// Creación del calendario completo de una temporada y cierre de la anterior.

import { NATION_LEAGUES } from "@tf/data";
import type { Ctx } from "../competition/build";
import { buildContinentalSeason } from "../competition/continental";
import { applyPromotions, buildDomesticSeason } from "../competition/domestic";
import { buildInternationalSeason } from "../competition/international";
import { continentalDates, continentalDays, windowsOf } from "../competition/seasonPlan";
import type { CareerLine, SeasonRecord, World } from "../types/domain";
import type { PlayerId, TeamId } from "../types/ids";

export function buildSeason(ctx: Ctx, season: number): void {
  const windows = windowsOf(season);
  const cd = continentalDates(season, windows);
  const contDays = continentalDays(cd);
  for (const data of NATION_LEAGUES) buildDomesticSeason(ctx, season, data, windows, contDays);
  buildContinentalSeason(ctx, season, cd);
  buildInternationalSeason(ctx, season);
}

/** Cierra la temporada: ascensos/descensos y registro histórico. */
export function closeSeason(ctx: Ctx, season: number): SeasonRecord {
  const { world } = ctx;
  const record: SeasonRecord = { season, champions: {}, promoted: {}, relegated: {} };
  // Todo lo terminado y aún no registrado: incluye torneos de verano que acabaron en julio,
  // después del cierre de la temporada anterior.
  for (const comp of Object.values(world.competitions)) {
    if (comp.status !== "finished" || comp.meta.recorded || comp.kind === "friendly" || !comp.winner) continue;
    record.champions[comp.nameKey] = comp.winner as TeamId;
    comp.meta.recorded = true;
  }
  record.topScorers = rollUpStats(world);
  for (const data of NATION_LEAGUES) {
    const { promoted, relegated } = applyPromotions(world, data.nation, season);
    record.promoted[data.nation] = promoted;
    record.relegated[data.nation] = relegated;
  }
  world.history.push(record);
  return record;
}

/**
 * Pasa las estadísticas de las competiciones terminadas a la trayectoria de cada jugador
 * (una línea por temporada y equipo) y las borra del mundo para que no crezca sin límite.
 * Devuelve el máximo goleador de cada competición (por nameKey).
 */
function rollUpStats(world: World): Record<string, { player: PlayerId; goals: number }> {
  const top: Record<string, { player: PlayerId; goals: number }> = {};
  for (const compId of Object.keys(world.stats).sort()) {
    const comp = world.competitions[compId];
    if (comp && comp.status !== "finished") continue;
    const lines = world.stats[compId]!;
    let best: { player: PlayerId; goals: number } | undefined;
    for (const pid of Object.keys(lines).sort()) {
      const st = lines[pid]!;
      const p = world.players[pid];
      if (st.goals > 0 && (!best || st.goals > best.goals)) best = { player: pid as PlayerId, goals: st.goals };
      if (!p || !comp) continue;
      let line: CareerLine | undefined = p.career.find((c) => c.season === comp.season && c.team === st.team);
      if (!line) p.career.push((line = { season: comp.season, team: st.team, apps: 0, goals: 0, assists: 0 }));
      line.apps += st.apps;
      line.goals += st.goals;
      line.assists += st.assists;
    }
    if (best && comp && comp.kind !== "qualifier") top[comp.nameKey] = best;
    delete world.stats[compId];
  }
  return top;
}
