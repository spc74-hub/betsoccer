# BetSoccer — Apuestas de futbol entre amigos

## Overview

BetSoccer es una aplicacion web (PWA) privada para un grupo de amigos que permite pronosticar los resultados de los partidos del Real Madrid y FC Barcelona. Los usuarios introducen marcadores de primer tiempo y resultado final antes del inicio de cada partido, y el sistema asigna puntos segun un sistema acumulativo de hasta 10 puntos por partido. Incluye clasificacion por temporadas, historial de predicciones y consulta de resultados de LaLiga.

**No es una app de apuestas con dinero** — es puramente para competicion amistosa.

## Architecture

| Capa | Tecnologia |
|------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Backend | FastAPI + SQLAlchemy (async) + Pydantic Settings |
| Base de datos | PostgreSQL 16 (container compartido `spcapps-postgres`) |
| Auth | JWT (Bearer tokens), bcrypt para passwords |
| API externa | football-data.org v4 (principal) |
| Deploy | Docker Compose en VPS Hostinger |
| Dominio | betsoccer.spcapps.com (via Cloudflare Tunnel) |

**Repositorio:** `spc74-hub/betsoccer`

### Estructura del repositorio

```
betsoccer-migration/
├── backend/                 # FastAPI backend (Python 3.12)
│   ├── app/
│   │   ├── main.py          # App entry point, CORS, routers
│   │   ├── config.py        # Pydantic Settings (.env)
│   │   ├── database.py      # AsyncSession, engine, init_db
│   │   ├── auth.py          # JWT creation/validation, bcrypt
│   │   ├── schemas.py       # Pydantic request/response schemas
│   │   ├── models/models.py # SQLAlchemy models (User, Match, Prediction, Season)
│   │   ├── routers/         # Endpoints: auth, users, matches, predictions, standings, sync, laliga, admin
│   │   └── services/        # football_api, points, seasons
│   └── seed.py              # Seed admin user + primera temporada
├── src/                     # Next.js frontend
│   ├── app/
│   │   ├── (auth)/          # Login, reset-password (sin navbar)
│   │   └── (protected)/     # Matches, jornada, laliga, standings, history (con navbar)
│   ├── components/          # MatchCard, Navbar, TeamFilter
│   ├── lib/                 # api.ts (cliente HTTP), utils, football APIs
│   ├── middleware.ts         # Redirect / → /login
│   └── types/index.ts       # TypeScript types
├── docker-compose.yml       # Frontend + backend containers
├── Dockerfile               # Frontend multi-stage build (Node 20)
└── public/                  # PWA manifest, iconos
```

## Features

### Autenticacion
- Login con email/password (JWT)
- Cambio de contrasena
- Sesion persistida en localStorage (7 dias)
- Sin registro publico — usuarios creados por admin via seed/servicio

### Predicciones (pagina "Partidos")
- Ver proximos partidos del Real Madrid y Barcelona
- Introducir pronostico de marcador: primer tiempo (HT) y resultado final (FT)
- Editar pronostico hasta que comience el partido (lockout automatico)
- Filtro por equipo (Todos / Real Madrid / Barcelona)
- Selector de usuario para ver/editar pronosticos de otros jugadores

### Jornada
- Vista comparativa side-by-side de todos los jugadores
- Secciones: proximos partidos y ultimos resultados (7 dias)
- Desglose de puntos por categoria para partidos finalizados
- Boton de sincronizacion manual

### LaLiga
- Consulta de partidos de toda LaLiga (no solo RM/FCB)
- Clasificacion completa de la liga con estadisticas
- Filtro por nombre de equipo
- Sistema de favoritos (persistido en localStorage)
- Agrupacion por jornada/fecha

### Clasificacion
- Ranking de jugadores por puntos en la temporada activa
- Medallas (oro, plata, bronce) para top 3
- Detalle expandible por jugador: predicciones puntuadas + barras de progreso por categoria
- Estadisticas resumen: participantes, lider, precision media
- Historial de temporadas anteriores con clasificaciones finales
- Gestion de temporadas: cerrar temporada actual + crear nueva

