# BetSoccer — Guia del Usuario

## Que es BetSoccer

BetSoccer es una aplicacion web para un grupo privado de amigos donde cada jugador pronostica los resultados de los partidos del Real Madrid y FC Barcelona. No hay dinero de por medio — es una competicion amistosa donde gana quien acumule mas puntos a lo largo de la temporada.

La app funciona como PWA (Progressive Web App), por lo que se puede instalar en el movil desde el navegador y usarla como una app nativa.

**URL:** https://betsoccer.spcapps.com

---

## Acceso

### Login

- Accede a la app desde el navegador o la PWA instalada.
- Introduce tu **email** y **contrasena**.
- No hay registro publico — tu cuenta la crea el administrador.
- La sesion se mantiene durante 7 dias. Despues tendras que volver a iniciar sesion.

### Cambiar contrasena

- Desde la pagina de cambio de contrasena (`/reset-password`).
- Introduce la nueva contrasena (minimo 6 caracteres) y confirmala.
- Tras el cambio, seras redirigido a la app automaticamente.

---

## Navegacion

La barra de navegacion aparece en todas las paginas protegidas:

| Seccion | Icono | Que muestra |
|---------|-------|-------------|
| **Jornada** | Usuarios | Comparativa de pronosticos de todos los jugadores |
| **Partidos** | Calendario | Proximos partidos para hacer pronosticos |
| **LaLiga** | TV | Partidos y clasificacion de toda LaLiga |
| **Clasificacion** | Trofeo | Ranking de jugadores por puntos |
| **Historial** | Reloj | Partidos finalizados con resultados y puntos |

En movil, la navegacion se muestra como menu hamburguesa (icono de 3 lineas).

---

## Partidos (Hacer pronosticos)

Esta es la pagina principal para introducir tus predicciones.

### Que ves

- Lista de **proximos partidos** del Real Madrid y Barcelona.
- Cada tarjeta muestra: competicion, equipos con escudos, fecha y hora del partido.
- Si ya tienes un pronostico guardado, aparece con los valores que pusiste.

### Como pronosticar

1. En cada tarjeta de partido, veras dos secciones:
   - **Primer tiempo (HT):** marcador que pronosticas para el descanso (morado).
   - **Resultado final (FT):** marcador que pronosticas para el final del partido (indigo).
2. Usa los botones **+** y **-** para ajustar los goles de cada equipo.
3. El pronostico se guarda automaticamente al hacer cambios (boton "Guardar" aparece cuando hay cambios sin guardar).

### Reglas importantes

- **Solo puedes pronosticar antes del inicio del partido.** Una vez que empieza, la tarjeta se bloquea (aparece un icono de candado).
- Puedes **modificar** tu pronostico tantas veces como quieras antes del partido.
- Cada usuario tiene **un unico pronostico por partido**.

### Filtros

- **Filtro de equipo:** Todos / Real Madrid / Barcelona — para ver solo los partidos del equipo que te interese.
- **Selector de usuario:** Si hay mas de un jugador, puedes ver los pronosticos de otros. Cuando ves otro usuario, aparece un aviso naranja indicando que estas viendo/editando sus pronosticos.

---

## Jornada (Vista comparativa)

Muestra los pronosticos de **todos los jugadores** lado a lado para cada partido.

### Secciones

1. **Proximos partidos** (hasta 10): muestra que ha pronosticado cada jugador.
   - Se ven las iniciales de cada usuario con su pronostico (HT en morado + FT en indigo).
   - Si un jugador no ha pronosticado, aparece "Pendiente" con un icono de reloj.

2. **Ultimos resultados** (ultimos 7 dias, hasta 10): partidos ya finalizados.
   - Muestra el resultado real del partido.
   - Para cada jugador: su pronostico + desglose de puntos obtenidos.
   - Tabla de puntos por categoria: 1X2 (ganador), HT (primer tiempo), DIF (diferencia), EXACTO (resultado exacto).
   - Celdas verdes = puntos obtenidos, celdas rojas/grises = no acertado.

### Boton de sincronizacion

- En la parte superior hay un boton **"Sincronizar"** que actualiza los partidos y resultados desde la API de futbol.
- Util si un partido acaba de terminar y quieres ver los puntos actualizados.

---

## LaLiga

Pagina para consultar toda la liga espanola (no solo Real Madrid y Barcelona).

### Dos vistas

