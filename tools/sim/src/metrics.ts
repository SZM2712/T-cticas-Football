// Métricas de balance del motor de partido (criterios de aceptación de la Fase 2, DISEÑO §7).

import {
  buildMatchInput, quickMatch, simulateMatch, type GameDay, type Match, type MatchId, type MatchReport, type PlayedMatch,
  type World, worldRng,
} from "@tf/core";

export interface Accumulator {
  matches: number;
  goals: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  reds: number;
  yellows: number;
  shots: number;
  onTarget: number;
  xg: number;
  fouls: number;
  corners: number;
  injuries: number;
  penalties: number;
  extraTime: number;
  /** Goles por jugador y temporada-competición (para la cola larga de goleadores). */
  scorers: Map<string, number>;
  ms: number;
}

export function newAccumulator(): Accumulator {
  return {
    matches: 0, goals: 0, homeWins: 0, draws: 0, awayWins: 0, reds: 0, yellows: 0, shots: 0, onTarget: 0, xg: 0,
    fouls: 0, corners: 0, injuries: 0, penalties: 0, extraTime: 0, scorers: new Map(), ms: 0,
  };
}

export function addReport(acc: Accumulator, report: MatchReport, key: string): void {
  acc.matches++;
  const [h, a] = report.score;
  acc.goals += h + a;
  if (h > a) acc.homeWins++;
  else if (h === a) acc.draws++;
  else acc.awayWins++;
  for (const s of report.stats) {
    acc.shots += s.shots;
    acc.onTarget += s.onTarget;
    acc.xg += s.xg;
    acc.fouls += s.fouls;
    acc.corners += s.corners;
  }
  for (const e of report.events) {
    if (e.type === "red") acc.reds++;
    else if (e.type === "yellow") acc.yellows++;
    else if (e.type === "injury") acc.injuries++;
    else if (e.type === "penaltyAwarded") acc.penalties++;
    else if (e.type === "goal" && e.player) acc.scorers.set(`${key}|${e.player}`, (acc.scorers.get(`${key}|${e.player}`) ?? 0) + 1);
  }
  if (report.extraTime) acc.extraTime++;
}

export interface Summary {
  matches: number;
  goalsPerMatch: number;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  redsPerMatch: number;
  yellowsPerMatch: number;
  shotsPerMatch: number;
  onTargetPerMatch: number;
  xgPerMatch: number;
  foulsPerMatch: number;
  cornersPerMatch: number;
  injuriesPerMatch: number;
  penaltiesPerMatch: number;
  /** Goleadores: P50, P90, P99 y máximo de goles por jugador y competición; % con un solo gol. */
  scorerP50: number;
  scorerP90: number;
  scorerP99: number;
  scorerMax: number;
  singleGoalShare: number;
  msPerMatch: number;
}

const pct = (x: number, n: number) => (n ? (100 * x) / n : 0);
const per = (x: number, n: number) => (n ? x / n : 0);

export function summarize(acc: Accumulator): Summary {
  const n = acc.matches;
  const goals = [...acc.scorers.values()].sort((a, b) => a - b);
  const q = (p: number) => goals[Math.min(goals.length - 1, Math.floor(p * goals.length))] ?? 0;
  return {
    matches: n,
    goalsPerMatch: per(acc.goals, n),
    homeWinPct: pct(acc.homeWins, n),
    drawPct: pct(acc.draws, n),
    awayWinPct: pct(acc.awayWins, n),
    redsPerMatch: per(acc.reds, n),
    yellowsPerMatch: per(acc.yellows, n),
    shotsPerMatch: per(acc.shots, n),
    onTargetPerMatch: per(acc.onTarget, n),
    xgPerMatch: per(acc.xg, n),
    foulsPerMatch: per(acc.fouls, n),
    cornersPerMatch: per(acc.corners, n),
    injuriesPerMatch: per(acc.injuries, n),
    penaltiesPerMatch: per(acc.penalties, n),
    scorerP50: q(0.5),
    scorerP90: q(0.9),
    scorerP99: q(0.99),
    scorerMax: goals.at(-1) ?? 0,
    singleGoalShare: pct(goals.filter((g) => g === 1).length, goals.length),
    msPerMatch: per(acc.ms, n),
  };
}

/** Criterios de aceptación de la Fase 2 (DISEÑO §7). */
export const TARGETS = {
  goalsPerMatch: [2.5, 2.9],
  homeWinPct: [42, 47],
  drawPct: [24, 28],
  redsPerMatch: [0.1, 0.2],
} as const;

export function checkTargets(s: Summary): { key: string; value: number; range: readonly [number, number]; ok: boolean }[] {
  return Object.entries(TARGETS).map(([key, range]) => {
    const value = s[key as keyof typeof TARGETS];
    return { key, value, range, ok: value >= range[0] && value <= range[1] };
  });
}

/** Solo partidos de liga de las ligas jugables cuentan para las métricas (como en la realidad). */
export function isLeagueMatch(world: World, played: PlayedMatch): boolean {
  return world.competitions[played.match.competitionId]?.kind === "league";
}

/**
 * Compara el motor completo y el rápido sobre los mismos emparejamientos (todos contra
 * todos de cada liga jugable, ida y vuelta), sin tocar el mundo.
 */
export function compareEngines(world: World, rounds = 1): { full: Summary; quick: Summary } {
  const full = newAccumulator();
  const quick = newAccumulator();
  const ratings = new Map<string, number>();
  const root = worldRng(world);
  const day = world.meta.today as GameDay;
  for (const league of Object.values(world.leagues).sort((a, b) => a.id.localeCompare(b.id))) {
    const clubs = league.clubs;
    for (let r = 0; r < rounds; r++) {
      for (const home of clubs) {
        for (const away of clubs) {
          if (home === away) continue;
          const m: Match = {
            id: `cmp_${r}_${home}_${away}` as MatchId, competitionId: league.currentCompetition!, stage: 0, round: 0,
            home, away, day, candidates: [], neutral: false, decisive: false,
          };
          const t0 = performance.now();
          addReport(full, simulateMatch(buildMatchInput(world, m), root.fork(`cmp/full/${m.id}`)), league.id);
          full.ms += performance.now() - t0;
          const t1 = performance.now();
          addReport(quick, quickMatch(world, m, root.fork(`cmp/quick/${m.id}`), ratings), league.id);
          quick.ms += performance.now() - t1;
        }
      }
    }
  }
  return { full: summarize(full), quick: summarize(quick) };
}
