// Bucle de juego: avanzar un día procesa convocatorias, amistosos, partidos del día y
// el cambio de temporada (1 de julio). El estado vive en `world`; `Game` añade índices
// en memoria que se reconstruyen al cargar.

import type { Ctx } from "../competition/build";
import { scheduleFriendlies, tournamentStart } from "../competition/international";
import { tryAdvance } from "../competition/progress";
import { TeamSchedule } from "../competition/schedule";
import { windowsOf } from "../competition/seasonPlan";
import { callUps, generateWorld, type GenerateOptions } from "../gen/world";
import { applyReport } from "../match/apply";
import { simulateWithInterventions } from "../match/engine";
import { buildMatchInput } from "../match/lineup";
import { playMatch, type EngineMode, type PlayedMatch } from "../match/play";
import { updateElo } from "../match/quick";
import type { MatchInput, MatchReport } from "../match/types";
import type { Intervention } from "../types/tactics";
import { dateOf, seasonStartDay } from "../time/calendar";
import { monthlyDevelopment } from "../development/tick";
import { monthlyScouting } from "../development/scouting";
import type { Match, World } from "../types/domain";
import type { GameDay } from "../types/ids";
import { worldRng } from "../world/rng";
import { buildSeason, closeSeason } from "./season";

export interface Game {
  world: World;
  ctx: Ctx;
  /** Motor de partido: "auto" (por LOD), o forzar uno (simulaciones de balance). */
  engine: EngineMode;
  /** Partido que el usuario está jugando en directo (aún sin resultado en el mundo). */
  live: LiveSession | null;
}

/**
 * Partido en directo. El mundo no cambia hasta `finishLive`: mientras tanto el partido se
 * puede simular las veces que haga falta con las intervenciones acumuladas (es determinista,
 * así que lo ya visto nunca cambia) y el usuario puede intervenir en cualquier pausa.
 */
export interface LiveSession {
  match: Match;
  input: MatchInput;
  interventions: Intervention[];
}

/** Envuelve un mundo (recién generado o cargado) con sus índices en memoria. */
export function openGame(world: World, engine: EngineMode = "auto"): Game {
  return { world, ctx: { world, schedule: TeamSchedule.fromWorld(world), clashes: 0 }, engine, live: null };
}

/** Genera un mundo nuevo y crea el calendario de su primera temporada. */
export function newGame(opts: GenerateOptions, engine: EngineMode = "auto"): Game {
  const game = openGame(generateWorld(opts), engine);
  buildSeason(game.ctx, game.world.meta.season);
  return game;
}

/** Goles acumulados de la eliminatoria antes de este partido, vistos desde su local. */
function aggregateBefore(world: World, m: Match): [number, number] | undefined {
  const tie = world.competitions[m.competitionId]?.stages[m.stage]?.rounds[m.round]?.ties?.find((t) => t.matchIds.includes(m.id));
  if (!tie) return undefined;
  let h = 0;
  let a = 0;
  for (const id of tie.matchIds) {
    if (id === m.id) continue;
    const other = world.matches[id];
    if (!other?.result) continue;
    h += other.home === m.home ? other.result.home : other.result.away;
    a += other.home === m.home ? other.result.away : other.result.home;
  }
  return [h, a];
}

export interface AdvanceOptions {
  /** Partidos de los que se quieren fotogramas para el visor (o todos con `true`). */
  frames?: boolean | ReadonlySet<string>;
  /** Partido que se reserva para jugarlo en directo (motor completo) en lugar de simularlo. */
  live?: string;
}

