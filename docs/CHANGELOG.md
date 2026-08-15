# Changelog

## 2026-08-15 (3)
- **feat(stats):** nueva pagina `/stats` con estadisticas de la liga de apuestas alimentada 100% desde BD propia (sin API externa). Cuatro bloques: (1) Tu rendimiento — puntos totales, media, precision, plenos, pronosticos en blanco, rachas y desglose por categoria con grafica de puntos acumulados; (2) Cara a cara — duelos ganados vs otros jugadores en partidos compartidos, empates y grafica de diferencia acumulada; (3) Tus manias — marcador favorito, error medio en goles, porcentajes de acierto (1X2 y descanso), optimismo vs conservadurismo, y en que equipos puntuas mas; (4) Palmares y records — temporadas ganadas, mejor pronostico historico, mejor dia, partidos mas traicioneros y mas cantados, listado de temporadas. Endpoint `GET /api/stats?season_id=<uuid opcional>` con selector de temporada en la vista. Nuevos ficheros: `backend/app/services/stats.py`, `backend/app/routers/stats.py`, `src/app/(protected)/stats/page.tsx`. Modificados: `backend/app/main.py` (registra router), `src/components/Navbar.tsx` (entra en menu), `src/types/index.ts` (tipos StatsPayload). Graficas SVG inline, sin libreria nueva.
- **fix(predictions):** el selector de jugador de la pagina "Partidos" ya no permite editar los
  pronosticos de otro. Antes la UI decia "Estas editando los pronosticos de X" y enviaba
  `user_id` en el POST, pero el backend ignora ese campo y siempre guarda para el usuario
  autenticado — asi que al "editar los de X" en realidad **sobrescribias los tuyos** sin
  ningun aviso. Ahora al seleccionar a otro jugador la tarjeta pasa a solo lectura
  (`readOnly` en `MatchCard`), el guardado esta bloqueado en cliente, y se distingue
  "Sin pronostico" de un 0-0 real. Ver los del rival sigue funcionando, que era la intencion.
- **chore(cron):** creado el cron de sincronizacion de LaLiga/Champions en el VPS
  (`/usr/local/bin/betsoccer-sync.sh`, cada 30 min entre 10:00-23:00 UTC + catch-up a las 08:00),
  que sustituye al del Mundial retirado hoy. Sin el, la app se quedaba sin ninguna
  sincronizacion automatica justo cuando arranca LaLiga 2026/27.

## 2026-08-15
- **chore(seasons):** cierre de temporada "Mundial 2026" (activa 2026-06-13, cerrada 2026-08-15 tras el torneo). Ganador: sergio.porcar con 212 puntos.
- **chore(seasons):** creacion y activacion de nueva temporada "Temporada 2026/27" con clasificacion a cero, start date 2026-08-15. LaLiga 2026/27 comienza el 2026-08-16 (proximos partidos del Real Madrid y Barcelona se sincronizaran en la nueva temporada).
- **chore(cron):** cron de sincronizacion del Mundial eliminado del crontab de root en el VPS (lineas `*/30 0-5,16-23 * * *` y `0 14 * * *`). El Mundial termino el 2026-07-19, asi que la sincronizacion automatica ya no es necesaria. Archivos retirados: script movido a `/root/betsoccer-sync-worldcup.sh.retired`, log comprimido `/var/log/betsoccer-wc-sync.log.gz`. El endpoint `POST /api/sync/worldcup` sigue disponible en el backend para lanzamiento manual si es necesario.

## 2026-08-12
- **fix(auth):** el JWKS de Cloudflare ya no se cachea para siempre. Se descargaba una vez al arrancar el proceso y no se refrescaba nunca, así que en cuanto Cloudflare rotaba sus claves de firma el auto-login dejaba de funcionar: pasabas el OTP y la app te pedía usuario y contraseña. Ahora la caché caduca a la hora y, ante un fallo de verificación, se reintenta una vez con las claves recién descargadas — de modo que una rotación se absorbe al instante. Arreglado desde el chat de infra por ser un defecto transversal a 9 apps; contexto en `spcapps-infra/docs/PATTERNS.md`.

## 2026-06-23 — Cloudflare Access + auto-login (sin contraseña)
- **feat(auth):** betsoccer pasa a **Cloudflare Access + código por email**, también para usuarios externos. Nuevo endpoint `POST /api/auth/cf-access` que canjea la identidad ya validada por Cloudflare por una sesión de betsoccer (busca al usuario por email, sin contraseña). Valida el JWT firmado `Cf-Access-Jwt-Assertion` contra las claves del equipo + `CF_ACCESS_AUD`. La recuperación pasa a ser automática (el buzón de email del usuario), eliminando el reset manual por consola.
- **feat(frontend):** la página de login intenta el auto-login de Cloudflare al cargar (fetch crudo para no entrar en bucle con el redirect de 401); si pasa Access, entra directo a `/matches`. Si no, muestra el login normal.
- **chore:** nueva config `CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD`. El hardening previo se mantiene como defensa en profundidad. Nota Cloudflare: bypass para `/api/sync` (sincronización con `SYNC_API_SECRET`) y la Access App con sólo "One-time PIN" (sin Google).

