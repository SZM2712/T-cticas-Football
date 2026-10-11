# CLAUDE.md — Tactical Football

Simulador de gestión futbolística centrado en las personas: ego, vestuario, promesas, prensa con memoria y un potencial que nadie conoce con certeza.
El documento de diseño completo está en `docs/DISEÑO.md`. Este archivo resume las reglas de trabajo.

## Reglas innegociables

1. **Determinismo con semilla.** Mismo seed + mismas decisiones → mismo mundo y mismos partidos. Prohibido `Math.random()`, `Date.now()` o iterar `Map`/`Set`/objetos sin orden estable dentro de `/core`. Todo azar sale de `core/rng` con un stream por subsistema.
2. **El núcleo es headless.** `packages/core` es TypeScript puro: sin DOM, sin React, sin IndexedDB, sin `fetch`. Corre igual en Node, en Web Worker y en tests.
3. **La UI nunca contiene lógica de simulación.** La UI envía `Command`s al núcleo y lee `View`s (proyecciones de solo lectura). Nunca muta el estado.
4. **El LLM narra, no decide.** Resultados de partidos, fichajes, desarrollo y reacciones salen del motor. `DialogueProvider` solo redacta texto a partir de un `DialogueIntent` ya resuelto. El juego funciona 100 % offline sin LLM.
5. **Todo tiene consecuencia recordada.** Una funcionalidad no está terminada si no deja huella en la memoria episódica, una relación, una narrativa o una promesa.
6. **Rasgos ocultos nunca se exponen como número** en UI, logs de usuario ni tooltips. Solo como texto cualitativo derivado ("parece afectarle la presión").
7. **El mundo por defecto es ficticio.** Países, idiomas y ciudades son reales; clubes, jugadores, staff y competiciones son ficticios con nombres genéricos, y todo nombre generado pasa por las listas de bloqueo de `packages/data`. Los datos reales viven SOLO en paquetes opcionales (`dataPack: "real"`, `packages/data/src/real/`) que nunca se cargan por defecto ni alteran el hash del mundo ficticio.

## Stack

- TypeScript `strict` (más `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- Monorepo con npm workspaces: `packages/core`, `packages/data`, `packages/i18n`, `apps/web`, `tools/gen`, `tools/sim`, `tools/assets`.
- UI: React + Vite (PWA) + escritorio con Tauri (Fase 7). Estado de UI con Zustand; el estado de juego vive en un Worker.
- Idiomas de UI: es (por defecto), en, fr, de, zh. Ninguna clave puede faltar en ningún idioma (hay test).
- Persistencia: IndexedDB vía Dexie; guardados versionados con migraciones encadenadas.
- RNG: `xoshiro128**` sembrado con `splitmix32`; streams derivados por nombre (`rng.fork("match")`).
- Tests: Vitest. Balance: scripts Node en `tools/sim`.

## Convenciones de código

- Identificadores, tipos y nombres de archivo **en inglés**; comentarios y documentación **en español**; textos de UI vía `packages/i18n`. El núcleo guarda claves y códigos, nunca texto traducido.
- Escala interna de atributos: `float` 1–20; la UI redondea. Rasgos psicológicos: `float` 0–1.
- Tiempo de juego: `GameDay` = entero (días desde el inicio del mundo). Nada de `Date` en el núcleo.
- IDs: strings con prefijo y contador determinista (`pl_000123`, `cl_0042`).
- Estado = datos planos serializables (sin clases con métodos en el estado). Los sistemas son funciones `(world, rng, ctx) => WorldEvent[]` y un reductor aplica los eventos.
- `Promise` está reservado por JS: las promesas del mánager se llaman `Commitment`.
- Nada de números mágicos en sistemas: van a `core/config/*.ts` con comentario de qué controlan (son los diales de balance).

## Comandos (se crearán en la Fase 1)

```bash
npm install
npm test                         # Vitest en todo el monorepo
npm run typecheck
npm run lint
npm run gen -- --seed=123        # genera un mundo y imprime su hash
npm run sim -- --seasons=20 --seed=123   # simulación headless (desde la Fase 2)
npm run dev                      # UI (desde la Fase 7, prototipo antes)
```

## Flujo de trabajo por fases

- Trabajar fase a fase según `docs/DISEÑO.md` §12. No adelantar fases sin pedirlo.
- **Un PR por fase**, en su propia rama `claude/fase-N-...`; no se empieza la siguiente fase sin revisar el PR.
- Cerrar una fase = tests verdes + typecheck + simulación de balance de la fase ejecutada + resumen de cambios en `docs/CHANGELOG.md`.
- Todo cambio en el formato del estado incrementa `SAVE_VERSION` y añade una migración con test.
- Si un cambio altera el hash del mundo de referencia (`seed=123`), debe ser intencional y el snapshot se actualiza en el mismo commit explicando por qué.
