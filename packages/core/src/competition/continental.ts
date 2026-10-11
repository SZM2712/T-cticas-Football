// Competiciones europeas de clubes (3 niveles): fase de liga de 36 equipos con sorteo
// por bombos, playoff, octavos, cuartos, semifinales y final.

import { NATION_LEAGUES } from "@tf/data";
import type { Club, Competition, World } from "../types/domain";
import type { ClubId, GameDay, TeamId } from "../types/ids";
import { addStage, bySeed, newCompetition, type Ctx, type RoundSlot } from "./build";
import { tryAdvance } from "./progress";
import { leaguesOf } from "./query";
import type { ContinentalDates } from "./seasonPlan";

const SIZE = 36;
/** Máximo de clubes de una misma nación no jugable por competición. */
const SHADOW_CAP = [2, 2, 3] as const;

function previousRanking(world: World, nation: string, season: number, kind: "league" | "cup"): ClubId[] | null {
  const comp = Object.values(world.competitions).find(
    (c) => c.kind === kind && c.nation === nation && c.season === season - 1 && (kind === "cup" || c.tier === 1),
  );
  return comp?.ranking?.length ? (comp.ranking as ClubId[]) : null;
}

/** Participantes de las tres competiciones a partir de la temporada anterior (o de la reputación). */
export function continentalEntrants(world: World, season: number): [ClubId[], ClubId[], ClubId[]] {
  const out: [ClubId[], ClubId[], ClubId[]] = [[], [], []];
  const taken = new Set<ClubId>();
  for (const data of NATION_LEAGUES) {
    const [t1] = leaguesOf(world, data.nation);
    // La clasificación de la temporada anterior decide; si un club bajó, ya no está en t1 y se salta.
    const ranking = (previousRanking(world, data.nation, season, "league") ?? (bySeed(world, t1.clubs) as ClubId[]))
      .filter((id) => world.clubs[id]?.leagueId === t1.id);
    const queue = ranking.filter((id) => !taken.has(id));
    const take = (n: number, level: 0 | 1 | 2) => {
      for (let i = 0; i < n && queue.length; i++) {
        const id = queue.shift()!;
        taken.add(id);
        out[level].push(id);
      }
    };
    take(data.continental.c1, 0);
    take(data.continental.c2, 1);
    const cupWinner = previousRanking(world, data.nation, season, "cup")?.[0];
    const cupLevel = data.continental.cupWinner === "c2" ? 1 : 2;
    if (cupWinner && !taken.has(cupWinner) && world.clubs[cupWinner]?.leagueId) {
      taken.add(cupWinner);
      out[cupLevel].push(cupWinner);
      const i = queue.indexOf(cupWinner);
      if (i >= 0) queue.splice(i, 1);
    } else {
      take(1, cupLevel);
    }
    take(data.continental.c3, 2);
  }
  // Clubes en sombra de naciones europeas no jugables.
  const shadow = Object.values(world.clubs)
    .filter((c): c is Club => c.shadowTier === 1 && world.nations[c.nation]?.confed === "EUR")
    .sort((a, b) => b.quality - a.quality || a.id.localeCompare(b.id));
  ([0, 1, 2] as const).forEach((level) => {
    const perNation = new Map<string, number>();
    for (const c of shadow) {
      if (out[level].length >= SIZE) break;
      if (taken.has(c.id)) continue;
      const count = perNation.get(c.nation) ?? 0;
      if (count >= SHADOW_CAP[level]) continue;
      perNation.set(c.nation, count + 1);
      taken.add(c.id);
      out[level].push(c.id);
    }
  });
  return out;
}

export function buildContinentalSeason(ctx: Ctx, season: number, cd: ContinentalDates): Competition[] {
  const entrants = continentalEntrants(ctx.world, season);
  return entrants.map((teams, level) => {
    const thursday = level > 0;
    const shift = (d: GameDay) => (d + (thursday ? 2 : 0)) as GameDay;
    const kind = thursday ? "thursday" : "c1";
    const comp = newCompetition(ctx.world, {
      kind: "continentalClub",
      nameKey: `comp.continental.${level + 1}`,
      season,
      confed: "EUR",
      teamType: "club",
      participants: bySeed(ctx.world, teams as TeamId[]),
      meta: { level: level + 1 },
    });
    const leagueRounds: RoundSlot[] = cd.leaguePhase.map((d) => ({ slots: [shift(d)], kind }));
    addStage(comp, "leaguePhase", "stage.leaguePhase", leagueRounds, { advance: { leaguePhase: { direct: 8, playoffTo: 24 } } });
    const finalDay = level === 0 ? cd.finals.c1 : level === 1 ? cd.finals.c2 : cd.finals.c3;
    const ko: RoundSlot[] = [
      { slots: cd.playoff.map(shift), kind },
      { slots: cd.r16.map(shift), kind },
      { slots: cd.qf.map(shift), kind },
      { slots: cd.sf.map(shift), kind },
      { slots: [finalDay], kind: "fixed", neutral: true },
    ];
    addStage(comp, "knockout", "stage.knockout", ko, { pairing: "seeded" });
    tryAdvance(ctx, comp);
    return comp;
  });
}
