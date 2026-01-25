import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugSeasons() {
    console.log('🔍 DIAGNÓSTICO DE TEMPORADAS\n');
    console.log('='.repeat(80));

    // Check seasons
    const { data: seasons } = await supabase
        .from('seasons')
        .select('*')
        .order('start_date', { ascending: true });

    console.log('\n📅 TEMPORADAS EN LA BASE DE DATOS:\n');
    seasons?.forEach(s => {
        const start = new Date(s.start_date).toLocaleDateString('es-ES');
        const end = s.end_date ? new Date(s.end_date).toLocaleDateString('es-ES') : 'Activa';
        console.log(`  ${s.is_active ? '✅' : '⭕'} ${s.name}`);
        console.log(`     Inicio: ${start} | Fin: ${end}`);
        console.log(`     ID: ${s.id}\n`);
    });

    // Check predictions by season
    console.log('='.repeat(80));
    console.log('\n📊 PREDICCIONES POR TEMPORADA:\n');

    for (const season of seasons || []) {
        const { data: preds } = await supabase
            .from('predictions')
            .select(`
        id,
        points,
        created_at,
        users (display_name)
      `)
            .eq('season_id', season.id)
            .order('created_at', { ascending: true });

        console.log(`\n${season.is_active ? '✅' : '⭕'} ${season.name}:`);
        console.log(`   Total predicciones: ${preds?.length || 0}`);

        if (preds && preds.length > 0) {
            const byUser: any = {};
            preds.forEach((p: any) => {
                const user = p.users?.display_name || 'Unknown';
                if (!byUser[user]) {
                    byUser[user] = { count: 0, points: 0 };
                }
                byUser[user].count++;
                byUser[user].points += p.points || 0;
            });

            Object.entries(byUser).forEach(([user, stats]: [string, any]) => {
                console.log(`   - ${user}: ${stats.points} pts (${stats.count} predicciones)`);
            });

            console.log(`\n   Primeras 3 predicciones:`);
            preds.slice(0, 3).forEach((p: any) => {
                const date = new Date(p.created_at).toLocaleDateString('es-ES');
                console.log(`   - ${date}: ${p.users?.display_name} → ${p.points || 0} pts`);
            });
        }
    }

    // Check standings view
    console.log('\n' + '='.repeat(80));
    console.log('\n🏆 VISTA DE CLASIFICACIÓN (standings):\n');

    const { data: standings } = await supabase
        .from('standings')
        .select('*')
        .order('total_points', { ascending: false });

    standings?.forEach((s, idx) => {
        console.log(`  ${idx + 1}. ${s.display_name}: ${s.total_points} pts (${s.correct_predictions}/${s.total_predictions})`);
    });

    // Check standings by season
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 VISTA POR TEMPORADA (standings_by_season):\n');

    const { data: seasonStandings } = await supabase
        .from('standings_by_season')
        .select('*')
        .order('season_id', { ascending: true })
        .order('total_points', { ascending: false });

    let currentSeasonId: string | null = null;
    seasonStandings?.forEach((s: any) => {
        if (s.season_id !== currentSeasonId) {
            console.log(`\n  ${s.is_active ? '✅' : '⭕'} ${s.season_name}:`);
            currentSeasonId = s.season_id;
        }
        if (s.total_predictions > 0) {
            console.log(`    ${s.display_name}: ${s.total_points} pts (${s.correct_predictions}/${s.total_predictions})`);
        }
    });

    console.log('\n');
}

debugSeasons()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Error:', error.message);
        process.exit(1);
    });
