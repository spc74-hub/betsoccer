import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnose() {
    // 1. Active season
    const { data: season } = await supabase.from('seasons').select('*').eq('is_active', true).single();
    console.log('=== TEMPORADA ACTIVA ===');
    console.log(JSON.stringify(season, null, 2));

    // 2. All seasons
    const { data: allSeasons } = await supabase.from('seasons').select('*').order('start_date', { ascending: false });
    console.log('\n=== TODAS LAS TEMPORADAS ===');
    allSeasons?.forEach(s => console.log(`  ${s.is_active ? '✅' : '⭕'} ${s.name} (ID: ${s.id})`));

    // 3. Recent finished matches
    const { data: recentMatches } = await supabase
        .from('matches')
        .select('id, home_team, away_team, kickoff_utc, status, home_score, away_score')
        .eq('status', 'FINISHED')
        .order('kickoff_utc', { ascending: false })
        .limit(10);

    console.log('\n=== ÚLTIMOS PARTIDOS FINALIZADOS ===');
    recentMatches?.forEach(m => {
        const date = new Date(m.kickoff_utc).toLocaleDateString('es-ES');
        console.log(`  ${date} | ${m.home_team} ${m.home_score}-${m.away_score} ${m.away_team} | ID: ${m.id}`);
    });

    // 4. Predictions with NULL season_id
    const { data: nullPreds } = await supabase
        .from('predictions')
        .select('id, user_id, match_id, season_id, points, created_at, users!inner(display_name), matches!inner(home_team, away_team, kickoff_utc, status)')
        .is('season_id', null);

    console.log(`\n=== PREDICCIONES CON season_id = NULL: ${nullPreds?.length || 0} ===`);
    (nullPreds || []).forEach((p: any) => {
        const date = new Date(p.matches.kickoff_utc).toLocaleDateString('es-ES');
        console.log(`  ${p.users.display_name} | ${p.matches.home_team} vs ${p.matches.away_team} (${date}) | pts: ${p.points ?? 'NULL'} | status: ${p.matches.status}`);
    });

    // 5. Predictions with wrong season_id (not active season)
    if (season) {
        const { data: wrongSeasonPreds } = await supabase
            .from('predictions')
            .select('id, user_id, match_id, season_id, points, created_at, users!inner(display_name), matches!inner(home_team, away_team, kickoff_utc, status)')
            .neq('season_id', season.id)
            .gt('created_at', season.start_date);

        console.log(`\n=== PREDICCIONES CREADAS DESPUÉS DE LA TEMPORADA ACTIVA PERO CON OTRA SEASON_ID: ${wrongSeasonPreds?.length || 0} ===`);
        (wrongSeasonPreds || []).forEach((p: any) => {
            const date = new Date(p.matches.kickoff_utc).toLocaleDateString('es-ES');
            console.log(`  ${p.users.display_name} | ${p.matches.home_team} vs ${p.matches.away_team} (${date}) | season_id: ${p.season_id} | pts: ${p.points ?? 'NULL'} | created: ${new Date(p.created_at).toLocaleString('es-ES')}`);
        });
    }

    // 6. All predictions for recent finished matches
    const recentMatchIds = recentMatches?.map(m => m.id) || [];
    const { data: recentPreds } = await supabase
        .from('predictions')
        .select('id, match_id, season_id, points, points_winner, points_halftime, points_difference, points_exact, created_at, users!inner(display_name), matches!inner(home_team, away_team, kickoff_utc)')
        .in('match_id', recentMatchIds)
        .order('created_at', { ascending: true });

    console.log(`\n=== PREDICCIONES DE ÚLTIMOS PARTIDOS FINALIZADOS ===`);
    (recentPreds || []).forEach((p: any) => {
        const date = new Date(p.matches.kickoff_utc).toLocaleDateString('es-ES');
        const isActiveSeason = p.season_id === season?.id;
        const seasonLabel = p.season_id === null ? '❌ NULL' : isActiveSeason ? '✅ Activa' : `⚠️ Otra (${p.season_id?.substring(0, 8)})`;
        console.log(`  ${p.users.display_name} | ${p.matches.home_team} vs ${p.matches.away_team} (${date}) | pts: ${p.points ?? 'NULL'} [${p.points_winner}+${p.points_halftime}+${p.points_difference}+${p.points_exact}] | season: ${seasonLabel}`);
    });

    // 7. Current standings
    const { data: standings } = await supabase.from('standings').select('*').order('total_points', { ascending: false });
    console.log('\n=== CLASIFICACIÓN ACTUAL (vista standings) ===');
    standings?.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.display_name}: ${s.total_points} pts (${s.correct_predictions}/${s.total_predictions})`);
    });
}

diagnose()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error:', error.message);
        process.exit(1);
    });
