import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function showLastFiveMatches() {
    console.log('📊 DETALLE DE LOS 5 PARTIDOS CON PREDICCIONES\n');
    console.log('='.repeat(80));

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
        users (display_name)
      )
    `)
        .eq('status', 'FINISHED')
        .not('predictions', 'is', null)
        .order('kickoff_utc', { ascending: true });

    if (!matches || matches.length === 0) {
        console.log('No se encontraron partidos');
        return;
    }

    const matchesWithPreds = matches.filter(m => m.predictions && m.predictions.length > 0);

    matchesWithPreds.forEach((match, idx) => {
        const date = new Date(match.kickoff_utc).toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const hasHalftime = match.home_score_halftime !== null && match.away_score_halftime !== null;
        const htDisplay = hasHalftime
            ? `${match.home_score_halftime}-${match.away_score_halftime}`
            : 'SIN DATOS';

        console.log(`\n🏆 PARTIDO ${idx + 1}`);
        console.log(`📅 ${date}`);
        console.log(`⚽ ${match.home_team} vs ${match.away_team}`);
        console.log(`📊 Resultado Final: ${match.home_score}-${match.away_score}`);
        console.log(`⏱️  Resultado Descanso: ${htDisplay}`);
        console.log(`${hasHalftime ? '✅' : '❌'} ${hasHalftime ? 'CON datos halftime (sistema NUEVO)' : 'SIN datos halftime (sistema ANTIGUO)'}`);
        console.log('');
        console.log('-'.repeat(80));

        match.predictions?.forEach((pred: any) => {
            const user = pred.users?.display_name || 'Unknown';
            const predHT = pred.home_score_halftime !== null && pred.away_score_halftime !== null
                ? `${pred.home_score_halftime}-${pred.away_score_halftime}`
                : '0-0';

            console.log(`\n👤 ${user.toUpperCase()}`);
            console.log(`   Predicción FT: ${pred.home_score}-${pred.away_score}`);
            console.log(`   Predicción HT: ${predHT}`);
            console.log('');

            if (hasHalftime) {
                // Sistema NUEVO - Multi-tier
                console.log(`   SISTEMA NUEVO (multi-tier):`);
                console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`   +1 Ganador:          ${pred.points_winner || 0} ${pred.points_winner ? '✅' : '❌'}`);
                console.log(`   +2 Halftime:         ${pred.points_halftime || 0} ${pred.points_halftime ? '✅' : '❌'}`);
                console.log(`   +3 Diferencia:       ${pred.points_difference || 0} ${pred.points_difference ? '✅' : '❌'}`);
                console.log(`   +4 Exacto:           ${pred.points_exact || 0} ${pred.points_exact ? '✅' : '❌'}`);
                console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`   TOTAL (BD actual):   ${pred.points || 0} puntos`);
            } else {
                // Sistema ANTIGUO - Solo exacto
                const isExact = pred.home_score === match.home_score && pred.away_score === match.away_score;
                const oldSystemPoints = isExact ? 1 : 0;

                console.log(`   SISTEMA ANTIGUO (solo exacto):`);
                console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`   +1 Exacto:           ${oldSystemPoints} ${isExact ? '✅' : '❌'}`);
                console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`   TOTAL (sistema viejo): ${oldSystemPoints} puntos`);
                console.log(`   TOTAL (BD actual):     ${pred.points || 0} puntos (con sistema nuevo)`);
            }
        });

        console.log('\n' + '='.repeat(80));
    });

    // Summary
    console.log('\n\n📈 RESUMEN GLOBAL\n');
    console.log('='.repeat(80));

    const userTotals: any = {};

    matchesWithPreds.forEach(match => {
        const hasHalftime = match.home_score_halftime !== null && match.away_score_halftime !== null;

        match.predictions?.forEach((pred: any) => {
            const user = pred.users?.display_name || 'Unknown';

            if (!userTotals[user]) {
                userTotals[user] = {
                    oldSystem: 0,
                    newSystem: 0,
                    currentDB: 0,
                    matches: { old: 0, new: 0 }
                };
            }

            if (hasHalftime) {
                userTotals[user].newSystem += pred.points || 0;
                userTotals[user].matches.new++;
            } else {
                // Calcular con sistema antiguo
                const isExact = pred.home_score === match.home_score && pred.away_score === match.away_score;
                userTotals[user].oldSystem += isExact ? 1 : 0;
                userTotals[user].matches.old++;
            }

            userTotals[user].currentDB += pred.points || 0;
        });
    });

    console.log('\n🏅 PUNTOS POR SISTEMA:\n');

    Object.entries(userTotals).forEach(([user, totals]: [string, any]) => {
        console.log(`${user}:`);
        console.log(`  Partidos sistema ANTIGUO: ${totals.matches.old} partidos → ${totals.oldSystem} puntos`);
        console.log(`  Partidos sistema NUEVO:   ${totals.matches.new} partidos → ${totals.newSystem} puntos`);
        console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`  TOTAL si mezclamos:       ${totals.oldSystem + totals.newSystem} puntos`);
        console.log(`  TOTAL en BD (todo nuevo): ${totals.currentDB} puntos`);
        console.log('');
    });

    console.log('\n💡 NOTAS:\n');
    console.log('  - "Sistema ANTIGUO": Solo +1 por resultado exacto');
    console.log('  - "Sistema NUEVO": +1 ganador, +2 halftime, +3 diferencia, +4 exacto');
    console.log(`  - Tienes ${matchesWithPreds.filter(m => m.home_score_halftime === null).length} partidos SIN halftime`);
    console.log(`  - Tienes ${matchesWithPreds.filter(m => m.home_score_halftime !== null).length} partidos CON halftime`);
    console.log('\n');
}

showLastFiveMatches()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Error:', error.message);
        process.exit(1);
    });
