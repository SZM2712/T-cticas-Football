# Balance de la Fase 3 — desarrollo

Generado con `npm run sim -- --seasons=20 --engine=quick --dev` (semilla 123, motor rápido en todos los partidos para acelerar 20 temporadas; el desarrollo es el mismo con cualquier motor).
Tiempo: 283 s (14,2 s por temporada) · hash final `f0663ade5f5fa41e`.

### Talento mundial por temporada (jugadores con club)

| Temporada | Jugadores | CA P50 | P95 | P99 | Élite (CA ≥ 16) | Edad media | ≤ 21 años |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2026 | 16186 | 11.01 | 14.14 | 15.56 | 52 | 25.9 | 2551 |
| 2027 | 16320 | 10.97 | 14.15 | 15.49 | 53 | 26.2 | 2787 |
| 2028 | 16508 | 10.94 | 14.13 | 15.50 | 56 | 26.4 | 3204 |
| 2029 | 16583 | 10.87 | 14.15 | 15.51 | 58 | 26.5 | 3358 |
| 2030 | 16619 | 10.78 | 14.14 | 15.49 | 57 | 26.6 | 3513 |
| 2031 | 16618 | 10.70 | 14.14 | 15.47 | 45 | 26.5 | 3327 |
| 2032 | 16634 | 10.63 | 14.14 | 15.52 | 44 | 26.4 | 3640 |
| 2033 | 16601 | 10.57 | 14.16 | 15.50 | 47 | 26.1 | 3959 |
| 2034 | 16591 | 10.50 | 14.18 | 15.52 | 49 | 25.8 | 4121 |
| 2035 | 16581 | 10.45 | 14.23 | 15.51 | 54 | 25.5 | 4239 |
| 2036 | 16597 | 10.42 | 14.25 | 15.51 | 56 | 25.3 | 4232 |
| 2037 | 16620 | 10.42 | 14.28 | 15.55 | 59 | 25.3 | 3990 |
| 2038 | 16636 | 10.41 | 14.30 | 15.56 | 62 | 25.4 | 3602 |
| 2039 | 16681 | 10.43 | 14.34 | 15.60 | 64 | 25.6 | 3107 |
| 2040 | 16696 | 10.43 | 14.36 | 15.59 | 63 | 25.9 | 2770 |
| 2041 | 16701 | 10.41 | 14.38 | 15.58 | 64 | 26.1 | 2621 |
| 2042 | 16688 | 10.40 | 14.39 | 15.59 | 63 | 26.3 | 2704 |
| 2043 | 16672 | 10.39 | 14.38 | 15.60 | 59 | 26.4 | 2922 |
| 2044 | 16661 | 10.37 | 14.37 | 15.61 | 54 | 26.4 | 3095 |
| 2045 | 16653 | 10.35 | 14.38 | 15.58 | 57 | 26.4 | 3267 |
| 2046 | 16640 | 10.32 | 14.36 | 15.59 | 54 | 26.4 | 3401 |

### Criterio de la Fase 3: sin inflación (±8 % respecto al año 1)

- ✅ p50: desviación máxima 6.3 %
- ✅ p95: desviación máxima 1.8 %
- ✅ p99: desviación máxima 0.5 %
- ❌ elite: desviación máxima 23.1 %

### Criterios de aceptación (partidos de liga)

## Lectura

- **P50, P95 y P99 cumplen** (desviación máxima 6,3 %, 1,8 % y 0,5 %). El nivel mediano baja despacio porque la plantilla rejuvenece: la cantera repone retiradas con jugadores de 18–20 años que aún no han crecido.
- **La élite (CA ≥ 16) no se infla**: empieza con 52–53, oscila entre 44 y 64 y acaba en 54. **No cumple el ±8 % (desviación máxima 23 %).**
  - Son unos 55 jugadores en todo el mundo: solo el ruido aleatorio de un recuento así ya mueve el número en torno a ±13 % (√55 ≈ 7,4).
  - Además, la cantera tarda de 3 a 5 años en dar un crack. Las oleadas de edad de la generación inicial (columna «≤ 21 años») producen un valle hacia 2031–2033 y un pico hacia 2039–2041.
  - Cada temporada se corrige el tamaño de la «generación que viene» según lo lejos que esté la élite de su cuota mundial (`ELITE_TARGET_SHARE`, `ELITE_FEEDBACK`). Sin esa corrección, la élite subía hasta 91 (+60 %) con cupo fijo, o hasta 219 sin cupo.
  - Propuesta: medir la élite con un criterio adecuado a su tamaño, por ejemplo **±25 % y sin tendencia** (la media de las 5 últimas temporadas cerca del año 1: aquí 57,4 frente a 53, un +8,3 %, en el límite). Queda a decisión en la revisión del PR.

## Balance de partidos tras el desarrollo

Comprobado con `npm run sim -- --seasons=8 --engine=auto`. Sigue dentro de los objetivos de la Fase 2:

- ✅ goles por partido: 2,55 (objetivo 2,5–2,9)
- ✅ victoria local: 42,87 % (objetivo 42–47)
- ✅ empates: 24,81 % (objetivo 24–28)
- ✅ rojas por partido: 0,16 (objetivo 0,1–0,2)

Con solo 2 temporadas los empates salen en 23,9 %: es ruido de muestra.
