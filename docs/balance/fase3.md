# Balance de la Fase 3 — desarrollo

Generado con `npm run sim -- --seasons=20 --engine=quick --dev` (semilla 123, motor rápido en todos los partidos para acelerar 20 temporadas; el desarrollo es el mismo con cualquier motor).
Actualizado en la Fase 4: control de la élite (criterio del usuario: ±12 %), niños prodigio y desarrollo mensual repartido por días.

### Talento mundial por temporada (jugadores con club)

| Temporada | Jugadores | CA P50 | P95 | P99 | Élite (CA ≥ 16) | Edad media | ≤ 21 años |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2026 | 16186 | 11.01 | 14.14 | 15.56 | 52 | 25.9 | 2551 |
| 2027 | 16320 | 10.97 | 14.15 | 15.49 | 53 | 26.1 | 2797 |
| 2028 | 16505 | 10.94 | 14.14 | 15.49 | 54 | 26.4 | 3226 |
| 2029 | 16581 | 10.88 | 14.14 | 15.49 | 52 | 26.6 | 3345 |
| 2030 | 16619 | 10.78 | 14.12 | 15.44 | 49 | 26.6 | 3488 |
| 2031 | 16612 | 10.70 | 14.11 | 15.40 | 49 | 26.5 | 3287 |
| 2032 | 16628 | 10.61 | 14.13 | 15.43 | 49 | 26.4 | 3681 |
| 2033 | 16610 | 10.54 | 14.14 | 15.42 | 49 | 26.1 | 4027 |
| 2034 | 16606 | 10.49 | 14.16 | 15.42 | 49 | 25.8 | 4228 |
| 2035 | 16602 | 10.44 | 14.21 | 15.45 | 52 | 25.5 | 4301 |
| 2036 | 16598 | 10.42 | 14.25 | 15.46 | 53 | 25.3 | 4236 |
| 2037 | 16611 | 10.41 | 14.27 | 15.48 | 50 | 25.3 | 3971 |
| 2038 | 16645 | 10.41 | 14.30 | 15.50 | 49 | 25.3 | 3582 |
| 2039 | 16681 | 10.43 | 14.34 | 15.54 | 52 | 25.6 | 3128 |
| 2040 | 16712 | 10.43 | 14.38 | 15.55 | 54 | 25.8 | 2817 |
| 2041 | 16717 | 10.41 | 14.37 | 15.55 | 53 | 26.1 | 2667 |
| 2042 | 16711 | 10.41 | 14.36 | 15.56 | 54 | 26.3 | 2692 |
| 2043 | 16699 | 10.40 | 14.37 | 15.55 | 54 | 26.4 | 2908 |
| 2044 | 16692 | 10.37 | 14.35 | 15.55 | 54 | 26.4 | 3076 |
| 2045 | 16669 | 10.35 | 14.36 | 15.54 | 51 | 26.5 | 3211 |
| 2046 | 16653 | 10.32 | 14.33 | 15.52 | 54 | 26.4 | 3395 |

### Criterio de la Fase 3: sin inflación (±8 % en P50/P95/P99 y ±12 % en élite respecto al año 1)

- ✅ p50: desviación máxima 6.3 % (límite 8 %)
- ✅ p95: desviación máxima 1.7 % (límite 8 %)
- ✅ p99: desviación máxima 1.0 % (límite 8 %)
- ✅ elite: desviación máxima 5.8 % (límite 12 %)

### Criterios de aceptación (partidos de liga)

## Lectura

- **P50, P95 y P99 cumplen** (desviación máxima 6,3 %, 1,7 % y 1,0 %). El nivel mediano baja despacio porque la plantilla rejuvenece.
- **La élite (CA ≥ 16) cumple el ±12 %**: empieza en 52, se mueve entre 49 y 54 y acaba en 54 (desviación máxima 5,8 %). Antes del control oscilaba entre 44 y 64 (±23–29 %).
- **Cómo se controla** (DISEÑO §10c):
  - la «generación que viene» cubre objetivo − élite + salidas previstas por la edad de los cracks;
  - si faltan cracks, los jóvenes que llegarían antes reciben techo de élite;
  - fuera de ±6 %, un ajuste de cierre sobre unos pocos jugadores en el límite: en 20 temporadas, 18 veteranos a los que pasó factura la edad y 9 temporadas de explosión.
- **Niños prodigio**:
  - 5 en el mundo inicial y 1 por temporada (25 en 20 temporadas);
  - 23 de los 25 llegan alguna vez a la élite: en una buena cantera su techo crece durante la etapa formativa.

## Balance de partidos tras el desarrollo

Comprobado con `npm run sim -- --seasons=8 --engine=auto`:

- ✅ goles por partido: 2,57 (objetivo 2,5–2,9)
- ✅ victoria local: 43,20 % (objetivo 42–47)
- ✅ empates: 24,95 % (objetivo 24–28)
- ✅ rojas por partido: 0,16 (objetivo 0,1–0,2)
