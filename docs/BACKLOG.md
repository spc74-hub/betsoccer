# BetSoccer — Backlog

## Prioridad Alta

- [ ] **Roles de usuario (admin vs jugador)** — Actualmente no hay distincion de roles. Cualquier usuario autenticado puede cerrar temporadas, recalcular puntos y editar pronosticos de otros. Implementar sistema de roles para restringir acciones administrativas.
- [x] **Proteger endpoint de sync con SYNC_API_SECRET** — Cablear `require_sync_auth` que valida JWT o SYNC_API_SECRET para los endpoints /api/sync y /api/sync/worldcup (permite crons desatendidos). 
- [ ] **Configurar cron de sincronizacion automatica** — Configurar un cron job en el VPS que llame a POST /api/sync/worldcup periodicamente (cada 30 min en ventana 16:00–06:00 UTC durante Mundial, usando SYNC_API_SECRET).

## Prioridad Media

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

- [ ] **Funcion calculatePoints del frontend es legacy** — `src/lib/utils.ts:calculatePoints` devuelve 1 o 0 (sistema antiguo). No se usa activamente pero puede causar confusion si alguien la llama. El calculo real esta en el backend (`services/points.py`).
- [ ] **Cross-user predictions sin validacion de rol** — Cualquier usuario puede enviar predicciones para otro usuario pasando `user_id` en el body del POST. Deberia requerir rol admin.
