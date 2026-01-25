import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAllMatches() {
    console.log('📊 ESTADO DE TODOS LOS PARTIDOS\n');
    console.log('='.repeat(80));

    // Get ALL matches that have predictions
    const { data: predictions } = await supabase
        .from('predictions')
        .select(`
      id,
      match_id,
      users (display_name)
    `);

    const matchIds = [...new Set(predictions?.map(p => p.match_id) || [])];

    const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .in('id', matchIds)
        .order('kickoff_utc', { ascending: true });

    if (!matches) {
        console.log('No matches found');
        return;
    }

    const finished = matches.filter(m => m.status === 'FINISHED');
    const live = matches.filter(m => m.status === 'LIVE');
    const scheduled = matches.filter(m => m.status === 'SCHEDULED');

    console.log(`\n📈 RESUMEN:`);
    console.log(`  Total partidos con predicciones: ${matches.length}`);
    console.log(`  ✅ Finalizados: ${finished.length}`);
    console.log(`  🔴 En vivo: ${live.length}`);
    console.log(`  ⏰ Programados: ${scheduled.length}\n`);

    console.log('='.repeat(80));
    console.log('\n✅ PARTIDOS FINALIZADOS:\n');

    finished.forEach((m, idx) => {
        const date = new Date(m.kickoff_utc).toLocaleDateString('es-ES');
        const hasHT = m.home_score_halftime !== null;
        console.log(`${idx + 1}. ${date}: ${m.home_team} vs ${m.away_team}`);
        console.log(`   Resultado: ${m.home_score}-${m.away_score}${hasHT ? ` (HT: ${m.home_score_halftime}-${m.away_score_halftime})` : ''}`);
    });

    if (live.length > 0) {
        console.log('\n' + '='.repeat(80));
        console.log('\n🔴 PARTIDOS EN VIVO:\n');

        live.forEach((m, idx) => {
            const date = new Date(m.kickoff_utc).toLocaleDateString('es-ES');
            console.log(`${idx + 1}. ${date}: ${m.home_team} vs ${m.away_team}`);
            console.log(`   Marcador actual: ${m.home_score || 0}-${m.away_score || 0}`);
        });
    }

    if (scheduled.length > 0) {
        console.log('\n' + '='.repeat(80));
        console.log('\n⏰ PARTIDOS PROGRAMADOS/PENDIENTES:\n');

        scheduled.forEach((m, idx) => {
            const date = new Date(m.kickoff_utc).toLocaleString('es-ES');
            const now = new Date();
            const matchDate = new Date(m.kickoff_utc);
            const isPast = matchDate < now;

            console.log(`${idx + 1}. ${date}: ${m.home_team} vs ${m.away_team}`);
            console.log(`   Estado: ${m.status}${isPast ? ' ⚠️  (ya pasó, necesita sync)' : ''}`);
        });
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n💡 NOTA:\n');
    console.log('  Los 5 partidos finalizados son los que ya analicé.');
    console.log('  Los demás están programados o necesitan sincronización.\n');
}

checkAllMatches()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Error:', error.message);
        process.exit(1);
    });
