# Tactical Football

Simulador de gestión futbolística centrado en las personas: ego, vestuario, promesas, prensa con memoria y un potencial que nadie conoce con certeza.

- Visión del producto: [`docs/VISION.md`](docs/VISION.md)
- Diseño técnico y roadmap: [`docs/DISEÑO.md`](docs/DISEÑO.md)
- Reglas de trabajo: [`CLAUDE.md`](CLAUDE.md)
- Cambios por fase: [`docs/CHANGELOG.md`](docs/CHANGELOG.md)

## Uso

```bash
npm install
npm test                                  # tests (Vitest)
npm run typecheck && npm run lint
npm run gen -- --seed=123 --stats         # genera el mundo e imprime hash y estadísticas
npm run gen -- --seed=123 --seasons=4     # simula 4 temporadas con el motor de partido
npm run sim -- --seasons=20 --seed=123 --compare   # balance del motor frente a los criterios de la Fase 2
npm run dev                               # UI de depuración en http://localhost:5173 (partido en directo, táctica…)
npm run gen -- --real --top=20 --seasons=1  # clubes y jugadores reales: los 20 más fuertes y una temporada
npm run gen -- --real --squad=ES            # convocatoria de España (o --squad="Real Madrid")
npm run gen -- --export-players=jugadores.csv  # exporta los jugadores reales para editarlos
npm run gen -- --players=jugadores.csv         # usa tu CSV editado
npm run import:football-data                  # descarga plantillas actuales (requiere FOOTBALL_DATA_API_KEY)
npm run gen -- --current --top=20             # usa los datos importados
```

## Estructura

| Paquete | Contenido |
|---|---|
| `packages/core` | Núcleo determinista y headless: RNG, tiempo, generación del mundo, competiciones, calendario, motor de partido, tácticas, motor de días |
| `packages/data` | Datos reales no licenciados (naciones, idiomas, ciudades, culturas de nombres) y listas de bloqueo |
| `packages/i18n` | Textos de UI en es/en/fr/de/zh |
| `apps/web` | UI de depuración (React + Vite): el juego corre en un Web Worker; visor 2D de partidos |
| `tools/gen` | CLI de generación y simulación |
| `tools/sim` | Simulación headless de balance del motor de partido |
