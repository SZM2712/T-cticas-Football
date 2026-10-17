// Vistas del vestuario (Fase 4): solo lectura y sin números de rasgos ocultos ni de tensiones
// (regla 6). Lo que la UI muestra son claves cualitativas: "parece molesto", "confía en ti".

import { LADDER } from "../config/social";
import { liveCommitments } from "../social/commitments";
import { dynamicOfKey } from "../social/ego";
import { fitOf } from "../social/fit";
import { squadPlayers } from "../social/graph";
import { managerOf, pairKey, salience, trustOf, valence } from "../social/store";
import { talkChance } from "../social/talk";
import type { Player, SquadStatus, World } from "../types/domain";
import type { ClubId, PlayerId } from "../types/ids";
import type { CommitmentStatus, CommitmentType, HierarchyLevel, InboxItem, MemoryKind, Publicness, TalkTopic } from "../types/social";
import { TALK_TOPICS } from "../types/social";
import { currentAbility } from "../player/ability";
import { displayName } from "./player";

export type MoodKey = "great" | "good" | "ok" | "low" | "awful";
export type TrustKey = "high" | "some" | "doubts" | "none";
export type FitKey = "good" | "ok" | "poor";
/** Escalón de una preocupación: 1 "parece molesto", 2 "quiere hablar", 3 "agente o redes", 4 "queja pública", 5 "pide salir". */
export interface ConcernView {
  dynamic: "salaryEnvy" | "statusGap" | "roosters";
  stage: number;
  other?: { id: PlayerId; name: string };
}

const mood = (x: number): MoodKey => (x > 0.45 ? "great" : x > 0.15 ? "good" : x > -0.15 ? "ok" : x > -0.45 ? "low" : "awful");
const trustKey = (x: number): TrustKey => (x > 0.4 ? "high" : x > 0.05 ? "some" : x > -0.3 ? "doubts" : "none");
const fitKey = (x: number): FitKey => (x > 0.25 ? "good" : x > -0.2 ? "ok" : "poor");

/** Preocupaciones visibles de un jugador (por escalón alcanzado; las de escalón 0 no se ven). */
function concernsOf(world: World, p: Player): ConcernView[] {
  const out: ConcernView[] = [];
  for (const key of Object.keys(p.state.tensions).sort()) {
    const t = p.state.tensions[key]!;
    let stage = 0;
    while (stage < LADDER.length && t >= LADDER[stage]!) stage++;
    if (!stage) continue;
    const c: ConcernView = { dynamic: dynamicOfKey(key), stage };
    if (key.startsWith("roosters:")) {
      const o = world.players[key.slice(9)];
      if (o) c.other = { id: o.id, name: displayName(o) };
    }
    out.push(c);
  }
  return out.sort((a, b) => b.stage - a.stage);
}

export interface DressingPlayerView {
  id: PlayerId;
  name: string;
  position: Player["position"];
  level: HierarchyLevel;
  mood: MoodKey;
  trust: TrustKey;
  fit: FitKey;
  expected: SquadStatus;
  perceived: SquadStatus;
  concerns: ConcernView[];
  captain: boolean;
  transferRequest: boolean;
}

export interface DressingRoomView {
  club: ClubId;
  /** Nombre del mánager humano que lo dirige (null: lo dirige la IA y no hay vestuario simulado). */
  manager: string | null;
  cliques: { label: string; labelParam?: string; members: { id: PlayerId; name: string }[] }[];
  players: DressingPlayerView[];
  roles: { penalties?: string; freeKicks?: string };
  /** Líderes del vestuario, del más influyente al menos. */
  leaders: { id: string; name: string }[];
}

const LEVEL_ORDER: Record<HierarchyLevel, number> = { leader: 0, influential: 1, core: 2, periphery: 3, outcast: 4 };

