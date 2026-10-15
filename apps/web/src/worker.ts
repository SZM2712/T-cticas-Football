// Web Worker que hospeda el juego (GameHost). Todo el estado vive aquí.

import {
  advanceDay, applyCommand, commitmentsView, competitionResultsView, dressingRoomView, inboxView, managersView, playerSocialView, displayName, playerDevelopmentView, finishLive, hashValue, liveIntervene, liveReport, simulateWithInterventions, worldRng, leagueOptions, leagueTableView, newGame, squadView, tacticsView,
  teamFixturesView, teamRef, topScorersView, type Game, type GenerateOptions, type Match, type MatchReport,
  type MatchInput, type TeamId,
} from "@tf/core";
import type { Api, Request, Response, Summary, WatchedMatch } from "./protocol";

let game: Game | null = null;
let played = 0;
let lastWatched: WatchedMatch | null = null;

function need(): Game {
  if (!game) throw new Error("No hay partida");
  return game;
}

function summary(): Summary {
  const g = need();
  return { seed: g.world.meta.seed, today: g.world.meta.today, season: g.world.meta.season, real: g.world.meta.dataPack === "real", played };
}

function step(live?: string) {
  const list = advanceDay(need(), live ? { live } : {});
  played += list.length;
  return list;
}

/** Equipo del usuario en el partido en directo. */
let liveTeam: TeamId | null = null;

function colorDistance(a: string, b: string): number {
  const rgb = (h: string) => {
    const x = h.replace("#", "");
    const full = x.length === 3 ? x.split("").map((c) => c + c).join("") : x;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0);
  };
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.hypot(r1! - r2!, g1! - g2!, b1! - b2!);
}

function toWatched(m: Match, report: MatchReport, input: MatchInput | undefined, engine: "full" | "quick", live: boolean): WatchedMatch {
  const w = need().world;
  const names: Record<string, string> = {};
  const add = (id: string) => (names[id] ??= displayName(w.players[id]!));
  for (const line of report.players) add(line.id);
  for (const id of [...report.lineups[0], ...report.lineups[1]]) add(id);
  const squads: WatchedMatch["squads"] = [[], []];
  if (input) {
    [input.home, input.away].forEach((sheet, side) => {
      for (const [list, bench] of [[sheet.xi, false], [sheet.bench, true]] as const) {
        for (const p of list) {
          add(p.id);
          squads[side]!.push({ id: p.id, position: p.position, bench });
        }
      }
    });
  }
  const colors = (team: string, fallback: [string, string]): [string, string] => {
    const c = w.clubs[team]?.colors;
    return c ? [c.primary, c.secondary] : fallback;
  };
  const home = colors(m.home, ["#d32f2f", "#ffffff"]);
  const away = colors(m.away, ["#1565c0", "#ffffff"]);
  // Si los colores principales se parecen, el visitante juega con su segundo color.
  const awayColor = colorDistance(home[0], away[0]) < 120 ? (colorDistance(home[0], away[1]) < 120 ? "#ffffff" : away[1]) : away[0];
  const side = liveTeam === m.home ? 0 : liveTeam === m.away ? 1 : null;
  return {
    fixture: {
      id: m.id, day: m.day, competitionKey: w.competitions[m.competitionId]?.nameKey ?? "",
      home: teamRef(w, m.home), away: teamRef(w, m.away), score: report.score, engine,
      ...(report.pens ? { pens: report.pens } : {}),
    },
    report,
    engine,
    names,
    colors: [home[0], awayColor],
    live,
    side,
    squads,
    interventions: report.interventions ?? [],
  };
}

function liveWatched(): WatchedMatch {
  const g = need();
  const live = g.live!;
  return toWatched(live.match, liveReport(g, true), live.input, "full", true);
}

/** Fotogramas del partido cerrado: se vuelve a simular con las mismas intervenciones (determinista). */
function liveReportOf(input: MatchInput, report: MatchReport): MatchReport {
  const g = need();
  return simulateWithInterventions(input, worldRng(g.world).fork(input.seedPath), { frames: true }, report.interventions ?? []).report;
}

async function loadReal(): Promise<Pick<GenerateOptions, "players" | "leagues">> {
  // Solo bajo demanda: el paquete real nunca entra en la carga por defecto (regla 7).
  const mod = await import("./real");
  return mod.loadCurrentRealData();
}

const handlers: { [M in keyof Api]: (args: Parameters<Api[M]>[0]) => ReturnType<Api[M]> | Promise<ReturnType<Api[M]>> } = {
  async newGame({ seed, real }) {
    const opts: GenerateOptions = { seed };
    if (real) Object.assign(opts, { dataPack: "real" as const }, await loadReal());
    game = newGame(opts);
    played = 0;
    lastWatched = null;
    return summary();
  },
  summary: () => summary(),
  advance({ days }) {
    for (let i = 0; i < days; i++) step();
    return summary();
  },
  advanceToMatch({ team }) {
    const w = need().world;
    for (let i = 0; i < 400; i++) {
      if (step().some((p) => p.match.home === team || p.match.away === team)) break;
      if (!Object.values(w.matches).some((m) => !m.result && (m.home === team || m.away === team))) break;
    }
    return summary();
  },
  startLive({ match, team }) {
    const g = need();
    const w = g.world;
    const m = w.matches[match];
    if (!m || m.result) return null;
    liveTeam = team;
    while (w.meta.today < m.day - 1) step();
    if (w.meta.today < m.day) step(match);
    if (g.live?.match.id !== match) return null;
    lastWatched = liveWatched();
    return lastWatched;
  },
  intervene({ step: at, side, change }) {
    const r = liveIntervene(need(), { step: at, side, change });
    if (!r.ok) return r;
    lastWatched = liveWatched();
    return { ok: true, match: lastWatched };
  },
  finishLive() {
    const g = need();
    if (!g.live) return lastWatched;
    const input = g.live.input;
    const p = finishLive(g);
    played++;
    // Repetición con fotogramas del partido ya cerrado (idéntico a lo que se vio).
    lastWatched = toWatched(p.match, liveReportOf(input, p.report), input, "full", false);
    return lastWatched;
  },
  lastWatched: () => lastWatched,
  leagues: () => leagueOptions(need().world),
  table: ({ competition }) => leagueTableView(need().world, competition),
  results: ({ competition }) => competitionResultsView(need().world, competition),
  scorers: ({ competition }) => topScorersView(need().world, competition),
  squad: ({ team, competition }) => squadView(need().world, team, competition),
  fixtures: ({ team }) => teamFixturesView(need().world, team, 5, 8),
  tactics: ({ team }) => tacticsView(need().world, team),
  player: ({ id }) => playerDevelopmentView(need().world, id as never),
  dressing: ({ team }) => dressingRoomView(need().world, team as never),
  inbox: ({ team }) => inboxView(need().world, team as never),
  commitments: ({ team }) => commitmentsView(need().world, team as never),
  playerSocial: ({ id }) => playerSocialView(need().world, id),
  managers: () => managersView(need().world),
  command: ({ cmd }) => applyCommand(need().world, cmd),
  hash: () => hashValue(need().world),
};

// Acceso de depuración desde la consola o desde tests de navegador: `await tf("hash", {})`.
self.onmessage = async (e: MessageEvent<Request>) => {
  const { id, method, args } = e.data;
  let res: Response;
  try {
    const fn = handlers[method] as (a: unknown) => unknown;
    res = { id, ok: true, data: await fn(args) };
  } catch (err) {
    res = { id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  (self as unknown as Worker).postMessage(res);
};
