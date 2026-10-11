// Generación del perfil psicológico con correlaciones (cópula gaussiana) y siembra
// opcional de arquetipos (§3.1 de DISEÑO.md).

import {
  ARCHETYPES, ARCHETYPE_AGE, ARCHETYPE_PROTOTYPES, ARCHETYPE_SEED_BLEND, ARCHETYPE_SEED_CHANCE, PSYCH_CORRELATION,
  PSYCH_TRAITS, psychAgeShift, type Archetype,
} from "../config/psych";
import { cholesky, correlatedNormals, normalCdf } from "../rng/dist";
import type { Rng } from "../rng/rng";
import type { PsychProfile } from "../types/domain";
import { round } from "../util/math";

let factor: number[][] | null = null;
function psychCholesky(): number[][] {
  factor ??= cholesky(PSYCH_CORRELATION);
  return factor;
}

/** Inversa aproximada de la CDF normal (para llevar prototipos 0..1 al espacio latente). */
function probit(p: number): number {
  const q = Math.min(0.999, Math.max(0.001, p));
  // Aproximación de Acklam simplificada por bisección (suficiente para prototipos).
  let lo = -4;
  let hi = 4;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (normalCdf(mid) < q) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function archetypeAllowed(archetype: Archetype, age: number): boolean {
  const limits = ARCHETYPE_AGE[archetype];
  if (!limits) return true;
  return (limits.min === undefined || age >= limits.min) && (limits.max === undefined || age <= limits.max);
}

export interface GeneratedPsych {
  psych: PsychProfile;
  seeded?: Archetype;
}

export function generatePsych(rng: Rng, age: number, allowSeed = true): GeneratedPsych {
  const z = correlatedNormals(rng, psychCholesky());
  const shift = psychAgeShift(age);
  let seeded: Archetype | undefined;
  if (allowSeed && rng.chance(ARCHETYPE_SEED_CHANCE)) {
    const options = ARCHETYPES.filter((a) => archetypeAllowed(a, age));
    seeded = rng.pick(options);
  }
  const psych = {} as PsychProfile;
  PSYCH_TRAITS.forEach((trait, i) => {
    let latent = (z[i] ?? 0) + (shift[trait] ?? 0);
    if (seeded) {
      const target = ARCHETYPE_PROTOTYPES[seeded][trait];
      if (target !== undefined) latent = latent * (1 - ARCHETYPE_SEED_BLEND) + probit(target) * ARCHETYPE_SEED_BLEND;
    }
    psych[trait] = round(normalCdf(latent), 3);
  });
  return seeded ? { psych, seeded } : { psych };
}

/** Arquetipo legible por cercanía a los prototipos (solo para mostrar, §3.3). */
export function classifyArchetype(psych: PsychProfile, age: number): { primary: Archetype; secondary: Archetype; distance: number } {
  const scored = ARCHETYPES.filter((a) => archetypeAllowed(a, age))
    .map((a) => {
      const proto = ARCHETYPE_PROTOTYPES[a];
      const keys = Object.keys(proto) as (keyof typeof proto)[];
      let d = 0;
      let expected = 0;
      for (const k of keys) {
        const c = proto[k] ?? 0;
        const diff = psych[k] - c;
        d += diff * diff;
        // Cada rasgo es uniforme en 0..1 (cópula gaussiana): E[(U − c)²] = 1/12 + (c − ½)².
        expected += 1 / 12 + (c - 0.5) * (c - 0.5);
      }
      // Distancia relativa a la de un perfil al azar: no favorece a los prototipos moderados.
      return { a, d: Math.sqrt(d / expected) };
    })
    .sort((x, y) => x.d - y.d || x.a.localeCompare(y.a));
  const first = scored[0]!;
  const second = scored[1] ?? first;
  return { primary: first.a, secondary: second.a, distance: first.d };
}
