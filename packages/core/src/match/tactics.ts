// Formaciones, forma del equipo sobre el campo y tácticas de la IA.
// Coordenadas relativas al equipo: x = 0 en su portería, 1 en la rival; y = 0..1 de banda a banda.
// En absolutas el local ataca hacia x = 1; el visitante se refleja en x e y.

import type { Position } from "../config/attributes";
import { fnv1a32 } from "../rng/hash";
import { clamp } from "../util/math";
import { ATTACKING_ROLES } from "./roles";
import type { Player } from "../types/domain";
import type {
  CornerRoutine, FormationId, InstructionKey, SetPieces, Tactics, TacticsPlan,
} from "../types/tactics";
import type { Side } from "./types";

export interface Slot {
  role: Position;
  x: number;
  y: number;
}

const GK: Slot = { role: "GK", x: 0.04, y: 0.5 };
const BACK4: Slot[] = [
  { role: "LB", x: 0.22, y: 0.12 },
  { role: "CB", x: 0.18, y: 0.37 },
  { role: "CB", x: 0.18, y: 0.63 },
  { role: "RB", x: 0.22, y: 0.88 },
];

export const FORMATIONS: Record<FormationId, Slot[]> = {
  "4-4-2": [
    GK, ...BACK4,
    { role: "LM", x: 0.45, y: 0.12 }, { role: "CM", x: 0.42, y: 0.38 }, { role: "CM", x: 0.42, y: 0.62 }, { role: "RM", x: 0.45, y: 0.88 },
    { role: "ST", x: 0.66, y: 0.4 }, { role: "ST", x: 0.66, y: 0.6 },
  ],
  "4-3-3": [
    GK, ...BACK4,
    { role: "CM", x: 0.42, y: 0.3 }, { role: "DM", x: 0.34, y: 0.5 }, { role: "CM", x: 0.42, y: 0.7 },
    { role: "LW", x: 0.63, y: 0.14 }, { role: "ST", x: 0.68, y: 0.5 }, { role: "RW", x: 0.63, y: 0.86 },
  ],
  "4-2-3-1": [
    GK, ...BACK4,
    { role: "DM", x: 0.35, y: 0.38 }, { role: "DM", x: 0.35, y: 0.62 },
    { role: "LW", x: 0.56, y: 0.15 }, { role: "AM", x: 0.54, y: 0.5 }, { role: "RW", x: 0.56, y: 0.85 },
    { role: "ST", x: 0.7, y: 0.5 },
  ],
  "3-5-2": [
    GK,
    { role: "CB", x: 0.2, y: 0.26 }, { role: "CB", x: 0.17, y: 0.5 }, { role: "CB", x: 0.2, y: 0.74 },
    { role: "LM", x: 0.43, y: 0.08 }, { role: "CM", x: 0.41, y: 0.33 }, { role: "DM", x: 0.35, y: 0.5 },
    { role: "CM", x: 0.41, y: 0.67 }, { role: "RM", x: 0.43, y: 0.92 },
    { role: "ST", x: 0.66, y: 0.4 }, { role: "ST", x: 0.66, y: 0.6 },
  ],
  "5-3-2": [
    GK,
    { role: "LB", x: 0.27, y: 0.08 }, { role: "CB", x: 0.18, y: 0.3 }, { role: "CB", x: 0.16, y: 0.5 },
    { role: "CB", x: 0.18, y: 0.7 }, { role: "RB", x: 0.27, y: 0.92 },
    { role: "CM", x: 0.42, y: 0.3 }, { role: "DM", x: 0.38, y: 0.5 }, { role: "CM", x: 0.42, y: 0.7 },
    { role: "ST", x: 0.65, y: 0.4 }, { role: "ST", x: 0.65, y: 0.6 },
  ],
  "4-1-4-1": [
    GK, ...BACK4,
    { role: "DM", x: 0.33, y: 0.5 },
    { role: "LM", x: 0.48, y: 0.12 }, { role: "CM", x: 0.46, y: 0.38 }, { role: "CM", x: 0.46, y: 0.62 }, { role: "RM", x: 0.48, y: 0.88 },
    { role: "ST", x: 0.7, y: 0.5 },
  ],
};

export const FORMATION_IDS = Object.keys(FORMATIONS) as FormationId[];

/** Pasa de coordenadas relativas del equipo a absolutas (el visitante se refleja). */
export function toAbsolute(side: Side, x: number, y: number): [number, number] {
  return side === 0 ? [x, y] : [1 - x, 1 - y];
}

/**
 * Posición relativa de un puesto según dónde está el balón (también en relativas del
 * equipo) y quién lo tiene. La usan el motor (quién está cerca de la jugada) y el visor.
 */
export function shapePosition(slot: Slot, t: Tactics, bx: number, by: number, inPossession: boolean, out: { [i: number]: number }, k: number): void {
  let x: number;
  let y: number;
  if (slot.role === "GK") {
    x = 0.035 + Math.max(0, bx - 0.45) * 0.14;
    y = 0.5 + (by - 0.5) * 0.25;
  } else if (inPossession) {
    const spread = 1.12 + 0.12 * t.mentality;
    x = slot.x * spread + (bx - 0.38) * 0.52 + 0.04 * t.mentality;
    y = 0.5 + (slot.y - 0.5) * (0.82 + 0.3 * t.width) + (by - 0.5) * 0.16;
  } else {
    x = slot.x * 0.86 + (bx - 0.58) * 0.48 - 0.03 + 0.06 * t.pressing - 0.03 * (t.mentality < 0 ? -t.mentality : 0);
    y = 0.5 + (slot.y - 0.5) * 0.68 + (by - 0.5) * 0.3;
  }
  out[k] = clamp(x, 0.02, 0.97);
  out[k + 1] = clamp(y, 0.03, 0.97);
}

