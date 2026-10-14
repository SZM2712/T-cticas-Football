// Motor de partido por zonas (Fase 2, DISEÑO §6 y §8.3).
//
// El balón se mueve por el campo en cadenas de posesión. En cada acción el poseedor
// elige qué hacer (pase de seguridad, pase hacia delante, balón largo, pase al hueco,
// regate, centro o tiro) según la zona, su puesto, sus atributos y la táctica. La acción
// se resuelve como un duelo logístico contra el defensor más cercano a la jugada (según
// la forma táctica del rival) con modificadores de campo, presión, cansancio y forma.
//
// Determinismo: todo el azar sale del `rng` recibido. Los fotogramas del visor se
// calculan sin tocar el RNG, así que pedirlos no cambia el partido.

import type { Position } from "../config/attributes";
import {
  ACTION_SECONDS, ACTION_WEIGHTS as W, BLOCK_CHANCE, BLOCK_CORNER, BOOKED_CAUTION, CONDITION_FLOOR, CORNER_SHOT, CROSS_BASE,
  CROSS_CORNER, DEAD_SECONDS, DISSENT_PER_MINUTE, BOX_FOUL_MULT, DRIBBLE_BASE, FATIGUE_PER_MINUTE, FORM_SD, FOUL_ON_TACKLE, GAME_STATE_RAMP, GAME_STATE_SHIFT,
  FINAL_THIRD_PENALTY, HOME_EDGE, INJURY_DAYS, INJURY_ON_FOUL, INJURY_PER_MINUTE, KEEPER_K, LOOSE_FOUL, MAN_DOWN, MAX_SUBS, MENTALITY_EDGE, OPENNESS_SD, ON_TARGET_SHARE,
  PASS_BASE, PRESS_EDGE, RATING_BASE, RED_PER_FOUL, SAVE_CORNER, SAVE_REBOUND, SHOOTER_K, SHOT_PRESSURE, SKILL_K, STOPPAGE_FIRST,
  STOPPAGE_SECOND, SUB_CONDITION, SUB_WINDOWS, TACTICAL_FOUL, TACTICAL_YELLOW_MULT, XG_BASE, YELLOW_PER_FOUL,
  CORNER_CROWD, CORNER_ROUTINES, FREE_KICK_DIRECT, INSTRUCTION_EFFECTS, LONG_THROW_BONUS,
} from "../config/match";
import type { Rng } from "../rng/rng";
import { clamp } from "../util/math";
import { ATTACKING_ROLES as ATTACKERS, DEFENDING_ROLES as DEFENDERS } from "./roles";
import { FORMATIONS, shapePosition, type Slot } from "./tactics";
import type {
  Frames, GoalKind, InstructionKey, InstructionOutcome, Intervention, MatchChange, MatchEvent, MatchEventType, MatchInput,
  MatchReport, PlayerLine, SheetPlayer, Side, Tactics, TeamSheet, TeamStats,
} from "./types";
import { INSTRUCTION_KEYS } from "../types/tactics";

export interface SimulateOptions {
  /** Generar fotogramas para el visor 2D. */
  frames?: boolean;
}

/** Modificadores de las instrucciones que el jugador decidió cumplir. */
interface Mods {
  shot: number;
  dribble: number;
  cross: number;
  long: number;
  short: number;
  through: number;
  dx: number;
  press: number;
  tackle: number;
  fatigue: number;
  foul: number;
}

const NO_MODS: Mods = { shot: 1, dribble: 1, cross: 1, long: 1, short: 1, through: 1, dx: 0, press: 0, tackle: 0, fatigue: 1, foul: 1 };

interface Live {
  sp: SheetPlayer;
  mods: Mods;
  /** Instrucciones vigentes y si las está cumpliendo. */
  follows: Partial<Record<InstructionKey, boolean>>;
  side: Side;
  /** Puesto que ocupa (0..10) o −1 si no está en el campo. */
  slot: number;
  role: Position;
  fam: number;
  cond: number;
  form: number;
  /** Multiplicador de rendimiento del momento (forma × condición × encaje × moral). */
  mult: number;
  started: boolean;
  played: boolean;
  minutes: number;
  yellow: number;
  red: boolean;
  injuryDays: number;
  impact: number;
  goals: number;
  assists: number;
}

interface Team {
  side: Side;
  sheet: TeamSheet;
  t: Tactics;
  slots: Slot[];
  field: (Live | null)[];
  bench: Live[];
  all: Live[];
  subs: number;
  windows: number;
  plan: number[];
  stats: TeamStats;
  /** Posiciones relativas de los 11 puestos (x, y) — caché por posición del balón. */
  shape: Float64Array;
  shapeKey: number;
  /** Mentalidad de partida sobre la que actúa la gestión del marcador. */
  baseMentality: number;
  /** El técnico humano tomó el mando en directo: sin gestión automática del marcador. */
  manual: boolean;
  /** Unidad en la que se abrió la última ventana de cambios (varios cambios en la misma pausa = una ventana). */
  windowUnit: number;
}

type Phase = "start" | "play" | "shootout" | "done";

type PassKind = "recycle" | "progress" | "long" | "through";
type ShotKind = keyof typeof XG_BASE;

const PERIOD_BASE = [0, 2700, 5400, 6300] as const;
const PERIOD_END_MINUTE = [45, 90, 105, 120] as const;

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const logit = (p: number) => Math.log(p / (1 - p));

function emptyStats(): TeamStats {
  return { shots: 0, onTarget: 0, xg: 0, possession: 0, passes: 0, passesCompleted: 0, tackles: 0, fouls: 0, corners: 0, yellow: 0, red: 0 };
}

/** Línea del puesto, para valorar sustituciones. */
function lineOf(p: Position): number {
  if (p === "GK") return 0;
  if (DEFENDERS.has(p)) return 1;
  if (ATTACKERS.has(p)) return 3;
  return 2;
}

export class Sim {
  private readonly teams: [Team, Team];
  private readonly events: MatchEvent[] = [];
  private readonly score: [number, number] = [0, 0];
  private clock = 0;
  private rt = 0;
  private period = 0;
  private minuteSeen = -1;
  private bx = 0.5;
  private by = 0.5;
  private poss: Side = 0;
  private carrier!: Live;
  private lastPasser: Live | null = null;
  private sinceReceive = 0;
  private extraTime = false;
  private pens: [number, number] | undefined;
  private readonly frames: Frames | undefined;
  private readonly weights = new Float64Array(11);
  private readonly outcomes: InstructionOutcome[] = [];
  /** Primera acción forzada tras un saque inicial (rutina de saque). */
  private forced: "recycle" | "long" | null = null;
  /** Factor común del partido: unos son abiertos y otros se traban. */
  private readonly openness: number;
  /** Unidades de simulación jugadas (saques, acciones, finales de parte, tanda). */
  private units = 0;
  private phase: Phase = "start";
  private periodEnd = 0;
  private guard = 0;
  private readonly lineups: [string[], string[]];
  private readonly applied: Intervention[] = [];

  constructor(
    private readonly input: MatchInput,
    private readonly rng: Rng,
    withFrames: boolean,
  ) {
    this.teams = [this.makeTeam(0, input.home), this.makeTeam(1, input.away)];
    this.openness = clamp(1 + this.rng.normal(0, OPENNESS_SD), 0.5, 1.6);
    if (withFrames) this.frames = { t: [], ball: [], pos: [], owner: [], event: [], evCount: [], clock: [], step: [], rosters: [] };
    this.lineups = [this.teams[0].field.map((p) => p!.sp.id), this.teams[1].field.map((p) => p!.sp.id)];
    this.rosterChanged(this.teams[0]);
    this.rosterChanged(this.teams[1]);
  }

  private rosterChanged(team: Team): void {
    if (!this.frames) return;
    this.frames.rosters.push({ at: this.frames.t.length, side: team.side, ids: team.field.map((p) => (p ? p.sp.id : null)) });
  }

  /** Modificadores a partir de las instrucciones que el jugador está cumpliendo. */
  private static modsOf(follows: Partial<Record<InstructionKey, boolean>>): Mods {
    let mods = NO_MODS;
    for (const key of INSTRUCTION_KEYS) {
      if (!follows[key]) continue;
      if (mods === NO_MODS) mods = { ...NO_MODS };
      const eff = INSTRUCTION_EFFECTS[key] as Partial<Mods>;
      for (const k of Object.keys(eff) as (keyof Mods)[]) {
        if (k === "dx" || k === "press" || k === "tackle") mods[k] += eff[k]!;
        else mods[k] *= eff[k]!;
      }
    }
    return mods;
  }

