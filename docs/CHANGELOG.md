# Cambios por fase

## Fase 2 — Motor de partido (rama `claude/fase-2-motor-partido`)

### Qué hay
- **Motor de partido por zonas** (`core/match/engine.ts`):
  - Cadenas de posesión y duelos logísticos contra el defensor más cercano según la forma táctica rival.
  - Tiros con xG por tipo de ocasión.
  - Faltas (también tácticas), tarjetas con árbitros de rigor distinto, lesiones, cansancio minuto a minuto, cambios de la IA y gestión del marcador.
  - Prórroga y penaltis teniendo en cuenta la ida.
  - Fotogramas clave para el visor 2D que no consumen RNG: verlo o no, el partido es el mismo.
- **Tácticas** (`types/tactics.ts`):
  - Seis sistemas y diales de mentalidad, presión, ritmo, amplitud y juego directo.
  - **Balón parado** completo: córners (primer palo, segundo palo, en corto, al borde del área y cuántos suben), faltas (tirar, centrar o en corto), saques de banda (cortos o largos al área), saque inicial al empezar y tras el descanso (elaborar o en largo) y lanzadores designados de penaltis, faltas, córners y saques largos.
  - **Instrucciones individuales** (13): el jugador decide en cada partido si las cumple según su profesionalidad, su ego, el choque con su forma de ser y la autoridad del técnico. Ignorarlas queda registrado en el mundo (`player.ignoredInstruction`) para la Fase 4.
- **Partido en directo**:
  - Se puede pausar en cualquier momento; en el descanso y antes de la prórroga se pausa solo.
  - En la pausa se hacen cambios, se cambia el sistema o la mentalidad, la presión y el ritmo, y se dan o quitan instrucciones; cada jugador vuelve a decidir si hace caso.
  - La IA rival reacciona a los cambios claros de mentalidad.
  - Es determinista: lo ya jugado nunca cambia, no se puede volver atrás y las intervenciones quedan guardadas en el partido.
- **Comandos** `setTactics` y `clearTactics`, validados (jugadores de la plantilla, rangos y rutinas válidas). La UI nunca toca el estado.
- **Consecuencias**:
  - Goleadores, asistentes y tarjetas en cada resultado.
  - Estadísticas por competición que pasan a la trayectoria al cerrar la temporada, más el máximo goleador en el historial.
  - Forma física que se recupera por días.
  - Lesiones con fecha de alta.
  - Sanciones por competición: roja directa 2 partidos, doble amarilla 1, cada 5 amarillas 1.
  - Internacionalidades.
  - Eventos de roja, lesión larga e instrucción ignorada.
- **Modelo rápido** recalibrado contra el motor completo; es el motor del LOD ligero (partidos entre clubes en sombra).
- **Estado v2** (`SAVE_VERSION = 2`) con migración v1→v2 y test.
- **`npm run sim`** (`tools/sim`): métricas de balance frente a los criterios de la fase y comparación motor completo frente a rápido sobre los mismos emparejamientos.
- **UI de depuración** (`apps/web`, `npm run dev`):
  - React + Vite y el juego en un Web Worker.
  - Pestañas: clasificación, resultados, plantilla (forma, lesiones, sanciones y estadísticas), goleadores, táctica completa y partido en directo con visor 2D, registro de eventos, estadísticas e instrucciones cumplidas o ignoradas.
  - En los 5 idiomas. Los datos reales se cargan solo si se piden.
- `npm run gen -- --seasons=N` muestra también los máximos goleadores y acepta `--engine=auto|full|quick`.

### Balance (criterios de DISEÑO §7)
20 temporadas, semilla 123, motor completo (`docs/balance/fase2.md`), en partidos de liga:

| Criterio | Objetivo | Resultado |
|---|---|---|
| Goles por partido | 2,5–2,9 | 2,64 ✅ |
| Victorias locales | 42–47 % | 43,4 % ✅ |
| Empates | 24–28 % | 24,7 % ✅ |
| Rojas por partido | 0,1–0,2 | 0,19 ✅ |
| Modelo rápido frente al completo | ±3 % | goles +0,6 %, locales +0,9 pp ✅ |
| Partido reproducible por `seedPath` | sí | test ✅ |
| Cola larga de goleadores | sí | P50 2 · P90 10 · P99 24 · récord 50 ✅ |

