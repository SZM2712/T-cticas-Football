// Diales del valor de mercado estimado (Fase 4; el mercado completo llega en la Fase 6).
// Solo usa información visible: nivel, edad, reputación y años de contrato (nunca el techo oculto).

/** Valor (€) de un jugador de nivel 12 en plenitud, con reputación media y contrato largo. */
export const VALUE_AT_12 = 1_500_000;
/** Cuánto se multiplica el valor por cada punto de nivel (≈ ×2,5 por punto). */
export const VALUE_PER_LEVEL = 0.9;
/** Multiplicador por edad [edad, factor]: los jóvenes cotizan más, los veteranos menos. */
export const VALUE_AGE_CURVE: readonly (readonly [number, number])[] = [
  [17, 1.35], [21, 1.3], [24, 1.1], [27, 1], [29, 0.8], [31, 0.55], [33, 0.3], [36, 0.12],
];
/** Reputación (0..1): de ×0,6 a ×1,4. */
export const VALUE_REPUTATION = { base: 0.6, span: 0.8 };
/** Años de contrato restantes [años, factor]: con poco contrato, vale menos. */
export const VALUE_CONTRACT_CURVE: readonly (readonly [number, number])[] = [[0, 0.45], [1, 0.7], [2, 0.9], [3, 1]];
/** Valor mínimo (€). */
export const VALUE_MIN = 10_000;