  private makeTeam(side: Side, sheet: TeamSheet): Team {
    const slots = FORMATIONS[sheet.tactics.formation];
    const live = (sp: SheetPlayer, slot: number): Live => {
      const role = slot >= 0 ? slots[slot]!.role : sp.position;
      const sd = FORM_SD * (1.1 - sp.consistency / 20);
      let form = 1 + this.rng.normal(0, sd);
      if (this.input.importance > 0.5) form += ((sp.bigMatches - 10) / 10) * 0.04 * this.input.importance;
      // Cada instrucción se cumple o no en este partido según su carácter y la autoridad del técnico.
      const follows: Partial<Record<InstructionKey, boolean>> = {};
      for (const key of sp.instructions) {
        const followed = this.rng.float() < sp.compliance[key];
        this.outcomes.push({ player: sp.id, key, followed });
        follows[key] = followed;
      }
      return {
        sp, mods: Sim.modsOf(follows), follows, side, slot, role, fam: slot >= 0 ? sp.familiarity : 1, cond: sp.fitness, form: clamp(form, 0.82, 1.16), mult: 1,
        started: slot >= 0, played: slot >= 0, minutes: 0, yellow: 0, red: false, injuryDays: 0, impact: 0, goals: 0, assists: 0,
      };
    };
    const field = sheet.xi.map((sp, i) => live(sp, i));
    const bench = sheet.bench.map((sp) => live(sp, -1));
    const team: Team = {
      side, sheet, t: { ...sheet.tactics }, slots, field, bench, all: [...field, ...bench], subs: 0, windows: 0,
      plan: [this.rng.int(56, 63), this.rng.int(66, 74), this.rng.int(77, 84)], stats: emptyStats(), shape: new Float64Array(22), shapeKey: -1,
      baseMentality: sheet.tactics.mentality, manual: false, windowUnit: -1,
    };
    for (const p of field) this.updateMult(p);
    return team;
  }

  private updateMult(p: Live): void {
    p.mult = p.form * (CONDITION_FLOOR + (1 - CONDITION_FLOOR) * p.cond) * (0.85 + 0.15 * p.fam) * (1 + 0.04 * p.sp.morale);
  }

  // ── Utilidades de posición ────────────────────────────────────────────────

  /** Coordenadas del balón relativas a un equipo. */
  private relX(side: Side): number {
    return side === 0 ? this.bx : 1 - this.bx;
  }
  private relY(side: Side): number {
    return side === 0 ? this.by : 1 - this.by;
  }
  private setBallRel(side: Side, x: number, y: number): void {
    x = clamp(x, 0.01, 0.99);
    y = clamp(y, 0.02, 0.98);
    this.bx = side === 0 ? x : 1 - x;
    this.by = side === 0 ? y : 1 - y;
  }

  private computeShape(team: Team): void {
    // Clave de caché: posición del balón (cuantizada finamente) y posesión.
    const key = Math.round(this.bx * 4096) * 8192 + Math.round(this.by * 4096) * 2 + (this.poss === team.side ? 1 : 0);
    if (key === team.shapeKey) return;
    team.shapeKey = key;
    const bx = this.relX(team.side);
    const by = this.relY(team.side);
    const inPoss = this.poss === team.side;
    for (let i = 0; i < team.slots.length; i++) {
      shapePosition(team.slots[i]!, team.t, bx, by, inPoss, team.shape, i * 2);
      const dx = team.field[i]?.mods.dx ?? 0;
      if (dx) team.shape[i * 2] = clamp(team.shape[i * 2]! + dx * (inPoss ? 1 : 0.5), 0.02, 0.97);
    }
  }

  /** Núcleo de cercanía (aproximación barata de una gaussiana). */
  private static near(d2: number, sigma2: number): number {
    const q = 1 + d2 / (3 * sigma2);
    return 1 / (q * q * q);
  }

  /** Jugador del equipo cuya posición está más cerca de (x, y) relativas, elegido con peso de cercanía. */
  private pickNear(team: Team, x: number, y: number, sigma2: number, exclude: Live | null, allowGk: boolean): Live | null {
    this.computeShape(team);
    const weights = this.weights;
    let total = 0;
    for (let i = 0; i < 11; i++) {
      const p = team.field[i];
      let w = 0;
      if (p && p !== exclude && (allowGk || i !== 0)) {
        const dx = team.shape[i * 2]! - x;
        const dy = team.shape[i * 2 + 1]! - y;
        w = Sim.near(dx * dx + dy * dy, sigma2) + 1e-6;
      }
      weights[i] = w;
      total += w;
    }
    if (total <= 0) return null;
    let r = this.rng.float() * total;
    let last = -1;
    for (let i = 0; i < 11; i++) {
      if (weights[i]! <= 0) continue;
      last = i;
      r -= weights[i]!;
      if (r < 0) return team.field[i]!;
    }
    return last >= 0 ? team.field[last]! : null;
  }

  /** Presión defensiva alrededor de un punto (relativo al defensor): suma de cercanías. */
  private pressureAt(team: Team, x: number, y: number): number {
    let s = 0;
    for (let i = 1; i < 11; i++) {
      if (!team.field[i]) continue;
      const dx = team.shape[i * 2]! - x;
      const dy = team.shape[i * 2 + 1]! - y;
      s += Sim.near(dx * dx + dy * dy, 0.012);
    }
    return s;
  }

  private onField(team: Team): number {
    let n = 0;
    for (const p of team.field) if (p) n++;
    return n;
  }

  /** Ventaja de campo y de superioridad numérica a favor del equipo atacante (logits). */
  private edge(att: Team, def: Team): number {
    const home = this.input.neutral ? 0 : att.side === 0 ? HOME_EDGE : -HOME_EDGE;
    return home + (this.onField(att) - this.onField(def)) * MAN_DOWN + MENTALITY_EDGE * (att.t.mentality + def.t.mentality);
  }

  /** Gestión del marcador: el que gana se protege y el que pierde arriesga, más cuanto más tarde. */
  private gameState(team: Team, minute: number): void {
    if (team.manual) return;
    const [a, b] = GAME_STATE_RAMP;
    const ramp = clamp((minute - a) / (b - a), 0, 1);
    const diff = this.score[team.side] - this.score[(1 - team.side) as Side] + this.aggregateFor(team.side);
    const shift = diff > 0 ? -GAME_STATE_SHIFT : diff < 0 ? GAME_STATE_SHIFT : 0;
    const m = clamp(team.baseMentality + shift * ramp * (Math.abs(diff) >= 2 ? 0.6 : 1), -1, 1);
    if (m !== team.t.mentality) {
      team.t.mentality = m;
      team.shapeKey = -1;
    }
  }

  /** Ventaja de la ida (eliminatorias) vista desde un equipo. */
  private aggregateFor(side: Side): number {
    const agg = this.input.aggregate;
    if (!agg) return 0;
    return side === 0 ? agg[0] - agg[1] : agg[1] - agg[0];
  }

  // ── Reloj ─────────────────────────────────────────────────────────────────

  private advance(seconds: number): void {
    this.clock += seconds;
    this.rt += seconds;
    this.teams[this.poss].stats.possession += seconds;
    const minute = Math.floor(this.clock / 60);
    while (this.minuteSeen < minute) {
      this.minuteSeen++;
      this.tick(this.minuteSeen + 1);
    }
  }

  private actionTime(kind: keyof typeof ACTION_SECONDS, team: Team): number {
    const [a, b] = ACTION_SECONDS[kind];
    return this.rng.range(a, b) * (1.15 - 0.3 * team.t.tempo);
  }

  private displayMinute(): [number, number] {
    const m = Math.floor(this.clock / 60) + 1;
    const end = PERIOD_END_MINUTE[this.period]!;
    return m > end ? [end, m - end] : [m, 0];
  }

  private ev(type: MatchEventType, side: Side, player?: Live | null, other?: Live | null, detail?: string, slot?: number): number {
    const [minute, added] = this.displayMinute();
    const e: MatchEvent = { t: Math.round(this.clock), minute, added, side, type };
    if (player) e.player = player.sp.id;
    if (other) e.other = other.sp.id;
    if (detail !== undefined) e.detail = detail;
    if (slot !== undefined) e.slot = slot;
    this.events.push(e);
    return this.events.length - 1;
  }

