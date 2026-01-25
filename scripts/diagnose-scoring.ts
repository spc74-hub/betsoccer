import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnose() {
    console.log('🔍 BetSoccer Scoring System Diagnostic\n');
    console.log('='.repeat(60));

    // 1. Check if new columns exist by fetching a sample prediction
    console.log('\n📋 1. CHECKING NEW COLUMNS...');
    const { data: samplePred } = await supabase
        .from('predictions')
        .select('*')
        .limit(1)
        .single();

    if (samplePred) {
        const newColumns = ['home_score_halftime', 'away_score_halftime', 'points_winner', 'points_halftime', 'points_difference', 'points_exact'];
        const existingCols = newColumns.filter(col => col in samplePred);

        if (existingCols.length === 6) {
            console.log('   ✅ All 6 new columns exist!');
            console.log(`      ${existingCols.join(', ')}`);
        } else {
            console.log(`   ⚠️  Only ${existingCols.length}/6 columns found:`);
            console.log(`      Present: ${existingCols.join(', ')}`);
            console.log(`      ❌ Missing: ${newColumns.filter(c => !existingCols.includes(c)).join(', ')}`);
        }
    } else {
        console.log('   ⚠️  No predictions found in database');
    }

    // 2. Check finished matches
    console.log('\n📊 2. CHECKING FINISHED MATCHES...');
    const { count: totalFinished } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'FINISHED');

    const { count: withHalftime } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'FINISHED')
        .not('home_score_halftime', 'is', null);

    console.log(`   Total finished matches: ${totalFinished}`);
    console.log(`   With halftime data: ${withHalftime}`);
    console.log(`   Without halftime data: ${(totalFinished || 0) - (withHalftime || 0)}`);

    // 3. Check recent matches details
    console.log('\n🏆 3. RECENT FINISHED MATCHES...');
    const { data: recentMatches } = await supabase
        .from('matches')
        .select('home_team, away_team, home_score, away_score, home_score_halftime, away_score_halftime, kickoff_utc')
        .eq('status', 'FINISHED')
        .order('kickoff_utc', { ascending: false })
        .limit(5);

    if (recentMatches) {
        recentMatches.forEach((m, i) => {
            const ht = m.home_score_halftime !== null && m.away_score_halftime !== null
                ? `${m.home_score_halftime}-${m.away_score_halftime}`
                : 'NO DATA';
            console.log(`   ${i + 1}. ${m.home_team} vs ${m.away_team}`);
            console.log(`      FT: ${m.home_score}-${m.away_score} | HT: ${ht}`);
        });
    }

    // 4. Check predictions with points breakdown
    console.log('\n🎯 4. PREDICTIONS WITH POINTS...');

    // First get finished matches
    const { data: finishedMatches } = await supabase
        .from('matches')
        .select('id, home_team, away_team, home_score, away_score, home_score_halftime, away_score_halftime, kickoff_utc')
        .eq('status', 'FINISHED')
        .order('kickoff_utc', { ascending: false })
        .limit(10);

    if (finishedMatches && finishedMatches.length > 0) {
        const matchIds = finishedMatches.map(m => m.id);

        const { data: predictions } = await supabase
            .from('predictions')
            .select(`
        id,
        home_score,
        away_score,
        home_score_halftime,
        away_score_halftime,
        points,
        points_winner,
        points_halftime,
        points_difference,
        points_exact,
        user_id,
        match_id,
        users:user_id (display_name)
      `)
            .in('match_id', matchIds);

        if (predictions && predictions.length > 0) {
            console.log(`   Found ${predictions.length} predictions on ${finishedMatches.length} recent finished matches:\n`);

            predictions.forEach((p: any, i) => {
                const user = p.users?.display_name || 'Unknown';
                const match = finishedMatches.find(m => m.id === p.match_id);

                if (!match) return;

                const predFT = `${p.home_score}-${p.away_score}`;
                const predHT = p.home_score_halftime !== null ? `${p.home_score_halftime}-${p.away_score_halftime}` : 'NULL';
                const actualFT = `${match.home_score}-${match.away_score}`;
                const actualHT = match.home_score_halftime !== null && match.away_score_halftime !== null
                    ? `${match.home_score_halftime}-${match.away_score_halftime}`
                    : 'NULL';

                console.log(`   ${i + 1}. ${user} - ${match.home_team} vs ${match.away_team}`);
                console.log(`      Predicted: FT ${predFT} | HT ${predHT}`);
                console.log(`      Actual:    FT ${actualFT} | HT ${actualHT}`);
                console.log(`      Points: Winner=${p.points_winner || 0}, HT=${p.points_halftime || 0}, Diff=${p.points_difference || 0}, Exact=${p.points_exact || 0} → Total=${p.points || 0}`);
                console.log('');
            });
        } else {
            console.log('   ⚠️  No predictions found on finished matches');
        }
    } else {
        console.log('   ⚠️  No finished matches found');
    }

    // 5. Check standings
    console.log('\n🏅 5. CURRENT STANDINGS...');
    const { data: standings } = await supabase
        .from('users')
        .select(`
      display_name,
      predictions (points)
    `);

    if (standings) {
        const userPoints = standings.map((u: any) => ({
            name: u.display_name,
            total: u.predictions?.reduce((sum: number, p: any) => sum + (p.points || 0), 0) || 0,
            count: u.predictions?.length || 0,
            withPoints: u.predictions?.filter((p: any) => (p.points || 0) > 0).length || 0
        }));

        userPoints.sort((a, b) => b.total - a.total);

        userPoints.forEach((u, i) => {
            console.log(`   ${i + 1}. ${u.name}: ${u.total} points (${u.withPoints}/${u.count} predictions scored)`);
        });
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n📝 DIAGNOSTIC SUMMARY:\n');

    if ((withHalftime || 0) < (totalFinished || 0) * 0.9 && (totalFinished || 0) > 0) {
        console.log(`⚠️  CRITICAL ISSUE: ${(totalFinished || 0) - (withHalftime || 0)}/${totalFinished} finished matches have NO halftime data`);
        console.log('   → The API sync is NOT fetching halftime scores correctly');
        console.log('   → Players are getting 2 points for halftime when they predict 0-0');
        console.log('   → This is because NULL halftime in DB is converted to 0-0 by COALESCE');
        console.log('\n   🔧 FIXES NEEDED:');
        console.log('   1. Fix the points calculation trigger to NOT award halftime points when match halftime is NULL');
        console.log('   2. Fix the API sync to fetch halftime data');
        console.log('   3. Recalculate all points with the corrected trigger');
    } else {
        console.log('✅ Halftime data coverage looks good');
    }

    console.log('\n');
}

diagnose()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Error running diagnostic:', error.message);
        process.exit(1);
    });
