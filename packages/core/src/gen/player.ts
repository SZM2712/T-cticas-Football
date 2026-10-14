// Generación de jugadores: atributos coherentes con la posición y una calidad
// objetivo, perfil psicológico correlacionado, ocultos derivados, desarrollo inicial
// y apariencia canónica (para retratos).

import { CULTURES, NATIONS, type NationData } from "@tf/data";
import {
  ALL_ATTRS, ATTR_GROUP, GOALKEEPING, MENTAL, PHYSICAL, POSITION_WEIGHTS, RELATED_POSITIONS, TECHNICAL,
  type AttrKey, type Position,
} from "../config/attributes";
import {
  ATTR_NOISE, ATTR_RELEVANCE_SPREAD, DUAL_NATIONALITY_CHANCE, SECOND_NATION_CHOICE, SHAPE_SD,
} from "../config/generation";
import { abilityFor, type AttributeMap } from "../player/ability";
import type { Rng } from "../rng/rng";
import { ageOn, dayOf, dateOf } from "../time/calendar";
import type {
  Appearance, DevelopmentState, EmotionalState, HiddenAttributes, MaturationProfile, Player, PsychProfile,
} from "../types/domain";
import type { ClubId, GameDay, NationId, PlayerId } from "../types/ids";
import { clamp, clamp01, round } from "../util/math";
import { generateName, pickCulture } from "./names";
import { generatePsych } from "./psych";

export interface PlayerSpec {
  id: PlayerId;
  nation: NationData;
  position: Position;
  /** CA objetivo (ya ajustada por edad y rol en plantilla). */
  targetCA: number;
  age: number;
  today: GameDay;
  clubId: ClubId | null;
  homegrown: boolean;
  /** Calidad de la cantera del club (0..1): sube el techo latente de los jóvenes. */
  youthQuality: number;
  /** Jugador real (paquete opcional): nombre fijo, fecha de nacimiento y sin doble nacionalidad inventada. */
  fixed?: { firstName: string; lastName: string; knownAs?: string; birthDay: GameDay };
  /** Permite sembrar arquetipos extremos (no se usa con jugadores reales). */
  allowSeed?: boolean;
}

/** Naciones cuya cultura dominante es `culture` (para dobles nacionalidades). */
const CULTURE_HOMES: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const n of NATIONS) {
    for (const [culture, w] of Object.entries(n.cultures)) {
      if (w >= 0.6) (map[culture] ??= []).push(n.code);
    }
  }
  return map;
})();

/** Talento natural por atributo, derivado del stream `shape/<id>` (no se guarda; ver DevelopmentState). */
export function attributeShape(root: Rng, id: PlayerId): Record<AttrKey, number> {
  const rng = root.fork(`shape/${id}`);
  const shape = {} as Record<AttrKey, number>;
  for (const a of ALL_ATTRS) shape[a] = clamp(rng.normal(1, SHAPE_SD), 0.6, 1.4);
  return shape;
}

function ageAttributeShift(group: string, age: number): number {
  if (group === "physical") return age < 21 ? -(21 - age) * 0.35 : age > 30 ? -(age - 30) * 0.45 : 0;
  if (group === "mental") return clamp((age - 24) * 0.22, -1.6, 1.8);
  return 0;
}

function heightShift(attr: AttrKey, heightCm: number): number {
  const d = (heightCm - 181) / 7;
  switch (attr) {
    case "heading":
    case "jumping":
    case "aerialReach":
      return d * 0.9;
    case "strength":
      return d * 0.7;
    case "agility":
    case "balance":
    case "acceleration":
      return -d * 0.6;
    default:
      return 0;
  }
}

export function generateAttributes(
  rng: Rng,
  shape: Record<AttrKey, number>,
  position: Position,
  targetCA: number,
  age: number,
  heightCm: number,
): AttributeMap {
  const weights = POSITION_WEIGHTS[position];
  const isGK = position === "GK";
  const attrs = {} as AttributeMap;
  for (const a of ALL_ATTRS) {
    const group = ATTR_GROUP[a];
    if (group === "goalkeeping" && !isGK) {
      attrs[a] = rng.range(1, 4.5);
      continue;
    }
    // Un portero apenas usa la técnica de campo: se genera baja, sin pesos de posición.
    const offRole = isGK && group === "technical";
    const rel = (weights[a] ?? 0) / 5;
    const base = offRole
      ? targetCA - 6 + rng.normal(0, 1.5)
      : targetCA + (rel - 0.55) * ATTR_RELEVANCE_SPREAD + rng.normal(0, ATTR_NOISE);
    attrs[a] = base + (shape[a] - 1) * 10 + ageAttributeShift(group, age) + heightShift(a, heightCm);
  }
  // Ajuste iterativo: desplaza los atributos para que la CA coincida con la objetivo.
  for (let i = 0; i < 4; i++) {
    for (const a of ALL_ATTRS) attrs[a] = clamp(attrs[a], 1, 20);
    const delta = targetCA - abilityFor(attrs, position);
    if (Math.abs(delta) < 0.02) break;
    for (const a of ALL_ATTRS) {
      const group = ATTR_GROUP[a];
      if (group === "goalkeeping" && !isGK) continue;
      attrs[a] += delta;
    }
  }
  for (const a of ALL_ATTRS) attrs[a] = round(clamp(attrs[a], 1, 20), 2);
  return attrs;
}

function deriveHidden(rng: Rng, p: PsychProfile): HiddenAttributes {
  const s = (x: number, sd = 0.1) => round(1 + 19 * clamp01(x + rng.normal(0, sd)), 2);
  return {
    consistency: s(0.5 * (1 - p.insecurity) + 0.5 * p.professionalism, 0.12),
    bigMatches: s(0.6 * (1 - p.insecurity) + 0.2 * p.competitiveness + 0.2 * p.ego, 0.15),
    injuryProneness: round(1 + 19 * rng.beta(2, 5), 2),
    versatility: round(1 + 19 * rng.beta(2, 2.5), 2),
    sportsmanship: s(0.6 * (1 - p.temperament) + 0.2 * (1 - p.ego) + 0.2 * p.professionalism),
    adaptability: s(0.5 * p.sociability + 0.3 * p.growthMindset + 0.2 * (1 - p.insecurity)),
    pressure: s(0.7 * (1 - p.insecurity) + 0.3 * p.competitiveness),
    professionalism: s(p.professionalism, 0.05),
    ambition: s(p.ambition, 0.05),
    loyalty: s(p.loyalty, 0.05),
    temperament: s(1 - p.temperament, 0.05),
    controversy: s(0.5 * p.offPitchLife + 0.3 * p.ego + 0.2 * p.temperament),
  };
}

function initialDevelopment(rng: Rng, ca: number, age: number, youthQuality: number): DevelopmentState {
  const youngYears = Math.max(0, 23.5 - age);
  const gapMean = youngYears * 0.5 * (0.8 + 0.5 * youthQuality);
  const gapSd = 0.5 + youngYears * 0.18;
  const gap = age >= 28 ? Math.abs(rng.normal(0, 0.25)) : Math.abs(rng.normal(gapMean, gapSd));
  const roll = rng.float();
  const maturation: MaturationProfile = roll < 0.25 ? "early" : roll < 0.75 ? "standard" : "late";
  const maturationShift =
    maturation === "early" ? rng.range(-1.6, -0.5) : maturation === "late" ? rng.range(0.8, 2.6) : rng.range(-0.5, 0.5);
  return {
    latentCeiling: round(Math.min(20, ca + gap), 2),
    volatility: round(0.1 + 1.4 * Math.pow(clamp01((26 - age) / 10), 1.3), 3),
    maturation,
    maturationShift: round(maturationShift, 2),
    physicalPeakAge: round(clamp(rng.normal(27, 1.5), 24, 31), 2),
    recentFactors: [],
  };
}

const HAIR_COLORS: Appearance["hairColor"][] = ["black", "darkBrown", "brown", "blond", "red"];

