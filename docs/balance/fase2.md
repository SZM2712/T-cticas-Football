# Balance de la Fase 2 — motor de partido

Generado con `npm run sim -- --seasons=20 --seed=123 --engine=full --compare --out=docs/balance/fase2.md`.

## Motor completo frente al rápido (mismos emparejamientos)

| Métrica | Completo | Rápido |
|---|---:|---:|
| Partidos | 3758 | 3758 |
| Goles/partido | 2.65 | 2.67 |
| Victoria local % | 42.4 | 43.3 |
| Empates % | 25.1 | 24.7 |
| Victoria visitante % | 32.4 | 31.9 |
| Rojas/partido | 0.20 | 0.00 |
| Amarillas/partido | 3.06 | 0.00 |
| Tiros/partido | 29.0 | 0.0 |
| A puerta/partido | 11.0 | 0.0 |
| xG/partido | 2.60 | 0.00 |
| Faltas/partido | 19.6 | 0.0 |
| Córners/partido | 8.3 | 0.0 |
| Penaltis/partido | 0.28 | 0.00 |
| Lesiones/partido | 0.26 | 0.00 |
| Goleadores P50 | 3 | 3 |
| Goleadores P90 | 12 | 23 |
| Goleadores P99 | 30 | 42 |
| Máximo goleador | 45 | 53 |
| % goleadores con 1 gol | 32.0 | 32.5 |
| ms/partido | 2.73 | 0.31 |

Diferencia del rápido: goles 0.6 %, victorias locales 0.9 pp, empates -0.4 pp.

## 20 temporada(s), semilla 123, motor full

Tiempo total 384.5 s (19.2 s por temporada) · choques de calendario: 0 · hash final fcc361a3b3b92f29

| Métrica | Ligas | Todos los partidos |
|---|---:|---:|
| Partidos | 75160 | 105920 |
| Goles/partido | 2.64 | 2.68 |
| Victoria local % | 43.4 | 42.8 |
| Empates % | 24.7 | 23.5 |
| Victoria visitante % | 32.0 | 33.7 |
| Rojas/partido | 0.19 | 0.19 |
| Amarillas/partido | 3.08 | 3.11 |
| Tiros/partido | 29.0 | 29.3 |
| A puerta/partido | 11.0 | 11.1 |
| xG/partido | 2.58 | 2.63 |
| Faltas/partido | 19.5 | 19.7 |
| Córners/partido | 8.2 | 8.3 |
| Penaltis/partido | 0.29 | 0.29 |
| Lesiones/partido | 0.25 | 0.25 |
| Goleadores P50 | 2 | 1 |
| Goleadores P90 | 10 | 6 |
| Goleadores P99 | 24 | 21 |
| Máximo goleador | 50 | 50 |
| % goleadores con 1 gol | 36.1 | 53.2 |
| ms/partido | 3.44 | 3.45 |

### Criterios de aceptación (partidos de liga)

- ✅ goalsPerMatch: 2.64 (objetivo 2.5–2.9)
- ✅ homeWinPct: 43.39 (objetivo 42–47)
- ✅ drawPct: 24.66 (objetivo 24–28)
- ✅ redsPerMatch: 0.19 (objetivo 0.1–0.2)


## Lectura

- **Criterios de la fase cumplidos** en 75.160 partidos de liga (20 temporadas): 2,64 goles por partido, 43,4 % de victorias locales, 24,7 % de empates y 0,19 rojas por partido.
- **Modelo rápido frente al completo**: goles +0,6 %, victorias locales +0,9 pp (+2 % relativo), empates −0,4 pp. Dentro del ±3 %.
- **Cola larga de goleadores**: la mediana de un goleador de liga es de 2 goles por temporada, el P90 de 10, el P99 de 24 y el récord en 20 temporadas es de 50. Uno de cada tres goleadores marca un solo gol. El récord está en el extremo alto de lo real (récords de 40–50 en las grandes ligas): cuando el desarrollo (Fase 3) haga rotar a las estrellas, convendrá vigilarlo.
- **El modelo rápido concentra demasiado los goles** en pocos jugadores (P90 de 23), porque reparte por un once fijo sin rotación. Solo se usa entre clubes en sombra, así que no afecta a las ligas jugables.
- **Otras métricas** (no son criterio): 29 tiros, 11 a puerta, 19,5 faltas, 3,1 amarillas, 8,2 córners y 0,29 penaltis por partido. Faltas y córners quedan algo por debajo de las grandes ligas (22–24 y 9–10); se pueden subir con `LOOSE_FOUL` y `CROSS_CORNER` sin tocar los criterios.
- **Rendimiento**: 2,7 ms por partido del motor completo (incluida la alineación) y 19 s por temporada mundial completa.
