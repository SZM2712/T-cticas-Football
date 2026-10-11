// Atributos y posiciones (§3.1 de VISION.md). Los pesos por posición definen la
// capacidad actual (CA) = media ponderada de atributos relevantes para la posición.

export const TECHNICAL = [
  "firstTouch", "shortPassing", "longPassing", "crossing", "dribbling", "finishing", "heading",
  "longShots", "penalties", "freeKicks", "tackling", "marking", "technique",
] as const;
export const MENTAL = [
  "anticipation", "decisions", "vision", "positioning", "offTheBall", "concentration", "composure",
  "teamwork", "bravery", "leadership", "aggression", "workRate", "flair",
] as const;
export const PHYSICAL = [
  "acceleration", "pace", "stamina", "strength", "agility", "balance", "jumping", "naturalFitness",
] as const;
export const GOALKEEPING = [
  "reflexes", "oneOnOnes", "aerialReach", "handling", "kicking", "throwing", "communication", "gkPositioning",
] as const;

export type TechnicalAttr = (typeof TECHNICAL)[number];
export type MentalAttr = (typeof MENTAL)[number];
export type PhysicalAttr = (typeof PHYSICAL)[number];
export type GoalkeepingAttr = (typeof GOALKEEPING)[number];
export type AttrKey = TechnicalAttr | MentalAttr | PhysicalAttr | GoalkeepingAttr;

export const ALL_ATTRS: readonly AttrKey[] = [...TECHNICAL, ...MENTAL, ...PHYSICAL, ...GOALKEEPING];
export type AttrGroup = "technical" | "mental" | "physical" | "goalkeeping";
export const ATTR_GROUP: Record<AttrKey, AttrGroup> = Object.fromEntries([
  ...TECHNICAL.map((a) => [a, "technical"]),
  ...MENTAL.map((a) => [a, "mental"]),
  ...PHYSICAL.map((a) => [a, "physical"]),
  ...GOALKEEPING.map((a) => [a, "goalkeeping"]),
]) as Record<AttrKey, AttrGroup>;

export const POSITIONS = ["GK", "CB", "LB", "RB", "DM", "CM", "LM", "RM", "AM", "LW", "RW", "ST"] as const;
export type Position = (typeof POSITIONS)[number];
export type Line = "GK" | "DEF" | "MID" | "FWD";
export const POSITION_LINE: Record<Position, Line> = {
  GK: "GK", CB: "DEF", LB: "DEF", RB: "DEF", DM: "MID", CM: "MID", LM: "MID", RM: "MID", AM: "MID",
  LW: "FWD", RW: "FWD", ST: "FWD",
};

type Weights = Partial<Record<AttrKey, number>>;

// Pesos 1–5: importancia del atributo para rendir en esa posición.
const FULLBACK: Weights = {
  tackling: 4, marking: 4, crossing: 4, pace: 4, acceleration: 4, stamina: 4, positioning: 3, workRate: 3,
  teamwork: 3, dribbling: 2, shortPassing: 3, firstTouch: 2, anticipation: 3, decisions: 3, concentration: 3,
  agility: 2, technique: 2,
};
const WINGER: Weights = {
  dribbling: 5, crossing: 4, acceleration: 5, pace: 5, technique: 4, firstTouch: 4, flair: 4, offTheBall: 3,
  finishing: 3, agility: 4, balance: 3, shortPassing: 3, decisions: 3, vision: 2, stamina: 2, composure: 2, longShots: 2,
};
const WIDE_MID: Weights = {
  crossing: 4, dribbling: 4, stamina: 4, workRate: 4, pace: 4, acceleration: 3, shortPassing: 4, firstTouch: 3,
  technique: 3, teamwork: 3, decisions: 3, offTheBall: 3, vision: 2, tackling: 2, positioning: 2,
};

export const POSITION_WEIGHTS: Record<Position, Weights> = {
  GK: {
    reflexes: 5, oneOnOnes: 4, aerialReach: 4, handling: 4, gkPositioning: 5, communication: 3, kicking: 2,
    throwing: 2, concentration: 4, decisions: 3, composure: 3, anticipation: 3, agility: 4, jumping: 2, bravery: 2,
  },
  CB: {
    tackling: 5, marking: 5, heading: 5, positioning: 5, strength: 4, jumping: 4, anticipation: 4, concentration: 4,
    bravery: 3, decisions: 3, composure: 3, pace: 3, shortPassing: 2, firstTouch: 2, aggression: 2, teamwork: 2,
  },
  LB: FULLBACK,
  RB: FULLBACK,
  DM: {
    tackling: 5, positioning: 5, marking: 3, anticipation: 4, decisions: 4, shortPassing: 4, teamwork: 4,
    workRate: 4, concentration: 3, stamina: 3, strength: 3, composure: 3, firstTouch: 3, longPassing: 2, vision: 2,
  },
  CM: {
    shortPassing: 5, firstTouch: 4, decisions: 5, vision: 4, teamwork: 4, workRate: 4, stamina: 4, technique: 4,
    composure: 4, anticipation: 3, positioning: 3, longPassing: 3, tackling: 2, offTheBall: 2, longShots: 2,
  },
  LM: WIDE_MID,
  RM: WIDE_MID,
  AM: {
    vision: 5, shortPassing: 5, technique: 5, firstTouch: 5, flair: 4, decisions: 4, dribbling: 4, offTheBall: 4,
    composure: 4, longShots: 3, finishing: 3, agility: 3, anticipation: 3, acceleration: 2,
  },
  LW: WINGER,
  RW: WINGER,
  ST: {
    finishing: 5, offTheBall: 5, composure: 5, firstTouch: 4, anticipation: 4, heading: 3, acceleration: 4,
    pace: 3, strength: 3, technique: 3, dribbling: 3, decisions: 3, jumping: 2, longShots: 2, agility: 3,
  },
};

/** Composición objetivo de una plantilla (25–30 jugadores). */
export const SQUAD_TEMPLATE: Record<Position, number> = {
  GK: 3, CB: 5, LB: 2, RB: 2, DM: 2, CM: 4, LM: 1, RM: 1, AM: 2, LW: 2, RW: 2, ST: 3,
};

/** Posiciones secundarias plausibles (familiaridad parcial). */
export const RELATED_POSITIONS: Record<Position, Position[]> = {
  GK: [],
  CB: ["DM", "RB", "LB"],
  LB: ["LM", "CB", "RB"],
  RB: ["RM", "CB", "LB"],
  DM: ["CM", "CB"],
  CM: ["DM", "AM", "LM", "RM"],
  LM: ["LW", "LB", "CM"],
  RM: ["RW", "RB", "CM"],
  AM: ["CM", "ST", "LW", "RW"],
  LW: ["LM", "RW", "ST", "AM"],
  RW: ["RM", "LW", "ST", "AM"],
  ST: ["AM", "LW", "RW"],
};
