import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { fetchAllTrackedMatches } from '../src/lib/football-api';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function syncMatches() {
    console.log('🔄 SINCRONIZANDO PARTIDOS DESDE FOOTBALL API\n');
    console.log('='.repeat(80));

    try {
        // Fetch matches from external API
        console.log('\n📡 Obteniendo partidos de Football API...');
        const matches = await fetchAllTrackedMatches();
        console.log(`✅ Obtenidos ${matches.length} partidos de la API\n`);

        let created = 0;
        let updated = 0;
        let errors = 0;

        for (const match of matches) {
            // Check if match exists
            const { data: existing } = await supabase
                .from('matches')
                .select('id, status, home_score, away_score, home_score_halftime, away_score_halftime')
                .eq('external_id', match.external_id)
                .single();

            if (existing) {
                // Update if there are changes
                const needsUpdate =
                    existing.status !== match.status ||
                    existing.home_score !== match.home_score ||
                    existing.away_score !== match.away_score ||
                    existing.home_score_halftime !== match.home_score_halftime ||
                    existing.away_score_halftime !== match.away_score_halftime;

                if (needsUpdate) {
                    const wasScheduled = existing.status === 'SCHEDULED';
                    const isNowFinished = match.status === 'FINISHED';

                    const { error } = await supabase
                        .from('matches')
                        .update({
                            status: match.status,
                            home_score: match.home_score,
                            away_score: match.away_score,
                            home_score_halftime: match.home_score_halftime,
                            away_score_halftime: match.away_score_halftime,
                            kickoff_utc: match.kickoff_utc,
                            venue: match.venue,
                        })
                        .eq('id', existing.id);

                    if (error) {
                        console.error(`❌ Error actualizando: ${match.home_team} vs ${match.away_team}`);
                        console.error(`   ${error.message}`);
                        errors++;
                    } else {
                        updated++;

                        if (wasScheduled && isNowFinished) {
                            console.log(`✅ FINALIZADO: ${match.home_team} vs ${match.away_team}`);
                            console.log(`   Resultado: ${match.home_score}-${match.away_score}${match.home_score_halftime !== undefined ? ` (HT: ${match.home_score_halftime}-${match.away_score_halftime})` : ''}`);
                        }
                    }
                }
            } else {
                // Insert new match
                const { error } = await supabase.from('matches').insert({
                    external_id: match.external_id,
                    competition: match.competition,
                    competition_logo: match.competition_logo,
                    season: match.season,
                    home_team: match.home_team,
                    home_team_logo: match.home_team_logo,
                    away_team: match.away_team,
                    away_team_logo: match.away_team_logo,
                    kickoff_utc: match.kickoff_utc,
                    venue: match.venue,
                    status: match.status,
                    home_score: match.home_score,
                    away_score: match.away_score,
                    home_score_halftime: match.home_score_halftime,
                    away_score_halftime: match.away_score_halftime,
                });

                if (error) {
                    console.error(`❌ Error insertando: ${match.home_team} vs ${match.away_team}`);
                    errors++;
                } else {
                    created++;
                }
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('\n📊 RESUMEN DE SINCRONIZACIÓN:\n');
        console.log(`  Total partidos procesados: ${matches.length}`);
        console.log(`  ✅ Creados: ${created}`);
        console.log(`  🔄 Actualizados: ${updated}`);
        console.log(`  ❌ Errores: ${errors}\n`);

        if (updated > 0) {
            console.log('✨ Se actualizaron partidos. Los puntos se calcularán automáticamente por los triggers.\n');
        }

        return { success: true, created, updated, errors };
    } catch (error) {
        console.error('\n❌ ERROR DE SINCRONIZACIÓN:');
        console.error(error instanceof Error ? error.message : String(error));

        if (error instanceof Error && error.message.includes('football-data.org')) {
            console.log('\n💡 POSIBLES CAUSAS:');
            console.log('  - API key inválida o expirada');
            console.log('  - Límite de llamadas alcanzado (plan free: 10 calls/min)');
            console.log('  - Problema de conexión a internet');
            console.log('\n  Verifica tu FOOTBALL_DATA_KEY en .env.local');
        }

        return { success: false, error };
    }
}

// Run sync
syncMatches()
    .then(async (result) => {
        if (result.success) {
            console.log('='.repeat(80));
            console.log('\n🎯 VERIFICANDO PUNTOS ACTUALIZADOS...\n');

            // Show updated standings
            const { data: standings } = await supabase
                .from('standings')
                .select('*')
                .order('total_points', { ascending: false });

            if (standings && standings.length > 0) {
                console.log('🏆 CLASIFICACIÓN ACTUALIZADA:\n');
                standings.forEach((s, idx) => {
                    console.log(`  ${idx + 1}. ${s.display_name}: ${s.total_points} puntos (${s.correct_predictions}/${s.total_predictions} aciertos)`);
                });
                console.log('');
            }

            console.log('✅ Sincronización completada con éxito!\n');
            process.exit(0);
        } else {
            process.exit(1);
        }
    })
    .catch((error) => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });
