// Web Worker que hospeda el juego (GameHost). Todo el estado vive aquí.

import {
  advanceDay, applyCommand, competitionResultsView, displayName, hashValue, leagueOptions, leagueTableView, newGame, squadView, tacticsView,
  teamFixturesView, teamRef, topScorersView, type Game, type GenerateOptions, type PlayedMatch,
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

function step(frames?: ReadonlySet<string>): PlayedMatch[] {
  const list = advanceDay(need(), frames ? { frames } : {});
  played += list.length;
  return list;
}

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

function toWatched(p: PlayedMatch): WatchedMatch {
  const w = need().world;
  const names: Record<string, string> = {};
  for (const line of p.report.players) names[line.id] = displayName(w.players[line.id]!);
  for (const id of [...p.report.lineups[0], ...p.report.lineups[1]]) names[id] ??= displayName(w.players[id]!);
  const m = p.match;
  const colors = (team: string, fallback: [string, string]): [string, string] => {
    const c = w.clubs[team]?.colors;
    return c ? [c.primary, c.secondary] : fallback;
  };
  const home = colors(m.home, ["#d32f2f", "#ffffff"]);
  const away = colors(m.away, ["#1565c0", "#ffffff"]);
  // Si los colores principales se parecen, el visitante juega con su segundo color.
  const awayColor = colorDistance(home[0], away[0]) < 120 ? (colorDistance(home[0], away[1]) < 120 ? "#ffffff" : away[1]) : away[0];
  return {
    fixture: {
      id: m.id, day: m.day, competitionKey: w.competitions[m.competitionId]?.nameKey ?? "",
      home: teamRef(w, m.home), away: teamRef(w, m.away), score: [m.result!.home, m.result!.away], engine: p.engine,
      ...(m.result!.pens ? { pens: m.result!.pens } : {}),
    },
    report: p.report,
    engine: p.engine,
    names,
    colors: [home[0], awayColor],
  };
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
  watch({ match }) {
    const w = need().world;
    const m = w.matches[match];
    if (!m || m.result) return null;
    while (w.meta.today < m.day - 1) step();
    const p = step(new Set([match])).find((x) => x.match.id === match);
    lastWatched = p ? toWatched(p) : null;
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
