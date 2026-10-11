// Jugadores reales (paquete opcional). Fuente embebida: plantillas aproximadas 2025/26
// de primera división de las 5 ligas; se puede sustituir por un CSV propio.

import { ENG_PLAYERS } from "./eng";
import { ESP_PLAYERS } from "./esp";
import { FRA_PLAYERS } from "./fra";
import { GER_PLAYERS } from "./ger";
import { ITA_PLAYERS } from "./ita";
import { OTHER_PLAYERS } from "./others";

export interface RealPlayerRecord {
  /** Club real exacto (nombre `n` de REAL_LEAGUES / REAL_SHADOW_CLUBS). */
  club: string;
  name: string;
  /** Nombre por el que se le conoce (Pedri, Vinícius Júnior…). */
  knownAs?: string;
  position: string;
  birthYear: number;
  /** Código de nación del juego (ES, GB-ENG, BR…): la selección por la que juega. */
  nation: string;
  /** Nivel estimado en la escala del juego (1–20). */
  rating: number;
}

function parse(map: Record<string, string>): RealPlayerRecord[] {
  const out: RealPlayerRecord[] = [];
  for (const [club, text] of Object.entries(map)) {
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const [name, position, year, nation, rating, knownAs] = line.split("|").map((x) => x.trim());
      const record: RealPlayerRecord = {
        club,
        name: name!,
        position: position!,
        birthYear: Number(year),
        nation: nation!,
        rating: Number(rating),
      };
      if (knownAs) record.knownAs = knownAs;
      out.push(record);
    }
  }
  return out;
}

export const REAL_PLAYERS: readonly RealPlayerRecord[] = [
  ...parse(ENG_PLAYERS),
  ...parse(ESP_PLAYERS),
  ...parse(ITA_PLAYERS),
  ...parse(GER_PLAYERS),
  ...parse(FRA_PLAYERS),
  ...parse(OTHER_PLAYERS),
];

const CSV_HEADER = ["club", "name", "known_as", "position", "birth_year", "nation", "rating"] as const;

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Exporta a CSV (para editar en una hoja de cálculo). */
export function realPlayersToCsv(records: readonly RealPlayerRecord[]): string {
  const rows = records.map((r) =>
    [r.club, r.name, r.knownAs ?? "", r.position, String(r.birthYear), r.nation, String(r.rating)].map(csvField).join(","),
  );
  return [CSV_HEADER.join(","), ...rows].join("\n") + "\n";
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === ";") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

/**
 * Lee un CSV con cabecera (club,name,known_as,position,birth_year,nation,rating; acepta
 * coma o punto y coma). Devuelve los registros y los errores por línea.
 */
export function realPlayersFromCsv(text: string): { records: RealPlayerRecord[]; errors: string[] } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  const header = splitCsvLine(lines[0] ?? "").map((h) => h.toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const errors: string[] = [];
  for (const name of CSV_HEADER) if (name !== "known_as" && col(name) < 0) errors.push(`Falta la columna "${name}"`);
  if (errors.length) return { records: [], errors };
  const records: RealPlayerRecord[] = [];
  lines.slice(1).forEach((line, i) => {
    const f = splitCsvLine(line);
    const get = (name: string) => (col(name) >= 0 ? (f[col(name)] ?? "") : "");
    const record: RealPlayerRecord = {
      club: get("club"),
      name: get("name"),
      position: get("position").toUpperCase(),
      birthYear: Number(get("birth_year")),
      nation: get("nation"),
      rating: Number(get("rating").replace(",", ".")),
    };
    if (get("known_as")) record.knownAs = get("known_as");
    if (!record.club || !record.name || !Number.isFinite(record.birthYear) || !Number.isFinite(record.rating)) {
      errors.push(`Línea ${i + 2}: datos incompletos`);
      return;
    }
    records.push(record);
  });
  return { records, errors };
}
