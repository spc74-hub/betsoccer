import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function analyzeSeasons() {
    console.log('🔍 Analyzing Scoring System History\n');
    console.log('='.repeat(70));

    // Get all finished matches with their predictions
    const { data: matches } = await supabase
        .from('matches')
        .select(`
      id,
      home_team,
      away_team,
      home_score,
      away_score,
      home_score_halftime,
      away_score_halftime,
      kickoff_utc,
      status,
      predictions (
        id,
        user_id,
        home_score,
        away_score,
        home_score_halftime,
        away_score_halftime,
        points,
        points_winner,
        points_halftime,
        points_difference,
        points_exact,
        created_at,
        users (display_name)
      )
    `)
        .eq('status', 'FINISHED')
        .order('kickoff_utc', { ascending: true });

    if (!matches || matches.length === 0) {
        console.log('No finished matches found');
        return;
    }

    console.log(`\n📊 Total Finished Matches: ${matches.length}\n`);

    // Analyze which matches use the new scoring system
    // New system has points breakdown (points_winner, points_halftime, etc.)
    const matchesWithNewSystem = matches.filter(m =>
        m.predictions?.some((p: any) =>
            p.points_winner !== null || p.points_halftime !== null ||
            p.points_difference !== null || p.points_exact !== null
        )
    );

    const matchesWithOldSystem = matches.filter(m =>
        m.predictions?.every((p: any) =>
            p.points_winner === null && p.points_halftime === null &&
            p.points_difference === null && p.points_exact === null
        ) && m.predictions.length > 0
    );

    console.log('🎯 SCORING SYSTEM BREAKDOWN:\n');
    console.log(`  Old System (only exact match = +1): ${matchesWithOldSystem.length} matches`);
    console.log(`  New System (multi-tier scoring):    ${matchesWithNewSystem.length} matches`);
    console.log(`  No predictions:                     ${matches.length - matchesWithOldSystem.length - matchesWithNewSystem.length} matches\n`);

    // Find the transition date
    if (matchesWithNewSystem.length > 0) {
        const firstNewSystemMatch = matchesWithNewSystem[0];
        const lastOldSystemMatch = matchesWithOldSystem[matchesWithOldSystem.length - 1];

        console.log('📅 SYSTEM TRANSITION:\n');

        if (lastOldSystemMatch) {
            console.log(`  Last Old System Match:`);
            console.log(`    ${lastOldSystemMatch.home_team} vs ${lastOldSystemMatch.away_team}`);
            console.log(`    Date: ${new Date(lastOldSystemMatch.kickoff_utc).toLocaleDateString('es-ES')}`);
            console.log(``);
        }

        console.log(`  First New System Match:`);
        console.log(`    ${firstNewSystemMatch.home_team} vs ${firstNewSystemMatch.away_team}`);
        console.log(`    Date: ${new Date(firstNewSystemMatch.kickoff_utc).toLocaleDateString('es-ES')}\n`);
    }

    // Calculate points for each season
    console.log('='.repeat(70));
    console.log('\n🏆 PLAYER STANDINGS BY SEASON:\n');

    // Season 1 - Old System
    console.log('📍 SEASON 1 (Old System - Only Exact Match Points):\n');
    const season1Stats = calculateSeasonStats(matchesWithOldSystem);
    displayStandings(season1Stats);

    // Season 2 - New System
    console.log('\n📍 SEASON 2 (New System - Multi-tier Scoring):\n');
    const season2Stats = calculateSeasonStats(matchesWithNewSystem);
    displayStandings(season2Stats);

    // Overall
    console.log('\n📍 OVERALL (Both Seasons Combined):\n');
    const overallStats = calculateSeasonStats(matches);
    displayStandings(overallStats);

    // Detailed match breakdown
    console.log('\n' + '='.repeat(70));
    console.log('\n📋 DETAILED MATCH LIST:\n');

    console.log('SEASON 1 (Old System):');
    matchesWithOldSystem.slice(0, 10).forEach((m, i) => {
        console.log(`  ${i + 1}. ${new Date(m.kickoff_utc).toLocaleDateString('es-ES')}: ${m.home_team} vs ${m.away_team}`);
    });
    if (matchesWithOldSystem.length > 10) {
        console.log(`  ... and ${matchesWithOldSystem.length - 10} more matches\n`);
    }

    console.log('\nSEASON 2 (New System):');
    matchesWithNewSystem.slice(0, 10).forEach((m, i) => {
        console.log(`  ${i + 1}. ${new Date(m.kickoff_utc).toLocaleDateString('es-ES')}: ${m.home_team} vs ${m.away_team}`);
    });
    if (matchesWithNewSystem.length > 10) {
        console.log(`  ... and ${matchesWithNewSystem.length - 10} more matches\n`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n💡 RECOMMENDATION:\n');

    if (matchesWithOldSystem.length > 0 && matchesWithNewSystem.length > 0) {
        console.log('  ✅ You have matches in both scoring systems.');
        console.log(`  📊 Season 1: ${matchesWithOldSystem.length} matches`);
        console.log(`  📊 Season 2: ${matchesWithNewSystem.length} matches`);
        console.log('');
        console.log('  🎯 Suggested Action:');
        console.log('     Create separate seasons to track scores independently.');
        console.log('     This will give players a fresh start with the new scoring system.');
        console.log('');
        console.log(`     Transition date: ${new Date(matchesWithNewSystem[0].kickoff_utc).toLocaleDateString('es-ES')}`);
    } else if (matchesWithOldSystem.length === 0) {
        console.log('  ℹ️  All matches use the new scoring system.');
        console.log('     No need to split seasons.');
    } else {
        console.log('  ℹ️  All matches use the old scoring system.');
        console.log('     The new system hasn\'t been applied yet.');
    }

    console.log('\n');
}

function calculateSeasonStats(matches: any[]) {
    const userStats: { [key: string]: { name: string; points: number; predictions: number; correct: number } } = {};

    matches.forEach(match => {
        if (!match.predictions) return;

        match.predictions.forEach((pred: any) => {
            const userName = pred.users?.display_name || 'Unknown';

            if (!userStats[userName]) {
                userStats[userName] = {
                    name: userName,
                    points: 0,
                    predictions: 0,
                    correct: 0
                };
            }

            userStats[userName].predictions++;
            userStats[userName].points += pred.points || 0;

            if ((pred.points || 0) > 0) {
                userStats[userName].correct++;
            }
        });
    });

    return Object.values(userStats).sort((a, b) => b.points - a.points);
}

function displayStandings(stats: any[]) {
    if (stats.length === 0) {
        console.log('  No predictions found\n');
        return;
    }

    stats.forEach((user, i) => {
        const accuracy = user.predictions > 0
            ? ((user.correct / user.predictions) * 100).toFixed(1)
            : '0.0';

        console.log(`  ${i + 1}. ${user.name}`);
        console.log(`     Points: ${user.points} | Predictions: ${user.predictions} | Success: ${user.correct} (${accuracy}%)`);
    });
}

analyzeSeasons()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Error:', error.message);
        process.exit(1);
    });
