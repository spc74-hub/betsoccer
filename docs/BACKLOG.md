# BetSoccer — Backlog

## Prioridad Alta
- [ ] **Versionar los scripts de cron (pendiente de analisis en infra)** — `/usr/local/bin/betsoccer-sync.sh` vive solo en el VPS, fuera de git: si se reinstala el servidor desaparece y la clasificacion deja de actualizarse sin que nadie se entere. Contradice la regla de `COORDINACION.md` de que nada importante viva fuera de git. **No es especifico de betsoccer**: segun el analisis del 2026-08-15, ninguna app de la flota versiona sus crons. Propuesta a valorar en el chat de infra: guardarlos en `spcapps-infra/scripts/` con un instalador que los despliegue en el VPS. Aqui solo habria que cambiar la ruta del script cuando exista el estandar.

- [x] 🔴 **Cron de sincronizacion de LaLiga 2026/27** — Al retirar el cron del Mundial el 2026-08-15 la app se quedo sin ninguna sincronizacion automatica justo antes del arranque de LaLiga. **✅ RESUELTO 2026-08-15:** creado `/usr/local/bin/betsoccer-sync.sh` (mismo patron que el del Mundial, con `SYNC_API_SECRET`) y programado `*/30 10-23 * * *` + catch-up `0 8 * * *`, log en `/var/log/betsoccer-sync.log`.

- [x] 🔴 **Cada jugador podia sobrescribir sus propios pronosticos creyendo que editaba los de otro** — El selector de jugador de "Partidos" permitia pulsar sobre otro usuario y editar sus marcadores; la UI decia "Estas editando los pronosticos de X". Pero el backend (endurecido en `6a8436a`) ignora el `user_id` del cliente y guarda siempre para el usuario autenticado, asi que el resultado real era **machacar tu propio pronostico** sin aviso. **✅ RESUELTO 2026-08-15:** el selector pasa a solo lectura para jugadores distintos al actual (`readOnly` en `MatchCard`), se elimina el `user_id` del POST y se distingue "Sin pronostico" de un 0-0.

- [x] 🔴 **El JWKS de Cloudflare se cachea para siempre → el auto-login se rompe solo** (detectado desde el chat de infra, 2026-08-12). En el endpoint `cf-access`, las claves públicas de Cloudflare se descargan **una vez** y se guardan en memoria sin caducidad (`if _cf_jwks is None`). Cloudflare **rota** esas claves, y al rotar la copia guardada deja de validar: `401 Invalid assertion` → el usuario pasa el OTP y **la app le pide su usuario y contraseña**. Le pasó a **9 apps el mismo día**. Parcheado reiniciando el contenedor (vuelve a descargarlas), pero **volverá a ocurrir en la siguiente rotación**. Arreglo: que la caché **caduque** (1 h basta) y que ante un fallo de verificación se **reintente una vez** con el JWKS recién bajado. Referencias que ya lo hacen bien: `kbia` (`PyJWKClient` de PyJWT) y `salesforce`/`reminders` (`createRemoteJWKSet` de jose) — mejor usar librería que escribir la caché a mano. Contexto: `spcapps-infra/docs/PATTERNS.md` → "El JWKS tiene que caducar". **✅ RESUELTO 2026-08-12 desde el chat de infra** (defecto transversal a 9 apps): caché con TTL de 1 h + un reintento forzado ante fallo de verificación.

- [ ] **Roles de usuario (admin vs jugador)** — Actualmente no hay distincion de roles. Cualquier usuario autenticado puede cerrar temporadas, recalcular puntos y editar pronosticos de otros. Implementar sistema de roles para restringir acciones administrativas.
- [x] **Proteger endpoint de sync con SYNC_API_SECRET** — Cablear `require_sync_auth` que valida JWT o SYNC_API_SECRET para los endpoints /api/sync y /api/sync/worldcup (permite crons desatendidos). 
- [ ] **Configurar cron de sincronizacion automatica** — Configurar un cron job en el VPS que llame a POST /api/sync/worldcup periodicamente (cada 30 min en ventana 16:00–06:00 UTC durante Mundial, usando SYNC_API_SECRET).

