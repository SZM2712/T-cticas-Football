// Tipos del dominio (§3 de DISEÑO.md). Datos planos y serializables: nada de clases
// ni referencias de objeto; las relaciones van por ID.

import type { Climate, ConfederationId } from "@tf/data";
import type { GoalkeepingAttr, MentalAttr, PhysicalAttr, Position, TechnicalAttr } from "../config/attributes";
import type { PsychTrait } from "../config/psych";
import type { DevFactor, DevelopmentPlan, PlanAdherence, RetirementIntent, ScoutBelief } from "./development";
import type { Commitment, DressingRoom, InboxItem, Manager, ManagerTrust, Memory, Relationship } from "./social";
import type { Intervention, TacticsPlan } from "./tactics";
import type {
  Attr, ClubId, CompetitionId, GameDay, LeagueId, MatchId, NationalTeamId, NationId, PlayerId, Signed, StaffId,
  TeamId, Unit,
} from "./ids";

// ── Jugador ─────────────────────────────────────────────────────────────────

export type PsychProfile = Record<PsychTrait, Unit>;

export interface HiddenAttributes {
  consistency: Attr;
  bigMatches: Attr;
  injuryProneness: Attr;
  versatility: Attr;
  sportsmanship: Attr;
  adaptability: Attr;
  pressure: Attr;
  professionalism: Attr;
  ambition: Attr;
  loyalty: Attr;
  /** Alto = templado; bajo = volátil. */
  temperament: Attr;
  controversy: Attr;
}

export type SquadStatus = "keyPlayer" | "firstTeam" | "rotation" | "backup" | "prospect";

export interface EmotionalState {
  morale: Signed;
  confidence: { attack: Signed; defence: Signed; passing: Signed; general: Signed };
  happiness: Signed;
  mentalFatigue: Unit;
  /** percibido − merecido (negativo = se siente agraviado). */
  statusGap: Signed;
  perceivedStatus: SquadStatus;
  expectedStatus: SquadStatus;
  /** Acumuladores de tensión por dinámica de ego (Fase 4). */
  tensions: Record<string, Unit>;
  lastUpdated: GameDay;
}

export type MaturationProfile = "early" | "standard" | "late";

export interface DevelopmentState {
  /** Niño prodigio (wonderkid): nació con techo de estrella; el cupo de élite no lo recorta. OCULTO. */
  prodigy?: boolean;
  /** Techo latente real L(t) en escala CA. OCULTO (§4). */
  latentCeiling: number;
  /** Volatilidad del proceso del techo; decrece con la edad. */
  volatility: number;
  maturation: MaturationProfile;
  /** Años de desplazamiento de la curva de crecimiento (−2..+3). */
  maturationShift: number;
  physicalPeakAge: number;
  // El "shape" (talento natural por atributo) no se guarda: se deriva del stream
  // RNG `shape/<playerId>` cuando se necesita (ver gen/attributes.ts).
  /** Factores dominantes del último periodo, para el informe "¿por qué?" (Fase 3). */
  recentFactors: DevFactor[];
  /** CA de los últimos 24 meses (×10, entero) y al cierre de cada temporada (×10). */
  caMonthly: number[];
  caYearly: number[];
  /** Minutos jugados en el mes en curso y media reciente con decaimiento. */
  monthMinutes: number;
  recentMinutes: number;
  /** Efectos vigentes del plan individual sobre la recuperación (×) y el riesgo de lesión (puntos de propensión). */
  recoveryMult: number;
  injuryRiskDelta: number;
  /** Lo que hizo con el plan el último mes. */
  adherence?: PlanAdherence;
  /** Último día en que una lesión larga dejó secuelas (para no aplicarlas dos veces). */
  lastShockDay?: GameDay;
  /** Lesiones graves sufridas (pesan en la tentación de retirarse). */
  seriousInjuries?: number;
}

export interface Appearance {
  skinTone: 1 | 2 | 3 | 4 | 5 | 6;
  hairColor: "black" | "darkBrown" | "brown" | "blond" | "red" | "grey";
  hairStyle: "shaved" | "buzz" | "short" | "curlyShort" | "medium" | "long" | "afro" | "braids" | "bald" | "manBun";
  facialHair: "none" | "stubble" | "moustache" | "goatee" | "fullBeard";
  eyeColor: "brown" | "darkBrown" | "hazel" | "green" | "blue" | "grey";
  faceShape: "oval" | "round" | "square" | "long" | "heart";
  build: "slim" | "lean" | "athletic" | "stocky";
}

export interface Contract {
  clubId: ClubId;
  /** Salario semanal en euros. */
  wage: number;
  expires: GameDay;
  signed: GameDay;
  squadStatus: SquadStatus;
}

