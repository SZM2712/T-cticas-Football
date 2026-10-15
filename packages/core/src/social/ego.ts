// Motor genérico de dinámicas de ego (DISEÑO §5.3) y las tres primeras dinámicas (§5.4):
// celos salariales, estatus prometido frente a real y dos gallos en el mismo corral.
// Cada dinámica detecta disparadores (puro), acumula tensión diaria según los rasgos y, al
// cruzar los escalones de la escalera común, el jugador actúa por el canal que eligen sus rasgos.

import {
  ENVY_LEADER_MULT, ENVY_MAX_GAP, HABITUATION, ENVY_MIN_EGO, ENVY_MIN_PARTICIPATION, ENVY_RATE, ENVY_WAGE_RATIO, LADDER, LADDER_RESET, PUBLIC_COMPLAINT_MORALE,
  ROOSTER_MIN_EGO, ROOSTER_RATE, STATUS_PROMISE_MULT, STATUS_RATE, TENSION_DECAY,
} from "../config/social";
import type { Player, World } from "../types/domain";
import type { ClubId, GameDay, PlayerId } from "../types/ids";
import type { DressingRoom, InboxItem, InboxKind, ManagerId } from "../types/social";
import { clamp, round } from "../util/math";
import { liveCommitments } from "./commitments";
import { participation, performance, squadPlayers, statusRank } from "./graph";
import { addTrust, managerOf, managerRef, notify, pairKey, playerRef, remember } from "./store";

/** Contexto de un club para un día: cálculos que comparten las dinámicas. */
export interface EgoContext {
  world: World;
  clubId: ClubId;
  dr: DressingRoom;
  day: GameDay;
  squad: Player[];
  perf: Map<string, number>;
  part: Map<string, number>;
}

/** Disparador: quién está afectado, contra quién y con qué fuerza. */
export interface Trigger {
  actor: PlayerId;
  other?: PlayerId;
  /** Clave del acumulador en `state.tensions` ("salaryEnvy", "roosters:pl_…"). */
  key: string;
  /** Fuerza del disparador (la dinámica la usa al acumular). */
  strength: number;
}

export interface EgoDynamic {
  id: "salaryEnvy" | "statusGap" | "roosters";
  detect(ctx: EgoContext): Trigger[];
  /** Δ de tensión diaria para este disparador (por rasgos y contexto). */
  accumulate(t: Trigger, actor: Player, ctx: EgoContext): number;
}

const LINE_ATTACK: Record<string, string> = { AM: "am", LW: "w", RW: "w", ST: "st" };

// ── 1) Celos salariales ─────────────────────────────────────────────────────

const salaryEnvy: EgoDynamic = {
  id: "salaryEnvy",
  detect(ctx) {
    const out: Trigger[] = [];
    for (const i of ctx.squad) {
      if (i.psych.ego <= ENVY_MIN_EGO || !i.contract || ctx.part.get(i.id)! < ENVY_MIN_PARTICIPATION) continue;
      let best: { j: Player; ratio: number } | undefined;
      for (const j of ctx.squad) {
        if (j.id === i.id || !j.contract) continue;
        const ratio = j.contract.wage / i.contract.wage;
        if (ratio < ENVY_WAGE_RATIO) continue;
        // Rinde como él o mejor, o juega tanto como él o más (§5.4.1). Solo cuenta quien juega
        // con regularidad: si no, cualquier suplente envidiaría al titular mejor pagado.
        const better = ctx.perf.get(i.id)! >= ctx.perf.get(j.id)! || ctx.part.get(i.id)! >= ctx.part.get(j.id)!;
        if (better && (!best || ratio > best.ratio)) best = { j, ratio };
      }
      if (best) out.push({ actor: i.id, other: best.j.id, key: "salaryEnvy", strength: 1 + Math.min(ENVY_MAX_GAP, best.ratio - 1) });
    }
    return out;
  },
  accumulate(t, p, ctx) {
    const ps = p.psych;
    const leader = ctx.dr.levels[p.id] === "leader" ? ENVY_LEADER_MULT : 1;
    // Calibrado con los escenarios: la lealtad amortigua más (1 − 0,8·lealtad) y la necesidad de
    // reconocimiento pesa algo menos (0,7 + 0,6·rec) que en el borrador (0,5 + rec).
    return ENVY_RATE * ps.ego * (t.strength - 1) * (0.7 + 0.6 * ps.recognitionNeed) * (1 - 0.8 * ps.loyalty) * leader;
  },
};

// ── 2) Estatus prometido frente a real ──────────────────────────────────────

