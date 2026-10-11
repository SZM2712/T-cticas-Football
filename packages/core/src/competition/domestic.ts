// Competiciones nacionales de una temporada: ligas, copa, playoffs y promociones;
// y aplicación de ascensos/descensos al cerrar la temporada.

import { NATION_LEAGUES, type NationLeagueData } from "@tf/data";
import { SAT, weekday } from "../time/calendar";
import type { Club, Competition, League, World } from "../types/domain";
import type { ClubId, GameDay } from "../types/ids";
import { worldRng } from "../world/rng";
import { addStage, bySeed, knockoutPlan, newCompetition, sequentialRounds, type Ctx, type RoundSlot } from "./build";
import { tryAdvance } from "./progress";
import { leaguesOf, shadowTier3 } from "./query";
import { planNation, type InternationalWindow } from "./seasonPlan";

/** Copa: todos los clubes de la nación (dos divisiones + nivel en sombra). */
function cupSetup(world: World, data: NationLeagueData, t1: League, t2: League) {
  const all = [...t1.clubs, ...t2.clubs, ...shadowTier3(world, data.nation).map((c) => c.id)];
  const seeded = bySeed(world, all);
  const top = data.cup.seededTopEntersAtRound;
  const extras = top ? seeded.slice(0, top.topN) : [];
  const entrants = top ? seeded.slice(top.topN) : seeded;
  const extrasMap = top ? { [top.round - 1]: top.topN } : {};
  const plan = knockoutPlan(entrants.length, extrasMap);
  const legs = Array.from({ length: plan.rounds - 1 }, (_, r) => (data.cup.semisTwoLegs && r === plan.rounds - 2 ? 2 : 1));
  return { entrants, extras, extraRound: top ? top.round - 1 : undefined, plan, legs };
}

export interface DomesticSeason {
  leagueComps: [Competition, Competition];
  cup: Competition;
}

export function buildDomesticSeason(
  ctx: Ctx,
  seasonYear: number,
  data: NationLeagueData,
  windows: readonly InternationalWindow[],
  continental: readonly GameDay[],
): DomesticSeason {
  const { world } = ctx;
  const [t1, t2] = leaguesOf(world, data.nation);
  const rounds: [number, number] = [2 * (t1.clubs.length - 1), 2 * (t2.clubs.length - 1)];
  const cup = cupSetup(world, data, t1, t2);
  const plan = planNation(seasonYear, data, rounds, cup.legs, windows, continental);

  const leagueComps = ([t1, t2] as const).map((league, i) => {
    const comp = newCompetition(world, {
      kind: "league",
      nameKey: `comp.league.${data.nation}.${league.tier}`,
      season: seasonYear,
      nation: league.nation,
      tier: league.tier,
      teamType: "club",
      participants: bySeed(world, league.clubs),
      meta: { leagueId: league.id },
    });
    const slots: RoundSlot[] = plan.leagueSlots[i]!.map((d) => ({ slots: [d], kind: weekday(d) === SAT ? "weekend" : "midweek" }));
    addStage(comp, "roundRobin", "stage.league", slots);
    league.currentCompetition = comp.id;
    tryAdvance(ctx, comp);
    return comp;
  }) as [Competition, Competition];

  // Copa nacional.
  const cupComp = newCompetition(world, {
    kind: "cup",
    nameKey: `comp.cup.${data.nation}`,
    season: seasonYear,
    nation: t1.nation,
    teamType: "club",
    participants: cup.entrants,
    meta: {},
  });
  const cupRounds: RoundSlot[] = plan.cupSlots.map((slots) => ({ slots, kind: "midweek" }));
  cupRounds.push({ slots: [plan.cupFinal], kind: "fixed", neutral: true });
  const lowerHosts = data.nation !== "GB-ENG" && data.nation !== "IT";
  addStage(cupComp, "knockout", "stage.cup", cupRounds, {
    pairing: data.nation === "IT" ? "seeded" : "random",
    lowerHosts,
    ...(cup.extras.length ? { extraEntrants: cup.extras, extraEntrantsRound: cup.extraRound ?? 1 } : {}),
  });
  tryAdvance(ctx, cupComp);

  // Playoff de ascenso (y promoción contra la 1.ª si existe).
  const S = plan.lastWeekend;
  const promo = data.tiers[1].promotion?.playoff;
  const upperPos = data.tiers[0].relegation.relegationPlayoffPosition;
  if (promo) {
    const n = promo.to - promo.from + 1;
    const kp = knockoutPlan(n);
    const legs = Array.from({ length: kp.rounds }, (_, r) => (upperPos ? 1 : r < kp.rounds - 1 ? 2 : 1));
    const comp = newCompetition(world, {
      kind: "promotionPlayoff",
      nameKey: `comp.promotionPlayoff.${data.nation}`,
      season: seasonYear,
      nation: t2.nation,
      teamType: "club",
      participants: [],
      meta: {
        resolver: "promotionPlayoff",
        leagueComp: leagueComps[1].id,
        upperLeagueComp: leagueComps[0].id,
        from: promo.from,
        to: promo.to,
        upperPosition: upperPos ?? 0,
        dependsOn: [leagueComps[1].id, leagueComps[0].id],
      },
    });
    const playoffRounds = sequentialRounds(S + 4, legs, "fixed");
    if (!upperPos && playoffRounds.length) playoffRounds[playoffRounds.length - 1]!.neutral = true;
    addStage(comp, "knockout", "stage.playoff", playoffRounds, { pairing: "seeded" });
    if (upperPos) {
      const after = playoffRounds.length ? playoffRounds[playoffRounds.length - 1]!.slots.at(-1)! + 4 : S + 5;
      addStage(comp, "playoffTie", "stage.promotionTie", [{ slots: [after as GameDay, (after + 3) as GameDay], kind: "fixed" }]);
    }
  }

  // Promoción de la 2.ª contra el nivel en sombra.
  const lowPos = data.tiers[1].relegation.relegationPlayoffPosition;
  if (lowPos) {
    const comp = newCompetition(world, {
      kind: "relegationPlayoff",
      nameKey: `comp.relegationPlayoff.${data.nation}`,
      season: seasonYear,
      nation: t2.nation,
      teamType: "club",
      participants: [],
      meta: { resolver: "relegationShadow", leagueComp: leagueComps[1].id, position: lowPos, dependsOn: [leagueComps[1].id] },
    });
    addStage(comp, "playoffTie", "stage.relegationTie", [{ slots: [(S + 4) as GameDay, (S + 7) as GameDay], kind: "fixed" }]);
  }
  return { leagueComps, cup: cupComp };
}