  // ── Minuto a minuto: cansancio, lesiones, protestas y cambios ─────────────

  private tick(minute: number): void {
    for (const team of this.teams) {
      this.gameState(team, minute);
      const intensity = 1 + 0.35 * team.t.pressing + 0.2 * team.t.tempo;
      for (const p of team.field) {
        if (!p) continue;
        p.minutes++;
        const s = p.sp.skills;
        const drain = FATIGUE_PER_MINUTE * (1.35 - s.stamina / 20) * intensity * (0.8 + s.workRate / 50) * (p.role === "GK" ? 0.3 : 1) * p.mods.fatigue;
        p.cond = Math.max(0.2, p.cond - drain);
        this.updateMult(p);
        const risk = INJURY_PER_MINUTE * (0.4 + p.sp.injuryProneness / 12) * (1.6 - p.cond);
        if (this.rng.float() < risk) this.injure(team, p);
      }
      let temper = 0;
      for (const p of team.field) if (p) temper += 20 - p.sp.temperament;
      temper /= 11;
      if (this.rng.float() < DISSENT_PER_MINUTE * (0.4 + temper / 10)) {
        const who = this.rng.weighted(team.field.filter((p): p is Live => p !== null), (p) => 21 - p.sp.temperament);
        this.book(team, who, "dissent");
      }
      if (this.period < 2 && team.plan.includes(minute)) this.aiSubs(team, minute);
      if (this.period >= 2 && (minute === 91 || minute === 106)) this.aiSubs(team, minute);
    }
  }

  private injure(team: Team, p: Live): void {
    if (!p.played || p.slot < 0 || p.injuryDays > 0) return;
    const prone = 0.6 + p.sp.injuryProneness / 25;
    const bucket = this.rng.weighted(INJURY_DAYS, (b) => b[0]);
    p.injuryDays = Math.round(this.rng.range(bucket[1], bucket[2]) * prone);
    this.ev("injury", team.side, p, null, String(p.injuryDays), p.slot);
    this.replace(team, p, true);
    this.advanceDead(DEAD_SECONDS.injury);
  }

  /** Mejor suplente para un puesto. */
  private bestBench(team: Team, role: Position): Live | null {
    let best: Live | null = null;
    let bestV = -Infinity;
    for (const b of team.bench) {
      if (b.played) continue;
      if ((role === "GK") !== (b.sp.position === "GK")) continue;
      const fam = b.sp.position === role ? 1 : lineOf(b.sp.position) === lineOf(role) ? 0.7 : 0.35;
      const v = b.sp.ability - (1 - fam) * 5 - (1 - b.sp.fitness) * 8;
      if (v > bestV) {
        bestV = v;
        best = b;
      }
    }
    return best;
  }

  /** Saca a un jugador del campo (lesión) y mete al mejor suplente si quedan cambios. */
  private replace(team: Team, out: Live, forced: boolean): boolean {
    const slot = out.slot;
    const role = team.slots[slot]!.role;
    const canSub = team.subs < MAX_SUBS && (forced || team.windows < SUB_WINDOWS);
    const sub = canSub ? this.bestBench(team, role) : null;
    out.slot = -1;
    team.field[slot] = null;
    if (sub) {
      this.enter(team, sub, slot);
      this.ev("sub", team.side, sub, out, undefined, slot);
      this.advanceDead(DEAD_SECONDS.sub);
    } else if (slot === 0) {
      this.emergencyKeeper(team);
    }
    if (this.carrier === out) this.carrier = this.pickNear(team, 0.4, 0.5, 0.2, null, true) ?? this.carrier;
    this.rosterChanged(team);
    return sub !== null;
  }

  private enter(team: Team, p: Live, slot: number): void {
    team.subs++;
    team.shapeKey = -1;
    p.slot = slot;
    p.role = team.slots[slot]!.role;
    p.fam = p.sp.position === p.role ? 1 : lineOf(p.sp.position) === lineOf(p.role) ? 0.7 : 0.35;
    p.played = true;
    team.field[slot] = p;
    this.updateMult(p);
  }

  /** Sin portero: un jugador de campo se pone los guantes. */
  private emergencyKeeper(team: Team): void {
    let pick = -1;
    for (let i = 1; i < team.field.length; i++) {
      const p = team.field[i];
      if (p && (pick < 0 || p.sp.ability < team.field[pick]!.sp.ability)) pick = i;
    }
    if (pick < 0) return;
    const p = team.field[pick]!;
    team.field[pick] = null;
    team.field[0] = p;
    p.slot = 0;
    p.role = "GK";
    p.fam = 0.02;
    this.updateMult(p);
    team.shapeKey = -1;
    this.rosterChanged(team);
  }

  private aiSubs(team: Team, minute: number): void {
    if (team.subs >= MAX_SUBS || team.windows >= SUB_WINDOWS) return;
    const diff = this.score[team.side] - this.score[(1 - team.side) as Side];
    const late = minute >= 75;
    const wanted: { out: Live; role: Position }[] = [];
    const outfield = team.field.filter((p): p is Live => p !== null && p.slot > 0).sort((a, b) => a.cond - b.cond);
    for (const p of outfield) {
      if (wanted.length >= (late ? 3 : 2)) break;
      if (p.cond < SUB_CONDITION || (p.yellow === 1 && DEFENDERS.has(p.role) && minute >= 60 && this.rng.chance(0.35))) {
        wanted.push({ out: p, role: p.role });
      }
    }
    // Perdiendo: un atacante por el defensa o medio más flojo. Ganando por la mínima al final: cerrar.
    if (diff < 0 && minute >= 60 && wanted.length < 2) {
      const victim = outfield.filter((p) => !ATTACKERS.has(p.role) && !wanted.some((w) => w.out === p)).sort((a, b) => a.sp.ability - b.sp.ability)[0];
      if (victim) wanted.push({ out: victim, role: victim.role });
    }
    let made = 0;
    for (const w of wanted) {
      if (team.subs >= MAX_SUBS) break;
      let sub = this.bestBench(team, w.role);
      if (diff < 0 && minute >= 60 && !ATTACKERS.has(w.role)) {
        sub = team.bench.filter((b) => !b.played && ATTACKERS.has(b.sp.position)).sort((a, b) => b.sp.ability - a.sp.ability)[0] ?? sub;
      } else if (diff === 1 && minute >= 80 && ATTACKERS.has(w.role)) {
        sub = team.bench.filter((b) => !b.played && (DEFENDERS.has(b.sp.position) || b.sp.position === "DM")).sort((a, b) => b.sp.ability - a.sp.ability)[0] ?? sub;
      }
      if (!sub || sub.sp.ability < w.out.sp.ability - 3.5) continue;
      const slot = w.out.slot;
      w.out.slot = -1;
      team.field[slot] = null;
      this.enter(team, sub, slot);
      this.ev("sub", team.side, sub, w.out, undefined, slot);
      if (this.carrier === w.out) this.carrier = sub;
      made++;
    }
    if (made) {
      team.windows++;
      this.rosterChanged(team);
      this.advanceDead(DEAD_SECONDS.sub);
    }
  }

  // ── Disciplina ────────────────────────────────────────────────────────────

  private book(team: Team, p: Live, detail?: string): void {
    p.yellow++;
    team.stats.yellow++;
    p.impact -= 0.25;
    if (p.yellow >= 2) {
      this.ev("red", team.side, p, null, "secondYellow", p.slot);
      this.sendOff(team, p);
    } else {
      this.ev("yellow", team.side, p, null, detail);
    }
  }

  private sendOff(team: Team, p: Live): void {
    p.red = true;
    team.stats.red++;
    p.impact -= 1.0;
    const slot = p.slot;
    p.slot = -1;
    team.field[slot] = null;
    if (slot === 0) {
      // Portero expulsado: entra el suplente por un jugador de campo, o se improvisa.
      const gk = team.subs < MAX_SUBS ? this.bestBench(team, "GK") : null;
      const victim = team.field.filter((x): x is Live => x !== null && x.slot > 0).sort((a, b) => a.sp.ability - b.sp.ability)[0];
      if (gk && victim) {
        team.field[victim.slot] = null;
        const vs = victim.slot;
        victim.slot = -1;
        this.enter(team, gk, 0);
        this.ev("sub", team.side, gk, victim, undefined, vs);
        team.windows++;
      } else this.emergencyKeeper(team);
    }
    if (this.carrier === p) this.carrier = this.pickNear(team, 0.4, 0.5, 0.2, null, true) ?? this.carrier;
    team.shapeKey = -1;
    this.rosterChanged(team);
  }

