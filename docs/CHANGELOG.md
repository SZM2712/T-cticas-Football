# Cambios por fase

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

### Provisional (se sustituye en la Fase 2)
- Los partidos se resuelven con un **modelo rápido de Poisson** por calidad del once (`match/quick.ts`), solo para que las competiciones avancen y poder probar calendario, clasificatorias y ascensos durante varias temporadas. No está calibrado contra los rangos de la §11.

### Desviaciones respecto al plan
- Test de sensibilidad con 6 semillas en vez de 50 (cada mundo tarda ~1,6 s).
- Test de determinismo en navegador: aplazado a la Fase 2, cuando exista `apps/web`. Riesgo conocido: `Math.exp/log/cos` no están garantizados bit a bit entre motores JS; si el test falla, se añadirá un módulo de matemática determinista.
- La siembra (`talent shape`) de atributos no se guarda: se deriva del stream `shape/<id>`, lo que ahorra ~45 números por jugador en el guardado.

### Números del mundo de referencia
Ver [`balance/fase1.md`](balance/fase1.md).