### Decisiones y desviaciones
- **Motor completo para todos los partidos con clubes jugables o selecciones** (`auto`). Los partidos entre clubes en sombra usan el modelo rápido. Una temporada mundial completa tarda ~20–25 s (~2,5 ms por partido), menos de 100 ms por día de juego.
- **Determinismo en navegador** (pendiente de la Fase 1): verificado a mano con Playwright. El mismo mundo tras 60 días tiene el mismo hash en Chromium (Web Worker) que en Node. Firefox y Safari no se han probado; si difieren, se añadiría un módulo de matemática determinista.
- **Test de temporadas**: usa el modelo rápido para no tardar minutos en CI (prueba calendario y competiciones, no el motor). El motor completo tiene su propio test (`match.test.ts`) y la CI ejecuta una temporada de `sim`.
- **Hash del mundo de referencia actualizado** por el formato v2 (campos nuevos; la generación no cambia).
- **Ideas registradas** (DISEÑO §11.3 y §11.4):
  - Multijugador asíncrono para 2–10 humanos con servidor propio, avance por días que solo espera a quien juega y anti-repetición con sal secreta por día. Pasa a ser la **Fase 8**.
  - Redes sociales ficticias, polémica arbitral con evidencia y comité de disciplina, dentro de la **Fase 5**.
  - El roadmap se renumera: 9 Assets e IA, 10 Pulido, 11 Director deportivo y presidente.
- **Pendiente para fases posteriores**:
  - Elegir el once a mano desde la UI: el plan ya lo admite, falta el control visual (Fase 7).
    - Conectar las instrucciones ignoradas con relaciones y tensiones de ego (Fase 4).
  - Controversias arbitrales con evidencia (Fase 5).

## Fase 1 — Núcleo (rama `claude/fase-1-nucleo`)

### Qué hay
- **Monorepo** con npm workspaces (`packages/core`, `packages/data`, `packages/i18n`, `tools/gen`), TypeScript estricto, Vitest, ESLint (con regla que prohíbe `Math.random`/`Date` en el núcleo) y CI de GitHub Actions.
- **RNG determinista**: `xoshiro128**` + `splitmix32`, *streams* derivados por ruta (`fork("match/mt_0001")`) que no dependen del consumo del padre; distribuciones (normal, beta, Poisson, ponderada, normal multivariante por Cholesky).
- **Tiempo** sin `Date`: `GameDay` con aritmética de calendario civil entera.
- **Datos**: 125 naciones reales en 6 confederaciones (55 europeas), 42 culturas de nombres con datos de apariencia, ~300 ciudades reales de las 5 naciones jugables, patrones de nombres de club por idioma, listas de bloqueo de clubes reales y futbolistas famosos.
- **Generación del mundo** (~1,6 s): 198 clubes en 10 ligas jugables con tamaños reales + ~380 clubes "en sombra" (tercer nivel de las naciones jugables y clubes de las naciones no jugables), ~15.900 jugadores, ~2.200 miembros de staff, 125 selecciones con convocatoria y Elo.
  - Jugadores: atributos coherentes con posición, edad y altura; perfil psicológico de 12 rasgos con correlaciones (cópula gaussiana) y 15 % sembrado hacia arquetipos; atributos ocultos derivados; techo latente inicial; doble nacionalidad para jugadores de origen inmigrante; apariencia canónica para retratos.