  private foul(def: Team, fouler: Live, victim: Live, tactical: boolean): void {
    const att = this.teams[victim.side];
    def.stats.fouls++;
    fouler.impact -= 0.04;
    this.ev("foul", def.side, fouler, victim);
    const strict = this.input.refStrictness;
    const aggr = fouler.sp.skills.aggression;
    const inBox = this.relX(att.side) > 0.84;
    const pRed = RED_PER_FOUL * (0.6 + aggr / 20) * (1.4 - fouler.sp.temperament / 20) * (0.6 + strict / 25);
    const pYellow = YELLOW_PER_FOUL * (0.55 + strict / 22) * (0.6 + aggr / 20) * (tactical ? TACTICAL_YELLOW_MULT : 1) * (inBox ? 1.3 : 1) * (fouler.yellow ? BOOKED_CAUTION.card : 1);
    const r = this.rng.float();
    if (r < pRed) {
      this.ev("red", def.side, fouler, null, "direct", fouler.slot);
      this.sendOff(def, fouler);
    } else if (r < pRed + pYellow) this.book(def, fouler);
    if (this.rng.float() < INJURY_ON_FOUL && victim.slot >= 0) this.injure(att, victim);
    this.setPiece(att, victim.slot >= 0 ? victim : null);
  }

  // ── Balón parado ──────────────────────────────────────────────────────────

  private bestBy(team: Team, f: (p: Live) => number, outfieldOnly = true): Live | null {
    let best: Live | null = null;
    let bestV = -Infinity;
    for (const p of team.field) {
      if (!p || (outfieldOnly && p.slot === 0)) continue;
      const v = f(p);
      if (v > bestV) {
        bestV = v;
        best = p;
      }
    }
    return best;
  }

  /** Lanzador designado si está en el campo. */
  private designated(team: Team, id: string | null): Live | null {
    if (!id) return null;
    for (const p of team.field) if (p && p.sp.id === id) return p;
    return null;
  }

  private penaltyTaker(team: Team): Live | null {
    for (const id of team.t.setPieces.penaltyTakers) {
      const p = this.designated(team, id);
      if (p) return p;
    }
    return this.bestBy(team, (p) => p.sp.skills.penalties);
  }

  private setPiece(att: Team, victim: Live | null): void {
    this.poss = att.side;
    const x = this.relX(att.side);
    const dy = Math.abs(this.relY(att.side) - 0.5);
    const sp = att.t.setPieces;
    this.advanceDead(DEAD_SECONDS.foul);
    if (x > 0.84 && dy < 0.25) {
      const taker = this.penaltyTaker(att);
      this.ev("penaltyAwarded", att.side, taker);
      if (taker) {
        this.carrier = taker;
        this.setBallRel(att.side, 0.89, 0.5);
        this.shot(att, taker, "penalty", null);
        return;
      }
    }
    const fkTaker = () =>
      this.designated(att, sp.freeKickTaker) ?? this.bestBy(att, (p) => p.sp.skills.freeKicks * 0.7 + p.sp.skills.technique * 0.3);
    if (x > 0.7 && dy < 0.3 && this.rng.float() < FREE_KICK_DIRECT[sp.freeKicks]) {
      const taker = fkTaker();
      if (taker) {
        this.carrier = taker;
        this.shot(att, taker, "freeKick", null);
        return;
      }
    }
    if (x > 0.66 && sp.freeKicks !== "short") {
      const taker = this.designated(att, sp.freeKickTaker) ?? this.bestBy(att, (p) => p.sp.skills.crossing);
      if (taker) {
        this.carrier = taker;
        this.cross(att, this.teams[1 - att.side as Side], taker, 0.3);
        return;
      }
    }
    this.carrier = victim ?? this.pickNear(att, x, 0.5, 0.05, null, false) ?? this.carrier;
  }

  private corner(att: Team): void {
    const def = this.teams[1 - att.side as Side];
    const sp = att.t.setPieces;
    att.stats.corners++;
    this.poss = att.side;
    const top = this.rng.chance(0.5);
    this.setBallRel(att.side, 0.99, top ? 0.02 : 0.98);
    const taker = this.designated(att, sp.cornerTaker) ?? this.bestBy(att, (p) => p.sp.skills.crossing);
    this.ev("corner", att.side, taker, null, sp.corners);
    this.advanceDead(DEAD_SECONDS.corner);
    if (taker) this.carrier = taker;
    this.snap(-1);
    const routine = CORNER_ROUTINES[sp.corners];
    const crowd = CORNER_CROWD[sp.cornerCrowd];
    if (sp.corners === "short") {
      // En corto: se conserva el balón cerca del córner y la jugada sigue.
      const mate = this.pickNear(att, 0.9, top ? 0.1 : 0.9, 0.01, taker, false);
      if (mate) {
        this.lastPasser = taker;
        this.sinceReceive = 0;
        this.carrier = mate;
        this.setBallRel(att.side, 0.9, top ? 0.12 : 0.88);
        att.stats.passes++;
        att.stats.passesCompleted++;
        return;
      }
    }
    if (sp.corners === "edgeOfBox" && this.rng.chance(0.45)) {
      const shooter = this.bestBy(att, (p) => (p === taker ? 0 : p.sp.skills.longShots));
      if (shooter) {
        this.carrier = shooter;
        this.setBallRel(att.side, 0.8, 0.5 + this.rng.range(-0.1, 0.1));
        this.shot(att, shooter, "long", taker);
        return;
      }
    }
    const quality = taker ? taker.sp.skills.crossing * taker.mult : 10;
    if (this.rng.float() < CORNER_SHOT * Math.sqrt(quality / 12) * routine.shot * crowd.shot) {
      const power = sp.corners === "farPost" ? 4 : 3;
      const header = this.weightedField(att, (p) => (p === taker || p.slot === 0 ? 0 : Math.pow(p.sp.skills.aerial / 10, power)));
      if (header) {
        this.setBallRel(att.side, 0.92, 0.5 + this.rng.range(-0.08, 0.08));
        this.carrier = header;
        this.shot(att, header, "cornerHeader", taker, routine.xg);
        return;
      }
    }
    // Despejado: segunda jugada del atacante, contra del rival (más probable cuantos más suben) o balón para el defensor.
    const r = this.rng.float();
    if (r < 0.25) {
      this.setBallRel(att.side, 0.7, 0.5 + this.rng.range(-0.25, 0.25));
      this.carrier = this.pickNear(att, 0.68, this.relY(att.side), 0.03, null, false) ?? this.carrier;
    } else if (r < 0.25 + crowd.counter * 0.75) {
      this.setBallRel(def.side, 0.42, 0.5 + this.rng.range(-0.3, 0.3));
      this.turnover(def, this.pickNear(def, 0.42, this.relY(def.side), 0.03, null, false));
    } else {
      this.turnover(def, this.pickNear(def, 0.12, this.relY(def.side), 0.02, null, false));
    }
  }

  /** Saque de banda: en campo rival y con rutina "larga" se convierte en un centro al área. */
  private throwIn(team: Team): void {
    this.advanceDead(DEAD_SECONDS.throwIn);
    const sp = team.t.setPieces;
    if (sp.throwIns === "long" && this.relX(team.side) > 0.72) {
      const thrower = this.designated(team, sp.throwInTaker) ?? this.bestBy(team, (p) => p.sp.skills.strength);
      if (thrower) {
        this.poss = team.side;
        this.carrier = thrower;
        this.cross(team, this.teams[1 - team.side as Side], thrower, LONG_THROW_BONUS, thrower.sp.skills.strength * 0.6 + thrower.sp.skills.crossing * 0.4);
        return;
      }
    }
    this.turnover(team, null);
  }

  private weightedField(team: Team, w: (p: Live) => number): Live | null {
    const list = team.field.filter((p): p is Live => p !== null);
    if (!list.length) return null;
    const pick = this.rng.weighted(list, w);
    return w(pick) > 0 ? pick : null;
  }

  private advanceDead(seconds: number): void {
    this.advance(seconds * this.rng.range(0.7, 1.3));
  }

  // ── Posesión ──────────────────────────────────────────────────────────────