const statusGap: EgoDynamic = {
  id: "statusGap",
  detect(ctx) {
    const out: Trigger[] = [];
    for (const p of ctx.squad) {
      const gap = statusRank(p.state.expectedStatus) - statusRank(p.state.perceivedStatus);
      if (gap > 0 && !p.injury) out.push({ actor: p.id, key: "statusGap", strength: gap });
    }
    return out;
  },
  accumulate(t, p, ctx) {
    const ps = p.psych;
    const atRisk = liveCommitments(ctx.world, p.id, "playingTime").some((c) => c.status === "atRisk");
    return STATUS_RATE * (t.strength / 2) * (0.4 + ps.ego) * (0.6 + 0.8 * ps.insecurity) * (atRisk ? STATUS_PROMISE_MULT : 1);
  },
};

// ── 3) Dos gallos en el mismo corral ────────────────────────────────────────

/** Solapamiento de rol simbólico entre dos jugadores (0..1). */
export function symbolicOverlap(ctx: EgoContext, a: Player, b: Player): number {
  let o = 0;
  // Mismo puesto ofensivo exacto (dos nueves, dos mediapuntas…) y los dos juegan.
  if (LINE_ATTACK[a.position] && a.position === b.position && ctx.part.get(a.id)! >= 0.3 && ctx.part.get(b.id)! >= 0.3) o += 0.5;
  const pens = ctx.dr.roles.penalties;
  if ((pens === a.id && b.technical.penalties >= 13) || (pens === b.id && a.technical.penalties >= 13)) o += 0.3;
  const fks = ctx.dr.roles.freeKicks;
  if ((fks === a.id && b.technical.freeKicks >= 13) || (fks === b.id && a.technical.freeKicks >= 13)) o += 0.2;
  const cap = ctx.dr.captain;
  if ((cap === a.id && ctx.dr.levels[b.id] === "leader") || (cap === b.id && ctx.dr.levels[a.id] === "leader")) o += 0.3;
  // Roles pactados (una promesa de papel a cada uno, viva o cumplida) separan a los gallos.
  const agreed = hasRolePact(ctx.world, a.id) && hasRolePact(ctx.world, b.id);
  return Math.min(1, o) * (agreed ? 0.3 : 1);
}

/** ¿Tiene un papel pactado con el mánager (promesa de rol o capitanía no rota)? */
function hasRolePact(world: World, player: string): boolean {
  for (const id of Object.keys(world.commitments)) {
    const c = world.commitments[id]!;
    if (c.madeTo === player && (c.type === "role" || c.type === "captaincy") && (c.status === "active" || c.status === "atRisk" || c.status === "kept")) return true;
  }
  return false;
}

const roosters: EgoDynamic = {
  id: "roosters",
  detect(ctx) {
    const out: Trigger[] = [];
    const egos = ctx.squad.filter((p) => p.psych.ego > ROOSTER_MIN_EGO);
    for (let i = 0; i < egos.length; i++) {
      for (let j = i + 1; j < egos.length; j++) {
        const a = egos[i]!;
        const b = egos[j]!;
        const overlap = symbolicOverlap(ctx, a, b);
        if (overlap <= 0) continue;
        // La tensión es del par: la llevan los dos con la misma clave cruzada.
        out.push({ actor: a.id, other: b.id, key: `roosters:${b.id}`, strength: overlap });
        out.push({ actor: b.id, other: a.id, key: `roosters:${a.id}`, strength: overlap });
      }
    }
    return out;
  },
  accumulate(t, p, ctx) {
    const other = ctx.world.players[t.other!]!;
    const rel = ctx.world.relationships[pairKey(p.id, other.id)];
    const affinity = rel?.affinity ?? 0;
    return ROOSTER_RATE * p.psych.ego * other.psych.ego * t.strength * (1 - affinity);
  },
};

export const EGO_DYNAMICS: readonly EgoDynamic[] = [salaryEnvy, statusGap, roosters];

export const dynamicOfKey = (key: string): EgoDynamic["id"] => (key.startsWith("roosters:") ? "roosters" : (key as EgoDynamic["id"]));

// ── Escalera común (§5.3) ───────────────────────────────────────────────────

const STEP_KIND: Record<number, InboxKind> = { 1: "egoSignal", 2: "egoAsksTalk", 3: "egoAgent", 4: "egoPublic", 5: "egoTransfer" };

function channelFor(p: Player, step: number): InboxItem["channel"] {
  const ps = p.psych;
  if (step === 2) return ps.sociability > 0.6 && ps.ego < 0.75 ? "clique" : "private";
  if (step === 3) return ps.offPitchLife > 0.6 ? "social" : "agent";
  if (step >= 4) return "public";
  return "private";
}

