// Creación del calendario completo de una temporada y cierre de la anterior.

import { NATION_LEAGUES } from "@tf/data";
import type { Ctx } from "../competition/build";
import { buildContinentalSeason } from "../competition/continental";
import { applyPromotions, buildDomesticSeason } from "../competition/domestic";
import { buildInternationalSeason } from "../competition/international";
import { continentalDates, continentalDays, windowsOf } from "../competition/seasonPlan";
import type { SeasonRecord } from "../types/domain";
import type { TeamId } from "../types/ids";

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
  for (const data of NATION_LEAGUES) {
    const { promoted, relegated } = applyPromotions(world, data.nation, season);
    record.promoted[data.nation] = promoted;
    record.relegated[data.nation] = relegated;
  }
  world.history.push(record);
  return record;
}