/** Avanza un día. Devuelve los partidos jugados (con su informe completo). */
export function advanceDay(game: Game, opts: AdvanceOptions = {}): PlayedMatch[] {
  const { world, ctx } = game;
  // Un partido en directo sin terminar se cierra con las intervenciones que tenga.
  if (game.live) finishLive(game);
  const day = (world.meta.today + 1) as GameDay;
  world.meta.today = day;

  if (day === seasonStartDay(world.meta.season + 1)) {
    closeSeason(ctx, world.meta.season);
    world.meta.season += 1;
    buildSeason(ctx, world.meta.season);
  }

  // Desarrollo de los jugadores y trabajo de los ojeadores, el primer día de cada mes.
  if (dateOf(day).d === 1) {
    monthlyDevelopment(world, day);
    monthlyScouting(world, day);
  }

  // Convocatorias y amistosos al abrirse una ventana FIFA; convocatorias antes de un torneo.
  const season = world.meta.season;
  for (const w of windowsOf(season)) {
    if (w.monday !== day) continue;
    callUps(world);
    scheduleFriendlies(ctx, season, w.matchdays[0], "intl1");
    scheduleFriendlies(ctx, season, w.matchdays[1], "intl2");
  }
  if (day === tournamentStart(season + 1) - 10) callUps(world);

  // Partidos del día: motor completo por zonas o modelo rápido según el LOD.
  const ratings = new Map<string, number>();
  const played: PlayedMatch[] = [];
  for (const id of ctx.schedule.matchesOn(day)) {
    const m = world.matches[id];
    if (!m || m.result) continue;
    if (opts.live === m.id) {
      game.live = { match: m, input: buildMatchInput(world, m, aggregateBefore(world, m)), interventions: [] };
      continue;
    }
    const frames = opts.frames === true || (typeof opts.frames === "object" && opts.frames.has(m.id));
    const aggregate = aggregateBefore(world, m);
    const playOpts: Parameters<typeof playMatch>[3] = { mode: game.engine, frames, ratings };
    if (aggregate) playOpts.aggregate = aggregate;
    played.push(playMatch(world, m, worldRng(world).fork(`match/${m.id}`), playOpts));
    const comp = world.competitions[m.competitionId];
    if (comp) tryAdvance(ctx, comp);
  }
  return played;
}

export function advanceDays(game: Game, days: number): void {
  for (let i = 0; i < days; i++) advanceDay(game);
}

/** Avanza hasta el inicio de la temporada `n` temporadas después. */
export function advanceSeasons(game: Game, seasons: number): void {
  const target = seasonStartDay(game.world.meta.season + seasons);
  while (game.world.meta.today < target) advanceDay(game);
}

/** Simula el partido en directo con las intervenciones hechas hasta ahora (no toca el mundo). */
export function liveReport(game: Game, frames = true): MatchReport {
  const live = game.live;
  if (!live) throw new Error("No hay partido en directo");
  return simulateWithInterventions(live.input, worldRng(game.world).fork(live.input.seedPath), { frames }, live.interventions).report;
}

/**
 * Intervención del técnico en una pausa. Debe ser en el mismo punto o después de la última
 * (no se puede volver atrás). Devuelve la clave del error si no se puede aplicar.
 */
export function liveIntervene(game: Game, iv: Intervention): { ok: true } | { ok: false; error: string } {
  const live = game.live;
  if (!live) return { ok: false, error: "error.noLiveMatch" };
  const last = live.interventions.at(-1);
  if (last && iv.step < last.step) return { ok: false, error: "error.pastStep" };
  const list = [...live.interventions, iv];
  const { errors } = simulateWithInterventions(live.input, worldRng(game.world).fork(live.input.seedPath), {}, list);
  const error = errors.at(-1);
  if (error) return { ok: false, error };
  live.interventions = list;
  return { ok: true };
}

/** Cierra el partido en directo: el resultado pasa al mundo y la competición avanza. */
export function finishLive(game: Game): PlayedMatch {
  const live = game.live;
  if (!live) throw new Error("No hay partido en directo");
  game.live = null;
  const m = live.match;
  const report = simulateWithInterventions(live.input, worldRng(game.world).fork(live.input.seedPath), {}, live.interventions).report;
  applyReport(game.world, m, report, "full");
  updateElo(game.world, m);
  const comp = game.world.competitions[m.competitionId];
  if (comp) tryAdvance(game.ctx, comp);
  return { match: m, engine: "full", report, input: live.input };
}
