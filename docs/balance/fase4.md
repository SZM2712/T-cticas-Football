# Balance de la Fase 4 — vestuario y ego

## Escenarios guionizados (200 semillas cada uno)

Se ejecutan en `packages/core/test/social.test.ts`. Con `SOCIAL_REPORT=1` imprimen su tasa.

Cada semilla parte del club con más reputación del mundo `seed=77`, con los 12 rasgos psicológicos de toda la plantilla perturbados (σ = 0,15) y un mánager humano al mando.

| Dinámica | Escenario | Objetivo | Resultado |
|---|---|---|---|
| Celos salariales | Llega una estrella con 1,5× el salario del líder (ego 0,85, lealtad 0,3) → tensión ≥ 0,45 en ≤ 30 días | ≥ 80 % | 100 % |
| Celos salariales | Igual, con un líder muy leal (0,9) | ≤ 40 % | 0 % |
| Celos salariales | Renovar al líder el día 12 al 90 % del salario de la estrella → tensión < 0,25 a los 30 días | ≥ 95 % | 100 % |
| Estatus | Un jugador clave (ego 0,7) que deja de jugar → tensión ≥ 0,45 en ≤ 45 días | ≥ 70 % | 100 % |
| Estatus | Si juega lo que espera → tensión < 0,25 | ≥ 95 % | 100 % |
| Dos gallos | Dos titulares del mismo puesto con ego 0,8; uno tira los penaltis y el otro también sabría → tensión del par ≥ 0,45 en ≤ 30 días | ≥ 70 % | 100 % |
| Dos gallos | Igual, con roles pactados (penaltis a uno, faltas al otro) | ≤ 20 % | 0 % |
| Dos gallos | Uno de los dos con ego 0,5 | 0 % | 0 % |

Además, una promesa de minutos incumplida se rompe al vencer: deja un recuerdo en el afectado y en los testigos, baja la confianza y avisa en el buzón. Las promesas de conversación (minutos, papel, capitanía, renovación y pacto de roles) crean siempre un `Commitment` con su acción enlazada.

## Vestuario desatendido (club real del mundo `seed=123`, 4 meses sin intervenir)

- 13 señales («parece molesto»), 6 peticiones de hablar, 4 movimientos de agente o en redes y 1 queja pública (un jugador con ego 0,94).
- Ninguna petición de salida.
- Antes de la habituación había 5 peticiones de salida en esos 4 meses, la primera al mes. Ahora los últimos escalones quedan para caracteres extremos o problemas que se dejan pudrir.
- Camarillas: de 4 a 10 jugadores (los de casa, los veteranos, por idioma, grupos mixtos).
- Jerarquía: 3 líderes, unos 7 influyentes, el núcleo y la periferia.

## Rendimiento del avance de día (`advanceDay`, mundo `seed=123`, un club dirigido por un humano)

| | p50 | p90 | p95 | máx. |
|---|---:|---:|---:|---:|
| Node, antes de la Fase 4 | 0 ms | 215 ms | — | 904 ms (día 1 de mes) |
| Node, ahora | 15 ms | 55 ms | 81 ms | 413 ms (cambio de temporada) |
| Navegador (Worker), sin limitar la CPU | 14 ms | 51 ms | 72 ms | 91 ms |
| Navegador × 4 (estimación) | ≈ 56 ms | ≈ 204 ms | ≈ 288 ms | ≈ 364 ms |

**Cómo se ha medido.** La limitación de CPU de Chromium (`Emulation.setCPUThrottlingRate`) no afecta al Web Worker donde corre el juego: con ×1 y ×4 da los mismos tiempos. La fila ×4 es, por tanto, la medida sin limitar multiplicada por 4, una estimación conservadora.

**Cambios que lo permiten** (DISEÑO §2.2):
- El desarrollo mensual se reparte por días: cada jugador tiene su día del mes. Antes, el día 1 de cada mes tardaba unos 700 ms.
- La caché de capacidad se invalida solo para los jugadores que se desarrollan.
- La capacidad actual se calcula con pesos precompilados.
- El modelo rápido usa la formación de la casa para el once.
- Con humanos en la partida, el motor completo se reserva a sus partidos y a las selecciones que convocan a jugadores suyos. El resto del mundo usa el modelo rápido, calibrado contra el completo. Sin humanos, todo queda como en la Fase 2.

**Resultado.** Se cumple en la mediana y en 9 de cada 10 días. Quedan por encima los días de jornada mundial con muchos partidos y el cambio de temporada.

## Balance de las fases anteriores tras estos cambios

- **Partidos** (8 temporadas, motor automático y sin humanos): 2,54 goles por partido, 43,0 % de victorias locales, 25,1 % de empates y 0,16 rojas por partido. ✅
- **Desarrollo** (20 temporadas): P50 −6,3 % ✅, P95 +1,9 % ✅, P99 +0,6 % ✅. La élite pasa de 54 a 54 (rango 43–67), igual que en la Fase 3; el criterio de la élite sigue pendiente de decisión.
- **Tiempo de simulación**: las 20 temporadas tardan 188 s (antes 283 s).
