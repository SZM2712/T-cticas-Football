// Lógica pura de la importación (sin red): convierte la respuesta de football-data.org
// en clubes y jugadores del juego, conservando niveles conocidos. Se prueba sin red.

import {
  NATIONS, REAL_LEAGUES, REAL_PLAYERS, REAL_SHADOW_CLUBS, normalizeClubName, normalizePersonName,
  type RealClub, type RealDataUpdate, type RealPlayerRecord,
} from "@tf/data";
import { REVIEWED_RATINGS } from "./reviewed";

/** Forma mínima de la respuesta de /v4/competitions/{code}/teams. */
export interface FdTeam {
  name: string;
  shortName?: string;
  tla?: string;
  founded?: number | null;
  clubColors?: string | null;
  venue?: string | null;
  address?: string | null;
  squad?: FdPlayer[];
}
export interface FdPlayer {
  name: string;
  position?: string | null;
  dateOfBirth?: string | null;
  nationality?: string | null;
}

export interface CompetitionSource {
  code: string;
  nation: string;
  /** División jugable (1 o 2) o "shadow" (solo clubes reales en sombra ya conocidos). */
  tier: 1 | 2 | "shadow";
}

/** Competiciones del plan gratuito de football-data.org que nos sirven. */
export const SOURCES: CompetitionSource[] = [
  { code: "PL", nation: "GB-ENG", tier: 1 },
  { code: "ELC", nation: "GB-ENG", tier: 2 },
  { code: "PD", nation: "ES", tier: 1 },
  { code: "SA", nation: "IT", tier: 1 },
  { code: "BL1", nation: "DE", tier: 1 },
  { code: "FL1", nation: "FR", tier: 1 },
  { code: "PPL", nation: "PT", tier: "shadow" },
  { code: "DED", nation: "NL", tier: "shadow" },
  { code: "BSA", nation: "BR", tier: "shadow" },
  { code: "CL", nation: "", tier: "shadow" },
];

// ── Naciones ───────────────────────────────────────────────────────────────

const NATIONALITY_OVERRIDES: Record<string, string> = {
  england: "GB-ENG", scotland: "GB-SCT", wales: "GB-WLS", "northern ireland": "GB-NIR",
  "korea republic": "KR", "south korea": "KR", "cote d'ivoire": "CI", "côte d’ivoire": "CI", "ivory coast": "CI",
  "congo dr": "CD", "dr congo": "CD", turkey: "TR", turkiye: "TR", türkiye: "TR", usa: "US", "united states": "US",
  "bosnia-herzegovina": "BA", "bosnia and herzegovina": "BA", "cape verde islands": "CV", "cape verde": "CV",
  "czech republic": "CZ", czechia: "CZ", kosovo: "XK", "republic of ireland": "IE", ireland: "IE",
  "north macedonia": "MK", iran: "IR", russia: "RU", "china pr": "CN", vietnam: "VN", "the gambia": "GM",
  gambia: "GM", palestine: "PS", syria: "SY", curacao: "CW", "curaçao": "CW",
};

let nationIndex: Map<string, string> | null = null;
export function nationCode(nationality: string | null | undefined): string | null {
  if (!nationality) return null;
  if (!nationIndex) {
    nationIndex = new Map();
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    for (const n of NATIONS) {
      if (n.code.includes("-")) continue;
      const name = dn.of(n.code);
      if (name) nationIndex.set(normalizePersonName(name), n.code);
    }
    for (const [k, v] of Object.entries(NATIONALITY_OVERRIDES)) nationIndex.set(normalizePersonName(k), v);
  }
  return nationIndex.get(normalizePersonName(nationality)) ?? null;
}

// ── Posiciones ─────────────────────────────────────────────────────────────

const POSITION_MAP: Record<string, string> = {
  goalkeeper: "GK", defence: "CB", "centre-back": "CB", "left-back": "LB", "right-back": "RB",
  midfield: "CM", "defensive midfield": "DM", "central midfield": "CM", "attacking midfield": "AM",
  "left midfield": "LM", "right midfield": "RM", offence: "ST", "left winger": "LW", "right winger": "RW",
  "centre-forward": "ST", "second striker": "ST",
};
export function positionCode(position: string | null | undefined): string | null {
  return position ? (POSITION_MAP[position.trim().toLowerCase()] ?? null) : null;
}

// ── Clubes ─────────────────────────────────────────────────────────────────

/** Nombres de la API que no se resuelven por similitud. */
const CLUB_ALIASES: Record<string, string> = {
  "lille osc": "LOSC Lille",
  "fc internazionale milano": "Inter",
  "rcd espanyol de barcelona": "Espanyol",
};

const tokens = (name: string) => new Set(normalizeClubName(name).split(" ").filter(Boolean));

export function allKnownClubs(): RealClub[] {
  const list: RealClub[] = [];
  for (const pack of Object.values(REAL_LEAGUES)) list.push(...pack.tier1, ...pack.tier2, ...pack.tier3);
  for (const clubs of Object.values(REAL_SHADOW_CLUBS)) list.push(...clubs);
  return list;
}