export function dressingRoomView(world: World, clubId: ClubId): DressingRoomView {
  const dr = world.dressing[clubId];
  const mgr = managerOf(world, clubId);
  const name = (id: string) => displayName(world.players[id]!);
  if (!dr || !mgr) return { club: clubId, manager: null, cliques: [], players: [], roles: {}, leaders: [] };
  const players = squadPlayers(world, clubId).map((p): DressingPlayerView => ({
    id: p.id, name: displayName(p), position: p.position, level: dr.levels[p.id] ?? "periphery",
    mood: mood(p.state.morale), trust: trustKey(trustOf(world, p.id, mgr.id)), fit: fitKey(fitOf(world, p, clubId).total),
    expected: p.state.expectedStatus, perceived: p.state.perceivedStatus, concerns: concernsOf(world, p),
    captain: dr.captain === p.id, transferRequest: p.transferRequest !== undefined,
  }));
  players.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.name.localeCompare(b.name));
  const roles: DressingRoomView["roles"] = {};
  if (dr.roles.penalties) roles.penalties = name(dr.roles.penalties);
  if (dr.roles.freeKicks) roles.freeKicks = name(dr.roles.freeKicks);
  return {
    club: clubId, manager: mgr.name,
    cliques: dr.cliques.map((c) => ({
      label: c.label, ...(c.labelParam ? { labelParam: c.labelParam } : {}),
      members: c.members.filter((id) => world.players[id]).map((id) => ({ id, name: name(id) })),
    })),
    players, roles, leaders: leadersOf(world, clubId),
  };
}

export interface InboxItemView {
  id: string;
  day: number;
  kind: InboxItem["kind"];
  dynamic?: string;
  channel?: InboxItem["channel"];
  player?: { id: string; name: string };
  other?: { id: string; name: string };
  read: boolean;
}

export function inboxView(world: World, clubId: ClubId, limit = 60): InboxItemView[] {
  const ref = (id?: string) => (id && world.players[id] ? { id, name: displayName(world.players[id]!) } : undefined);
  return world.inbox
    .filter((i) => i.clubId === clubId)
    .slice(-limit)
    .reverse()
    .map((i) => {
      const v: InboxItemView = { id: i.id, day: i.day, kind: i.kind, read: i.read };
      if (i.dynamic) v.dynamic = i.dynamic;
      if (i.channel) v.channel = i.channel;
      const p = ref(i.player);
      if (p) v.player = p;
      const o = ref(i.other);
      if (o) v.other = o;
      return v;
    });
}

export interface CommitmentView {
  id: string;
  player: { id: string; name: string };
  type: CommitmentType;
  params: Record<string, string | number>;
  createdDay: number;
  deadline: number;
  /** Progreso de la métrica visible (minutos, papel asignado…), 0..1. */
  progress: number;
  status: CommitmentStatus;
  witnesses: Publicness;
  linkedActions: string[];
}

export function commitmentsView(world: World, clubId: ClubId): CommitmentView[] {
  return Object.keys(world.commitments).sort().reverse().map((id) => world.commitments[id]!)
    .filter((c) => c.clubId === clubId)
    .map((c) => ({
      id: c.id, player: { id: c.madeTo, name: world.players[c.madeTo] ? displayName(world.players[c.madeTo]!) : c.madeTo },
      type: c.type, params: { ...c.params }, createdDay: c.createdDay, deadline: c.deadline, progress: c.progress,
      status: c.status, witnesses: c.witnesses, linkedActions: [...c.linkedActions],
    }));
}

export interface PlayerSocialView {
  /** Hay vestuario simulado (su club lo dirige un humano). */
  managed: boolean;
  level?: HierarchyLevel;
  mood?: MoodKey;
  trust?: TrustKey;
  fit?: { tactical: FitKey; cultural: FitKey; social: FitKey; manager: FitKey; total: FitKey };
  concerns: ConcernView[];
  friends: { id: string; name: string }[];
  rivals: { id: string; name: string }[];
  /** Recuerdos que más pesan hoy (sin números: tipo, día y si es bueno o malo). */
  memories: { kind: MemoryKind; day: number; positive: boolean; about: string[] }[];
  commitments: CommitmentView[];
  /** Temas de conversación y si parece receptivo (sin probabilidad numérica). */
  talk: { available: boolean; topics: { topic: TalkTopic; mood: "receptive" | "unsure" | "closed" }[] };
  /** Gallos con los que podría pactar roles. */
  roosters: { id: string; name: string }[];
  transferRequest: boolean;
}

