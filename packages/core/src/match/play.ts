// Juega un partido del mundo: elige motor según el nivel de detalle y aplica las consecuencias.

import type { Rng } from "../rng/rng";
import type { Match, World } from "../types/domain";
import { isNationalTeamId } from "../types/ids";
import { applyReport } from "./apply";
import { simulateMatch } from "./engine";
import { buildMatchInput } from "./lineup";
import { quickMatch, updateElo } from "./quick";
import type { MatchInput, MatchReport } from "./types";

/**
 * "auto": motor completo salvo entre dos clubes en sombra (LOD ligero). Con humanos en la
 * partida (DISEÑO §2.2), el motor completo se reserva para lo que ven: sus ligas, sus clubes y
 * las selecciones con jugadores suyos; el resto del mundo juega con el modelo rápido, calibrado
 * contra el completo.
 */
export type EngineMode = "auto" | "full" | "quick";

const humanLeagues = new WeakMap<World, { key: string; leagues: Set<string> }>();

function leaguesWithHumans(world: World): Set<string> | null {
  const ids = Object.keys(world.managers);
  if (!ids.length) return null;
  const clubs = ids.map((id) => world.managers[id]!.clubId).filter((c): c is NonNullable<typeof c> => !!c).sort();
  const key = clubs.map((c) => `${c}:${world.clubs[c]?.leagueId ?? ""}`).join(",");
  const cached = humanLeagues.get(world);
  if (cached?.key === key) return cached.leagues;
  const leagues = new Set(clubs.map((c) => world.clubs[c]?.leagueId).filter((l): l is NonNullable<typeof l> => !!l) as string[]);
  humanLeagues.set(world, { key, leagues });
  return leagues;
}

export function engineFor(world: World, m: Match, mode: EngineMode): "full" | "quick" {
  if (mode !== "auto") return mode;
  const light = (id: string) => !isNationalTeamId(id) && world.clubs[id]?.lod === "light";
  if (light(m.home) && light(m.away)) return "quick";
  const human = leaguesWithHumans(world);
  if (!human) return "full";
  // Una selección se ve si convoca a alguien de un club dirigido por un humano.
  const seen = (id: string) => isNationalTeamId(id)
    ? (world.nationalTeams[id]?.squad ?? []).some((pid) => !!world.dressing[world.players[pid]?.clubId ?? ""])
    : human.has(world.clubs[id]?.leagueId ?? "") || !!world.dressing[id];
  return seen(m.home) || seen(m.away) ? "full" : "quick";
}

export interface PlayedMatch {
  match: Match;
  engine: "full" | "quick";
  report: MatchReport;
  /** Entrada del motor completo: con ella y `report.seedPath` el partido se repite idéntico. */
  input?: MatchInput;
}

export interface PlayOptions {
  mode: EngineMode;
  frames?: boolean;
  /** Caché de niveles de equipo del día (modelo rápido). */
  ratings: Map<string, number>;
  /** Goles previos de la eliminatoria vistos desde el local de este partido. */
  aggregate?: [number, number];
}

export function playMatch(world: World, m: Match, rng: Rng, opts: PlayOptions): PlayedMatch {
  const engine = engineFor(world, m, opts.mode);
  let played: PlayedMatch;
  if (engine === "full") {
    const input = buildMatchInput(world, m, opts.aggregate);
    played = { match: m, engine, report: simulateMatch(input, rng, { frames: opts.frames ?? false }), input };
  } else {
    played = { match: m, engine, report: quickMatch(world, m, rng, opts.ratings, opts.aggregate) };
  }
  applyReport(world, m, played.report, engine);
  updateElo(world, m);
  return played;
}
