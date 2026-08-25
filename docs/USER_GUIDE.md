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
| **Castellon** | Escudo | Partidos y clasificacion del CD Castellon (solo administrador) |

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
- +3 puntos: acertar el marcador del primer tiempo (descanso)
- +2 puntos: acertar la diferencia de goles

> **Cambio de reglas (26/08/2026):** el descanso pasa a valer 3 puntos y la diferencia 2; antes era al reves. Se aplica **a partir del partido Real Madrid - Real Sociedad del 26/08**. Todo lo jugado antes conserva los puntos que ya diste por bueno, y el maximo por partido sigue siendo 10.
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
  - **Desglose de puntos:** badges de color por cada categoria acertada (Ganador +1, HT +3, Diferencia +2, Exacto +4; en partidos anteriores al 26/08/2026, HT +2 y Diferencia +3).

### Predicciones de todos los jugadores

- En cada tarjeta puedes expandir la seccion **"Puntuaciones"** para ver las predicciones de todos los jugadores en ese partido.
- Se ordenan por puntos obtenidos (de mayor a menor).
- Cada fila muestra: nombre del jugador, su pronostico, y el desglose de puntos.

### Filtros

- **Filtro de equipo:** Todos / Real Madrid / Barcelona.

---

## Estadisticas

Pagina dedicada a analizar el rendimiento de los jugadores. Todo lo que ves aqui sale
de vuestros propios pronosticos: no depende de ninguna API externa.

### Acceso

Entra desde **Estadisticas** en la barra de navegacion. Por defecto muestra la temporada
activa; con el selector de arriba puedes ver cualquier temporada anterior.

### 1. Tu rendimiento

Una tarjeta por jugador, mas una grafica comun de puntos acumulados:

- **Puntos totales** y **media** de puntos por pronostico (sobre un maximo de 10).
- **Precision:** porcentaje de tus pronosticos que sacaron algun punto.
- **Plenos:** pronosticos de 10 puntos, es decir, los que acertaron las cuatro categorias.
- **En blanco:** pronosticos que se quedaron a cero puntos.
- **Racha actual:** cuantos pronosticos seguidos llevas puntuando ahora mismo.
- **Mejor racha:** la mayor cadena de pronosticos con puntos de la temporada.
- **De donde salen los puntos:** una barra por categoria (ganador, descanso, diferencia,
  exacto) con los **puntos** sumados en cada una; el numero pequeno de la derecha (×N) es
  cuantas veces la acertaste.
- **Mejor acierto:** el partido donde mas puntos sacaste.
- **Mejor dia:** la fecha en la que mas puntos sumaste sumando todos los partidos del dia.
- **Grafica de puntos acumulados:** una linea por jugador, para ver quien tiro de quien
  y en que momento se abrio o cerro la brecha.

### 2. Cara a cara

El duelo entre los dos jugadores con mas puntos, contando **solo los partidos que ambos
pronosticaron**:

- **Duelos ganados:** en cuantos de esos partidos uno saco mas puntos que el otro, y
  cuantos quedaron empatados.
- **Ambos clavaron el exacto:** partidos en los que los dos acertasteis el resultado exacto.
- **Ninguno puntuo:** partidos en los que los dos os quedasteis a cero.
- **Diferencia acumulada:** la grafica de la ventaja a lo largo del tiempo. Por encima de
  la linea central manda el primer jugador; por debajo, el segundo.

> **Ojo:** esta ventaja **no tiene por que coincidir con la de la Clasificacion**. Aqui solo
> cuentan los partidos que pronosticaron los dos, asi que los partidos que solo pronostico
> uno de vosotros quedan fuera del calculo.

### 3. Tus manias

Los patrones que no se ven en la clasificacion:

- **Marcador favorito:** el resultado que mas repites, y cuantas veces lo has puesto.
- **Error medio:** de media, cuantos goles te separan del marcador real (sumando la
  desviacion del local y la del visitante). Siempre es positivo: mide cuanto fallas, no
  en que direccion.
- **Acierta el 1X2** y **acierta el descanso:** porcentaje de aciertos en cada una.
- **Goles que pronostica vs goles reales:** si pronosticas mas goles de los que se marcan,
  la app te llama **optimista**; si pronosticas menos, **conservador**; y si la diferencia
  es minima, **clavado**.
- **Donde mas puntua:** los equipos con los que mejor se te da, en puntos por partido.
  Solo aparecen equipos con al menos 3 pronosticos, para que un unico acierto no distorsione.

### 4. Palmares y records

A diferencia de los bloques anteriores, **los records son historicos**: cuentan todas las
temporadas, no la seleccionada en el desplegable.

- **Palmares:** cuantas temporadas ha ganado cada jugador.
- **Mejor pronostico:** la mejor puntuacion individual de la historia, de cualquier jugador,
  con el partido y el resultado real.
- **Mejor dia:** el dia con mas puntos sumados por un jugador.
- **El partido mas traicionero:** el partido concreto con la media de puntos mas baja entre
  todos los que lo pronosticaron. El que os pillo a todos.
- **El mas cantado:** el contrario, el partido con la media mas alta.
- **Temporadas:** el listado completo, con el ganador y sus puntos.

---

## CD Castellon (solo administrador)

Seccion personal, **sin ninguna relacion con la liga de apuestas**: aqui no se pronostica
nada ni se suman puntos, es solo para consultar como va el equipo. Solo aparece en el menu
si entras con la cuenta de administrador; el resto de jugadores no la ven.

Tiene dos pestanas:

- **Partidos** — Proximos encuentros del Castellon con dia y hora, y ultimos resultados. Cada
  partido lleva una franja de color a la izquierda: verde si gano, roja si perdio, gris si
  empato y azul si aun no se ha jugado.
- **Clasificacion** — Tabla completa de LaLiga Hypermotion con los 22 equipos. La fila del
  Castellon aparece resaltada.

**Sobre el boton "Refrescar":** los datos vienen de una API externa con un limite de 100
consultas al mes, asi que la app se refresca sola cada pocos dias en lugar de a cada rato.
Si acaba de terminar un partido y quieres el resultado ya, pulsa "Refrescar". Abajo del todo
veras cuantas consultas se han gastado este mes. Si se agotan, la pagina sigue funcionando
pero muestra los ultimos datos guardados en vez de dar error.

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