export function playerSocialView(world: World, playerId: string): PlayerSocialView {
  const p = world.players[playerId];
  const clubId = p?.clubId ?? null;
  const dr = clubId ? world.dressing[clubId] : undefined;
  const mgr = clubId ? managerOf(world, clubId) : undefined;
  const empty: PlayerSocialView = {
    managed: false, concerns: [], friends: [], rivals: [], memories: [], commitments: [], talk: { available: false, topics: [] }, roosters: [], transferRequest: false,
  };
  if (!p || !clubId || !dr || !mgr) return empty;
  const day = world.meta.today;
  const mates = world.clubs[clubId]!.squad.filter((id) => id !== p.id && world.players[id]);
  const scored = mates.map((id) => {
    const rel = world.relationships[pairKey(p.id, id)];
    return { id, v: rel ? (valence(rel, p.id, id) + valence(rel, id, p.id)) / 2 : 0 };
  });
  const byV = [...scored].sort((a, b) => b.v - a.v || (a.id < b.id ? -1 : 1));
  const ref = (id: string) => ({ id, name: displayName(world.players[id]!) });
  const f = fitOf(world, p, clubId);
  const memories = p.memoryIds.map((id) => world.memories[id]!).filter(Boolean)
    .sort((a, b) => salience(b, day) - salience(a, day) || (a.id < b.id ? -1 : 1))
    .slice(0, 6)
    .map((m) => ({
      kind: m.kind, day: m.day, positive: m.valence >= 0,
      about: m.about.map((a) => (a.kind === "player" && world.players[a.id] ? displayName(world.players[a.id]!) : a.kind === "manager" ? (world.managers[a.id]?.name ?? "") : "")).filter(Boolean),
    }));
  const last = dr.talks[p.id];
  const available = last === undefined || day - last >= 7;
  const topics = TALK_TOPICS.map((topic) => {
    const c = talkChance(world, mgr, p, topic);
    return { topic, mood: c >= 0.65 ? ("receptive" as const) : c >= 0.4 ? ("unsure" as const) : ("closed" as const) };
  });
  const roosters = Object.keys(p.state.tensions).filter((k) => k.startsWith("roosters:")).map((k) => k.slice(9)).filter((id) => world.players[id]).map(ref);
  return {
    managed: true, level: dr.levels[p.id] ?? "periphery", mood: mood(p.state.morale), trust: trustKey(trustOf(world, p.id, mgr.id)),
    fit: { tactical: fitKey(f.tactical), cultural: fitKey(f.cultural), social: fitKey(f.social), manager: fitKey(f.manager), total: fitKey(f.total) },
    concerns: concernsOf(world, p),
    friends: byV.filter((x) => x.v > 0.25).slice(0, 3).map((x) => ref(x.id)),
    rivals: byV.filter((x) => x.v < -0.05).reverse().slice(0, 3).map((x) => ref(x.id)),
    memories,
    commitments: commitmentsView(world, clubId).filter((c) => c.player.id === p.id && liveCommitments(world, p.id).some((l) => l.id === c.id)),
    talk: { available, topics },
    roosters,
    transferRequest: p.transferRequest !== undefined,
  };
}

export interface ManagerView {
  id: string;
  name: string;
  club: ClubId | null;
  clubName: string | null;
}

export function managersView(world: World): ManagerView[] {
  return Object.keys(world.managers).sort().map((id) => {
    const m = world.managers[id]!;
    return { id: m.id, name: m.name, club: m.clubId, clubName: m.clubId ? (world.clubs[m.clubId]?.name ?? null) : null };
  });
}

export const GOSSIP_KINDS = [
  "grumbling", "socialDig", "publicComplaint", "rivalry", "row", "mentorClash", "nightLife", "skipsDiet",
  "brokenPromise", "ignoredOrders", "retirementRumour", "prodigy", "agingToll", "breakthrough", "newCaptain",
] as const;
export type GossipKind = (typeof GOSSIP_KINDS)[number];

export interface GossipView {
  day: number;
  kind: GossipKind;
  player: { id: string; name: string };
  other?: { id: string; name: string };
  /** Clave de la dinámica de ego (para "grumbling" y "publicComplaint"). */
  about?: string;
}

/**
 * Lo que se comenta en el vestuario: los sucesos recientes de los jugadores del club contados
 * como rumores (sin números). Sale del registro de eventos del mundo.
 */