### Historial
- Partidos finalizados con resultado real
- Pronosticos del usuario actual + puntos obtenidos
- Vista de predicciones de todos los jugadores por partido
- Filtro por equipo
- Estadisticas: partidos pronosticados, aciertos, precision

### Sincronizacion
- Endpoint POST /api/sync que obtiene partidos de football-data.org
- Actualiza/crea partidos de Real Madrid y Barcelona
- Calcula puntos automaticamente cuando un partido pasa a FINISHED
- Autenticacion via JWT o SYNC_API_SECRET (para cron)

### Sistema de puntuacion (acumulativo, max 10 pts/partido)
| Condicion | Puntos |
|-----------|--------|
| Acertar ganador (1X2) | +1 |
| Acertar marcador del primer tiempo | +2 |
| Acertar diferencia de goles | +3 |
| Acertar resultado exacto | +4 |

## Database schema

### users
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| email | String | UNIQUE, NOT NULL |
| display_name | String | NOT NULL |
| avatar_url | Text | nullable |
| hashed_password | String | NOT NULL (bcrypt) |
| initial_points | Integer | default 0 |
| created_at / updated_at | DateTime(tz) | |

### matches
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| external_id | Integer | UNIQUE (ID de football-data.org) |
| competition | String | NOT NULL |
| season | String | e.g. "2024/2025" |
| home_team / away_team | String | NOT NULL |
| home_team_logo / away_team_logo | Text | nullable |
| kickoff_utc | DateTime(tz) | NOT NULL |
| status | String | SCHEDULED, LIVE, FINISHED, POSTPONED, CANCELLED |
| home_score / away_score | Integer | nullable (null hasta FINISHED) |
| home_score_halftime / away_score_halftime | Integer | nullable |

### predictions
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → users (CASCADE) |
| match_id | UUID | FK → matches (CASCADE) |
| season_id | UUID | FK → seasons, nullable |
| home_score / away_score | Integer | NOT NULL, >= 0 |
| home_score_halftime / away_score_halftime | Integer | default 0 |
| points | Integer | nullable (total, calculado al finalizar) |
| points_winner / points_halftime / points_difference / points_exact | Integer | desglose |
| UNIQUE(user_id, match_id) | | |

### seasons
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| name | String | e.g. "Temporada 2024/25" |
| start_date / end_date | DateTime(tz) | |
| is_active | Boolean | default True |
| winner_user_id | UUID | FK → users, nullable |
| winner_name | String | nullable |
| winner_points | Integer | nullable |

## API endpoints

### Auth (`/api/auth`)
| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/api/auth/login` | No | Login con email/password, devuelve JWT + user |
| GET | `/api/auth/me` | JWT | Perfil del usuario actual |
| POST | `/api/auth/change-password` | JWT | Cambiar contrasena (min 6 chars) |

### Users (`/api/users`)
| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/api/users` | JWT | Lista todos los usuarios |

### Matches (`/api/matches`)
| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/api/matches` | No | Partidos. Params: `status` (upcoming/finished), `team` (real-madrid/barcelona) |

### Predictions (`/api/predictions`)
| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/api/predictions` | JWT | Filtrar por match_id, user_id, match_ids, season_id, has_points |
| POST | `/api/predictions` | JWT | Crear/actualizar pronostico (upsert). Bloquea si kickoff ha pasado |
| DELETE | `/api/predictions` | JWT | Eliminar pronostico por id |

### Standings (`/api/standings`)
| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/api/standings` | JWT | Clasificacion de la temporada activa |
| GET | `/api/standings/by-season` | JWT | Clasificacion por season_id |
| GET | `/api/standings/seasons` | JWT | Historial de temporadas |
| POST | `/api/standings/close-season` | JWT | Cierra temporada + crea nueva |

### Sync (`/api/sync`)
| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/api/sync` | JWT | Sincroniza partidos desde football-data.org y calcula puntos |
| GET | `/api/sync` | No | Metadata del endpoint |

### LaLiga (`/api/laliga`)
| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/api/laliga` | No | Proxy a football-data.org. Params: `type` (matches/standings) |

### Admin (`/api/admin`)
| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/api/admin/recalculate-points` | JWT | Recalcula puntos de todos los partidos finalizados |

