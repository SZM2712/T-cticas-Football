// Generación de nombres de personas a partir de las culturas de @tf/data.

import { BRAZILIAN_NICKNAMES, CULTURES, isFamousPersonName, type CultureData } from "@tf/data";
import type { Rng } from "../rng/rng";

export function cultureData(culture: string): CultureData {
  const data = CULTURES[culture];
  if (!data) throw new Error(`Cultura desconocida: ${culture}`);
  return data;
}

/** Elige una cultura según la mezcla de una nación. Itera en orden de claves estable. */
export function pickCulture(rng: Rng, mix: Record<string, number>): string {
  const keys = Object.keys(mix).sort();
  return rng.weighted(keys, (k) => mix[k] ?? 0);
}

export interface PersonName {
  firstName: string;
  lastName: string;
  knownAs?: string;
}

/** Nombre completo para mostrar y para comprobar contra la lista de famosos. */
export function fullName(n: PersonName, culture: string): string {
  if (n.knownAs) return n.knownAs;
  return cultureData(culture).familyFirst ? `${n.lastName} ${n.firstName}` : `${n.firstName} ${n.lastName}`;
}

export function generateName(rng: Rng, culture: string): PersonName {
  const data = cultureData(culture);
  for (let attempt = 0; attempt < 20; attempt++) {
    const firstName = rng.pick(data.first);
    let lastName = rng.pick(data.last);
    if (data.doubleSurname && rng.chance(data.doubleSurname)) {
      const second = rng.pick(data.last);
      if (second !== lastName) lastName = `${lastName} ${second}`;
    }
    const name: PersonName = { firstName, lastName };
    if (data.nickname && rng.chance(data.nickname)) name.knownAs = rng.pick(BRAZILIAN_NICKNAMES);
    // Ni la forma completa ni el apodo pueden coincidir con un futbolista famoso.
    const candidates = [`${firstName} ${lastName}`, `${lastName} ${firstName}`, name.knownAs ?? ""];
    if (candidates.some((c) => c && isFamousPersonName(c))) continue;
    return name;
  }
  // Prácticamente imposible: 20 colisiones seguidas. Se devuelve un nombre con inicial.
  return { firstName: rng.pick(data.first), lastName: `${rng.pick(data.last)}-${rng.pick(data.last)}` };
}