/** Club conocido más parecido (por alias, nombre normalizado y solapamiento de palabras). */
export function matchClub(apiName: string, candidates: readonly RealClub[]): RealClub | null {
  const alias = CLUB_ALIASES[apiName.trim().toLowerCase()];
  if (alias) return candidates.find((c) => c.n === alias) ?? null;
  const t = tokens(apiName);
  let best: { club: RealClub; score: number } | null = null;
  for (const c of candidates) {
    const u = tokens(c.n);
    const inter = [...t].filter((x) => u.has(x)).length;
    if (!inter) continue;
    const score = inter / new Set([...t, ...u]).size;
    if (!best || score > best.score) best = { club: c, score };
  }
  return best && best.score >= 0.34 ? best.club : null;
}

const COLOR_WORDS: Record<string, string> = {
  red: "#C8102E", white: "#FFFFFF", black: "#000000", blue: "#0057B8", "navy blue": "#0B1F41", navy: "#0B1F41",
  "sky blue": "#6CABDD", "light blue": "#87D8F7", "royal blue": "#1D428A", claret: "#7A263A", maroon: "#8B1E3F",
  burgundy: "#8B1E3F", yellow: "#FFE500", gold: "#C39E6D", green: "#00843D", orange: "#F58025", purple: "#5B2C83",
  grey: "#8A8D8F", gray: "#8A8D8F", amber: "#FFBF00", violet: "#5B2C83",
};
function parseColors(raw: string | null | undefined): [string, string] {
  const parts = (raw ?? "").toLowerCase().split("/").map((p) => p.trim());
  const pick = (p: string | undefined) => (p ? (COLOR_WORDS[p] ?? COLOR_WORDS[p.split(" ").pop() ?? ""]) : undefined);
  return [pick(parts[0]) ?? "#0057B8", pick(parts[1]) ?? "#FFFFFF"];
}

// ── Jugadores ──────────────────────────────────────────────────────────────

const playerKey = (name: string, year: number) => `${normalizePersonName(name)}|${year}`;

function indexKnownPlayers(known: readonly RealPlayerRecord[]) {
  const byName = new Map<string, RealPlayerRecord>();
  const byLast = new Map<string, RealPlayerRecord[]>();
  const byNameNation = new Map<string, RealPlayerRecord[]>();
  for (const r of known) {
    byName.set(playerKey(r.name, r.birthYear), r);
    if (r.knownAs) byName.set(playerKey(r.knownAs, r.birthYear), r);
    for (const n of [r.name, r.knownAs]) {
      if (!n) continue;
      const k = `${normalizePersonName(n)}|${r.nation}`;
      byNameNation.set(k, [...(byNameNation.get(k) ?? []), r]);
    }
    const last = normalizePersonName(r.name).split(" ").pop()!;
    const k = `${last}|${r.birthYear}|${r.nation}`;
    byLast.set(k, [...(byLast.get(k) ?? []), r]);
  }
  return (name: string, year: number, nation: string): RealPlayerRecord | undefined => {
    const exact = byName.get(playerKey(name, year));
    if (exact) return exact;
    // La fuente a veces trae la fecha de nacimiento mal: nombre + nacionalidad, si es único.
    const sameName = byNameNation.get(`${normalizePersonName(name)}|${nation}`) ?? [];
    if (sameName.length === 1) return sameName[0];
    const last = normalizePersonName(name).split(" ").pop()!;
    const candidates = byLast.get(`${last}|${year}|${nation}`) ?? [];
    if (candidates.length === 1) return candidates[0];
    // Último recurso: mismo año y nación con nombre parecido (guiones, apóstrofos, apellidos
    // compuestos, nombres de una palabra como "Raúl" o "Johnny").
    const fuzzy = known.filter((r) => r.birthYear === year && r.nation === nation && namesLookAlike(name, r));
    return fuzzy.length === 1 ? fuzzy[0] : undefined;
  };
}

/** Similitud de Levenshtein normalizada (0..1). */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[n]! / Math.max(m, n, 1);
}

const compact = (s: string) => normalizePersonName(s).replace(/[^a-z ]/g, "");

export function namesLookAlike(apiName: string, r: RealPlayerRecord): boolean {
  const api = compact(apiName);
  const apiTokens = api.split(" ").filter(Boolean);
  for (const candidate of [r.name, r.knownAs]) {
    if (!candidate) continue;
    const k = compact(candidate);
    const kTokens = k.split(" ").filter(Boolean);
    if (similarity(api.replace(/ /g, ""), k.replace(/ /g, "")) >= 0.82) return true;
    // "Aitor Paredes Casamichana" ⊇ "Aitor Paredes"; "Raúl" ∈ "Raúl Asencio".
    const [small, big] = apiTokens.length <= kTokens.length ? [apiTokens, kTokens] : [kTokens, apiTokens];
    if (small.length && small.every((t) => big.some((b) => similarity(t, b) >= 0.8))) return true;
  }
  return false;
}

