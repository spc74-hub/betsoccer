import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function splitByHalftime() {
    console.log('🔍 Season Split Analysis Based on Halftime Data\n');
    console.log('='.repeat(75));

    // Get all finished matches with predictions
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
        users (display_name)
      )
    `)
        .eq('status', 'FINISHED')
        .order('kickoff_utc', { ascending: true });

    if (!matches || matches.length === 0) {
        console.log('No finished matches found');
        return;
    }

    // Filter matches with predictions
    const matchesWithPredictions = matches.filter(m => m.predictions && m.predictions.length > 0);

    // Split by halftime data
    const season1Matches = matchesWithPredictions.filter(m =>
        m.home_score_halftime === null || m.away_score_halftime === null
    );

    const season2Matches = matchesWithPredictions.filter(m =>
        m.home_score_halftime !== null && m.away_score_halftime !== null
    );

    console.log(`\n📊 SEASON SPLIT SUMMARY:\n`);
    console.log(`  Total finished matches with predictions: ${matchesWithPredictions.length}`);
    console.log(`  Season 1 (NO halftime data):  ${season1Matches.length} matches`);
    console.log(`  Season 2 (WITH halftime data): ${season2Matches.length} matches\n`);

    if (season2Matches.length > 0) {
        console.log(`📅 TRANSITION POINT:\n`);
        const lastSeason1 = season1Matches[season1Matches.length - 1];
        const firstSeason2 = season2Matches[0];

        if (lastSeason1) {
            console.log(`  Last Season 1 Match:`);
            console.log(`    ${new Date(lastSeason1.kickoff_utc).toLocaleDateString('es-ES')}: ${lastSeason1.home_team} vs ${lastSeason1.away_team}`);
            console.log(`    Result: ${lastSeason1.home_score}-${lastSeason1.away_score}\n`);
        }

        console.log(`  First Season 2 Match:`);
        console.log(`    ${new Date(firstSeason2.kickoff_utc).toLocaleDateString('es-ES')}: ${firstSeason2.home_team} vs ${firstSeason2.away_team}`);
        console.log(`    Result: ${firstSeason2.home_score}-${firstSeason2.away_score} (HT: ${firstSeason2.home_score_halftime}-${firstSeason2.away_score_halftime})\n`);
    }

    console.log('='.repeat(75));
    console.log('\n🏆 SEASON 1 POINTS (Old System: Only +1 for Exact Match)\n');

    const season1Stats = calculateOldSystemPoints(season1Matches);
    displaySeasonStats(season1Stats, 'Season 1');

    console.log('\n' + '='.repeat(75));
    console.log('\n🏆 SEASON 2 POINTS (New System: Multi-tier Scoring)\n');

    const season2Stats = calculateNewSystemPoints(season2Matches);
    displaySeasonStats(season2Stats, 'Season 2');

    console.log('\n' + '='.repeat(75));
    console.log('\n📊 COMPARISON:\n');

    const allUsers = new Set([...Object.keys(season1Stats), ...Object.keys(season2Stats)]);

    console.log('  User                 | S1 Points | S2 Points | Total | Change');
    console.log('  ' + '-'.repeat(71));

    allUsers.forEach(user => {
        const s1 = season1Stats[user]?.points || 0;
        const s2 = season2Stats[user]?.points || 0;
        const total = s1 + s2;
        const change = s2 - s1;
        const changeStr = change > 0 ? `+${change}` : change.toString();

        console.log(`  ${user.padEnd(20)} | ${s1.toString().padStart(9)} | ${s2.toString().padStart(9)} | ${total.toString().padStart(5)} | ${changeStr}`);
    });

    console.log('\n' + '='.repeat(75));
    console.log('\n📋 DETAILED MATCH BREAKDOWN:\n');

    console.log('SEASON 1 (Old System - Only Exact Match):\n');
    season1Matches.forEach((m, i) => {
        console.log(`${i + 1}. ${new Date(m.kickoff_utc).toLocaleDateString('es-ES')}: ${m.home_team} vs ${m.away_team}`);
        console.log(`   Result: ${m.home_score}-${m.away_score} (HT: NO DATA)`);

        m.predictions?.forEach((p: any) => {
            const isExact = p.home_score === m.home_score && p.away_score === m.away_score;
            const oldPoints = isExact ? 1 : 0;
            console.log(`   - ${p.users?.display_name}: Predicted ${p.home_score}-${p.away_score} → ${oldPoints} pt${oldPoints !== 1 ? 's' : ''} ${isExact ? '✅' : ''}`);
        });
        console.log('');
    });

    console.log('\nSEASON 2 (New System - Multi-tier):\n');
    season2Matches.forEach((m, i) => {
        console.log(`${i + 1}. ${new Date(m.kickoff_utc).toLocaleDateString('es-ES')}: ${m.home_team} vs ${m.away_team}`);
        console.log(`   Result: ${m.home_score}-${m.away_score} (HT: ${m.home_score_halftime}-${m.away_score_halftime})`);

        m.predictions?.forEach((p: any) => {
            const breakdown = calculateNewSystemPointsForPrediction(p, m);
            console.log(`   - ${p.users?.display_name}: Predicted ${p.home_score}-${p.away_score} (HT: ${p.home_score_halftime || 0}-${p.away_score_halftime || 0})`);
            console.log(`     Points: ${breakdown.total} (W:${breakdown.winner}, HT:${breakdown.halftime}, D:${breakdown.difference}, E:${breakdown.exact})`);
        });
        console.log('');
    });

    console.log('='.repeat(75));
    console.log('\n💡 SUMMARY:\n');
    console.log(`  This analysis splits your ${matchesWithPredictions.length} matches into two seasons:`);
    console.log(`  - Season 1: ${season1Matches.length} matches WITHOUT halftime data (old scoring)`);
    console.log(`  - Season 2: ${season2Matches.length} matches WITH halftime data (new scoring)`);
    console.log('');
    console.log('  You can import Season 1 points as a starting balance for the new season.');
    console.log('\n');
}

function calculateOldSystemPoints(matches: any[]) {
    const stats: any = {};

    matches.forEach(match => {
        match.predictions?.forEach((pred: any) => {
            const user = pred.users?.display_name || 'Unknown';

            if (!stats[user]) {
                stats[user] = { points: 0, predictions: 0, exact: 0 };
            }

            stats[user].predictions++;

            // Old system: only +1 for exact match
            if (pred.home_score === match.home_score && pred.away_score === match.away_score) {
                stats[user].points += 1;
                stats[user].exact++;
            }
        });
    });

    return stats;
}

function calculateNewSystemPoints(matches: any[]) {
    const stats: any = {};

    matches.forEach(match => {
        match.predictions?.forEach((pred: any) => {
            const user = pred.users?.display_name || 'Unknown';

            if (!stats[user]) {
                stats[user] = { points: 0, predictions: 0, breakdown: { winner: 0, halftime: 0, difference: 0, exact: 0 } };
            }

            stats[user].predictions++;

            const breakdown = calculateNewSystemPointsForPrediction(pred, match);
            stats[user].points += breakdown.total;
            stats[user].breakdown.winner += breakdown.winner;
            stats[user].breakdown.halftime += breakdown.halftime;
            stats[user].breakdown.difference += breakdown.difference;
            stats[user].breakdown.exact += breakdown.exact;
        });
    });

    return stats;
}

function calculateNewSystemPointsForPrediction(pred: any, match: any) {
    let winner = 0, halftime = 0, difference = 0, exact = 0;

    const predResult = Math.sign(pred.home_score - pred.away_score);
    const matchResult = Math.sign(match.home_score - match.away_score);

    // +1 for correct winner
    if (predResult === matchResult) {
        winner = 1;
    }

    // +2 for correct halftime (only if match has halftime data)
    if (match.home_score_halftime !== null && match.away_score_halftime !== null) {
        const predHT_home = pred.home_score_halftime || 0;
        const predHT_away = pred.away_score_halftime || 0;
        if (predHT_home === match.home_score_halftime && predHT_away === match.away_score_halftime) {
            halftime = 2;
        }
    }

    // +3 for correct goal difference
    const predDiff = pred.home_score - pred.away_score;
    const matchDiff = match.home_score - match.away_score;
    if (predDiff === matchDiff) {
        difference = 3;
    }

    // +4 for exact result
    if (pred.home_score === match.home_score && pred.away_score === match.away_score) {
        exact = 4;
    }

    return {
        winner,
        halftime,
        difference,
        exact,
        total: winner + halftime + difference + exact
    };
}

function displaySeasonStats(stats: any, seasonName: string) {
    const sorted = Object.entries(stats).sort((a: any, b: any) => b[1].points - a[1].points);

    if (sorted.length === 0) {
        console.log('  No predictions found\n');
        return;
    }

    sorted.forEach(([user, data]: [string, any], i) => {
        console.log(`  ${i + 1}. ${user}`);
        console.log(`     Total Points: ${data.points}`);
        console.log(`     Predictions: ${data.predictions}`);

        if (data.breakdown) {
            console.log(`     Breakdown: Winner=${data.breakdown.winner}, HT=${data.breakdown.halftime}, Diff=${data.breakdown.difference}, Exact=${data.breakdown.exact}`);
        } else if (data.exact !== undefined) {
            console.log(`     Exact Matches: ${data.exact}`);
        }
        console.log('');
    });
}

splitByHalftime()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Error:', error.message);
        process.exit(1);
    });