## 2026-06-23 — Hardening de seguridad de auth
- **fix(seguridad):** `change-password` ahora **exige la contraseña actual** (antes solo pedía la nueva → una sesión robada podía cambiarla). Formulario `reset-password` actualizado con el campo "contraseña actual".
- **fix(seguridad):** `POST /api/predictions` ya **no acepta `user_id` en el body** — la predicción se guarda siempre para el usuario autenticado (antes se podía apostar en nombre de otro). Quitado `user_id` de `PredictionCreate`.
- **fix(seguridad):** endpoints de **admin protegidos por `require_admin`** (admin = el email de `ADMIN_EMAIL`); antes cualquier usuario logueado podía llamarlos (p.ej. recalcular puntos).
- **fix(seguridad):** **fail-closed de secretos** — la app no arranca si `JWT_SECRET`/`ADMIN_PASSWORD` siguen con el valor débil por defecto (`change-me`/`changeme`). Producción debe definir valores fuertes en el `.env`.
- **feat:** reset de contraseña por consola (break-glass / reset admin de cualquier usuario, sin email): `docker exec betsoccer-backend python -m app.set_password <email> <nueva_pass>`.

## 2026-06-14
- **fix:** El boton de sincronizar manual en Jornada ahora sincroniza tambien el Mundial (/api/sync/worldcup), antes solo sincronizaba liga y los partidos del Mundial acabados seguian apareciendo como LIVE
- **fix:** Reintentos (3x con backoff) en las llamadas a football-data.org para tolerar cortes de conexion intermitentes que hacian perder actualizaciones de estado/resultado
- **fix:** Sync de liga reescrito para usar endpoints de competicion en vez de /teams/{id}/matches (restringido en tier gratuito, daba 403). Ahora cubre LaLiga + Champions League filtrando por equipo
- **note:** La Copa del Rey no esta disponible en el tier gratuito de football-data.org, sus partidos no se sincronizan

## 2026-06-13
- **feat:** Endpoint POST /api/sync/worldcup para sincronizar partidos del Mundial (FIFA World Cup) desde football-data.org, reusando upsert + calculo de puntos del sync de liga
- **feat:** Soporte del Mundial como Season independiente (clasificacion separada por season_id)
- **feat:** Auth de sync por SYNC_API_SECRET ademas de JWT (require_sync_auth) para permitir crons desatendidos en /api/sync y /api/sync/worldcup
- **fix:** Cablear SYNC_API_SECRET que estaba definido pero sin usar (_verify_secret era codigo muerto)

## 2026-05-17
- **fix:** Incluir `kickoff_utc` en la comparacion del sync para que actualice horarios TBD cuando football-data.org los confirma (los partidos sin hora se sincronizaban a 00:00 UTC y quedaban bloqueados antes de jugarse)
- **fix:** Parsear `kickoff_utc` de string ISO a `datetime` antes de guardar (asyncpg requiere objetos datetime, el sync fallaba silenciosamente)

## 2026-04-12
- **refactor:** Migracion completa de Supabase a PostgreSQL self-hosted con FastAPI + SQLAlchemy
- **refactor:** Nuevo backend Python con endpoints REST que reemplazan las API routes de Next.js + Supabase
- **refactor:** Eliminacion de scripts legacy que referenciaban Supabase
- **fix:** Coalesce de campos undefined a null para campos de puntos en TypeScript
- **feat:** Docker Compose con containers frontend + backend en red spcapps-network
- **feat:** Deploy en VPS Hostinger (betsoccer.spcapps.com) via Cloudflare Tunnel

## 2026-02-17
- **fix:** Asignar season_id activo explicitamente al guardar predicciones

## 2026-01-26
- **feat:** Desglose de puntos en clasificacion (expandible por jugador con barras de progreso)
- **feat:** Lista de partidos individuales en desglose de puntos
- **fix:** Filtrar partidos por temporada activa en desglose

## 2026-01-25
- **feat:** Historial de temporadas expandible con clasificaciones finales
- **feat:** Mostrar predicciones detalladas de todos los jugadores en historial
- **feat:** Mejoras en manejo de errores de sincronizacion
- **feat:** Scripts de analisis de datos

## 2026-01-22
- **fix:** Sincronizar marcadores de primer tiempo y mostrar desglose detallado de puntos

## 2026-01-05
- **feat:** Nuevo sistema de puntuacion acumulativo (max 10 pts: +1 ganador, +2 HT, +3 diferencia, +4 exacto)
- **feat:** Sistema de temporadas con historial y ganadores
- **feat:** Explicacion del sistema de puntuacion en la UI
- **feat:** Mostrar marcadores de primer tiempo en tarjetas de partido

## 2025-12-21
- **feat:** Mostrar nombres de ganadores en pagina Historial
- **feat:** Boton de sincronizacion manual + mostrar resultados de predicciones

## 2025-12-19
- **feat:** Pagina LaLiga con partidos y clasificacion completa
- **feat:** Separar partidos proximos y jugados en vista LaLiga
- **feat:** Jornada como vista por defecto
- **fix:** Eliminar Segunda Division (no disponible en tier gratuito de la API)

## 2025-12-18
- **feat:** Vista Jornada con comparativa side-by-side de predicciones de todos los jugadores
- **feat:** Login con email/password (ademas de magic link)
- **feat:** Soporte PWA con icono de balon naranja
- **feat:** Recuperacion de contrasena
- **fix:** Sincronizar estado de MatchCard al cambiar de usuario
- **fix:** Redirect de auth callback a URL de produccion
- **fix:** Usar img tags en vez de Next.js Image para logos SVG
- **fix:** Usar Node.js 20 para deploy en Railway
- **feat:** Commit inicial de la aplicacion BetSoccer
