import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function calculateProgression() {
    console.log('📊 CÁLCULO DE PROGRESIÓN DE PUNTOS\n');
    console.log('='.repeat(80));

    // Get the 5 matches with predictions (ordered by date)
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
        console.log('No matches found');
        return;
    }

    const matchesWithPreds = matches.filter(m => m.predictions && m.predictions.length > 0);

    console.log(`\nPARTIDOS ANALIZADOS: ${matchesWithPreds.length}\n`);
    console.log('Puntos iniciales: sergio 3 pts, Salvador 3 pts\n');
    console.log('='.repeat(80));

    // Track running totals
    const totals: any = {
        'sergio.porcar': { points: 3, history: [] },
        'Salvador Serrano': { points: 3, history: [] }
    };

    matchesWithPreds.forEach((match, idx) => {
        const date = new Date(match.kickoff_utc).toLocaleDateString('es-ES');
        const hasHT = match.home_score_halftime !== null && match.away_score_halftime !== null;
        const htDisplay = hasHT ? `${match.home_score_halftime}-${match.away_score_halftime}` : 'N/A';

        console.log(`\n📅 PARTIDO ${idx + 1}: ${date}`);
        console.log(`⚽ ${match.home_team} vs ${match.away_team}`);
        console.log(`📊 Resultado: ${match.home_score}-${match.away_score} (HT: ${htDisplay})`);
        console.log(`${hasHT ? '✅' : '❌'} ${hasHT ? 'CON halftime' : 'SIN halftime'}\n`);

        match.predictions?.forEach((pred: any) => {
            const user = pred.users?.display_name || 'Unknown';
            const pts = pred.points || 0;

            console.log(`👤 ${user}:`);
            console.log(`   Predicción: ${pred.home_score}-${pred.away_score} (HT: ${pred.home_score_halftime || 0}-${pred.away_score_halftime || 0})`);
            console.log(`   Puntos obtenidos: ${pts}`);

            if (pts > 0) {
                const breakdown = [];
                if (pred.points_winner) breakdown.push(`Ganador +${pred.points_winner}`);
                if (pred.points_halftime) breakdown.push(`HT +${pred.points_halftime}`);
                if (pred.points_difference) breakdown.push(`Dif +${pred.points_difference}`);
                if (pred.points_exact) breakdown.push(`Exacto +${pred.points_exact}`);
                console.log(`   Desglose: ${breakdown.join(', ')}`);
            }

            // Update totals
            if (totals[user]) {
                totals[user].points += pts;
                totals[user].history.push({
                    match: `${match.home_team} vs ${match.away_team}`,
                    date,
                    points: pts,
                    total: totals[user].points
                });
                console.log(`   Total acumulado: ${totals[user].points} pts`);
            }
            console.log('');
        });

        console.log('-'.repeat(80));
    });

    // Summary
    console.log('\n\n📈 RESUMEN FINAL\n');
    console.log('='.repeat(80));
    console.log('\nPUNTOS INICIALES: 3-3');
    console.log('');

    Object.entries(totals).forEach(([user, data]: [string, any]) => {
        console.log(`${user}:`);
        console.log(`  Inicial: 3 pts`);

        let matchNum = 1;
        data.history.forEach((h: any) => {
            console.log(`  Partido ${matchNum}: +${h.points} → ${h.total} pts`);
            matchNum++;
        });

        console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`  FINAL: ${data.points} pts`);
        console.log('');
    });

    // Calculate gain from last 5
    console.log('='.repeat(80));
    console.log('\n💰 GANANCIA EN LOS ÚLTIMOS 5 PARTIDOS:\n');

    Object.entries(totals).forEach(([user, data]: [string, any]) => {
        const gained = data.points - 3;
        console.log(`${user}: +${gained} puntos (3 → ${data.points})`);
    });

    console.log('\n');
}

calculateProgression()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Error:', error.message);
        process.exit(1);
    });
