// Perfil psicológico (§3.3 de VISION.md, §3.1 de DISEÑO.md). Diales de generación.

export const PSYCH_TRAITS = [
  "ego", "recognitionNeed", "insecurity", "competitiveness", "loyalty", "ambition",
  "professionalism", "temperament", "sociability", "influence", "growthMindset", "offPitchLife",
] as const;
export type PsychTrait = (typeof PSYCH_TRAITS)[number];

/**
 * Matriz de correlación objetivo entre rasgos (orden de PSYCH_TRAITS).
 * Debe ser definida positiva (hay un test). Los valores son hipótesis de diseño a calibrar.
 */
// prettier-ignore
export const PSYCH_CORRELATION: readonly (readonly number[])[] = [
  //  ego   recog  inseg  compe  loyal  ambit  profe  tempe  socia  influ  growt  offpi
  [ 1.00,  0.55, -0.10,  0.40, -0.30,  0.45, -0.05,  0.30,  0.00,  0.20, -0.15,  0.35], // ego
  [ 0.55,  1.00,  0.25,  0.20, -0.10,  0.30, -0.05,  0.15,  0.15,  0.05, -0.05,  0.35], // recognitionNeed
  [-0.10,  0.25,  1.00, -0.20,  0.05, -0.15, -0.15,  0.15, -0.20, -0.30, -0.10,  0.10], // insecurity
  [ 0.40,  0.20, -0.20,  1.00,  0.00,  0.45,  0.20,  0.20,  0.00,  0.25,  0.25,  0.00], // competitiveness
  [-0.30, -0.10,  0.05,  0.00,  1.00, -0.30,  0.15, -0.05,  0.15,  0.10,  0.05, -0.15], // loyalty
  [ 0.45,  0.30, -0.15,  0.45, -0.30,  1.00,  0.10,  0.05,  0.00,  0.15,  0.20,  0.10], // ambition
  [-0.05, -0.05, -0.15,  0.20,  0.15,  0.10,  1.00, -0.30,  0.00,  0.15,  0.50, -0.45], // professionalism
  [ 0.30,  0.15,  0.15,  0.20, -0.05,  0.05, -0.30,  1.00, -0.10,  0.00, -0.20,  0.30], // temperament
  [ 0.00,  0.15, -0.20,  0.00,  0.15,  0.00,  0.00, -0.10,  1.00,  0.45,  0.10,  0.25], // sociability
  [ 0.20,  0.05, -0.30,  0.25,  0.10,  0.15,  0.15,  0.00,  0.45,  1.00,  0.10,  0.05], // influence
  [-0.15, -0.05, -0.10,  0.25,  0.05,  0.20,  0.50, -0.20,  0.10,  0.10,  1.00, -0.20], // growthMindset
  [ 0.35,  0.35,  0.10,  0.00, -0.15,  0.10, -0.45,  0.30,  0.25,  0.05, -0.20,  1.00], // offPitchLife
];

/** Desplazamiento de la media latente (en desviaciones típicas) por edad. */
export function psychAgeShift(age: number): Partial<Record<PsychTrait, number>> {
  const youth = Math.max(0, (24 - age) / 7); // 1 a los 17, 0 a partir de 24
  const veteran = Math.max(0, (age - 28) / 6); // 0 hasta 28, 1 a los 34
  return {
    insecurity: 0.5 * youth - 0.3 * veteran,
    influence: -0.7 * youth + 0.6 * veteran,
    professionalism: -0.2 * youth + 0.2 * veteran,
    temperament: 0.2 * youth - 0.2 * veteran,
    growthMindset: 0.2 * youth,
    ambition: 0.2 * youth - 0.3 * veteran,
  };
}

export const ARCHETYPES = [
  "quietLeader", "mediaStar", "diva", "modelPro", "mercenary", "clubLegend",
  "troubledTalent", "veteranMentor", "hungryYoungster", "loneWolf",
] as const;
export type Archetype = (typeof ARCHETYPES)[number];

/**
 * Prototipos de arquetipo en el espacio de rasgos (valores 0..1; los ausentes no cuentan).
 * Se usan para (a) etiquetar al jugador por cercanía y (b) "sembrar" arquetipos en la
 * generación. El arquetipo NUNCA lo lee ningún sistema de simulación.
 */
export const ARCHETYPE_PROTOTYPES: Record<Archetype, Partial<Record<PsychTrait, number>>> = {
  quietLeader: { ego: 0.25, influence: 0.8, professionalism: 0.8, temperament: 0.2, recognitionNeed: 0.2, offPitchLife: 0.15 },
  mediaStar: { ego: 0.75, recognitionNeed: 0.85, offPitchLife: 0.85, sociability: 0.75, ambition: 0.7 },
  diva: { ego: 0.92, recognitionNeed: 0.8, temperament: 0.75, loyalty: 0.2, professionalism: 0.35, insecurity: 0.55 },
  modelPro: { professionalism: 0.92, growthMindset: 0.85, temperament: 0.15, offPitchLife: 0.1, competitiveness: 0.7 },
  mercenary: { loyalty: 0.08, ambition: 0.75, ego: 0.6, sociability: 0.35 },
  clubLegend: { loyalty: 0.95, influence: 0.7, ambition: 0.3, ego: 0.3 },
  troubledTalent: { professionalism: 0.2, temperament: 0.8, offPitchLife: 0.8, insecurity: 0.6, growthMindset: 0.3 },
  veteranMentor: { influence: 0.8, sociability: 0.75, professionalism: 0.8, ego: 0.25, loyalty: 0.6 },
  hungryYoungster: { ambition: 0.85, growthMindset: 0.85, competitiveness: 0.8, insecurity: 0.45, professionalism: 0.7 },
  loneWolf: { sociability: 0.1, influence: 0.15, recognitionNeed: 0.25, competitiveness: 0.6 },
};

/** Restricciones de edad para que un arquetipo tenga sentido (para etiquetar y sembrar). */
export const ARCHETYPE_AGE: Partial<Record<Archetype, { min?: number; max?: number }>> = {
  veteranMentor: { min: 29 },
  hungryYoungster: { max: 23 },
  clubLegend: { min: 24 },
};

/** Probabilidad de que un jugador generado se "siembre" hacia un arquetipo. */
export const ARCHETYPE_SEED_CHANCE = 0.15;
/** Mezcla hacia el prototipo cuando se siembra (0 = nada, 1 = prototipo exacto). */
export const ARCHETYPE_SEED_BLEND = 0.55;