export interface Injury {
  kind: string;
  since: GameDay;
  until: GameDay;
}

/** Partidos de sanción pendientes en una competición. */
export interface Suspension {
  competitionId: CompetitionId;
  matches: number;
}

/** Línea de la trayectoria: una temporada en un equipo (club o selección). */
export interface CareerLine {
  season: number;
  team: TeamId;
  apps: number;
  goals: number;
  assists: number;
}

export interface Player {
  id: PlayerId;
  firstName: string;
  lastName: string;
  knownAs?: string;
  birthDay: GameDay;
  nationality: NationId;
  secondNationality?: NationId;
  /** Selección por la que juega o jugará (se fija al debutar). */
  internationalNation: NationId;
  languages: { lang: string; fluency: Unit }[];
  culture: string;
  appearance: Appearance;
  foot: { left: Attr; right: Attr };
  heightCm: number;
  weightKg: number;
  position: Position;
  positions: Partial<Record<Position, Unit>>;
  technical: Record<TechnicalAttr, Attr>;
  mental: Record<MentalAttr, Attr>;
  physical: Record<PhysicalAttr, Attr>;
  goalkeeping: Record<GoalkeepingAttr, Attr>;
  hidden: HiddenAttributes;
  psych: PsychProfile;
  /** Arquetipo sembrado en la generación (solo para pruebas de distribución; nunca lo lee la simulación). */
  seededArchetype?: string;
  state: EmotionalState;
  development: DevelopmentState;
  clubId: ClubId | null;
  contract: Contract | null;
  /** Canterano del club actual. */
  homegrown: boolean;
  /** Forma física al terminar su último partido; se recupera con los días (ver match/lineup.ts). */
  fitness: Unit;
  /** Día en que se fijó `fitness`. */
  fitnessDay: GameDay;
  injury: Injury | null;
  suspensions: Suspension[];
  career: CareerLine[];
  reputation: Unit;
  caps: number;
  internationalGoals: number;
  memoryIds: string[];
  retired: boolean;
  /** Pidió salir del club (escalón final de una dinámica de ego). Lo usa el mercado (Fase 6). */
  transferRequest?: GameDay;
  /** Se está planteando retirarse (lesión, motivos personales, edad). */
  retirementIntent?: RetirementIntent;
  /** Anunció su retirada: se retira al terminar la temporada. */
  retiring?: boolean;
}

// ── Staff ───────────────────────────────────────────────────────────────────

export type StaffRole =
  | "headCoach" | "assistant" | "coach" | "scout" | "physio" | "nutritionist" | "fitnessCoach" | "referee" | "nationalCoach";

export interface Staff {
  id: StaffId;
  firstName: string;
  lastName: string;
  birthDay: GameDay;
  nationality: NationId;
  languages: { lang: string; fluency: Unit }[];
  role: StaffRole;
  clubId: ClubId | null;
  nationalTeamId?: NationalTeamId;
  /** Atributos 1–20 según el rol. */
  attributes: {
    coaching: Attr;
    tactics: Attr;
    manManagement: Attr;
    judgingAbility: Attr;
    judgingPotential: Attr;
    physiotherapy: Attr;
    /** Nutricionista: calidad de las pautas de dieta. */
    nutrition: Attr;
    /** Preparador físico: calidad de las rutinas de ejercicio. */
    conditioning: Attr;
    discipline: Attr;
    motivation: Attr;
    youth: Attr;
    /** Solo árbitros: rigor con tarjetas y coherencia. */
    refStrictness?: Attr;
    refConsistency?: Attr;
  };
  psych: PsychProfile;
  /** Sesgo del ojeador: cuánto sobrevalora físicos (+) o técnica (−), en puntos. */
  scoutBias?: number;
  reputation: Unit;
}

// ── Clubes, naciones, ligas ─────────────────────────────────────────────────

export type FanSegment = "ultras" | "members" | "casual" | "international";

export interface Club {
  id: ClubId;
  name: string;
  shortName: string;
  founded: number;
  city: string;
  nation: NationId;
  /** Liga jugable actual, o null si es un club en sombra (LOD ligero). */
  leagueId: LeagueId | null;
  /** Nivel del club en sombra (3 = tercer nivel de una nación jugable; 1 = primera de una nación no jugable). */
  shadowTier?: number;
  colors: { primary: string; secondary: string };
  reputation: Unit;
  /** Calidad media objetivo del once (CA), usada al generar y para regenerar plantillas. */
  quality: number;
  stadium: { name: string; capacity: number };
  facilities: { training: Unit; youth: Unit; medical: Unit };
  finances: { balance: number; transferBudget: number; wageBudget: number; revenue: number };
  fanBase: Record<FanSegment, { size: number; mood: Signed }>;
  squad: PlayerId[];
  staff: StaffId[];
  lod: "full" | "medium" | "light";
}

