// Generación de clubes ficticios en ciudades reales, con nombres genéricos que nunca
// coinciden con clubes reales (lista de bloqueo de @tf/data).

import {
  CLUB_PATTERNS, CLUB_PATTERN_LANG, STADIUM_PATTERNS, isRealClubName, normalizeClubName, type NationData,
} from "@tf/data";
import type { Rng } from "../rng/rng";
import type { Club, FanSegment } from "../types/domain";
import type { ClubId, LeagueId, NationId } from "../types/ids";
import { clamp, clamp01, round } from "../util/math";
import { generateName, pickCulture } from "./names";

const PALETTE = [
  "#C8102E", "#E03A3E", "#1D428A", "#0B1F41", "#6CABDD", "#FFFFFF", "#111111", "#FFD100", "#00843D",
  "#7A263A", "#F57F17", "#5B2C83", "#004D98", "#A50044", "#2E7D32", "#B71C1C", "#1565C0", "#FBC02D",
];
const DARK = new Set(["#0B1F41", "#111111", "#7A263A", "#5B2C83", "#004D98", "#A50044", "#1D428A", "#B71C1C"]);

function pickColors(rng: Rng): Club["colors"] {
  const primary = rng.pick(PALETTE);
  const options = PALETTE.filter((c) => c !== primary && DARK.has(c) !== DARK.has(primary));
  return { primary, secondary: rng.weighted(options, (c) => (c === "#FFFFFF" || c === "#111111" ? 3 : 1)) };
}

function applyPattern(pattern: string, place: string, founded: number): string {
  const vowelStart = /^[AEIOUÉÈÂÎÔYaeiouéèâîôy]/.test(place);
  return pattern
    .replace("{de}", vowelStart ? "d'" : "de ")
    .replace("{city}", place)
    .replace("{year}", String(founded))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Elige un nombre de club único y que no sea real. `used` guarda nombres
 * normalizados ya asignados en todo el mundo.
 */
export function generateClubName(rng: Rng, nationCode: string, place: string, founded: number, used: Set<string>): string {
  const lang = CLUB_PATTERN_LANG[nationCode] ?? "generic";
  // Primero los patrones del idioma del país; los genéricos solo como último recurso.
  const own = CLUB_PATTERNS[lang] ?? [];
  const patterns = [...own, ...(lang === "generic" ? [] : CLUB_PATTERNS.generic ?? [])];
  for (const pattern of [...rng.shuffle(own), ...patterns.slice(own.length)]) {
    const name = applyPattern(pattern, place, founded);
    const norm = normalizeClubName(name);
    if (!isRealClubName(name) && !used.has(norm)) {
      used.add(norm);
      return name;
    }
  }
  // Último recurso: añadir el año de fundación al primer patrón libre.
  for (const pattern of patterns) {
    const name = `${applyPattern(pattern, place, founded)} ${founded}`;
    const norm = normalizeClubName(name) + ` ${founded}`;
    if (!isRealClubName(name) && !used.has(norm)) {
      used.add(norm);
      return name;
    }
  }
  throw new Error(`Sin nombre de club disponible para ${place}`);
}

export function shortNameOf(name: string, place: string): string {
  // Nombre corto: la ciudad/distrito, o la palabra más distintiva.
  if (place.length <= 14) return place;
  const words = name.split(" ").filter((w) => w.length > 3);
  return words[0] ?? name.slice(0, 12);
}

export interface ClubSpec {
  id: ClubId;
  nation: NationData;
  city: string;
  /** Lugar que da nombre al club: ciudad o distrito. */
  place: string;
  cityPop: number;
  leagueId: LeagueId | null;
  shadowTier?: number;
  quality: number;
  /** Ingresos de referencia de su liga (millones). */
  leagueRevenue: number;
  /** Datos fijos de un club real (paquete opcional `real`): sustituyen a los generados. */
  fixed?: { name: string; shortName?: string; colors: [string, string]; stadium?: [string, number]; founded?: number };
}

export function generateClub(rng: Rng, spec: ClubSpec, usedNames: Set<string>): Club {
  const fixed = spec.fixed;
  const founded = fixed?.founded ?? rng.int(1872, 1965);
  const name = fixed ? fixed.name : generateClubName(rng, spec.nation.code, spec.place, founded, usedNames);
  if (fixed) usedNames.add(normalizeClubName(name));
  const reputation = round(clamp01((spec.quality - 7) / 9.5 + rng.normal(0, 0.03)), 3);
  const lang = CLUB_PATTERN_LANG[spec.nation.code] ?? "generic";
  const surname = generateName(rng, pickCulture(rng, spec.nation.cultures)).lastName;
  const stadiumName = applyPattern(rng.pick(STADIUM_PATTERNS[lang] ?? STADIUM_PATTERNS.generic!), spec.city, founded)
    .replace("{name}", surname);
  const popFactor = Math.log10(Math.max(10, spec.cityPop));
  const capacity = Math.round(clamp(2500 + reputation * reputation * 75000 * (0.6 + popFactor / 8) + rng.normal(0, 4000), 2500, 90000) / 100) * 100;
  const revenue = round(spec.leagueRevenue * (0.35 + 1.6 * reputation * reputation) * rng.range(0.85, 1.15), 2);
  const fanScale = reputation * reputation * (0.5 + popFactor / 4);
  const fanBase: Record<FanSegment, { size: number; mood: number }> = {
    ultras: { size: Math.round(fanScale * rng.range(2000, 9000)), mood: 0 },
    members: { size: Math.round(fanScale * rng.range(15000, 90000)), mood: 0 },
    casual: { size: Math.round(fanScale * rng.range(60000, 600000)), mood: 0 },
    international: { size: Math.round(fanScale * reputation * rng.range(0, 3_000_000)), mood: 0 },
  };
  const club: Club = {
    id: spec.id,
    name,
    shortName: fixed ? (fixed.shortName ?? name) : shortNameOf(name, spec.place),
    founded,
    city: spec.city,
    nation: spec.nation.code as NationId,
    leagueId: spec.leagueId,
    colors: fixed ? { primary: fixed.colors[0], secondary: fixed.colors[1] } : pickColors(rng),
    reputation,
    quality: round(spec.quality, 2),
    stadium: fixed?.stadium ? { name: fixed.stadium[0], capacity: fixed.stadium[1] } : { name: stadiumName, capacity },
    facilities: {
      training: round(clamp01(reputation + rng.normal(0, 0.1)), 3),
      youth: round(clamp01(reputation * 0.8 + rng.normal(0.1, 0.15)), 3),
      medical: round(clamp01(reputation + rng.normal(0, 0.1)), 3),
    },
    finances: {
      revenue,
      balance: Math.round(revenue * rng.range(-0.1, 0.4) * 1e6),
      transferBudget: Math.round(revenue * rng.range(0.08, 0.45) * 1e6),
      wageBudget: Math.round((revenue * 0.62 * 1e6) / 52),
    },
    fanBase,
    squad: [],
    staff: [],
    lod: spec.leagueId ? "medium" : "light",
  };
  if (spec.shadowTier !== undefined) club.shadowTier = spec.shadowTier;
  return club;
}