- **Competiciones** (motor de formatos genérico): ligas, copas con exentos y cabezas de serie que entran tarde, playoffs de ascenso, promociones contra la 1.ª división o contra el nivel en sombra, 3 competiciones europeas con fase de liga de 36 (sorteo suizo, 4 en casa / 4 fuera, sin cruces del mismo país), Ligas de Naciones (Europa A–D y Norte/Centroamérica) con ascensos y finales, clasificatorias por confederación, Mundial de 48, Eurocopa, Copa de las Américas, Copa Oro, Copa de África, Copa de Asia y amistosos en ventanas libres.
- **Calendario**: ventanas FIFA, semanas continentales, parones invernales y asignación de día concreto por partido con descanso mínimo de 3 días (recolocación recursiva de partidos vecinos). 0 choques en 4 temporadas.
- **Motor de días**: avanza día a día, convoca selecciones, programa amistosos, resuelve partidos, sortea rondas, cierra temporadas (ascensos/descensos, historial) y crea la siguiente.
- **i18n**: catálogo es/en/fr/de/zh para posiciones, atributos, arquetipos, confederaciones, competiciones y fases; nombres de países con `Intl.DisplayNames`.
- **Vistas** de jugador y club para la UI que nunca exponen ocultos, perfil psicológico ni techo latente.

### Paquete opcional de clubes reales
- `dataPack: "real"` (CLI: `--real`): las 10 ligas con sus clubes reales de 2025/26 (más tercera división como nivel en sombra) y los grandes de 17 ligas europeas no jugables, con colores, estadios de primera y una fuerza aproximada editable (`packages/data/src/real/clubs.ts`).
- **Jugadores reales**: ~1.800 jugadores (plantillas 2025/26 de los 98 clubes de primera división y los internacionales que juegan en Portugal, Países Bajos, Bélgica, Escocia, Turquía, Arabia Saudí, MLS, Brasil, Argentina y México). Las selecciones convocan a sus estrellas reales. Los huecos de plantilla se completan con suplentes ficticios.
- Los niveles son estimaciones del juego y la personalidad se genera al azar sin arquetipos extremos sembrados.
- **CSV**: `--export-players=jugadores.csv` exporta el pack; `--players=jugadores.csv` carga uno editado (con validación de club, nación, posición y nivel).
- `--top=20` (clubes más fuertes) y `--squad="Real Madrid"` / `--squad=ES` (plantilla o convocatoria).
- Hash del mundo de referencia actualizado: se añadieron 6 naciones africanas (Gambia, Guinea-Bisáu, Zimbabue, Mozambique, Togo, Guinea Ecuatorial) necesarias para nacionalidades reales.

### Datos actuales (2026/27)
- `npm run import:football-data` descarga las plantillas actuales de football-data.org (clave en `FOOTBALL_DATA_API_KEY`) y genera `packages/data/current/` (players.csv, leagues.json, report.md, raw.json). Conserva niveles conocidos, reconoce nombres escritos de otra forma, corrige fechas erróneas de la fuente y marca como estimados a los nuevos.
- `tools/import/src/reviewed.ts`: niveles revisados a mano que se aplican en cada importación.
- Segundas divisiones de ES/IT/DE/FR verificadas por búsqueda web (no están en el plan gratuito de la API).
- `npm run gen -- --current` usa estos datos.

### Ideas registradas para fases futuras
- Cláusulas de contrato (recompra por años, pagos a plazos, etc.) y roles jugables de director deportivo y presidente: `DISEÑO.md` §11.

### Provisional (se sustituye en la Fase 2)
- Los partidos se resuelven con un **modelo rápido de Poisson** por calidad del once (`match/quick.ts`), solo para que las competiciones avancen y poder probar calendario, clasificatorias y ascensos durante varias temporadas. No está calibrado contra los rangos de la §11.

### Desviaciones respecto al plan
- Test de sensibilidad con 6 semillas en vez de 50 (cada mundo tarda ~1,6 s).
- Test de determinismo en navegador: aplazado a la Fase 2, cuando exista `apps/web`. Riesgo conocido: `Math.exp/log/cos` no están garantizados bit a bit entre motores JS; si el test falla, se añadirá un módulo de matemática determinista.
- La siembra (`talent shape`) de atributos no se guarda: se deriva del stream `shape/<id>`, lo que ahorra ~45 números por jugador en el guardado.

### Números del mundo de referencia
Ver [`balance/fase1.md`](balance/fase1.md).
