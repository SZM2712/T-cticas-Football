// Participantes que dependen de otras competiciones (resolvers) y efectos al terminar
// una competición (hooks). Los usa progress.ts.

import type { Competition } from "../types/domain";
import type { TeamId } from "../types/ids";
import type { Ctx } from "./build";
import { shadowTier3 } from "./query";
import { compareRowsPerGame, groupTable } from "./standings";

/**
 * Devuelve los entrantes de la fase `stage`, `null` si todavía no se pueden saber, o
 * `undefined` si el resolver no se ocupa de esa fase (se usan los clasificados de la anterior).
 */
export type EntrantResolver = (ctx: Ctx, comp: Competition, stage: number) => TeamId[] | null | undefined;

const finished = (ctx: Ctx, id: unknown): Competition | null => {
  const c = typeof id === "string" ? ctx.world.competitions[id] : undefined;
  return c && c.status === "finished" ? c : null;
};

export const ENTRANT_RESOLVERS: Record<string, EntrantResolver> = {
  /** Playoff de ascenso: puestos [from, to] de la 2.ª; luego, promoción contra la 1.ª. */
  promotionPlayoff(ctx, comp, stage) {
    if (stage === 0) {
      const league = finished(ctx, comp.meta.leagueComp);
      if (!league) return null;
      return league.ranking!.slice(Number(comp.meta.from) - 1, Number(comp.meta.to));
    }
    const upper = finished(ctx, comp.meta.upperLeagueComp);
    const winner = comp.stages[0]?.qualified?.[0];
    if (!upper || !winner) return null;
    const upperTeam = upper.ranking![Number(comp.meta.upperPosition) - 1]!;
    return [upperTeam, winner];
  },
  /** Promoción de la 2.ª contra el mejor club del nivel en sombra. */
  relegationShadow(ctx, comp) {
    const league = finished(ctx, comp.meta.leagueComp);
    if (!league) return null;
    const team = league.ranking![Number(comp.meta.position) - 1]!;
    const best = shadowTier3(ctx.world, String(comp.nation))
      .sort((a, b) => b.quality - a.quality || a.id.localeCompare(b.id))[0];
    return best ? [team, best.id] : [team];
  },
  /** Los primeros `take` de la clasificación de otra competición. */
  takeRanking(ctx, comp, stage) {
    if (stage !== 0) return undefined;
    const source = finished(ctx, comp.meta.source);
    return source ? source.ranking!.slice(0, Number(comp.meta.take)) : null;
  },
  /** Unión de los clasificados de varias competiciones más equipos fijos (anfitriones). */
  union(ctx, comp, stage) {
    if (stage !== 0) return undefined;
    const sources = (comp.meta.sources as string[]) ?? [];
    const done = sources.map((id) => finished(ctx, id));
    if (done.some((c) => !c)) return null;
    const fixed = ((comp.meta.fixed as string[]) ?? []) as TeamId[];
    return [...fixed, ...done.flatMap((c) => c!.ranking ?? []).filter((t) => !fixed.includes(t))];
  },
};

/** Ascensos y descensos entre divisiones de la Liga de Naciones al terminar todas. */
function nationsLeaguePromotions(ctx: Ctx, comp: Competition): void {
  const { world } = ctx;
  const siblings = Object.values(world.competitions)
    .filter((c) => c.kind === "nationsLeague" && c.confed === comp.confed && c.season === comp.season)
    .sort((a, b) => Number(a.meta.tier) - Number(b.meta.tier));
  if (siblings.some((c) => c.status !== "finished")) return;
  const seed = new Map<TeamId, number>();
  const tables = siblings.map((c) => c.stages[0]!.groups.map((g) => groupTable(world, c.id, 0, g.teams)));
  for (let t = 0; t + 1 < siblings.length; t++) {
    const upper = tables[t]!;
    const lower = tables[t + 1]!;
    const swaps = Math.min(upper.length, lower.length);
    const lastPlaced = upper.map((rows) => rows[rows.length - 1]!).sort((a, b) => compareRowsPerGame(b, a, seed));
    const winners = lower.map((rows) => rows[0]!).sort((a, b) => compareRowsPerGame(a, b, seed));
    for (const row of lastPlaced.slice(0, swaps)) world.nationalTeams[row.team]!.nationsLeagueTier = t + 1;
    for (const row of winners.slice(0, swaps)) world.nationalTeams[row.team]!.nationsLeagueTier = t;
  }
}

export const COMPLETION_HOOKS: Partial<Record<Competition["kind"], (ctx: Ctx, comp: Competition) => void>> = {
  nationsLeague: nationsLeaguePromotions,
};