export interface Nation {
  id: NationId;
  short: string;
  confed: ConfederationId;
  languages: string[];
  cultures: Record<string, number>;
  strength: Unit;
  talent: Unit;
  climate: Climate;
  playable: boolean;
}

export interface NationalTeam {
  id: NationalTeamId;
  nation: NationId;
  elo: number;
  coachId: StaffId | null;
  squad: PlayerId[];
  /** Nivel en la Liga de Naciones de su confederación (0 = A). */
  nationsLeagueTier?: number;
}

export interface League {
  id: LeagueId;
  nation: NationId;
  tier: 1 | 2;
  clubs: ClubId[];
  /** Competición de la temporada en curso. */
  currentCompetition: CompetitionId | null;
}

// ── Competiciones y partidos ────────────────────────────────────────────────

export type CompetitionKind =
  | "league"
  | "cup"
  | "promotionPlayoff"
  | "relegationPlayoff"
  | "continentalClub"
  | "worldCup"
  | "continentalCup"
  | "nationsLeague"
  | "nationsLeagueFinals"
  | "qualifier"
  | "friendly";

export interface Tie {
  /** Equipo local en la ida. */
  a: TeamId;
  b: TeamId;
  matchIds: MatchId[];
  winner?: TeamId;
}

export interface Round {
  /** Días base de cada jornada/partido de la ronda (uno por pierna en eliminatorias). */
  slots: GameDay[];
  matchIds: MatchId[];
  ties?: Tie[];
  /** Equipos con pase directo a la siguiente ronda (exentos). */
  byes?: TeamId[];
  drawn: boolean;
}

/** Grupo de una fase de liga/grupos. En una eliminatoria, groups[0] guarda los participantes por orden de siembra. */
export interface Group {
  teams: TeamId[];
}

export type SlotKind = "weekend" | "midweek" | "c1" | "thursday" | "fixed" | "intl1" | "intl2";

export type StageKind = "roundRobin" | "groups" | "knockout" | "leaguePhase" | "playoffTie";

export interface AdvanceRule {
  /**
   * Plazas que avanzan desde una fase de grupos: primero todos los 1.º, luego los 2.º…
   * hasta completar `slots`; dentro de cada puesto, ordenados por puntos por partido.
   */
  slots?: number;
  /** Fase de liga: los `direct` primeros pasan directos, del `direct+1` al `playoffTo` juegan un playoff. */
  leaguePhase?: { direct: number; playoffTo: number };
}

export interface Stage {
  kind: StageKind;
  nameKey: string;
  /** Emparejamiento en eliminatorias: por cabezas de serie o sorteo libre. */
  pairing: "seeded" | "random";
  /** En sorteo libre, el equipo de menor reputación juega en casa (copas). */
  lowerHosts?: boolean;
  groups: Group[];
  rounds: Round[];
  advance?: AdvanceRule;
  /** Fase de grupos: número de grupos a sortear y restricción de sorteo. */
  groupCount?: number;
  groupConstraint?: "confed";
  /** Todos contra todos a doble vuelta (por defecto) o a una. */
  double?: boolean;
  /** Equipos que se incorporan en una ronda posterior de la eliminatoria (cabezas de serie que esperan). */
  extraEntrants?: TeamId[];
  /** Ronda en la que se incorporan los extraEntrants. */
  extraEntrantsRound?: number;
  /** Tipo de jornada, campo neutral y dispersión en días de cada ronda reservada. */
  roundMeta?: { kind: SlotKind; neutral: boolean; spread?: number }[];
  status: "pending" | "active" | "finished";
  /** Clasificados de la fase, ordenados por siembra. */
  qualified?: TeamId[];
}

export interface Competition {
  id: CompetitionId;
  kind: CompetitionKind;
  nameKey: string;
  /** Año de la temporada (julio) o del torneo. */
  season: number;
  nation?: NationId;
  confed?: ConfederationId;
  tier?: number;
  teamType: "club" | "national";
  participants: TeamId[];
  stages: Stage[];
  currentStage: number;
  status: "scheduled" | "active" | "finished";
  winner?: TeamId;
  /** Resultado final ordenado (clasificación de liga, o clasificados de un torneo). */
  ranking?: TeamId[];
  /** Datos específicos (p. ej. anfitrión, plazas, liga de origen). */
  meta: Record<string, string | number | boolean | string[]>;
}

