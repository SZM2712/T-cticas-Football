// Carga del paquete de datos reales (opcional, regla 7): jugadores y ligas importados
// en packages/data/current. Solo se importa dinámicamente si el usuario lo pide.

import { realPlayersFromCsv, type RealDataUpdate } from "@tf/data";
import type { GenerateOptions } from "@tf/core";
import csv from "../../../packages/data/current/players.csv?raw";
import leagues from "../../../packages/data/current/leagues.json";

export function loadCurrentRealData(): Pick<GenerateOptions, "players" | "leagues"> {
  const { records, errors } = realPlayersFromCsv(csv);
  if (errors.length) throw new Error(errors.slice(0, 3).join("\n"));
  return { players: records, leagues: leagues as unknown as RealDataUpdate };
}