## Prioridad Media
- [ ] **Estadisticas de LaLiga: pichichi, zamora y otras** — Analisis de fuentes hecho el 2026-08-15 (verificado contra las APIs reales, no asumido):
  - **Pichichi: GRATIS y ya disponible.** `GET /competitions/PD/scorers` de football-data.org (la fuente que ya usamos) devuelve goleadores con goles, asistencias, penaltis y partidos jugados. No requiere fuente nueva ni gasto.
  - **Zamora: NO disponible gratis.** football-data.org no publica estadisticas de portero en ningun plan (solo goles en contra por equipo, en la clasificacion).
  - **API-Football (api-sports.io):** el plan Free (100 req/dia) **NO da acceso a la temporada en curso**. Error literal de la API: `"Free plans do not have access to this season, try from 2022 to 2024."` Sirve para historico, no para 2026/27.
  - Los datos del Zamora **si existen** en API-Football y son los correctos (verificado con Courtois 2024/25: 32 partidos, 2700 min, 29 encajados, 77 paradas), pero para la temporada en curso hacen falta **$19/mes del plan Pro**. Decidir si compensa para una liga de 2 jugadores.
  - Descartados SofaScore y FotMob: sin API publica, habria que scrapear.
- [x] **Estadisticas de la liga de apuestas (BD propia)** — Rachas, mejor jornada, quien acierta mas los descansos, evolucion de puntos por jornada. Sale todo de las tablas `predictions`/`matches`, sin API externa ni coste. **✅ RESUELTO 2026-08-15:** implementada vista `/stats` con endpoint `GET /api/stats` alimentado 100% desde BD propia. Cuatro bloques: tu rendimiento (puntos, media, precision, plenos, rachas, grafica acumulada, desglose por categoria), cara a cara (duelos vs otros jugadores), tus manias (marcador favorito, error medio, porcentajes, optimismo), palmares y records (temporadas ganadas, mejores dias, patrones). Selector de temporada; records historicos (todas las temporadas).


- [ ] **Notificaciones de partidos proximos** — Avisar a los jugadores cuando un partido esta por empezar y no han hecho su pronostico.
- [ ] **Registro de usuarios desde la app** — Actualmente los usuarios se crean solo via seed.py o directamente en DB. Permitir al admin crear jugadores desde la UI.
- [ ] **Paginacion en historial** — El historial esta limitado a 50 partidos. Implementar paginacion o scroll infinito para ver mas partidos antiguos.
- [ ] **Mejorar CORS** — Actualmente `allow_origins=["*"]`. Restringir a los dominios reales (betsoccer.spcapps.com, localhost:3000).
- [ ] **Eliminar codigo legacy de api-football.com** — El frontend tiene `src/lib/api-football.ts` que ya no se usa (se migro a football-data.org). El backend tambien tiene constantes de api-football sin uso activo.
- [ ] **Eliminar carpeta supabase/** — Contiene migraciones SQL de Supabase que ya no son relevantes tras la migracion a FastAPI + SQLAlchemy.

## Prioridad Baja / Futuro

- [ ] **Estadisticas avanzadas** — Graficos de evolucion de puntos por jornada, racha de aciertos, comparativa entre jugadores.
- [ ] **Pronosticos de competiciones europeas** — Ampliar a Champions League y otros torneos (requiere mas llamadas a la API).
- [ ] **Modo oscuro/claro** — Actualmente solo tema oscuro. Permitir cambiar a tema claro.
- [ ] **Avatares personalizados** — El campo avatar_url existe en la DB pero no se usa. Permitir subir foto de perfil.
- [ ] **Soporte offline mejorado** — La PWA funciona pero no cachea datos. Implementar service worker con cache de partidos y predicciones.
- [ ] **Tests automatizados** — No hay tests unitarios ni de integracion. Anadir tests para el sistema de puntuacion, endpoints criticos y componentes principales.
- [ ] **Rate limiting en API** — Proteger endpoints publicos contra abuso.

## Bugs Conocidos

- [x] **Sync manual no cubria el Mundial** — El boton de sincronizar en Jornada solo llamaba a /api/sync (liga), por lo que los partidos del Mundial acabados seguian mostrando estado LIVE. Arreglado el 2026-06-14: handleSync ahora llama a /api/sync Y /api/sync/worldcup con Promise.allSettled.
- [ ] **Funcion calculatePoints del frontend es legacy** — `src/lib/utils.ts:calculatePoints` devuelve 1 o 0 (sistema antiguo). No se usa activamente pero puede causar confusion si alguien la llama. El calculo real esta en el backend (`services/points.py`).
- [ ] **Cross-user predictions sin validacion de rol** — Cualquier usuario puede enviar predicciones para otro usuario pasando `user_id` en el body del POST. Deberia requerir rol admin.
