# BetSoccer — Flujos de Negocio

## 1. Flujo de autenticacion

```mermaid
sequenceDiagram
    actor U as Usuario
    participant F as Frontend (Next.js)
    participant B as Backend (FastAPI)
    participant DB as PostgreSQL

    U->>F: Introduce email + password
    F->>B: POST /api/auth/login
    B->>DB: Busca usuario por email
    DB-->>B: Usuario encontrado
    B->>B: Verifica password (bcrypt)
    alt Password correcto
        B->>B: Genera JWT (7 dias)
        B-->>F: { access_token, user }
        F->>F: Guarda token + user en localStorage
        F-->>U: Redirige a /matches
    else Password incorrecto
        B-->>F: 401 "Credenciales incorrectas"
        F-->>U: Muestra error
    end
```

### Verificacion en cada request

```mermaid
flowchart TD
    A[Request a pagina protegida] --> B{Token en localStorage?}
    B -->|No| C[Redirect a /login]
    B -->|Si| D[apiFetch con Authorization header]
    D --> E{Response 401?}
    E -->|Si| F[Limpia localStorage]
    F --> C
    E -->|No| G[Muestra contenido]
```

---

## 2. Flujo de pronostico

```mermaid
sequenceDiagram
    actor U as Usuario
    participant F as Frontend
    participant B as Backend
    participant DB as PostgreSQL

    U->>F: Entra en pagina Partidos
    F->>B: GET /api/matches?status=upcoming
    B->>DB: SELECT matches WHERE status IN (SCHEDULED, LIVE)
    DB-->>B: Lista de partidos
    B-->>F: matches[]
    F->>B: GET /api/predictions?user_id=X&match_ids=...
    B-->>F: predictions[]
    F-->>U: Muestra tarjetas con pronosticos existentes

    U->>F: Modifica marcador (HT + FT)
    F->>F: Verifica: partido no ha comenzado?
    alt Partido bloqueado
        F-->>U: Muestra candado, no permite cambios
    else Partido abierto
        F->>B: POST /api/predictions {match_id, scores, user_id}
        B->>B: Verifica kickoff_utc > ahora
        B->>DB: Busca season activa
        B->>DB: UPSERT prediction (user_id + match_id)
        DB-->>B: Prediction guardada
        B-->>F: prediction
        F-->>U: Confirmacion visual
    end
```

---

## 3. Flujo de sincronizacion de partidos

```mermaid
flowchart TD
    A[Trigger: boton manual o cron] --> B[POST /api/sync]
    B --> C[Verifica autenticacion JWT]
    C --> D[Fetch partidos Real Madrid desde football-data.org]
    C --> E[Fetch partidos Barcelona desde football-data.org]
    D --> F[Combinar + deduplicar por external_id]
    E --> F
    F --> G{Para cada partido}
    G --> H{Existe en DB?}
    H -->|No| I[INSERT nuevo partido]
    H -->|Si| J{Ha cambiado algo?}
    J -->|No| K[Skip]
    J -->|Si| L[UPDATE partido]
    L --> M{Status cambio a FINISHED?}
    M -->|Si| N[Calcular puntos de todas las predicciones]
    M -->|No| O[Continuar]
    N --> O
    I --> O
    K --> O
    O --> P{Mas partidos?}
    P -->|Si| G
    P -->|No| Q[Devolver estadisticas: created, updated, errors]
```

---

## 4. Flujo de calculo de puntos

```mermaid
flowchart TD
    A[Partido pasa a FINISHED] --> B[Obtener todas las predicciones del partido]
    B --> C{Para cada prediccion}
    C --> D{Ganador correcto? local/empate/visitante}
    D -->|Si| E[+1 punto winner]
    D -->|No| F[0 puntos winner]
    E --> G{Marcador HT exacto?}
    F --> G
    G -->|Si| H[+2 puntos halftime]
    G -->|No| I[0 puntos halftime]
    H --> J{Diferencia de goles correcta?}
    I --> J
    J -->|Si| K[+3 puntos difference]
    J -->|No| L[0 puntos difference]
    K --> M{Resultado exacto FT?}
    L --> M
    M -->|Si| N[+4 puntos exact]
    M -->|No| O[0 puntos exact]
    N --> P[Total = winner + halftime + difference + exact]
    O --> P
    P --> Q[UPDATE prediction SET points, desglose]
    Q --> R{Mas predicciones?}
    R -->|Si| C
    R -->|No| S[Commit a DB]
```

### Ejemplo de puntuacion

| Criterio | Resultado real | Pronostico | Puntos |
|----------|---------------|------------|--------|
| Resultado FT | 2-1 (local gana) | 3-1 (local gana) | +1 (ganador correcto) |
| Marcador HT | 1-0 | 1-0 | +2 (HT exacto) |
| Diferencia goles | +1 | +2 | 0 (diferencia incorrecta) |
| Resultado exacto | 2-1 | 3-1 | 0 (no exacto) |
| **Total** | | | **3 puntos** |

---

## 5. Flujo de gestion de temporadas

```mermaid
sequenceDiagram
    actor A as Admin
    participant F as Frontend
    participant B as Backend
    participant DB as PostgreSQL

    A->>F: Click "Cerrar temporada"
    A->>F: Introduce nombre nueva temporada
    F->>B: POST /api/standings/close-season {new_season_name}
    B->>DB: SELECT season WHERE is_active = true
    DB-->>B: Temporada activa
    B->>DB: Calcula clasificacion final (SUM puntos por usuario)
    DB-->>B: Clasificacion con ganador
    B->>DB: UPDATE season SET is_active=false, end_date=now, winner_*
    B->>DB: INSERT nueva season (is_active=true)
    DB-->>B: Nueva temporada creada
    B-->>F: {closed_season, winner, new_season}
    F-->>A: Muestra confirmacion + nueva temporada activa

    Note over F,DB: Las nuevas predicciones se asocian a la nueva temporada
    Note over F,DB: Las clasificaciones previas quedan en el historial
```

---

## 6. Flujo de consulta de LaLiga

```mermaid
sequenceDiagram
    actor U as Usuario
    participant F as Frontend
    participant B as Backend
    participant API as football-data.org

    U->>F: Navega a LaLiga
    F->>B: GET /api/laliga?type=matches
    B->>API: GET /v4/competitions/PD/matches
    API-->>B: Partidos de LaLiga
    B-->>F: {matches: [...]}
    F-->>U: Muestra partidos agrupados por fecha

    U->>F: Cambia a vista Clasificacion
    F->>B: GET /api/laliga?type=standings
    B->>API: GET /v4/competitions/PD/standings
    API-->>B: Tabla clasificatoria
    B-->>F: {standings: [...]}
    F-->>U: Muestra tabla con posiciones y estadisticas
```

---

## Actores del sistema

| Actor | Descripcion | Acciones principales |
|-------|-------------|---------------------|
| **Jugador** | Miembro del grupo de amigos | Pronosticar, ver clasificacion, consultar historial |
| **Admin** | Jugador con acceso a gestion | Cerrar temporadas, recalcular puntos, crear usuarios |
| **Cron/Webhook** | Proceso automatico | Sincronizar partidos periodicamente |
| **football-data.org** | API externa | Proporciona partidos, resultados y clasificacion de LaLiga |