  private turnover(to: Team, p: Live | null): void {
    this.poss = to.side;
    this.carrier = p ?? this.pickNear(to, this.relX(to.side), this.relY(to.side), 0.05, null, true) ?? this.carrier;
    this.lastPasser = null;
    this.sinceReceive = 0;
  }

  private kickoff(side: Side): void {
    this.bx = 0.5;
    this.by = 0.5;
    this.poss = side;
    const team = this.teams[side];
    this.carrier = this.pickNear(team, 0.5, 0.5, 0.02, null, false) ?? team.field.find((p): p is Live => p !== null)!;
    this.lastPasser = null;
    this.sinceReceive = 0;
    this.forced = team.t.setPieces.kickoff === "long" ? "long" : "recycle";
  }

  private keeperBall(team: Team): void {
    this.poss = team.side;
    this.setBallRel(team.side, 0.05, 0.5);
    this.carrier = team.field[0] ?? this.pickNear(team, 0.1, 0.5, 0.05, null, true) ?? this.carrier;
    this.lastPasser = null;
    this.sinceReceive = 0;
  }

  /** Una acción del poseedor del balón. */
  private step(): void {
    const att = this.teams[this.poss];
    const def = this.teams[1 - this.poss as Side];
    const c = this.carrier;
    if (c.slot < 0) {
      this.carrier = this.pickNear(att, this.relX(att.side), this.relY(att.side), 0.05, null, true) ?? c;
      if (this.carrier.slot < 0) {
        this.advance(5);
        return;
      }
    }
    this.snap(-1);
    // Disputas sueltas: empujones, agarrones y faltas del propio atacante.
    if (this.rng.float() < LOOSE_FOUL * (this.relX(att.side) > 0.84 ? BOX_FOUL_MULT : 1)) {
      this.computeShape(def);
      const d = this.pickNear(def, 1 - this.relX(att.side), 1 - this.relY(att.side), 0.02, null, false);
      if (d) {
        if (this.rng.chance(0.4)) {
          att.stats.fouls++;
          this.ev("foul", att.side, this.carrier, d);
          this.advanceDead(DEAD_SECONDS.foul);
          this.turnover(def, d);
        } else this.foul(def, d, this.carrier, false);
        return;
      }
    }
    const x = this.relX(att.side);
    const y = this.relY(att.side);
    const s = this.carrier.sp.skills;
    const t = att.t;
    const dy = Math.abs(y - 0.5);
    const central = dy < 0.2;
    const wide = dy > 0.3;
    const role = this.carrier.role;
    if (role === "GK" && !this.forced) {
      const r = this.rng.float() * (1.5 + 1.2 * (0.5 + t.directness) + 1.2);
      if (r < 1.5) this.pass(att, def, "progress");
      else if (r < 1.5 + 1.2 * (0.5 + t.directness)) this.pass(att, def, "long");
      else this.pass(att, def, "recycle");
      return;
    }
    if (this.forced) {
      // Rutina de saque inicial: elaborar desde atrás o balón largo.
      const kind = this.forced;
      this.forced = null;
      this.pass(att, def, kind);
      return;
    }
    const m = this.carrier.mods;
    const o = this.openness;
    const shot = (x > 0.83
      ? (central ? W.shotBox : W.shotBoxWide) * (s.finishing / 12) * (1 + 0.25 * t.mentality)
      : x > 0.68 && dy < 0.3 ? W.shotLong * (s.longShots / 12) * (1 + 0.4 * t.mentality) : 0) * m.shot * o;
    const cross = (x > 0.68 && wide ? W.cross * (0.6 + t.width) * (s.crossing / 12) : x > 0.7 && !central ? 0.25 * W.cross : 0) * m.cross;
    const through = (x > 0.5 && x < 0.85 ? W.through * (s.vision / 12) * (1 + 0.25 * t.mentality) * (0.7 + 0.6 * t.tempo) : 0) * m.through * o;
    const dribble = W.dribble * Math.pow(s.dribbling / 12, 1.6) * (ATTACKERS.has(role) || role === "LM" || role === "RM" ? 1.5 : 1) * (x > 0.3 ? 1 : 0.35) * m.dribble;
    const progress = W.progress * (1 + 0.15 * t.mentality) * (0.8 + 0.4 * t.tempo) * (x > 0.85 ? 0.3 : 1) * m.short;
    const recycle = W.recycle * (1 - 0.15 * t.mentality) * (1.2 - 0.4 * t.tempo) * m.short;
    const long = (x < 0.45 ? (W.long + W.longDirect * t.directness) * (role === "CB" ? 1.6 : 1) : 0) * m.long;
    let r = this.rng.float() * (shot + cross + through + dribble + progress + recycle + long);
    if ((r -= shot) < 0) {
      this.shot(att, this.carrier, x > 0.83 ? (central ? (x > 0.92 ? "boxClose" : "box") : "boxWide") : "long", this.assister());
    } else if ((r -= cross) < 0) this.cross(att, def, this.carrier, 0);
    else if ((r -= through) < 0) this.pass(att, def, "through");
    else if ((r -= dribble) < 0) this.dribble(att, def);
    else if ((r -= progress) < 0) this.pass(att, def, "progress");
    else if (r - recycle < 0) this.pass(att, def, "recycle");
    else this.pass(att, def, "long");
  }

  private assister(): Live | null {
    return this.sinceReceive <= 1 && this.lastPasser && this.lastPasser.slot >= 0 ? this.lastPasser : null;
  }

  private pass(att: Team, def: Team, kind: PassKind): void {
    const c = this.carrier;
    const x = this.relX(att.side);
    const y = this.relY(att.side);
    let tx: number;
    let ty: number;
    switch (kind) {
      case "recycle":
        tx = x + this.rng.range(-0.15, 0.03);
        ty = y + this.rng.range(-0.3, 0.3);
        break;
      case "progress":
        tx = x + this.rng.range(0.07, 0.19);
        ty = 0.5 + (y - 0.5) * 0.6 + this.rng.range(-0.3, 0.3) * (0.6 + att.t.width * 0.6);
        break;
      case "long":
        tx = x + this.rng.range(0.24, 0.42);
        ty = this.rng.range(0.1, 0.9);
        break;
      case "through":
        tx = this.rng.range(0.86, 0.94);
        ty = 0.5 + this.rng.range(-0.13, 0.13);
        break;
    }
    tx = clamp(tx, 0.03, 0.97);
    ty = clamp(ty, 0.04, 0.96);
    this.computeShape(att);
    const receiver = this.pickNear(att, tx, ty, kind === "through" ? 0.05 : 0.03, c, kind === "recycle" && x < 0.3);
    if (!receiver) {
      this.advance(3);
      return;
    }
    this.computeShape(def);
    const d = this.pickNear(def, 1 - tx, 1 - ty, 0.015, null, false);
    const pressure = this.pressureAt(def, 1 - tx, 1 - ty);
    const s = c.sp.skills;
    const r = receiver.sp.skills;
    const passQ = kind === "long" ? s.passing * 0.5 + s.vision * 0.5 : kind === "through" ? s.vision * 0.6 + s.passing * 0.4 : s.passing * 0.8 + s.technique * 0.2;
    const recvQ = kind === "long" || kind === "through" ? r.firstTouch * 0.5 + r.pace * 0.5 : r.firstTouch * 0.8 + r.composure * 0.2;
    const defQ = d ? (d.sp.skills.anticipation * 0.4 + d.sp.skills.positioning * 0.3 + d.sp.skills.marking * 0.3) * d.mult : 8;
    const press = x < 0.5 ? PRESS_EDGE * def.t.pressing * (0.5 - x) * 2 : 0;
    const finalThird = kind === "through" ? 0 : Math.max(0, tx - 0.7) * 10 * FINAL_THIRD_PENALTY;
    const l = PASS_BASE[kind] + SKILL_K * (passQ * c.mult * 0.65 + recvQ * receiver.mult * 0.35 - defQ) + this.edge(att, def) - 0.22 * pressure - press - finalThird - (d ? d.mods.press : 0);
    att.stats.passes++;
    this.advance(this.actionTime(kind, att));
    if (this.rng.float() < sigmoid(l)) {
      att.stats.passesCompleted++;
      c.impact += kind === "recycle" ? 0.004 : kind === "progress" ? 0.012 : 0.03;
      this.lastPasser = c;
      this.sinceReceive = 0;
      this.carrier = receiver;
      this.setBallRel(att.side, tx, ty);
      if (kind === "through" && receiver.slot > 0) this.shot(att, receiver, "oneOnOne", c);
      return;
    }
    c.impact -= kind === "recycle" ? 0.05 : kind === "progress" ? 0.025 : 0.008;
    this.setBallRel(att.side, tx, ty);
    if (this.rng.chance(0.18)) {
      // Fuera de banda: saque para el rival.
      this.throwIn(def);
    } else {
      if (d) d.impact += 0.03;
      this.turnover(def, d);
    }
  }