function generateAppearance(rng: Rng, culture: string, age: number, position: Position, heightCm: number, weightKg: number): Appearance {
  const data = CULTURES[culture]!;
  const skinTone = (rng.weighted([1, 2, 3, 4, 5, 6] as const, (_, i) => data.skin[i] ?? 0)) as Appearance["skinTone"];
  let hairColor = rng.weighted(HAIR_COLORS, (_, i) => data.hair[i] ?? 0);
  if (age >= 33 && rng.chance(0.25)) hairColor = "grey";
  const darkSkin = skinTone >= 5;
  const hairStyle = rng.weighted(
    ["shaved", "buzz", "short", "curlyShort", "medium", "long", "afro", "braids", "bald", "manBun"] as const,
    (s) => {
      switch (s) {
        case "afro":
        case "braids":
          return darkSkin ? 1.5 : 0.05;
        case "bald":
          return age > 30 ? 0.8 : 0.1;
        case "long":
        case "manBun":
          return 0.6;
        case "short":
          return 3;
        case "curlyShort":
          return darkSkin ? 2 : 1;
        default:
          return 1.5;
      }
    },
  );
  const facialHair = rng.weighted(["none", "stubble", "moustache", "goatee", "fullBeard"] as const, (f) =>
    f === "none" ? (age < 21 ? 6 : 3) : f === "fullBeard" ? (age > 24 ? 1.5 : 0.3) : 1,
  );
  const lightSkin = skinTone <= 2;
  const eyeColor = rng.weighted(["brown", "darkBrown", "hazel", "green", "blue", "grey"] as const, (e) => {
    if (e === "blue" || e === "grey" || e === "green") return lightSkin && hairColor !== "black" ? 2 : lightSkin ? 0.8 : 0.05;
    if (e === "darkBrown") return lightSkin ? 0.5 : 3;
    return 1.5;
  });
  const faceShape = rng.pick(["oval", "round", "square", "long", "heart"] as const);
  const bmi = weightKg / ((heightCm / 100) * (heightCm / 100));
  const build: Appearance["build"] =
    bmi < 21.5 ? "slim" : bmi < 23.2 ? "lean" : bmi < 24.8 || position === "GK" ? "athletic" : "stocky";
  return { skinTone, hairColor, hairStyle, facialHair, eyeColor, faceShape, build };
}

function heightFor(rng: Rng, position: Position): number {
  const mean = position === "GK" ? 189 : position === "CB" ? 188 : position === "ST" ? 183 : position === "DM" ? 181 :
    position === "LW" || position === "RW" || position === "AM" ? 176 : 179;
  return Math.round(clamp(rng.normal(mean, 6), 160, 204));
}

function pickPositions(rng: Rng, position: Position, versatility: number): Partial<Record<Position, number>> {
  const positions: Partial<Record<Position, number>> = { [position]: 1 };
  const related = RELATED_POSITIONS[position];
  const extra = versatility > 14 ? 2 : versatility > 8 ? 1 : rng.chance(0.3) ? 1 : 0;
  for (const pos of rng.shuffle(related).slice(0, extra)) positions[pos] = round(rng.range(0.45, 0.95), 2);
  return positions;
}

function birthDayFor(rng: Rng, today: GameDay, age: number): GameDay {
  // Fecha de nacimiento tal que tenga `age` años cumplidos hoy.
  const { y } = dateOf(today);
  const birthYear = y - age - 1;
  const start = dayOf(birthYear, 1, 1);
  let birth = (start + rng.int(0, 364)) as GameDay;
  while (ageOn(birth, today) > age) birth = (birth + 30) as GameDay;
  while (ageOn(birth, today) < age) birth = (birth - 30) as GameDay;
  return birth;
}

function languagesFor(rng: Rng, nation: NationData): Player["languages"] {
  const langs: Player["languages"] = nation.languages.map((lang, i) => ({ lang, fluency: i === 0 ? 1 : 0.6 }));
  if (!nation.languages.includes("en") && rng.chance(0.45)) langs.push({ lang: "en", fluency: round(rng.range(0.25, 0.85), 2) });
  return langs;
}