export interface MatchGoal {
  minute: number;
  /** 0 = local, 1 = visitante (equipo que suma el gol). */
  side: 0 | 1;
  scorer: PlayerId;
  assist?: PlayerId;
  kind: string;
}

export interface MatchCard {
  minute: number;
  side: 0 | 1;
  player: PlayerId;
  red: boolean;
}

export interface MatchResult {
  home: number;
  away: number;
  /** Penaltis (si hubo tanda). */
  pens?: [number, number];
  extraTime?: boolean;
  /** Motor completo por zonas o modelo rápido (LOD ligero). */
  engine: "full" | "quick";
  goals: MatchGoal[];
  cards: MatchCard[];
  /** Solo motor completo: tiros, a puerta, xG ×100 y % de posesión del local. */
  stats?: { shots: [number, number]; onTarget: [number, number]; xg: [number, number]; possession: number };
  /** Mejor jugador del partido. */
  motm?: PlayerId;
}

/** Estadísticas de un jugador en una competición. */
export interface PlayerCompStats {
  team: TeamId;
  apps: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  /** Suma de valoraciones (media = ratingSum / apps). */
  ratingSum: number;
}

export interface Match {
  id: MatchId;
  competitionId: CompetitionId;
  stage: number;
  round: number;
  leg?: number;
  home: TeamId;
  away: TeamId;
  day: GameDay;
  /** Días alternativos permitidos (para reajustar sin romper el descanso mínimo). */
  candidates: GameDay[];
  neutral: boolean;
  /** En la vuelta de una eliminatoria o en una ronda única: hay que decidir ganador. */
  decisive: boolean;
  result?: MatchResult;
  /** Intervenciones en directo del técnico humano (para repetir o auditar el partido). */
  interventions?: Intervention[];
}

// ── Eventos y mundo ─────────────────────────────────────────────────────────

export interface WorldEvent {
  day: GameDay;
  type: string;
  data: Record<string, string | number | boolean | string[]>;
}

export interface SeasonRecord {
  season: number;
  champions: Record<string, TeamId>;
  promoted: Record<string, ClubId[]>;
  relegated: Record<string, ClubId[]>;
  /** Máximo goleador de cada competición registrada (clave = nameKey). */
  topScorers?: Record<string, { player: PlayerId; goals: number }>;
  /** Retiradas, canteranos subidos y jugadores que quedaron libres al cerrar la temporada. */
  turnover?: { retired: number; promoted: number; released: number };
}

export interface World {
  meta: {
    saveVersion: number;
    seed: string;
    startYear: number;
    today: GameDay;
    season: number;
    generator: string;
    /** Paquete de datos usado al generar (ausente = ficticio). */
    dataPack?: "real";
  };
  nations: Record<string, Nation>;
  nationalTeams: Record<string, NationalTeam>;
  leagues: Record<string, League>;
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  staff: Record<string, Staff>;
  competitions: Record<string, Competition>;
  matches: Record<string, Match>;
  /** Anfitriones decididos para torneos futuros: clave = id de plantilla + año. */
  hosts: Record<string, NationId[]>;
  history: SeasonRecord[];
  /** Planes individuales de desarrollo: playerId → plan (Fase 3). */
  plans: Record<string, DevelopmentPlan>;
  /** Creencias de los ojeadores: staffId → playerId → creencia. */
  scouting: Record<string, Record<string, ScoutBelief>>;
  /** Planes tácticos fijados por el usuario: teamId → plan (los demás equipos los decide la IA). */
  tactics: Record<string, TacticsPlan>;
  /** Estadísticas por competición en curso: competitionId → playerId → línea. */
  stats: Record<string, Record<string, PlayerCompStats>>;
  events: WorldEvent[];
  // ── Vestuario (Fase 4) ──
  /** Mánagers humanos (uno por humano; vacío en una simulación sin humanos). */
  managers: Record<string, Manager>;
  /** Relaciones entre jugadores: "idA|idB" (idA < idB). Solo en clubes dirigidos por humanos. */
  relationships: Record<string, Relationship>;
  /** Confianza de cada jugador en cada mánager: "playerId|managerId". */
  trust: Record<string, ManagerTrust>;
  memories: Record<string, Memory>;
  commitments: Record<string, Commitment>;
  inbox: InboxItem[];
  /** Vestuario de cada club dirigido por un humano. */
  dressing: Record<string, DressingRoom>;
  /**
   * Sal de turno por día (multijugador, DISEÑO §11.3): se publica al cerrar el día y entra en la
   * semilla de sus partidos. Vacía en un jugador: no cambia nada.
   */
  salts: Record<string, string>;
  idCounters: Record<string, number>;
}