  private dribble(att: Team, def: Team): void {
    const c = this.carrier;
    const x = this.relX(att.side);
    const y = this.relY(att.side);
    this.computeShape(def);
    const d = this.pickNear(def, 1 - x, 1 - y, 0.01, null, false);
    const s = c.sp.skills;
    const dribQ = s.dribbling * 0.6 + s.pace * 0.2 + s.agility * 0.2;
    const defQ = d ? (d.sp.skills.tackling * 0.55 + d.sp.skills.positioning * 0.2 + d.sp.skills.pace * 0.25) * d.mult : 8;
    const l = DRIBBLE_BASE + SKILL_K * (dribQ * c.mult - defQ) + this.edge(att, def) - (d ? d.mods.tackle : 0);
    this.advance(this.actionTime("dribble", att));
    if (this.rng.float() < sigmoid(l)) {
      c.impact += 0.04;
      this.sinceReceive++;
      const nx = x + this.rng.range(0.06, 0.13);
      this.setBallRel(att.side, nx, y + this.rng.range(-0.08, 0.08) + (0.5 - y) * 0.15);
      if (d && nx > 0.35 && nx < 0.8 && this.rng.float() < TACTICAL_FOUL * (0.5 + d.sp.skills.aggression / 20) * (d.yellow ? BOOKED_CAUTION.foul : 1) * d.mods.foul) {
        this.foul(def, d, c, true);
      }
      return;
    }
    if (!d) {
      this.turnover(def, null);
      return;
    }
    const pFoul = FOUL_ON_TACKLE * (0.5 + d.sp.skills.aggression / 20) * (1.3 - d.sp.skills.tackling / 20) * (x > 0.84 ? BOX_FOUL_MULT : 1) * (d.yellow ? BOOKED_CAUTION.foul : 1) * d.mods.foul;
    if (this.rng.float() < pFoul) {
      this.foul(def, d, c, false);
      return;
    }
    def.stats.tackles++;
    d.impact += 0.05;
    c.impact -= 0.03;
    this.turnover(def, d);
  }

  private cross(att: Team, def: Team, c: Live, bonus: number, quality?: number): void {
    att.stats.passes++;
    const target = this.weightedField(att, (p) => {
      if (p === c || p.slot === 0) return 0;
      const w = p.role === "ST" ? 2 : ATTACKERS.has(p.role) ? 1.2 : p.role === "CB" ? 0.45 : 0.7;
      return w * Math.pow(p.sp.skills.aerial / 10, 2);
    });
    const d = this.bestBy(def, (p) => (DEFENDERS.has(p.role) ? p.sp.skills.aerial * p.mult + this.rng.float() * 3 : 0));
    this.advance(this.actionTime("cross", att));
    if (!target) {
      this.turnover(def, d);
      return;
    }
    const q = (quality ?? c.sp.skills.crossing) * c.mult * 0.5 + target.sp.skills.aerial * target.mult * 0.5 - (d ? d.sp.skills.aerial * d.mult : 8);
    const l = CROSS_BASE + bonus + SKILL_K * q + this.edge(att, def);
    if (this.rng.float() < sigmoid(l)) {
      att.stats.passesCompleted++;
      this.carrier = target;
      this.setBallRel(att.side, 0.9, 0.5 + this.rng.range(-0.1, 0.1));
      this.shot(att, target, "header", c);
      return;
    }
    if (d) d.impact += 0.03;
    if (d && this.rng.float() < 0.008) {
      this.score[att.side]++;
      d.impact -= 0.8;
      const e = this.ev("ownGoal", att.side, d, null, "ownGoal");
      this.setBallRel(att.side, 1, 0.5);
      this.snap(e);
      this.advanceDead(DEAD_SECONDS.goal);
      this.kickoff(def.side);
      return;
    }
    if (this.rng.float() < CROSS_CORNER) this.corner(att);
    else {
      this.setBallRel(att.side, 0.85, this.relY(att.side));
      this.turnover(def, d);
    }
  }

  private shot(att: Team, shooter: Live, kind: ShotKind, assist: Live | null, xgMult = 1): void {
    const def = this.teams[1 - att.side as Side];
    const s = shooter.sp.skills;
    const gk = def.field[0];
    const gkQ = gk ? (kind === "oneOnOne" ? (gk.sp.skills.keeping + gk.sp.skills.oneOnOnes) / 2 : gk.sp.skills.keeping) * gk.mult : 3;
    let q: number;
    switch (kind) {
      case "header":
      case "cornerHeader":
        q = s.heading * 0.6 + s.aerial * 0.4;
        break;
      case "long":
        q = s.longShots;
        break;
      case "penalty":
        q = s.penalties;
        break;
      case "freeKick":
        q = s.freeKicks * 0.7 + s.technique * 0.3;
        break;
      default:
        q = s.finishing;
    }
    let mod = 0;
    if (kind === "penalty") mod += ((shooter.sp.pressure - 10) / 10) * 0.2;
    if (this.input.importance > 0.5) mod += ((shooter.sp.bigMatches - 10) / 10) * 0.15 * this.input.importance;
    const home = this.input.neutral ? 0 : att.side === 0 ? HOME_EDGE * 0.5 : -HOME_EDGE * 0.5;
    if (kind !== "penalty" && kind !== "freeKick") {
      this.computeShape(def);
      mod -= SHOT_PRESSURE * Math.max(0, this.pressureAt(def, 1 - this.relX(att.side), 1 - this.relY(att.side)) - 0.5);
    }
    const xg = sigmoid(logit(XG_BASE[kind] * xgMult) + SHOOTER_K * (q * shooter.mult - 11) - KEEPER_K * (gkQ - 11) + home + mod);
    att.stats.shots++;
    att.stats.xg += xg;
    this.advance(this.actionTime("shot", att));
    const blockP = kind === "box" || kind === "boxClose" || kind === "boxWide" ? BLOCK_CHANCE.box : kind === "long" ? BLOCK_CHANCE.long : kind === "penalty" ? 0 : BLOCK_CHANCE.other;
    if (this.rng.float() < blockP) {
      shooter.impact -= 0.01;
      this.ev("shotBlocked", att.side, shooter, null, kind);
      if (this.rng.float() < BLOCK_CORNER) this.corner(att);
      else this.turnover(def, this.pickNear(def, 1 - this.relX(att.side), 0.5, 0.02, null, false));
      return;
    }
    const pGoal = Math.min(0.97, xg / (1 - blockP));
    if (this.rng.float() < pGoal) {
      this.score[att.side]++;
      att.stats.onTarget++;
      shooter.goals++;
      shooter.impact += kind === "penalty" ? 0.6 : 1.0;
      if (assist && assist !== shooter) {
        assist.assists++;
        assist.impact += 0.55;
      }
      if (gk) gk.impact -= 0.2;
      for (const p of def.field) if (p && DEFENDERS.has(p.role)) p.impact -= 0.06;
      const goalKind: GoalKind = kind === "header" || kind === "cornerHeader" ? "header" : kind === "penalty" ? "penalty" : kind === "freeKick" ? "freeKick" : kind === "long" ? "longShot" : kind === "rebound" ? "rebound" : "open";
      const e = this.ev("goal", att.side, shooter, assist && assist !== shooter ? assist : null, goalKind);
      this.setBallRel(att.side, 1, 0.5 + this.rng.range(-0.04, 0.04));
      this.snap(e);
      this.advanceDead(DEAD_SECONDS.goal);
      this.kickoff(def.side);
      return;
    }
    const onTarget = clamp(ON_TARGET_SHARE + 0.02 * (q * shooter.mult - 11), 0.2, 0.6) * (kind === "penalty" ? 0.6 : 1);
    if (this.rng.float() < onTarget) {
      att.stats.onTarget++;
      shooter.impact += 0.06;
      if (gk) gk.impact += 0.18;
      const e = this.ev("shotSaved", att.side, shooter, gk, kind);
      this.setBallRel(att.side, 0.98, 0.5 + this.rng.range(-0.05, 0.05));
      this.snap(e);
      const r = this.rng.float();
      if (r < SAVE_CORNER) this.corner(att);
      else if (r < SAVE_CORNER + SAVE_REBOUND && kind !== "penalty") {
        const follow = this.pickNear(att, 0.9, 0.5, 0.02, null, false);
        if (follow) {
          this.carrier = follow;
          this.setBallRel(att.side, 0.92, 0.5 + this.rng.range(-0.06, 0.06));
          this.shot(att, follow, "rebound", null);
        } else this.keeperBall(def);
      } else this.keeperBall(def);
      return;
    }
    shooter.impact -= 0.02;
    const wood = this.rng.chance(0.045);
    const e = this.ev(wood ? "woodwork" : "shotOff", att.side, shooter, null, kind);
    this.setBallRel(att.side, 1, this.rng.chance(0.5) ? 0.38 : 0.62);
    this.snap(e);
    this.advanceDead(DEAD_SECONDS.goalKick);
    this.keeperBall(def);
  }

