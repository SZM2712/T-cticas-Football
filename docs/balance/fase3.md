# Balance de la Fase 3 — desarrollo

Generado con `npm run sim -- --seasons=20 --engine=quick --dev` (semilla 123, motor rápido en todos los partidos para acelerar 20 temporadas; el desarrollo es el mismo con cualquier motor).
Actualizado en la Fase 4: control de la élite (criterio del usuario: ±12 %), niños prodigio, desarrollo mensual repartido por días y encaje / florecimiento tardío (DISEÑO §4.3.1).

### Talento mundial por temporada (jugadores con club)

| Temporada | Jugadores | CA P50 | P95 | P99 | Élite (CA ≥ 16) | Edad media | ≤ 21 años |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2026 | 16186 | 11.01 | 14.14 | 15.56 | 52 | 25.9 | 2551 |
| 2027 | 16320 | 10.97 | 14.15 | 15.49 | 53 | 26.1 | 2797 |
| 2028 | 16505 | 10.94 | 14.14 | 15.49 | 54 | 26.4 | 3226 |
| 2029 | 16587 | 10.88 | 14.15 | 15.49 | 50 | 26.6 | 3327 |
| 2030 | 16619 | 10.79 | 14.13 | 15.46 | 49 | 26.6 | 3497 |
| 2031 | 16631 | 10.71 | 14.14 | 15.45 | 49 | 26.5 | 3307 |
| 2032 | 16627 | 10.62 | 14.14 | 15.45 | 49 | 26.4 | 3668 |
| 2033 | 16606 | 10.54 | 14.16 | 15.45 | 49 | 26.1 | 4052 |
| 2034 | 16579 | 10.48 | 14.19 | 15.44 | 49 | 25.8 | 4224 |
| 2035 | 16577 | 10.42 | 14.20 | 15.47 | 53 | 25.5 | 4269 |
| 2036 | 16610 | 10.40 | 14.26 | 15.48 | 52 | 25.3 | 4249 |
| 2037 | 16607 | 10.39 | 14.31 | 15.49 | 51 | 25.3 | 3927 |
| 2038 | 16644 | 10.40 | 14.35 | 15.51 | 53 | 25.3 | 3558 |
| 2039 | 16675 | 10.42 | 14.38 | 15.54 | 52 | 25.6 | 3141 |
| 2040 | 16701 | 10.42 | 14.40 | 15.53 | 50 | 25.9 | 2764 |
| 2041 | 16699 | 10.39 | 14.39 | 15.54 | 53 | 26.1 | 2619 |
| 2042 | 16707 | 10.38 | 14.39 | 15.55 | 54 | 26.3 | 2669 |
| 2043 | 16688 | 10.37 | 14.40 | 15.54 | 54 | 26.4 | 2898 |
| 2044 | 16691 | 10.35 | 14.40 | 15.51 | 53 | 26.4 | 3127 |
| 2045 | 16677 | 10.33 | 14.38 | 15.50 | 54 | 26.4 | 3322 |
| 2046 | 16675 | 10.31 | 14.36 | 15.50 | 54 | 26.4 | 3489 |

### Criterio de la Fase 3: sin inflación (±8 % en P50/P95/P99 y ±12 % en élite respecto al año 1)

- ✅ p50: desviación máxima 6.4 % (límite 8 %)
- ✅ p95: desviación máxima 1.9 % (límite 8 %)
- ✅ p99: desviación máxima 0.8 % (límite 8 %)
- ✅ elite: desviación máxima 5.8 % (límite 12 %)

### Criterios de aceptación (partidos de liga)

## Lectura

- **P50, P95 y P99 cumplen** (desviación máxima 6,4 %, 1,9 % y 0,8 %). El nivel mediano baja despacio porque la plantilla rejuvenece.
- **La élite (CA ≥ 16) cumple el ±12 %**: empieza en 52, se mueve entre 49 y 54 y acaba en 54 (desviación máxima 5,8 %); el encaje no la infla porque se mide respecto a la media y los cracks no florecen. Antes del control oscilaba entre 44 y 64 (±23–29 %).
- **Cómo se controla** (DISEÑO §10c):
  - la «generación que viene» cubre objetivo − élite + salidas previstas por la edad de los cracks;
  - si faltan cracks, los jóvenes que llegarían antes reciben techo de élite;
  - fuera de ±6 %, un ajuste de cierre sobre unos pocos jugadores en el límite: en 20 temporadas, 13 veteranos a los que pasó factura la edad y 15 temporadas de explosión.
- **Niños prodigio**:
  - 5 en el mundo inicial y 1 por temporada (25 en 20 temporadas);
  - antes llegaban a la élite 23 de 25 (92 %); ahora su techo es una promesa que un mal entorno (sin minutos reales, mal encaje, poca profesionalidad) erosiona deprisa: con las semillas 123, 7 y 2024 llegan 12, 15 y 14 de 25 (48–60 %), y los que se quedan por el camino tocan techo entre 13 y 15,9.
- **Florecimiento tardío**: en cada cierre de temporada florecen ~160–200 adultos (de ~7.700 entre 25 y 31 años), despacio: en un club con mánager humano que confía en ellos y en su puesto, +0,2 de nivel al año y su techo sube (test «un adulto que encaja… puede florecer»).

## Balance de partidos tras el desarrollo

Comprobado con `npm run sim -- --seasons=8 --engine=auto`:

- ✅ goles por partido: 2,57 (objetivo 2,5–2,9)
- ✅ victoria local: 43,20 % (objetivo 42–47)
- ✅ empates: 24,95 % (objetivo 24–28)
- ✅ rojas por partido: 0,16 (objetivo 0,1–0,2)