export function generatePlayer(rng: Rng, root: Rng, spec: PlayerSpec): Player {
  const { nation, position, age, today } = spec;
  const culture = pickCulture(rng, nation.cultures);
  const name = spec.fixed
    ? { firstName: spec.fixed.firstName, lastName: spec.fixed.lastName, ...(spec.fixed.knownAs ? { knownAs: spec.fixed.knownAs } : {}) }
    : generateName(rng, culture);
  const heightCm = heightFor(rng, position);
  const weightKg = Math.round(clamp(heightCm - 100 - 7 + rng.normal(0, 4.5), 55, 105));
  const { psych, seeded } = generatePsych(rng, age, spec.allowSeed ?? true);
  const hidden = deriveHidden(rng, psych);
  const shape = attributeShape(root, spec.id);
  const attrs = generateAttributes(rng, shape, position, spec.targetCA, age, heightCm);
  const pick = <K extends AttrKey>(keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, attrs[k]])) as Record<K, number>;
  const leftFooted = rng.chance(position === "LB" || position === "LW" || position === "LM" ? 0.6 : 0.2);
  const strong = round(rng.range(15, 20), 2);
  const weak = round(clamp(rng.normal(8, 3.5), 1, 18), 2);

  // Doble nacionalidad: la cultura apunta a otra nación (p. ej. francés de origen senegalés).
  let secondNationality: NationId | undefined;
  // Solo para jugadores de origen inmigrante: su cultura no es la mayoritaria en su país.
  const immigrant = (nation.cultures[culture] ?? 0) < 0.5;
  const homes = immigrant ? (CULTURE_HOMES[culture] ?? []).filter((c) => c !== nation.code) : [];
  if (!spec.fixed && homes.length && rng.chance(DUAL_NATIONALITY_CHANCE)) secondNationality = rng.pick(homes) as NationId;
  let internationalNation = nation.code as NationId;
  if (secondNationality) {
    const second = NATIONS.find((n) => n.code === secondNationality)!;
    // Si la nación principal es mucho más fuerte, elegir la segunda es menos probable para los buenos.
    const p = SECOND_NATION_CHOICE * (second.strength >= nation.strength ? 1.5 : 1) * (spec.targetCA > 14 ? 0.6 : 1.2);
    if (rng.chance(clamp01(p))) internationalNation = secondNationality;
  }

  const state: EmotionalState = {
    morale: round(rng.normal(0.15, 0.2), 3),
    confidence: { attack: 0, defence: 0, passing: 0, general: round(rng.normal(0, 0.15), 3) },
    happiness: round(rng.normal(0.2, 0.2), 3),
    mentalFatigue: 0,
    statusGap: 0,
    perceivedStatus: "rotation",
    expectedStatus: "rotation",
    tensions: {},
    lastUpdated: today,
  };

  const ca = abilityFor(attrs, position);
  const player: Player = {
    id: spec.id,
    firstName: name.firstName,
    lastName: name.lastName,
    birthDay: spec.fixed?.birthDay ?? birthDayFor(rng, today, age),
    nationality: nation.code as NationId,
    internationalNation,
    languages: languagesFor(rng, nation),
    culture,
    appearance: generateAppearance(rng, culture, age, position, heightCm, weightKg),
    foot: leftFooted ? { left: strong, right: weak } : { left: weak, right: strong },
    heightCm,
    weightKg,
    position,
    positions: pickPositions(rng, position, hidden.versatility),
    technical: pick(TECHNICAL),
    mental: pick(MENTAL),
    physical: pick(PHYSICAL),
    goalkeeping: pick(GOALKEEPING),
    hidden,
    psych,
    state,
    development: initialDevelopment(rng, ca, age, spec.youthQuality),
    clubId: spec.clubId,
    contract: null,
    homegrown: spec.homegrown,
    fitness: 1,
    fitnessDay: 0 as GameDay,
    injury: null,
    suspensions: [],
    career: [],
    reputation: round(clamp01((ca - 6) / 13), 3),
    caps: 0,
    internationalGoals: 0,
    memoryIds: [],
    retired: false,
  };
  if (name.knownAs) player.knownAs = name.knownAs;
  if (secondNationality) player.secondNationality = secondNationality;
  if (seeded) player.seededArchetype = seeded;
  return player;
}
