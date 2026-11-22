# Balance de la Fase 5 — medios, redes y disciplina

Generado con `npm run sim:media -- --seasons=20 --seed=123`. Un mánager humano en un club de la liga española; todas sus ruedas de prensa las atiende el asistente, con directrices que cambian cada temporada. En las temporadas impares el mánager es impulsivo: tras una polémica que le perjudica critica al árbitro en redes, y alega y recurre los expedientes.

| Temporada | Ruedas de prensa | Preguntas | De narrativas | Publicaciones | Virales | Polémicas | Expedientes | Sancionados | Narrativas nuevas |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2026 | 122 | 201 | 79 | 378 | 17 | 22 | 0 | 0 | 15 |
| 2027 | 106 | 188 | 82 | 351 | 19 | 29 | 9 | 9 | 16 |
| 2028 | 98 | 167 | 69 | 313 | 9 | 17 | 0 | 0 | 14 |
| 2029 | 100 | 188 | 88 | 340 | 14 | 24 | 8 | 7 | 14 |
| 2030 | 112 | 189 | 77 | 333 | 17 | 23 | 0 | 0 | 15 |
| 2031 | 100 | 190 | 90 | 358 | 22 | 21 | 12 | 10 | 13 |
| 2032 | 122 | 190 | 68 | 332 | 10 | 23 | 0 | 0 | 12 |
| 2033 | 102 | 167 | 65 | 325 | 20 | 17 | 8 | 6 | 19 |
| 2034 | 106 | 186 | 80 | 357 | 18 | 18 | 0 | 0 | 18 |
| 2035 | 110 | 185 | 75 | 362 | 25 | 25 | 14 | 13 | 15 |
| 2036 | 118 | 165 | 47 | 311 | 6 | 26 | 0 | 0 | 10 |
| 2037 | 98 | 163 | 65 | 302 | 11 | 14 | 5 | 4 | 10 |
| 2038 | 80 | 133 | 53 | 243 | 10 | 17 | 0 | 0 | 14 |
| 2039 | 90 | 166 | 76 | 302 | 11 | 22 | 10 | 8 | 15 |
| 2040 | 110 | 179 | 69 | 315 | 10 | 18 | 0 | 0 | 13 |
| 2041 | 78 | 164 | 86 | 313 | 11 | 22 | 8 | 7 | 13 |
| 2042 | 116 | 200 | 84 | 365 | 16 | 30 | 0 | 0 | 14 |
| 2043 | 106 | 197 | 91 | 359 | 12 | 22 | 11 | 8 | 12 |
| 2044 | 90 | 169 | 79 | 316 | 5 | 18 | 0 | 0 | 8 |
| 2045 | 80 | 174 | 94 | 329 | 27 | 26 | 18 | 14 | 14 |

## Criterios de aceptación

- ✅ Preguntas repetidas en una temporada sin hecho nuevo: 0 (de 1517 preguntas de narrativas).
- ✅ Respuestas del asistente que violan una directriz: 0 (de 3561).
- ✅ Sanciones sin hechos enlazados: 0; hechos que no se pueden enseñar: 0.
- ✅ Publicaciones con parámetros que no son nombres o recuentos visibles: 0 (de 6604).
- Coste: 52.7 ms por día de juego de media (7305 días, motor completo solo para el club humano).
