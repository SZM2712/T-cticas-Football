// Bucle de juego: avanzar un día procesa convocatorias, amistosos, partidos del día y
// el cambio de temporada (1 de julio). El estado vive en `world`; `Game` añade índices
// en memoria que se reconstruyen al cargar.

import type { Ctx } from "../competition/build";
import { scheduleFriendlies, tournamentStart } from "../competition/international";
import { tryAdvance } from "../competition/progress";
import { TeamSchedule } from "../competition/schedule";
import { windowsOf } from "../competition/seasonPlan";
import { callUps, generateWorld, type GenerateOptions } from "../gen/world";
import { quickResult, updateElo } from "../match/quick";
import { seasonStartDay } from "../time/calendar";
import type { Match, World } from "../types/domain";
import type { GameDay } from "../types/ids";
import { worldRng } from "../world/rng";
import { buildSeason, closeSeason } from "./season";

export interface Game {
  world: World;
  ctx: Ctx;
}

/** Envuelve un mundo (recién generado o cargado) con sus índices en memoria. */
export function openGame(world: World): Game {
  return { world, ctx: { world, schedule: TeamSchedule.fromWorld(world), clashes: 0 } };
}

/** Genera un mundo nuevo y crea el calendario de su primera temporada. */
export function newGame(opts: GenerateOptions): Game {
  const game = openGame(generateWorld(opts));
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

export function advanceDay(game: Game): void {
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

  // Partidos del día. En la Fase 1 se resuelven con el modelo rápido provisional.
  const ratings = new Map<string, number>();
  for (const id of ctx.schedule.matchesOn(day)) {
    const m = world.matches[id];
    if (!m || m.result) continue;
    m.result = quickResult(world, m, worldRng(world).fork(`match/${m.id}`), ratings, aggregateBefore(world, m));
    updateElo(world, m);
    const comp = world.competitions[m.competitionId];
    if (comp) tryAdvance(ctx, comp);
  }
}

export function advanceDays(game: Game, days: number): void {
  for (let i = 0; i < days; i++) advanceDay(game);
}

/** Avanza hasta el inicio de la temporada `n` temporadas después. */
export function advanceSeasons(game: Game, seasons: number): void {
  const target = seasonStartDay(game.world.meta.season + seasons);
  while (game.world.meta.today < target) advanceDay(game);
}