  // ── Fotogramas (sin RNG) ──────────────────────────────────────────────────

  private snap(event: number): void {
    const f = this.frames;
    if (!f) return;
    f.t.push(Math.round(this.rt * 10) / 10);
    f.ball.push(round3(this.bx), round3(this.by));
    f.owner.push(this.poss);
    f.event.push(event);
    f.evCount.push(this.events.length);
    f.clock.push(Math.round(this.clock));
    f.step.push(this.units);
    const n = f.t.length;
    for (const team of this.teams) {
      this.computeShape(team);
      for (let i = 0; i < 11; i++) {
        const p = team.field[i];
        if (!p) {
          f.pos.push(-1, -1);
          continue;
        }
        if (p === this.carrier) {
          f.pos.push(round3(this.bx), round3(this.by));
          continue;
        }
        // Ruido estable (hash del fotograma y el puesto) para que no se vea rígido.
        const h1 = (Math.imul(n * 31 + i * 7 + team.side * 101, 2654435761) >>> 0) / 4294967296 - 0.5;
        const h2 = (Math.imul(n * 17 + i * 13 + team.side * 57, 2246822519) >>> 0) / 4294967296 - 0.5;
        const x = clamp(team.shape[i * 2]! + h1 * 0.03, 0.01, 0.99);
        const y = clamp(team.shape[i * 2 + 1]! + h2 * 0.04, 0.01, 0.99);
        f.pos.push(round3(team.side === 0 ? x : 1 - x), round3(team.side === 0 ? y : 1 - y));
      }
    }
  }

  // ── Partido completo ──────────────────────────────────────────────────────

  /** Arranque de una parte: añadido, reloj y saque inicial. */
  private startPeriod(): void {
    const period = this.period;
    const base = PERIOD_BASE[period]!;
    const len = period < 2 ? 2700 : 900;
    const [lo, hi] = period === 0 ? STOPPAGE_FIRST : period === 1 ? STOPPAGE_SECOND : [0, 2];
    this.periodEnd = base + len + this.rng.int(lo, hi) * 60;
    this.clock = base;
    this.minuteSeen = Math.floor(base / 60) - 1;
    this.guard = 0;
    this.kickoff((period % 2) as Side);
    const ko = this.ev("kickoff", this.poss);
    this.snap(ko);
  }

  /** Final de una parte y paso a la siguiente fase del partido. */
  private endPeriod(): void {
    const period = this.period;
    this.clock = Math.min(this.clock, this.periodEnd);
    if (period === 1 && this.needsExtra()) {
      this.extraTime = true;
      this.ev("extraTime", 0);
      this.period = 2;
      this.phase = "start";
      return;
    }
    const e = this.ev(period === 1 || period === 3 ? "fullTime" : "halfTime", 0);
    this.snap(e);
    if (period === 0 || period === 2) {
      this.period = period + 1;
      this.phase = "start";
    } else if (period === 3 && this.needsExtra()) this.phase = "shootout";
    else this.phase = "done";
  }

  /**
   * Una unidad de simulación: un saque inicial, una acción, un final de parte o la tanda.
   * Entre dos unidades se puede pausar el partido e intervenir.
   */
  private unit(): void {
    this.units++;
    switch (this.phase) {
      case "start":
        this.startPeriod();
        this.phase = "play";
        return;
      case "play":
        if (this.clock < this.periodEnd && this.guard++ < 5000) this.step();
        else this.endPeriod();
        return;
      case "shootout":
        this.shootout();
        this.phase = "done";
        return;
      case "done":
        return;
    }
  }

  get finished(): boolean {
    return this.phase === "done";
  }

  get step_(): number {
    return this.units;
  }

  /** Juega hasta haber completado `step` unidades (o hasta el final). */
  runTo(step: number): void {
    while (this.units < step && this.phase !== "done") this.unit();
  }

  runToEnd(): void {
    while (this.phase !== "done") this.unit();
  }

  // ── Intervenciones en directo ─────────────────────────────────────────────

  /** En una pausa entre partes (descanso, antes de la prórroga) los cambios no gastan ventana. */
  private atBreak(): boolean {
    return this.phase === "start" && this.units > 0;
  }

  /** Aplica un cambio del técnico. Devuelve la clave del error (i18n) o null. */
  apply(side: Side, change: MatchChange): string | null {
    if (this.phase === "done") return "error.matchOver";
    const team = this.teams[side];
    let error: string | null;
    switch (change.type) {
      case "sub":
        error = this.manualSub(team, change.out, change.in);
        break;
      case "tactics":
        error = this.changeTactics(team, change.tactics);
        break;
      case "instructions":
        error = this.changeInstructions(team, change.instructions);
        break;
    }
    if (!error) this.applied.push({ step: this.units, side, change });
    return error;
  }

  private manualSub(team: Team, outId: string, inId: string): string | null {
    const out = team.field.find((p) => p?.sp.id === outId);
    const sub = team.bench.find((p) => p.sp.id === inId);
    if (!out) return "error.subOut";
    if (!sub || sub.played) return "error.subIn";
    if (team.subs >= MAX_SUBS) return "error.noSubsLeft";
    const newWindow = !this.atBreak() && team.windowUnit !== this.units;
    if (newWindow && team.windows >= SUB_WINDOWS) return "error.noWindowsLeft";
    if (newWindow) {
      team.windows++;
      team.windowUnit = this.units;
    }
    const slot = out.slot;
    out.slot = -1;
    team.field[slot] = null;
    this.enter(team, sub, slot);
    this.ev("sub", team.side, sub, out, "manual", slot);
    if (this.carrier === out) this.carrier = sub;
    this.rosterChanged(team);
    return null;
  }

  private changeTactics(team: Team, patch: Extract<MatchChange, { type: "tactics" }>["tactics"]): string | null {
    const before = team.t.mentality;
    if (patch.formation && !FORMATIONS[patch.formation]) return "error.formation";
    for (const k of ["mentality", "pressing", "tempo", "width", "directness"] as const) {
      const v = patch[k];
      if (v === undefined) continue;
      const lo = k === "mentality" ? -1 : 0;
      if (!Number.isFinite(v) || v < lo || v > 1) return "error.range";
    }
    if (patch.formation && patch.formation !== team.t.formation) this.reassign(team, patch.formation);
    if (patch.mentality !== undefined) {
      team.baseMentality = patch.mentality;
      team.t.mentality = patch.mentality;
    }
    for (const k of ["pressing", "tempo", "width", "directness"] as const) if (patch[k] !== undefined) team.t[k] = patch[k];
    if (patch.setPieces) team.t.setPieces = { ...team.t.setPieces, ...patch.setPieces };
    team.manual = true;
    team.shapeKey = -1;
    this.ev("tactical", team.side, null, null, patch.formation ?? "style");
    this.aiResponse(this.teams[(1 - team.side) as Side], team.t.mentality - before);
    return null;
  }

  /**
   * La IA rival responde a un cambio de mentalidad claro: si el otro se lanza, ella se
   * protege y busca la contra; si el otro se encierra, ella da un paso adelante.
   */
  private aiResponse(ai: Team, delta: number): void {
    if (ai.sheet.human || ai.manual || Math.abs(delta) < 0.3) return;
    const shift = delta > 0 ? -0.15 : 0.2;
    ai.baseMentality = clamp(ai.baseMentality + shift, -1, 1);
    ai.t.mentality = clamp(ai.t.mentality + shift, -1, 1);
    if (delta > 0) ai.t.directness = clamp(ai.t.directness + 0.1, 0, 1);
    ai.shapeKey = -1;
    this.ev("tactical", ai.side, null, null, "response");
  }

