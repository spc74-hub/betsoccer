import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { fetchAllTrackedMatches } from '@/lib/football-api';
import { NextResponse } from 'next/server';

// Use service role for sync operations
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Verify sync secret (for cron jobs)
function verifySecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.SYNC_API_SECRET;

  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}

// Verify authenticated user (for manual sync from app)
async function verifyUser(): Promise<boolean> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return !!user;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  // Allow either secret (cron) or authenticated user (manual)
  const hasSecret = verifySecret(request);
  const hasUser = await verifyUser();

  if (!hasSecret && !hasUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getServiceClient();
    const matches = await fetchAllTrackedMatches();

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const match of matches) {
      // Check if match exists
      const { data: existing } = await supabase
        .from('matches')
        .select('id, status, home_score, away_score')
        .eq('external_id', match.external_id)
        .single();

      if (existing) {
        // Update if there are changes
        const needsUpdate =
          existing.status !== match.status ||
          existing.home_score !== match.home_score ||
          existing.away_score !== match.away_score;

        if (needsUpdate) {
          const { error } = await supabase
            .from('matches')
            .update({
              status: match.status,
              home_score: match.home_score,
              away_score: match.away_score,
              kickoff_utc: match.kickoff_utc,
              venue: match.venue,
            })
            .eq('id', existing.id);

          if (error) {
            console.error('Update error:', error);
            errors++;
          } else {
            updated++;
          }
        }
      } else {
        // Insert new match
        const { error } = await supabase.from('matches').insert({
          external_id: match.external_id,
          competition: match.competition,
          competition_logo: match.competition_logo,
          season: match.season,
          home_team: match.home_team,
          home_team_logo: match.home_team_logo,
          away_team: match.away_team,
          away_team_logo: match.away_team_logo,
          kickoff_utc: match.kickoff_utc,
          venue: match.venue,
          status: match.status,
          home_score: match.home_score,
          away_score: match.away_score,
        });

        if (error) {
          console.error('Insert error:', error);
          errors++;
        } else {
          created++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        total: matches.length,
        created,
        updated,
        errors,
      },
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

// GET for health check / manual trigger info
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/sync',
    method: 'POST',
    auth: 'Bearer token required',
    description: 'Syncs matches from API-Football to database',
  });
}