- **Partidos:** todos los partidos de LaLiga agrupados por fecha.
  - Proximos partidos y partidos jugados (con resultado).
  - Cada grupo de fecha es colapsable (click para expandir/contraer).

- **Clasificacion:** tabla completa de la liga.
  - Posicion, equipo, partidos jugados, victorias, empates, derrotas, goles a favor/contra, diferencia de goles, puntos.
  - Colores por zona: verde (Champions League, top 4), azul (Europa League, 5o), naranja (Conference, 6o), rojo (descenso, ultimos 3).

### Funcionalidades

- **Busqueda:** filtra partidos o equipos por nombre.
- **Favoritos:** marca equipos con la estrella para filtrar y destacarlos. Se guardan en el navegador.
- **Filtro favoritos:** boton para mostrar solo tus equipos favoritos.

---

## Clasificacion (Ranking de jugadores)

Muestra quien va ganando en la temporada actual.

### Que ves

- **Ranking** ordenado por puntos totales (descendente).
  - 1o: medalla de oro
  - 2o: medalla de plata
  - 3o: medalla de bronce
- Cada tarjeta muestra: nombre, pronosticos correctos/totales, porcentaje de precision, y puntos totales.
- Tu tarjeta aparece destacada con un borde indigo.

### Detalle por jugador

- Haz click en cualquier jugador para expandir su detalle.
- Veras:
  - **Barras de progreso** por categoria de puntos: Ganador (verde), Primer Tiempo (azul), Diferencia (amarillo), Exacto (morado).
  - **Lista de predicciones** puntuadas con el desglose de puntos de cada partido.

### Estadisticas resumen

Tres tarjetas en la parte superior:
- **Participantes:** numero total de jugadores.
- **Lider:** puntos del primer clasificado.
- **Precision media:** porcentaje medio de aciertos de todos los jugadores.

### Explicacion del sistema de puntuacion

Boton "Como se calculan los puntos?" que muestra:
- +1 punto: acertar el ganador (local, empate, visitante)
- +2 puntos: acertar el marcador del primer tiempo
- +3 puntos: acertar la diferencia de goles
- +4 puntos: acertar el resultado exacto
- **Maximo 10 puntos por partido** (todos los criterios son acumulativos)

### Gestion de temporadas

- **Historial de temporadas:** seccion colapsable que muestra temporadas anteriores con sus clasificaciones finales y ganador.
- **Cerrar temporada:** boton que permite al administrador cerrar la temporada actual y crear una nueva. Al cerrar:
  - Se registra el ganador (jugador con mas puntos).
  - Se crea una nueva temporada con puntos a cero.
  - Las predicciones futuras se asocian a la nueva temporada.

---

## Historial

Muestra tus resultados en partidos ya finalizados.

### Que ves

- **Estadisticas personales** en la parte superior:
  - Partidos pronosticados
  - Pronosticos correctos (algun punto obtenido)
  - Porcentaje de precision

- **Lista de partidos finalizados** (hasta 50, los mas recientes primero).
  - Cada tarjeta muestra: resultado real del partido, tu pronostico, y los puntos obtenidos.
  - **Desglose de puntos:** badges de color por cada categoria acertada (Ganador +1, HT +2, Diferencia +3, Exacto +4).

### Predicciones de todos los jugadores

- En cada tarjeta puedes expandir la seccion **"Puntuaciones"** para ver las predicciones de todos los jugadores en ese partido.
- Se ordenan por puntos obtenidos (de mayor a menor).
- Cada fila muestra: nombre del jugador, su pronostico, y el desglose de puntos.

### Filtros

- **Filtro de equipo:** Todos / Real Madrid / Barcelona.

---

## Datos tecnicos para el usuario

### Zona horaria

Todos los horarios de partidos se muestran en hora de **Madrid (Europe/Madrid)**. No necesitas ajustar nada.

### PWA (instalar como app)

En Chrome/Safari, puedes "Instalar" la app desde el navegador:
- **Android:** menu del navegador → "Agregar a pantalla de inicio"
- **iOS:** boton compartir → "Agregar a pantalla de inicio"

La app se abre en pantalla completa como una app nativa.

### Sincronizacion de datos

- Los partidos se sincronizan automaticamente desde football-data.org.
- Si un resultado no aparece actualizado, usa el boton **"Sincronizar"** en la pagina Jornada.
- Los puntos se calculan automaticamente cuando un partido pasa a estado FINISHED.
