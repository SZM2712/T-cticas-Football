// Vestuario (Fase 4, DISEÑO §3 y §5): mánagers humanos, relaciones, memoria episódica,
// promesas (`Commitment`), buzón y estado del vestuario de cada club dirigido por un humano.
// Datos planos y serializables; las relaciones van por ID.

import type { ClubId, GameDay, PlayerId, Signed, Unit } from "./ids";

/** Mánager humano: "mg_01". Hay uno por humano en la partida (2–10 en multijugador). */
export type ManagerId = string & { readonly __manager?: never };

export interface Manager {
  id: ManagerId;
  name: string;
  /** Cargo (Fase 11: director deportivo y presidente). */
  role: "coach";
  clubId: ClubId | null;
  /** Reputación profesional 0..1: pesa en la autoridad ante el vestuario. */
  reputation: Unit;
  sinceDay: GameDay;
}

export type ActorRef =
  | { kind: "player"; id: PlayerId }
  | { kind: "manager"; id: ManagerId }
  | { kind: "club"; id: ClubId };

export const MEMORY_KINDS = [
  "privatePraise", "publicPraise", "privateCriticism", "publicCriticism",
  "benched", "subbedOff", "statusSnub",
  "promiseMade", "promiseKept", "promiseBroken", "witnessedBrokenPromise", "promiseRenegotiated",
  "salaryInsult", "renewed", "captaincyGiven", "captaincyRemoved", "roleGiven", "roleTaken",
  "goodTalk", "badTalk", "dressingRoomRow", "sharedGoal",
] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export type Publicness = "private" | "squad" | "public";

/** Recuerdo de un jugador. Su peso decae: salience(t) = intensity · 0,5^((t − day)/halfLifeDays). */
export interface Memory {
  id: string;
  owner: PlayerId;
  about: ActorRef[];
  kind: MemoryKind;
  day: GameDay;
  /** Positiva o negativa para el dueño (−1..1). */
  valence: Signed;
  intensity: Unit;
  publicness: Publicness;
  /** Calculada al crearla con los rasgos del dueño: el ego alto recuerda las humillaciones años. */
  halfLifeDays: number;
  /** Trazabilidad: evento o comando que la originó. */
  source: string;
}

/**
 * Arista entre dos jugadores (clave "idA|idB" con idA < idB). La afinidad y la rivalidad son
 * simétricas; el respeto y la envidia, dirigidas (ab = de A hacia B).
 */
export interface Relationship {
  affinity: Signed;
  /** Afinidad de partida (idioma, nacionalidad, edad): hacia ella decae la relación. */
  baseline: Signed;
  rivalry: Unit;
  respectAB: Unit;
  respectBA: Unit;
  envyAB: Unit;
  envyBA: Unit;
  sinceDay: GameDay;
}

/** Confianza de un jugador en un mánager (¿cumple su palabra?), −1..1. Clave "playerId|managerId". */
export interface ManagerTrust {
  trust: Signed;
  sinceDay: GameDay;
}

export const COMMITMENT_TYPES = ["playingTime", "role", "captaincy", "newContract", "mentor"] as const;
export type CommitmentType = (typeof COMMITMENT_TYPES)[number];

/** Papeles simbólicos que pueden pactarse o disputarse. */
export const SYMBOLIC_ROLES = ["penalties", "freeKicks", "captain"] as const;
export type SymbolicRole = (typeof SYMBOLIC_ROLES)[number];

export type CommitmentStatus = "active" | "atRisk" | "kept" | "broken" | "renegotiated" | "void";

/** Promesa rastreable del mánager (`Promise` está reservado en JS). */
export interface Commitment {
  id: string;
  madeBy: ManagerId;
  clubId: ClubId;
  madeTo: PlayerId;
  /** Quién se entera si se rompe. */
  witnesses: Publicness;
  origin: { kind: "conversation" | "press" | "contract"; refId: string };
  type: CommitmentType;
  /** playingTime: minStartsPct; role: role; newContract: minWage; mentor: menteeId. */
  params: Record<string, string | number>;
  createdDay: GameDay;
  deadline: GameDay;
  /** 0..1, recalculado cada semana (consulta pura sobre el mundo). */
  progress: Unit;
  status: CommitmentStatus;
  /** Acciones que la cumplen, para enlazarlas en la UI ("setCaptain:pl_1", "renew:pl_1"). */
  linkedActions: string[];
}

/** Nivel en la jerarquía del vestuario. */
export const HIERARCHY_LEVELS = ["leader", "influential", "core", "periphery", "outcast"] as const;
export type HierarchyLevel = (typeof HIERARCHY_LEVELS)[number];

export interface Clique {
  members: PlayerId[];
  /** Clave del rasgo que comparten: "language", "nation", "veterans", "youngsters", "homegrown", "mixed". */
  label: string;
  /** Parámetro del nombre (código de idioma o de nación). */
  labelParam?: string;
}

/** Estado del vestuario de un club dirigido por un humano (LOD completo). */
export interface DressingRoom {
  cliques: Clique[];
  levels: Record<string, HierarchyLevel>;
  /** Influencia real 0..1 (rasgo, respeto de los compañeros, antigüedad, estatus, reputación). */
  influence: Record<string, number>;
  captain?: PlayerId;
  /** Lanzadores pactados (también fijan el plan táctico). */
  roles: Partial<Record<Exclude<SymbolicRole, "captain">, PlayerId>>;
  /** Último escalón alcanzado por dinámica: "playerId:dinámica" → 0..5. */
  steps: Record<string, number>;
  /** Día de la última conversación con cada jugador (una por semana). */
  talks: Record<string, GameDay>;
  /**
   * Participación en los últimos partidos oficiales (1 titular, 0,5 suplente que juega, 0 sin
   * jugar), del más antiguo al más reciente. Alimenta el estatus percibido.
   */
  recent: Record<string, number[]>;
  lastWeekly: GameDay;
}

export const INBOX_KINDS = [
  "egoSignal", "egoAsksTalk", "egoAgent", "egoPublic", "egoTransfer",
  "commitmentAtRisk", "commitmentKept", "commitmentBroken", "dressingRoomRow", "cliqueChanged",
] as const;
export type InboxKind = (typeof INBOX_KINDS)[number];

export interface InboxItem {
  id: string;
  day: GameDay;
  clubId: ClubId;
  kind: InboxKind;
  /** Dinámica de ego que lo originó ("salaryEnvy", "statusGap", "roosters"). */
  dynamic?: string;
  player?: PlayerId;
  other?: PlayerId;
  commitment?: string;
  /** Por dónde llegó: en privado, a través de su camarilla, de su agente, en redes o en público. */
  channel?: "private" | "clique" | "agent" | "social" | "public";
  read: boolean;
}

/** Temas de conversación con un jugador (comando `talk`). */
export const TALK_TOPICS = [
  "praise", "criticize", "rolePlans", "promisePlayingTime", "promiseRole", "promiseContract", "agreeRoles",
] as const;
export type TalkTopic = (typeof TALK_TOPICS)[number];
