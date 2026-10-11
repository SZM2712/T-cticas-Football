// Juega un partido del mundo: elige motor según el nivel de detalle y aplica las consecuencias.

import type { Rng } from "../rng/rng";
import type { Match, World } from "../types/domain";
import { isNationalTeamId } from "../types/ids";
import { applyReport } from "./apply";
import { simulateMatch } from "./engine";
import { buildMatchInput } from "./lineup";
import { quickMatch, updateElo } from "./quick";
import type { MatchInput, MatchReport } from "./types";

/** "auto": motor completo salvo entre dos clubes en sombra (LOD ligero). */
export type EngineMode = "auto" | "full" | "quick";

export function engineFor(world: World, m: Match, mode: EngineMode): "full" | "quick" {
  if (mode !== "auto") return mode;
  const light = (id: string) => !isNationalTeamId(id) && world.clubs[id]?.lod === "light";
  return light(m.home) && light(m.away) ? "quick" : "full";
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
