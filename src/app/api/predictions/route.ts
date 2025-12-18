import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get('match_id');
  const userId = searchParams.get('user_id');

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let query = supabase
    .from('predictions')
    .select('*, match:matches(*), user:users(id, display_name, avatar_url)')
    .order('created_at', { ascending: false });

  if (matchId) {
    query = query.eq('match_id', matchId);
  }

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { match_id, home_score, away_score } = body;

  if (!match_id || home_score === undefined || away_score === undefined) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  // Check if match is still open for predictions
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('kickoff_utc, status')
    .eq('id', match_id)
    .single();

  if (matchError || !match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  if (new Date(match.kickoff_utc) <= new Date()) {
    return NextResponse.json(
      { error: 'Predictions are closed for this match' },
      { status: 400 }
    );
  }

  // Upsert prediction
  const { data, error } = await supabase
    .from('predictions')
    .upsert(
      {
        user_id: user.id,
        match_id,
        home_score,
        away_score,
      },
      { onConflict: 'user_id,match_id' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const predictionId = searchParams.get('id');

  if (!predictionId) {
    return NextResponse.json(
      { error: 'Prediction ID required' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('predictions')
    .delete()
    .eq('id', predictionId)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