/** Nivel provisional para un jugador nuevo: según la fuerza del club, la edad y la posición. */
export function estimateRating(clubQuality: number, age: number, position: string): number {
  // Sin datos de rendimiento, un fichaje desconocido se asume de rotación, no titular.
  let r = clubQuality - 0.2;
  if (age < 19) r -= 2.6;
  else if (age < 21) r -= 1.6;
  else if (age < 23) r -= 0.8;
  else if (age > 33) r -= 1.0;
  else if (age > 30) r -= 0.4;
  if (position === "GK") r -= 0.4;
  return Math.round(Math.max(8, Math.min(18, r)) * 10) / 10;
}

export interface ImportResult {
  update: RealDataUpdate;
  players: RealPlayerRecord[];
  report: {
    clubsMatched: number;
    clubsNew: string[];
    playersKept: number;
    playersNew: number;
    skipped: string[];
    /** Jugadores conocidos de clubes importados que ya no están en esa plantilla (¿traspaso a otra liga?). */
    missing: string[];
  };
}

/**
 * Convierte las plantillas de la API. `responses`: competición → equipos con plantilla.
 * Los jugadores conocidos conservan nivel, apodo y nacionalidad deportiva; los nuevos
 * reciben un nivel estimado marcado como tal.
 */
export function buildImport(
  responses: { source: CompetitionSource; teams: FdTeam[] }[],
  season: string,
  today: Date,
  known: readonly RealPlayerRecord[] = REAL_PLAYERS,
): ImportResult {
  const knownClubs = allKnownClubs();
  const findKnown = indexKnownPlayers(known);
  const shadowNames = new Set(Object.values(REAL_SHADOW_CLUBS).flat().map((c) => c.n));
  const update: RealDataUpdate = { source: "football-data.org", importedAt: today.toISOString(), season, leagues: [] };
  const players: RealPlayerRecord[] = [];
  const report: ImportResult["report"] = { clubsMatched: 0, clubsNew: [], playersKept: 0, playersNew: 0, skipped: [], missing: [] };
  const seen = new Set<RealPlayerRecord>();
  const done = new Set<string>();

  for (const { source, teams } of responses) {
    const leagueClubs: RealClub[] = [];
    for (const team of teams) {
      const matched = matchClub(team.name, knownClubs);
      if (source.tier === "shadow" && (!matched || !shadowNames.has(matched.n))) continue;
      const club: RealClub = matched
        ? { ...matched }
        : {
            n: team.name.replace(/\s+(FC|CF|AFC)$/i, "").trim(),
            ...(team.shortName ? { s: team.shortName } : {}),
            c: team.shortName ?? team.name,
            q: source.tier === 1 ? 12.8 : 10.8,
            col: parseColors(team.clubColors),
            ...(team.venue ? { st: [team.venue, 20000] as [string, number] } : {}),
            ...(team.founded ? { f: team.founded } : {}),
          };
      if (matched) report.clubsMatched++;
      else report.clubsNew.push(club.n);
      if (source.tier !== "shadow") leagueClubs.push(club);
      if (done.has(club.n)) continue;
      done.add(club.n);

      for (const p of team.squad ?? []) {
        const nation = nationCode(p.nationality);
        const position = positionCode(p.position);
        const year = p.dateOfBirth ? Number(p.dateOfBirth.slice(0, 4)) : NaN;
        if (!nation || !position || !Number.isFinite(year)) {
          report.skipped.push(`${p.name} (${club.n}): ${!nation ? `nacionalidad "${p.nationality}"` : !position ? `posición "${p.position}"` : "sin fecha de nacimiento"}`);
          continue;
        }
        const old = findKnown(p.name, year, nation);
        const plausible = (y: number) => today.getUTCFullYear() - y >= 15 && today.getUTCFullYear() - y <= 45;
        if (!plausible(year) && !old) {
          report.skipped.push(`${p.name} (${club.n}): fecha de nacimiento errónea en la fuente (${p.dateOfBirth})`);
          continue;
        }
        const age = today.getUTCFullYear() - year;
        const record: RealPlayerRecord = old
          ? { ...old, club: club.n, position: old.position || position }
          : { club: club.n, name: p.name, position, birthYear: year, nation, rating: estimateRating(club.q, age, position), estimated: true };
        const reviewed = REVIEWED_RATINGS[`${p.name}|${year}`] ?? (old ? REVIEWED_RATINGS[`${old.name}|${old.birthYear}`] : undefined);
        if (reviewed !== undefined) {
          record.rating = reviewed;
          delete record.estimated;
        }
        if (old) {
          report.playersKept++;
          seen.add(old);
        }
        else report.playersNew++;
        players.push(record);
      }
    }
    if (source.tier !== "shadow" && leagueClubs.length) update.leagues.push({ nation: source.nation, tier: source.tier, clubs: leagueClubs });
  }
  // Conocidos de clubes que la fuente no cubre (p. ej. Arabia Saudí, MLS): se conservan.
  for (const r of known) {
    if (seen.has(r)) continue;
    if (done.has(r.club)) report.missing.push(`${r.knownAs ?? r.name} (${r.club})`);
    else players.push(r);
  }
  return { update, players, report };
}
