import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixNullSeasonPredictions() {
    console.log('🔧 CORRIGIENDO PREDICCIONES SIN TEMPORADA\n');
    console.log('='.repeat(80));

    // Get active season
    const { data: activeSeason } = await supabase
        .from('seasons')
        .select('*')
        .eq('is_active', true)
        .single();

    if (!activeSeason) {
        console.error('❌ No se encontró temporada activa');
        return;
    }

    console.log(`\n✅ Temporada activa: ${activeSeason.name}`);
    console.log(`   ID: ${activeSeason.id}\n`);

    // Find all predictions with NULL season_id
    const { data: nullSeasonPredictions, error: fetchError } = await supabase
        .from('predictions')
        .select(`
            id,
            match_id,
            home_score,
            away_score,
            season_id,
            created_at,
            points,
            users!inner (display_name),
            matches!inner (
                home_team,
                away_team,
                kickoff_utc,
                status
            )
        `)
        .is('season_id', null);

    if (fetchError) {
        console.error('❌ Error al buscar predicciones:', fetchError);
        return;
    }

    console.log(`📊 Predicciones sin temporada asignada: ${nullSeasonPredictions?.length || 0}\n`);

    if (!nullSeasonPredictions || nullSeasonPredictions.length === 0) {
        console.log('✅ No hay predicciones sin temporada asignada');
        return;
    }

    console.log('='.repeat(80));
    console.log('\n📝 DETALLES DE LAS PREDICCIONES:\n');

    nullSeasonPredictions.forEach((p: any) => {
        const match = p.matches;
        const date = new Date(match.kickoff_utc);
        console.log(`👤 ${p.users.display_name}`);
        console.log(`   Partido: ${match.home_team} vs ${match.away_team}`);
        console.log(`   Fecha: ${date.toLocaleString('es-ES')}`);
        console.log(`   Predicción: ${p.home_score}-${p.away_score}`);
        console.log(`   Estado del partido: ${match.status}`);
        console.log(`   Puntos calculados: ${p.points ?? 'NULL'}`);
        console.log(`   Created: ${new Date(p.created_at).toLocaleString('es-ES')}\n`);
    });

    // Filter predictions created after the new season started
    const newSeasonStart = new Date(activeSeason.start_date);
    const predictionsToFix = nullSeasonPredictions.filter((p: any) =>
        new Date(p.created_at) >= newSeasonStart
    );

    console.log('='.repeat(80));
    console.log(`\n⚙️  ACCIÓN: Asignar temporada activa a ${predictionsToFix.length} predicciones\n`);

    if (predictionsToFix.length === 0) {
        console.log('ℹ️  No hay predicciones que corregir');
        return;
    }

    predictionsToFix.forEach((p: any) => {
        console.log(`  - ${p.users.display_name}: ${p.matches.home_team} vs ${p.matches.away_team}`);
    });

    const predictionIds = predictionsToFix.map((p: any) => p.id);

    console.log(`\n📝 Actualizando ${predictionIds.length} predicciones...\n`);

    const { error: updateError, count } = await supabase
        .from('predictions')
        .update({ season_id: activeSeason.id })
        .in('id', predictionIds);

    if (updateError) {
        console.error('❌ Error al actualizar predicciones:', updateError);
        return;
    }

    console.log(`✅ ${predictionIds.length} predicciones actualizadas exitosamente\n`);

    // Verify the fix
    console.log('='.repeat(80));
    console.log('\n✅ VERIFICACIÓN:\n');

    const { data: standings } = await supabase
        .from('standings')
        .select('*')
        .order('total_points', { ascending: false });

    console.log('🏆 Nueva clasificación:\n');
    standings?.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.display_name}: ${s.total_points} pts (${s.correct_predictions}/${s.total_predictions})`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n🎉 CORRECCIÓN COMPLETADA\n');
    console.log('  Las predicciones ahora están asignadas a la temporada correcta');
    console.log('  Los puntos deberían reflejarse en la clasificación\n');
}

fixNullSeasonPredictions()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Error:', error.message);
        process.exit(1);
    });