/** El jugador da un paso más en la escalera: aviso en el buzón, recuerdos y consecuencias. */
function fireStep(ctx: EgoContext, p: Player, key: string, other: PlayerId | undefined, step: number, mgr: ManagerId | undefined): void {
  const { world, day, clubId, dr } = ctx;
  const dyn = dynamicOfKey(key);
  const channel = channelFor(p, step);
  const extra: Parameters<typeof notify>[4] = { dynamic: dyn, player: p.id };
  if (other) extra.other = other;
  if (channel) extra.channel = channel;
  notify(world, day, clubId, STEP_KIND[step]!, extra);
  world.events.push({ day, type: "player.egoStep", data: { player: p.id, dynamic: dyn, step, channel: channel ?? "private", ...(other ? { other } : {}) } });
  if (step < 2) return;
  const about = other ? [playerRef(other)] : mgr ? [managerRef(mgr)] : [];
  const kind = dyn === "salaryEnvy" ? "salaryInsult" : dyn === "statusGap" ? "statusSnub" : "dressingRoomRow";
  remember(world, day, {
    owner: p.id, about, kind, valence: -0.3 - 0.1 * step, intensity: 0.2 + 0.12 * step,
    publicness: step >= 4 ? "public" : step === 3 || channel === "clique" ? "squad" : "private", source: `ego:${key}:${step}`,
  });
  if (channel === "clique") {
    // Lo comenta con los suyos: su camarilla se contagia un poco del enfado.
    const clique = dr.cliques.find((c) => c.members.includes(p.id));
    for (const id of clique?.members ?? []) {
      if (id === p.id) continue;
      const q = world.players[id]!;
      q.state.morale = round(clamp(q.state.morale - 0.04, -1, 1), 3);
    }
  }
  if (step >= 3 && mgr) addTrust(world, p.id, mgr, -0.03 * step, day);
  if (step === 4) {
    p.state.morale = round(clamp(p.state.morale + PUBLIC_COMPLAINT_MORALE, -1, 1), 3);
    if (dyn === "roosters" && other) {
      // Estalla: discusión visible y el vestuario toma partido según sus afinidades.
      const rel = world.relationships[pairKey(p.id, other)];
      if (rel) rel.affinity = round(clamp(rel.affinity - 0.3, -1, 1), 4);
      notify(world, day, clubId, "dressingRoomRow", { player: p.id, other });
      for (const q of ctx.squad) {
        if (q.id === p.id || q.id === other) continue;
        const ra = world.relationships[pairKey(q.id, p.id)]?.affinity ?? 0;
        const rb = world.relationships[pairKey(q.id, other)]?.affinity ?? 0;
        const loser = ra >= rb ? other : p.id;
        const r = world.relationships[pairKey(q.id, loser)];
        if (r && Math.abs(ra - rb) > 0.05) r.affinity = round(clamp(r.affinity - 0.08, -1, 1), 4);
      }
    }
  }
  if (step === 5) p.transferRequest = day;
}

/** Tick diario de las dinámicas de ego de un club dirigido por un humano. */
export function dailyEgo(world: World, clubId: ClubId, day: GameDay): void {
  const dr = world.dressing[clubId];
  if (!dr) return;
  const squad = squadPlayers(world, clubId);
  const ctx: EgoContext = {
    world, clubId, dr, day, squad,
    perf: new Map(squad.map((p) => [p.id, performance(world, p, clubId)])),
    part: new Map(squad.map((p) => [p.id, participation(dr, p)])),
  };
  const mgr = managerOf(world, clubId)?.id;
  const active = new Map<string, Trigger>();
  for (const dyn of EGO_DYNAMICS) {
    for (const t of dyn.detect(ctx)) {
      const p = world.players[t.actor]!;
      const delta = dyn.accumulate(t, p, ctx);
      const prev = p.state.tensions[t.key] ?? 0;
      p.state.tensions[t.key] = round(clamp(prev + delta - HABITUATION[dyn.id] * prev, 0, 1), 4);
      active.set(`${t.actor}:${t.key}`, t);
    }
  }
  for (const p of squad) {
    for (const key of Object.keys(p.state.tensions).sort()) {
      const id = `${p.id}:${key}`;
      const t = active.get(id);
      if (!t) p.state.tensions[key] = round(Math.max(0, p.state.tensions[key]! - TENSION_DECAY), 4);
      const tension = p.state.tensions[key]!;
      let step = dr.steps[id] ?? 0;
      // Histéresis: si la tensión baja claramente, se puede volver a subir el mismo escalón.
      while (step > 0 && tension < LADDER[step - 1]! - LADDER_RESET) step--;
      while (step < LADDER.length && tension >= LADDER[step]!) {
        step++;
        const other = t?.other ?? (key.startsWith("roosters:") ? (key.slice(9) as PlayerId) : undefined);
        fireStep(ctx, p, key, other, step, mgr);
      }
      if (step > 0) dr.steps[id] = step;
      else delete dr.steps[id];
      if (tension === 0 && !t) delete p.state.tensions[key];
    }
  }
}

/** Baja la tensión de un jugador (resolución: conversación, renovación, roles pactados). */
export function relieve(p: Player, key: string, amount: number): void {
  const t = p.state.tensions[key];
  if (t === undefined) return;
  p.state.tensions[key] = round(Math.max(0, t - amount), 4);
}