  /** Reparte a los jugadores en el campo entre los puestos de un nuevo sistema. */
  private reassign(team: Team, formation: Tactics["formation"]): void {
    const slots = FORMATIONS[formation];
    const field: (Live | null)[] = new Array(slots.length).fill(null);
    field[0] = team.field[0] ?? null;
    const pool = team.field.filter((p, i): p is Live => p !== null && i !== 0);
    const order = slots.map((sl, i) => ({ i, role: sl.role })).slice(1).sort((a, b) => lineOf(a.role) - lineOf(b.role) || a.i - b.i);
    for (const { i, role } of order) {
      let best = -1;
      let bestV = -Infinity;
      for (let k = 0; k < pool.length; k++) {
        const p = pool[k]!;
        const fam = p.sp.position === role ? 1 : lineOf(p.sp.position) === lineOf(role) ? 0.7 : 0.35;
        const v = p.sp.ability - (1 - fam) * 5;
        if (v > bestV) {
          bestV = v;
          best = k;
        }
      }
      if (best < 0) continue;
      const p = pool.splice(best, 1)[0]!;
      p.slot = i;
      p.role = role;
      p.fam = p.sp.position === role ? 1 : lineOf(p.sp.position) === lineOf(role) ? 0.7 : 0.35;
      field[i] = p;
      this.updateMult(p);
    }
    team.slots = slots;
    team.field = field;
    team.t.formation = formation;
    team.shapeKey = -1;
    this.rosterChanged(team);
  }

  private changeInstructions(team: Team, list: { player: string; key: InstructionKey }[]): string | null {
    const ids = new Set(team.all.map((p) => p.sp.id as string));
    if (list.some((i) => !ids.has(i.player) || !INSTRUCTION_KEYS.includes(i.key))) return "error.instruction";
    const [minute] = this.displayMinute();
    for (const p of team.all) {
      const wanted = new Set(list.filter((i) => i.player === p.sp.id).map((i) => i.key));
      const follows: Partial<Record<InstructionKey, boolean>> = {};
      for (const key of INSTRUCTION_KEYS) {
        if (!wanted.has(key)) continue;
        if (p.follows[key] !== undefined) follows[key] = p.follows[key];
        else {
          // Instrucción nueva dada en directo: vuelve a decidir si hace caso.
          const followed = this.rng.float() < p.sp.compliance[key];
          follows[key] = followed;
          this.outcomes.push({ player: p.sp.id, key, followed, minute });
        }
      }
      p.follows = follows;
      p.mods = Sim.modsOf(follows);
    }
    team.t.instructions = list.map((i) => ({ player: i.player as never, key: i.key }));
    team.shapeKey = -1;
    this.ev("tactical", team.side, null, null, "instructions");
    return null;
  }

  private needsExtra(): boolean {
    if (!this.input.decisive) return false;
    const [ah, aa] = this.input.aggregate ?? [0, 0];
    return this.score[0] + ah === this.score[1] + aa;
  }

  private shootout(): void {
    this.ev("shootout", 0);
    const order = (team: Team) =>
      team.field.filter((p): p is Live => p !== null).sort((a, b) => (a.slot === 0 ? 1 : 0) - (b.slot === 0 ? 1 : 0) || b.sp.skills.penalties - a.sp.skills.penalties);
    const takers = [0, 1].map((side) => {
      const team = this.teams[side as Side];
      const first = team.t.setPieces.penaltyTakers.map((id) => this.designated(team, id)).filter((p): p is Live => p !== null);
      return [...first, ...order(team).filter((p) => !first.includes(p))];
    });
    const goals: [number, number] = [0, 0];
    for (let round = 0; round < 30; round++) {
      for (const side of [0, 1] as Side[]) {
        const list = takers[side]!;
        const p = list[round % list.length]!;
        const gk = this.teams[1 - side as Side].field[0];
        const gkQ = gk ? gk.sp.skills.keeping * gk.mult : 3;
        const l = logit(0.76) + 0.1 * (p.sp.skills.penalties * p.mult - 11) - 0.07 * (gkQ - 11) + ((p.sp.pressure - 10) / 10) * 0.25;
        const scored = this.rng.float() < sigmoid(l);
        if (scored) goals[side]++;
        this.ev(scored ? "penaltyScored" : "penaltyMissed", side, p);
        if (round < 5) {
          // Se decide antes de los cinco si uno ya no puede alcanzar al otro.
          const left0 = 4 - round + (side === 0 ? 1 : 0);
          const left1 = 4 - round;
          if (goals[0] + left0 < goals[1] || goals[1] + left1 < goals[0]) {
            this.pens = goals;
            return;
          }
        }
      }
      if (round >= 4 && goals[0] !== goals[1]) {
        this.pens = goals;
        return;
      }
    }
    // Imposible en la práctica; desempate determinista.
    goals[0]++;
    this.pens = goals;
  }

  report(): MatchReport {
    return this.buildReport(this.lineups);
  }

  private buildReport(lineups: [string[], string[]]): MatchReport {
    const players: PlayerLine[] = [];
    let motm: { line: PlayerLine; v: number } | undefined;
    for (const team of this.teams) {
      const diff = this.score[team.side] - this.score[(1 - team.side) as Side];
      const conceded = this.score[(1 - team.side) as Side];
      for (const p of team.all) {
        if (!p.played) continue;
        let rating = RATING_BASE + p.impact + (diff > 0 ? 0.25 : diff < 0 ? -0.2 : 0);
        if (conceded === 0 && p.minutes >= 60 && (p.role === "GK" || DEFENDERS.has(p.role))) rating += 0.4;
        if (p.role === "GK") rating -= 0.1 * conceded;
        rating = Math.round(clamp(rating, 3, 10) * 10) / 10;
        const line: PlayerLine = {
          id: p.sp.id, side: team.side, started: p.started, minutes: Math.max(1, p.minutes), rating,
          goals: p.goals, assists: p.assists, yellow: p.yellow, red: p.red, condition: Math.round(p.cond * 1000) / 1000,
        };
        if (p.injuryDays > 0) line.injuryDays = p.injuryDays;
        players.push(line);
        const v = rating + (p.minutes >= 45 ? 0 : -1);
        if (!motm || v > motm.v) motm = { line, v };
      }
    }
    for (const team of this.teams) team.stats.xg = Math.round(team.stats.xg * 100) / 100;
    const report: MatchReport = {
      seedPath: this.input.seedPath,
      score: [this.score[0], this.score[1]],
      extraTime: this.extraTime,
      events: this.events,
      stats: [this.teams[0].stats, this.teams[1].stats],
      players,
      lineups: lineups as MatchReport["lineups"],
      tactics: [this.teams[0].sheet.tactics, this.teams[1].sheet.tactics],
      instructions: this.outcomes,
    };
    if (this.pens) report.pens = this.pens;
    if (this.applied.length) report.interventions = this.applied.slice();
    if (this.frames) report.frames = this.frames;
    return report;
  }
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** Partido en curso que se puede pausar entre unidades para intervenir. */
export type LiveMatch = Sim;

export function startMatch(input: MatchInput, rng: Rng, opts: SimulateOptions = {}): LiveMatch {
  return new Sim(input, rng, opts.frames ?? false);
}

/**
 * Simula un partido completo a partir de su instantánea de entrada y de las intervenciones
 * del técnico (en orden de `step`). Función pura dado el RNG. Las intervenciones que no se
 * pueden aplicar devuelven su error en `errors` (mismo índice).
 */
export function simulateWithInterventions(
  input: MatchInput, rng: Rng, opts: SimulateOptions, interventions: readonly Intervention[],
): { report: MatchReport; errors: (string | null)[] } {
  const sim = new Sim(input, rng, opts.frames ?? false);
  const errors: (string | null)[] = [];
  for (const iv of interventions) {
    sim.runTo(iv.step);
    errors.push(sim.apply(iv.side, iv.change));
  }
  sim.runToEnd();
  return { report: sim.report(), errors };
}

/** Simula un partido completo a partir de su instantánea de entrada. Función pura dado el RNG. */
export function simulateMatch(input: MatchInput, rng: Rng, opts: SimulateOptions = {}): MatchReport {
  const sim = new Sim(input, rng, opts.frames ?? false);
  sim.runToEnd();
  return sim.report();
}
