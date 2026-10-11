// Bucle de juego: avanzar un día procesa convocatorias, amistosos, partidos del día y
// el cambio de temporada (1 de julio). El estado vive en `world`; `Game` añade índices
// en memoria que se reconstruyen al cargar.

import type { Ctx } from "../competition/build";
import { scheduleFriendlies, tournamentStart } from "../competition/international";
import { tryAdvance } from "../competition/progress";
import { TeamSchedule } from "../competition/schedule";
import { windowsOf } from "../competition/seasonPlan";
import { callUps, generateWorld, type GenerateOptions } from "../gen/world";
import { playMatch, type EngineMode, type PlayedMatch } from "../match/play";
import { seasonStartDay } from "../time/calendar";
import type { Match, World } from "../types/domain";
import type { GameDay } from "../types/ids";
import { worldRng } from "../world/rng";
import { buildSeason, closeSeason } from "./season";

export interface Game {
  world: World;
  ctx: Ctx;
  /** Motor de partido: "auto" (por LOD), o forzar uno (simulaciones de balance). */
  engine: EngineMode;
}

/** Envuelve un mundo (recién generado o cargado) con sus índices en memoria. */
export function openGame(world: World, engine: EngineMode = "auto"): Game {
  return { world, ctx: { world, schedule: TeamSchedule.fromWorld(world), clashes: 0 }, engine };
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
}

/** Avanza un día. Devuelve los partidos jugados (con su informe completo). */
export function advanceDay(game: Game, opts: AdvanceOptions = {}): PlayedMatch[] {
  const { world, ctx } = game;
  const day = (world.meta.today + 1) as GameDay;
  world.meta.today = day;

  if (day === seasonStartDay(world.meta.season + 1)) {
    closeSeason(ctx, world.meta.season);
    world.meta.season += 1;
    buildSeason(ctx, world.meta.season);
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
