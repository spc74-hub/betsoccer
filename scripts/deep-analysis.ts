import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deepAnalysis() {
    console.log('🔎 Deep Analysis of Database History\n');
    console.log('='.repeat(70));

    // Check all predictions regardless of match status
    const { data: allPredictions, error } = await supabase
        .from('predictions')
        .select(`
      *,
      users (display_name),
      matches (
        home_team,
        away_team,
        kickoff_utc,
        status,
        home_score,
        away_score
      )
    `)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`\n📊 TOTAL PREDICTIONS IN DATABASE: ${allPredictions?.length || 0}\n`);

    if (!allPredictions || allPredictions.length === 0) {
        console.log('No predictions found in database');
        return;
    }

    // Group by scoring system
    const oldSystemPreds = allPredictions.filter(p =>
        p.points_winner === null && p.points_halftime === null &&
        p.points_difference === null && p.points_exact === null
    );

    const newSystemPreds = allPredictions.filter(p =>
        p.points_winner !== null || p.points_halftime !== null ||
        p.points_difference !== null || p.points_exact !== null
    );

    console.log('🎯 BY SCORING SYSTEM:\n');
    console.log(`  Old System (columns are NULL): ${oldSystemPreds.length} predictions`);
    console.log(`  New System (has breakdown):    ${newSystemPreds.length} predictions\n`);

    // Find first and last predictions
    const firstPred = allPredictions[0];
    const lastPred = allPredictions[allPredictions.length - 1];

    console.log('📅 PREDICTION TIMELINE:\n');
    console.log(`  First Prediction Ever:`);
    console.log(`    Date: ${new Date(firstPred.created_at).toLocaleString('es-ES')}`);
    console.log(`    User: ${firstPred.users?.display_name}`);
    console.log(`    Match: ${firstPred.matches?.home_team} vs ${firstPred.matches?.away_team}`);
    console.log(`    Has breakdown: ${firstPred.points_winner !== null ? 'YES (new system)' : 'NO (old system)'}\n`);

    console.log(`  Last Prediction Ever:`);
    console.log(`    Date: ${new Date(lastPred.created_at).toLocaleString('es-ES')}`);
    console.log(`    User: ${lastPred.users?.display_name}`);
    console.log(`    Match: ${lastPred.matches?.home_team} vs ${lastPred.matches?.away_team}`);
    console.log(`    Has breakdown: ${lastPred.points_winner !== null ? 'YES (new system)' : 'NO (old system)'}\n`);

    // If there are predictions with old system
    if (oldSystemPreds.length > 0) {
        const lastOld = oldSystemPreds[oldSystemPreds.length - 1];
        console.log(`  Last Old System Prediction:`);
        console.log(`    Date: ${new Date(lastOld.created_at).toLocaleString('es-ES')}`);
        console.log(`    User: ${lastOld.users?.display_name}`);
        console.log(`    Match: ${lastOld.matches?.home_team} vs ${lastOld.matches?.away_team}\n`);
    }

    // If there are predictions with new system
    if (newSystemPreds.length > 0) {
        const firstNew = newSystemPreds[0];
        console.log(`  First New System Prediction:`);
        console.log(`    Date: ${new Date(firstNew.created_at).toLocaleString('es-ES')}`);
        console.log(`    User: ${firstNew.users?.display_name}`);
        console.log(`    Match: ${firstNew.matches?.home_team} vs ${firstNew.matches?.away_team}\n`);
    }

    // Check matches table
    console.log('='.repeat(70));
    console.log('\n📋 MATCHES TABLE ANALYSIS:\n');

    const { data: allMatches } = await supabase
        .from('matches')
        .select('*')
        .order('kickoff_utc', { ascending: true });

    if (allMatches) {
        console.log(`  Total matches in DB: ${allMatches.length}`);
        console.log(`  Finished: ${allMatches.filter(m => m.status === 'FINISHED').length}`);
        console.log(`  Scheduled: ${allMatches.filter(m => m.status === 'SCHEDULED').length}`);
        console.log(`  Live: ${allMatches.filter(m => m.status === 'LIVE').length}\n`);

        if (allMatches.length > 0) {
            console.log(`  First match: ${new Date(allMatches[0].kickoff_utc).toLocaleDateString('es-ES')}`);
            console.log(`  Last match: ${new Date(allMatches[allMatches.length - 1].kickoff_utc).toLocaleDateString('es-ES')}\n`);
        }
    }

    // Calculate stats for each system
    console.log('='.repeat(70));
    console.log('\n💰 POINTS ANALYSIS:\n');

    const userStatsOld: any = {};
    const userStatsNew: any = {};

    oldSystemPreds.forEach(p => {
        const user = p.users?.display_name || 'Unknown';
        if (!userStatsOld[user]) {
            userStatsOld[user] = { points: 0, predictions: 0 };
        }
        userStatsOld[user].points += p.points || 0;
        userStatsOld[user].predictions++;
    });

    newSystemPreds.forEach(p => {
        const user = p.users?.display_name || 'Unknown';
        if (!userStatsNew[user]) {
            userStatsNew[user] = { points: 0, predictions: 0 };
        }
        userStatsNew[user].points += p.points || 0;
        userStatsNew[user].predictions++;
    });

    if (Object.keys(userStatsOld).length > 0) {
        console.log('OLD SYSTEM POINTS:');
        Object.entries(userStatsOld).forEach(([user, stats]: [string, any]) => {
            console.log(`  ${user}: ${stats.points} points (${stats.predictions} predictions)`);
        });
        console.log('');
    }

    if (Object.keys(userStatsNew).length > 0) {
        console.log('NEW SYSTEM POINTS:');
        Object.entries(userStatsNew).forEach(([user, stats]: [string, any]) => {
            console.log(`  ${user}: ${stats.points} points (${stats.predictions} predictions)`);
        });
        console.log('');
    }

    // Detailed breakdown of first 20 predictions
    console.log('='.repeat(70));
    console.log('\n📝 FIRST 20 PREDICTIONS (Chronological):\n');

    allPredictions.slice(0, 20).forEach((p, i) => {
        const match = p.matches;
        const system = p.points_winner !== null ? 'NEW' : 'OLD';
        console.log(`${i + 1}. [${system}] ${new Date(p.created_at).toLocaleDateString('es-ES')} - ${p.users?.display_name}`);
        console.log(`   ${match?.home_team} vs ${match?.away_team}`);
        console.log(`   Prediction: ${p.home_score}-${p.away_score} (HT: ${p.home_score_halftime || 0}-${p.away_score_halftime || 0})`);
        if (p.matches?.status === 'FINISHED') {
            console.log(`   Result: ${match.home_score}-${match.away_score}`);
            console.log(`   Points: ${p.points || 0} (W:${p.points_winner || 0}, HT:${p.points_halftime || 0}, D:${p.points_difference || 0}, E:${p.points_exact || 0})`);
        }
        console.log('');
    });

    console.log('\n');
}

deepAnalysis()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Error:', error.message);
        process.exit(1);
    });
