# Changelog

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
