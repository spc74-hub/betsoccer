import { fetchCompetitionMatches, fetchCompetitionStandings, COMPETITION_IDS } from '@/lib/football-api';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const division = searchParams.get('division') || 'primera';
  const type = searchParams.get('type') || 'matches'; // 'matches' or 'standings'

  const competitionId = division === 'segunda' ? COMPETITION_IDS.SEGUNDA : COMPETITION_IDS.LA_LIGA;

  try {
    if (type === 'standings') {
      const standings = await fetchCompetitionStandings(competitionId);
      return NextResponse.json({ standings });
    } else {
      const matches = await fetchCompetitionMatches(competitionId);
      return NextResponse.json({ matches });
    }
  } catch (error) {
    console.error('LaLiga API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
