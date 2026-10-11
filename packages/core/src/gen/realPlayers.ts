// Validación y preparación de jugadores reales (paquete opcional). El núcleo no lee
// archivos: recibe los registros ya cargados (pack embebido o CSV importado por la CLI).

import { NATIONS, REAL_LEAGUES, REAL_SHADOW_CLUBS, type RealLeaguePack, type RealPlayerRecord } from "@tf/data";
import { POSITIONS, type Position } from "../config/attributes";

/** Equivalencias habituales de posición en otros juegos y hojas de datos. */
const POSITION_ALIASES: Record<string, Position> = {
  CF: "ST", FW: "ST", LWB: "LB", RWB: "RB", CDM: "DM", CAM: "AM", LCB: "CB", RCB: "CB", LAM: "LW", RAM: "RW",
  POR: "GK", DFC: "CB", LI: "LB", LD: "RB", MCD: "DM", MC: "CM", MI: "LM", MD: "RM", MCO: "AM", EI: "LW", ED: "RW",
};

export function normalizePosition(raw: string): Position | null {
  const p = raw.trim().toUpperCase();
  if ((POSITIONS as readonly string[]).includes(p)) return p as Position;
  return POSITION_ALIASES[p] ?? null;
}

export function realClubNames(leagues: Record<string, RealLeaguePack> = REAL_LEAGUES): Set<string> {
  const names = new Set<string>();
  for (const pack of Object.values(leagues)) for (const c of [...pack.tier1, ...pack.tier2, ...pack.tier3]) names.add(c.n);
  for (const list of Object.values(REAL_SHADOW_CLUBS)) for (const c of list) names.add(c.n);
  return names;
}

/** Errores legibles (club inexistente, nación desconocida, posición inválida, nivel fuera de rango). */
export function validateRealPlayers(records: readonly RealPlayerRecord[], leagues?: Record<string, RealLeaguePack>): string[] {
  const clubs = realClubNames(leagues);
  const nations = new Set(NATIONS.map((n) => n.code));
  const errors: string[] = [];
  records.forEach((r, i) => {
    const where = `${r.name || `registro ${i + 1}`} (${r.club})`;
    if (!clubs.has(r.club)) errors.push(`${where}: club desconocido`);
    if (!nations.has(r.nation)) errors.push(`${where}: nación desconocida "${r.nation}"`);
    if (!normalizePosition(r.position)) errors.push(`${where}: posición desconocida "${r.position}"`);
    if (!(r.rating >= 1 && r.rating <= 20)) errors.push(`${where}: nivel fuera de 1–20`);
    if (!(r.birthYear >= 1970 && r.birthYear <= 2012)) errors.push(`${where}: año de nacimiento improbable`);
  });
  return errors;
}

/** Nombre y apellidos: la primera palabra es el nombre; el resto, los apellidos. */
export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: "", lastName: parts[0]! };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}