## Auth

- **Mecanismo:** JWT Bearer tokens (HS256)
- **Almacenamiento:** `localStorage` (keys: `token`, `user`)
- **Expiracion:** 7 dias (10080 minutos)
- **Passwords:** bcrypt via passlib
- **Flujo:** Login → JWT → cada request lleva `Authorization: Bearer <token>` → 401 auto-redirect a /login
- **Sin registro publico:** usuarios creados via `seed.py` o servicio `create_player`

## Deployment

| Componente | Container | Puerto |
|------------|-----------|--------|
| Frontend | `betsoccer-frontend` | 3000 (interno) |
| Backend | `betsoccer-backend` | 8000 (interno) |
| PostgreSQL | `spcapps-postgres` (compartido) | 5432 |

- **Dominio:** betsoccer.spcapps.com
- **Red Docker:** `spcapps-network` (externa, compartida con otros servicios)
- **Reverse proxy:** Nginx
- **Tunnel:** Cloudflare Tunnel (*.spcapps.com)
- **Auto-deploy:** webhook en `https://webhook.spcapps.com/webhook` (git push → pull + build + restart)
- **Base de datos:** `betsoccer` en PostgreSQL 16 compartido (user: `spcadmin`)
- **Seed inicial:** `python seed.py` crea admin + primera temporada

### Variables de entorno (backend/.env)
```
DATABASE_URL, JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_MINUTES
API_FOOTBALL_KEY, FOOTBALL_DATA_KEY, SYNC_API_SECRET
ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_DISPLAY_NAME
```

### Variables de entorno (frontend)
```
NEXT_PUBLIC_API_URL=https://betsoccer.spcapps.com
```

## Key files

| Fichero | Descripcion |
|---------|-------------|
| `backend/app/main.py` | Entry point FastAPI, CORS, routers |
| `backend/app/models/models.py` | Modelos SQLAlchemy (User, Match, Prediction, Season) |
| `backend/app/services/points.py` | Sistema de puntuacion acumulativo |
| `backend/app/services/football_api.py` | Cliente football-data.org v4 |
| `backend/app/services/seasons.py` | Logica de temporadas y clasificaciones |
| `backend/app/routers/sync.py` | Sincronizacion de partidos y calculo de puntos |
| `backend/app/routers/predictions.py` | CRUD de pronosticos |
| `src/components/MatchCard.tsx` | Componente principal de pronostico |
| `src/app/(protected)/jornada/page.tsx` | Vista comparativa de todos los jugadores |
| `src/app/(protected)/standings/page.tsx` | Clasificacion + gestion de temporadas |
| `src/lib/api.ts` | Cliente HTTP + gestion de auth (localStorage) |
| `src/types/index.ts` | Tipos TypeScript del dominio |
| `docker-compose.yml` | Definicion de containers frontend + backend |
| `Dockerfile` | Build multi-stage del frontend (Node 20) |

## Backlog

Resumen: mejorar seguridad (roles admin), notificaciones, y UX de predicciones. Ver [docs/BACKLOG.md](docs/BACKLOG.md) para detalle completo.

## Conventions

- **Idioma:** commits en ingles, UI y documentacion en espanol
- **When making changes, update this CLAUDE.md**
- Al completar items del backlog, marcarlos en `docs/BACKLOG.md` y documentar en `docs/CHANGELOG.md`
- Auth es client-side (localStorage JWT), no hay SSR auth
- Todos los tiempos se muestran en zona horaria `Europe/Madrid`
- La API externa principal es football-data.org v4 (no api-football.com)
- CORS completamente abierto (`allow_origins=["*"]`)
- Sin registro publico de usuarios
- PWA habilitada con manifest.json

## Documentacion

Ver `docs/` para documentacion detallada:
- [docs/USER_GUIDE.md](docs/USER_GUIDE.md) — Guia funcional del usuario
- [docs/PROCESSES.md](docs/PROCESSES.md) — Flujos de negocio con diagramas mermaid
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — Historial de cambios
- [docs/BACKLOG.md](docs/BACKLOG.md) — Tareas pendientes y mejoras futuras