function seasonComps(world: World, nation: string, season: number): Competition[] {
  return Object.values(world.competitions).filter((c) => c.nation === nation && c.season === season && c.teamType === "club");
}

function moveClub(world: World, club: Club, to: League | null): void {
  for (const l of Object.values(world.leagues)) {
    const i = l.clubs.indexOf(club.id);
    if (i >= 0) l.clubs.splice(i, 1);
  }
  if (to) {
    to.clubs.push(club.id);
    club.leagueId = to.id;
    delete club.shadowTier;
    club.lod = "medium";
  } else {
    club.leagueId = null;
    club.shadowTier = 3;
    club.lod = "light";
  }
}

/** Ascensos y descensos al cerrar la temporada `season` de una nación jugable. */
export function applyPromotions(world: World, nationCode: string, season: number): { promoted: ClubId[]; relegated: ClubId[] } {
  const data = NATION_LEAGUES.find((d) => d.nation === nationCode)!;
  const [t1, t2] = leaguesOf(world, nationCode);
  const comps = seasonComps(world, nationCode, season);
  const l1 = comps.find((c) => c.kind === "league" && c.tier === 1);
  const l2 = comps.find((c) => c.kind === "league" && c.tier === 2);
  const rank1 = (l1?.ranking ?? bySeed(world, t1.clubs)) as ClubId[];
  const rank2 = (l2?.ranking ?? bySeed(world, t2.clubs)) as ClubId[];
  const down1 = rank1.slice(rank1.length - data.tiers[0].relegation.auto);
  const up2 = rank2.slice(0, data.tiers[1].promotion?.auto ?? 0);

  const promo = comps.find((c) => c.kind === "promotionPlayoff");
  if (promo?.winner) {
    const hasTie = promo.stages.some((s) => s.kind === "playoffTie");
    const winner = promo.winner as ClubId;
    if (!hasTie) up2.push(winner);
    else if (t2.clubs.includes(winner)) {
      up2.push(winner);
      const loser = promo.ranking?.[1] as ClubId | undefined;
      if (loser && t1.clubs.includes(loser)) down1.push(loser);
    }
  }
  const down2 = rank2.slice(rank2.length - data.tiers[1].relegation.auto);
  const shadowUp: ClubId[] = [];
  const releg = comps.find((c) => c.kind === "relegationPlayoff");
  if (releg?.winner) {
    const winner = releg.winner as ClubId;
    const loser = releg.ranking?.[1] as ClubId | undefined;
    if (!t2.clubs.includes(winner) && loser) {
      down2.push(loser);
      shadowUp.push(winner);
    }
  }
  // El resto de plazas del nivel en sombra: los mejores clubes con algo de azar ("su liga").
  const rng = worldRng(world).fork(`promotions/${nationCode}/${season}`);
  const candidates = shadowTier3(world, nationCode)
    .filter((c) => !shadowUp.includes(c.id))
    .map((c) => ({ c, score: c.quality + rng.normal(0, 0.6) }))
    .sort((a, b) => b.score - a.score || a.c.id.localeCompare(b.c.id));
  while (shadowUp.length < down2.length && candidates.length) shadowUp.push(candidates.shift()!.c.id);

  for (const id of down1) moveClub(world, world.clubs[id]!, t2);
  for (const id of up2) moveClub(world, world.clubs[id]!, t1);
  for (const id of down2) moveClub(world, world.clubs[id]!, null);
  for (const id of shadowUp) moveClub(world, world.clubs[id]!, t2);
  return { promoted: [...up2, ...shadowUp], relegated: [...down1, ...down2] };
}