const CORNERS: CornerRoutine[] = ["nearPost", "farPost", "farPost", "short", "edgeOfBox", "nearPost"];

/** Estilo estable de un equipo (no cambia de partido a partido): sale del hash de su id. */
export function teamStyle(team: string): {
  pressing: number; tempo: number; width: number; directness: number; preferred: FormationId; corners: CornerRoutine;
} {
  const h = fnv1a32(`style/${team}`);
  const h2 = fnv1a32(`style2/${team}`);
  const u = (shift: number) => ((h >>> shift) & 0xff) / 255;
  return {
    pressing: 0.25 + 0.5 * u(0),
    tempo: 0.3 + 0.45 * u(8),
    width: 0.3 + 0.5 * u(16),
    directness: 0.15 + 0.55 * u(24),
    preferred: FORMATION_IDS[h % FORMATION_IDS.length]!,
    corners: CORNERS[h2 % CORNERS.length]!,
  };
}

/** Balón parado por defecto: lanzadores automáticos (el mejor en el campo) y rutinas del estilo. */
export function defaultSetPieces(team: string): SetPieces {
  const s = teamStyle(team);
  return {
    penaltyTakers: [], freeKickTaker: null, cornerTaker: null, throwInTaker: null,
    corners: s.corners,
    cornerCrowd: "some",
    freeKicks: "shoot",
    throwIns: s.directness > 0.55 ? "long" : "short",
    kickoff: s.directness > 0.6 ? "long" : "buildUp",
  };
}

/**
 * Táctica de la IA: el estilo del club y una mentalidad según la diferencia de nivel
 * con el rival (el débil se protege) y el campo.
 */
export function aiTactics(team: string, formation: FormationId, myLevel: number, oppLevel: number, home: boolean): Tactics {
  const s = teamStyle(team);
  const mentality = clamp((myLevel - oppLevel) * 0.22 + (home ? 0.12 : -0.08), -0.8, 0.8);
  return {
    formation,
    mentality: Math.round(mentality * 100) / 100,
    pressing: Math.round(clamp(s.pressing + 0.15 * mentality, 0, 1) * 100) / 100,
    tempo: Math.round(s.tempo * 100) / 100,
    width: Math.round(s.width * 100) / 100,
    directness: Math.round(clamp(s.directness - 0.2 * mentality, 0, 1) * 100) / 100,
    setPieces: defaultSetPieces(team),
    instructions: [],
  };
}

/** Aplica el plan del usuario sobre la táctica de la IA (lo que el plan no fija, se mantiene). */
export function resolveTactics(ai: Tactics, plan: TacticsPlan | undefined): Tactics {
  if (!plan) return ai;
  const t: Tactics = { ...ai, setPieces: { ...ai.setPieces, ...plan.setPieces }, instructions: plan.instructions ?? ai.instructions };
  if (plan.formation) t.formation = plan.formation;
  if (plan.mentality !== undefined) t.mentality = clamp(plan.mentality, -1, 1);
  if (plan.pressing !== undefined) t.pressing = clamp(plan.pressing, 0, 1);
  if (plan.tempo !== undefined) t.tempo = clamp(plan.tempo, 0, 1);
  if (plan.width !== undefined) t.width = clamp(plan.width, 0, 1);
  if (plan.directness !== undefined) t.directness = clamp(plan.directness, 0, 1);
  return t;
}

/**
 * Cuánto choca una instrucción con la naturaleza del jugador (0..1). Un delantero con
 * mucho ego y gol no quiere tirar menos; un jugador temperamental no sabe no ir al suelo.
 */
function conflict(p: Player, key: InstructionKey): number {
  const ps = p.psych;
  const attacker = ATTACKING_ROLES.has(p.position);
  switch (key) {
    case "shootLess":
      return (attacker ? 0.4 : 0.1) + 0.5 * ps.ego * (p.technical.finishing / 20);
    case "shootMore":
      return 0.45 * ps.insecurity + (p.technical.finishing < 9 ? 0.15 : 0);
    case "dribbleLess":
      return 0.6 * (p.mental.flair / 20) + 0.2 * ps.ego;
    case "dribbleMore":
      return 0.4 * ps.insecurity + 0.3 * (1 - p.technical.dribbling / 20);
    case "stayBack":
      return (attacker ? 0.35 : 0.05) + 0.3 * ps.ambition * ps.ego;
    case "getForward":
      return 0.45 * (1 - p.mental.workRate / 20);
    case "pressMore":
      return 0.5 * (1 - p.mental.workRate / 20) + 0.2 * ps.offPitchLife;
    case "pressLess":
      return 0.35 * ps.competitiveness;
    case "tackleHarder":
      return 0.4 * (p.hidden.sportsmanship / 20);
    case "stayOnFeet":
      return 0.45 * (p.mental.aggression / 20) + 0.3 * ps.temperament;
    case "crossMore":
    case "passShort":
      return 0.1;
    case "passLong":
      return 0.15 + 0.15 * (p.technical.shortPassing / 20);
  }
}

/**
 * Probabilidad de que el jugador cumpla una instrucción en un partido. Depende de su
 * profesionalidad y su ego, de la autoridad del técnico sobre él (0..1) y del choque
 * con su forma de ser. Valor interno del motor: la UI solo muestra si la cumplió.
 */
export function instructionCompliance(p: Player, key: InstructionKey, authority: number): number {
  const ps = p.psych;
  const c = 0.72 + 0.25 * (ps.professionalism - 0.5) - 0.3 * (ps.ego - 0.5) + 0.3 * (authority - 0.5) - 0.55 * conflict(p, key);
  return Math.round(clamp(c, 0.05, 0.98) * 1000) / 1000;
}
