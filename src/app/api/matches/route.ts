import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status'); // upcoming, finished, all
  const team = searchParams.get('team'); // real-madrid, barcelona, all

  const supabase = await createClient();

  let query = supabase
    .from('matches')
    .select('*')
    .order('kickoff_utc', { ascending: true });

  // Filter by status
  if (status === 'upcoming') {
    query = query.in('status', ['SCHEDULED', 'LIVE']);
  } else if (status === 'finished') {
    query = query.eq('status', 'FINISHED');
  }

  // Filter by team
  if (team === 'real-madrid') {
    query = query.or('home_team.ilike.%Real Madrid%,away_team.ilike.%Real Madrid%');
  } else if (team === 'barcelona') {
    query = query.or('home_team.ilike.%Barcelona%,away_team.ilike.%Barcelona%');
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