export function gossipView(world: World, clubId: ClubId, limit = 25): GossipView[] {
  const squad = new Set(world.clubs[clubId]?.squad ?? []);
  const ref = (id: unknown) => {
    const p = typeof id === "string" ? world.players[id] : undefined;
    return p ? { id: p.id as string, name: displayName(p) } : undefined;
  };
  const out: GossipView[] = [];
  for (let i = world.events.length - 1; i >= 0 && out.length < limit; i--) {
    const e = world.events[i]!;
    const pid = (e.data.player ?? e.data.manager) as string | undefined;
    if (!pid || !squad.has(pid as PlayerId)) continue;
    const player = ref(pid);
    if (!player) continue;
    const g = (kind: GossipKind, extra: Partial<GossipView> = {}) => out.push({ day: e.day, kind, player, ...extra });
    switch (e.type) {
      case "player.egoStep": {
        const step = Number(e.data.step);
        const about = String(e.data.dynamic);
        const other = ref(e.data.other);
        if (about === "roosters" && other) {
          // Un pique es de los dos: se cuenta una vez por pareja y día.
          const kind: GossipKind | null = step >= 4 ? "row" : step >= 2 ? "rivalry" : null;
          const dup = out.some((x) => x.day === e.day && x.kind === kind && x.player.id === other.id && x.other?.id === player.id);
          if (kind && !dup) g(kind, { other });
        } else if (step >= 4) g("publicComplaint", { about });
        else if (e.data.channel === "social") g("socialDig", { about });
        else if (step >= 2) g("grumbling", { about });
        break;
      }
      case "player.mentorClash": {
        const other = ref(e.data.mentor);
        if (other) g("mentorClash", { other });
        break;
      }
      case "player.planIgnored": {
        const parts = (e.data.parts as string[] | undefined) ?? [];
        if (parts.includes("sleep")) g("nightLife");
        else if (parts.includes("diet")) g("skipsDiet");
        break;
      }
      case "manager.promiseBroken": g("brokenPromise"); break;
      case "player.ignoredInstruction": g("ignoredOrders"); break;
      case "player.consideringRetirement": g("retirementRumour"); break;
      case "player.prodigy": g("prodigy"); break;
      case "player.agingToll": g("agingToll"); break;
      case "player.breakthrough": g("breakthrough"); break;
      case "manager.captain": g("newCaptain"); break;
    }
  }
  return out;
}

/** Líderes del vestuario (para la cabecera de la pestaña). */
export function leadersOf(world: World, clubId: ClubId): { id: string; name: string }[] {
  const dr = world.dressing[clubId];
  if (!dr) return [];
  return Object.keys(dr.levels).sort().filter((id) => dr.levels[id] === "leader" && world.players[id])
    .sort((a, b) => (dr.influence[b] ?? 0) - (dr.influence[a] ?? 0) || (a < b ? -1 : 1))
    .map((id) => ({ id, name: displayName(world.players[id]!) }));
}

export interface ClubOptionView {
  id: ClubId;
  name: string;
  city: string;
  /** Reputación en estrellas (0,5–5). */
  stars: number;
  /** Nivel medio del once (visible), 1 decimal. */
  level: number;
  stadium: string;
  capacity: number;
  transferBudget: number;
  /** Mánager humano que ya lo dirige (null si está libre). */
  takenBy: string | null;
}

/** Clubes de una liga para elegir club al empezar (del más prestigioso al menos). */
export function clubOptionsView(world: World, leagueId: string): ClubOptionView[] {
  const league = world.leagues[leagueId];
  if (!league) return [];
  return league.clubs.map((id) => world.clubs[id]!).filter(Boolean).map((c) => {
    const best = c.squad.map((pid) => world.players[pid]).filter((p): p is Player => !!p && !p.retired)
      .map((p) => currentAbility(p)).sort((a, b) => b - a).slice(0, 11);
    return {
      id: c.id, name: c.name, city: c.city, stars: Math.max(0.5, Math.round(c.reputation * 10) / 2),
      level: best.length ? Math.round((best.reduce((a, b) => a + b, 0) / best.length) * 10) / 10 : 0,
      stadium: c.stadium.name, capacity: c.stadium.capacity, transferBudget: c.finances.transferBudget,
      takenBy: managerOf(world, c.id)?.name ?? null,
    };
  }).sort((a, b) => b.stars - a.stars || b.level - a.level || a.name.localeCompare(b.name));
}
