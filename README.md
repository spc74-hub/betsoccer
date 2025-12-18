# BetSoccer

Aplicación de apuestas (sin dinero) con amigos para pronosticar los partidos del Real Madrid y FC Barcelona.

## Características

- Carga automática de partidos (Real Madrid + Barcelona, todas las competiciones)
- Pronósticos de marcador exacto antes del inicio del partido
- Sistema de puntuación (+1 por acierto exacto)
- Clasificación en tiempo real
- Historial de predicciones y resultados

## Stack tecnológico

- **Frontend/Backend**: Next.js 15 (App Router)
- **Base de datos**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth (Magic Link + Google)
- **API de fútbol**: API-Football (api-sports.io)
- **Deploy**: Railway

## Configuración inicial

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Ve a **SQL Editor** y ejecuta el contenido de `supabase/schema.sql`
3. Configura la autenticación:
   - En **Authentication > Providers**, habilita **Email** (Magic Link)
   - (Opcional) Habilita **Google** con tus credenciales OAuth
4. Copia las credenciales desde **Settings > API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### 2. API-Football

1. Regístrate en [api-sports.io](https://api-sports.io)
2. Suscríbete al plan gratuito de API-Football (100 llamadas/día)
3. Copia tu API key desde el dashboard

### 3. Variables de entorno

Crea un archivo `.env.local` con:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# API-Football
API_FOOTBALL_KEY=tu-api-key

# Sync secret (genera con: openssl rand -hex 32)
SYNC_API_SECRET=tu-secret-para-cron

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Instalación

```bash
npm install
npm run dev
```

La app estará en http://localhost:3000

## Sincronización de partidos

La sincronización se hace mediante el endpoint `/api/sync`. Para ejecutarlo:

```bash
# Manualmente (desarrollo)
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer tu-sync-secret"
```

### Configurar Cron en Railway

En Railway, crea un **Cron Job** que ejecute:

```bash
curl -X POST $APP_URL/api/sync -H "Authorization: Bearer $SYNC_API_SECRET"
```

Con la siguiente programación:
- **Sync diario**: `0 6 * * *` (6:00 AM UTC)
- **Sync frecuente** (días de partido): `*/30 * * * *` (cada 30 min)

## Deploy en Railway

1. Conecta tu repositorio a Railway
2. Configura las variables de entorno en el dashboard
3. Railway detectará automáticamente que es un proyecto Next.js

## Estructura del proyecto

```
src/
├── app/
│   ├── (auth)/login/        # Página de login
│   ├── (protected)/         # Páginas protegidas
│   │   ├── matches/         # Próximos partidos
│   │   ├── standings/       # Clasificación
│   │   └── history/         # Historial
│   └── api/                 # API routes
├── components/              # Componentes React
├── lib/                     # Utilidades y configuración
│   ├── supabase/           # Clientes Supabase
│   ├── api-football.ts     # Integración API-Football
│   └── utils.ts            # Helpers
└── types/                  # TypeScript types
```

## Reglas del juego

1. Cada usuario puede hacer **un pronóstico por partido**
2. El pronóstico debe ser el **marcador exacto** (ej: 2-1)
3. El pronóstico se puede modificar hasta que **comience el partido**
4. Se otorga **+1 punto** por acertar el marcador exacto
5. El resultado cuenta como **tiempo reglamentario** (FT), sin prórroga
