// Generación del mundo (Fase 1). Cada parte usa su propio stream RNG derivado por
// nombre, de modo que cambiar la generación de un club no altera la de los demás.

import {
  NATION_LEAGUES, NATIONS, PLAYABLE_CITIES, REAL_LEAGUES, REAL_SHADOW_CLUBS, nationByCode, type CityData, type NationData,
  REAL_PLAYERS, type RealClub, type RealPlayerRecord,
} from "@tf/data";
import { SQUAD_TEMPLATE, type Position } from "../config/attributes";
import {
  AGE_MAX, AGE_MEAN, AGE_MIN, AGE_SD, DEFAULT_START_YEAR, DEPTH_OFFSETS, ELO_BASE, ELO_STRENGTH_K, GENERATOR_VERSION,
  PROSPECTS_PER_SQUAD, PROSPECT_OFFSET, REFEREES_OTHER, REFEREES_PLAYABLE, SAVE_VERSION, SHADOW_CLUBS_A,
  SHADOW_CLUBS_B, SHADOW_FOREIGN_SHARE, SHADOW_QUALITY_BASE, SHADOW_QUALITY_K, SHADOW_QUALITY_STEP,
  SHADOW_SQUAD_SIZE, SHADOW_TIER3_OFFSET, STAFF_PER_CLUB, VETERAN_CA_PENALTY, YOUTH_CA_PENALTY,
} from "../config/generation";
import { currentAbility } from "../player/ability";
import { Rng } from "../rng/rng";
import { ageOn, dayOf, seasonStartDay } from "../time/calendar";
import type { Club, League, Nation, NationalTeam, Player, SquadStatus, World } from "../types/domain";
import {
  nationalTeamIdOf, type ClubId, type GameDay, type LeagueId, type NationId, type PlayerId, type StaffId,
} from "../types/ids";
import { clamp, clamp01, round } from "../util/math";
import { nextId } from "../world/ids";
import { generateClub } from "./clubs";
import { generatePlayer } from "./player";
import { normalizePosition, splitName, validateRealPlayers } from "./realPlayers";
import { generateStaff } from "./staff";

export interface GenerateOptions {
  seed: string | number;
  startYear?: number;
  /**
   * "fictional" (por defecto): todo inventado. "real": clubes reales con su fuerza
   * aproximada (paquete opcional de @tf/data); los jugadores siguen siendo ficticios.
   */
  dataPack?: "fictional" | "real";
  /**
   * Jugadores reales (solo con dataPack "real"). Si no se pasan, se usa el pack embebido
   * de @tf/data; la CLI puede cargarlos de un CSV. Los huecos de cada plantilla se
   * completan con jugadores ficticios.
   */
  players?: readonly RealPlayerRecord[];
}

interface Place {
  city: string;
  place: string;
  pop: number;
}

/** Reparte `count` clubes entre ciudades según población; las grandes reciben varios (distritos). */
function pickPlaces(rng: Rng, cities: readonly CityData[], count: number): Place[] {
  const used = new Map<string, number>();
  const districts = new Map(cities.map((c) => [c.name, rng.shuffle(c.districts ?? [])]));
  const capacity = (c: CityData) => Math.min(1 + (c.districts?.length ?? 0), 1 + Math.floor(c.pop / 600));
  const places: Place[] = [];
  for (let i = 0; i < count; i++) {
    const open = cities.filter((c) => (used.get(c.name) ?? 0) < capacity(c));
    if (!open.length) throw new Error("No hay ciudades suficientes para los clubes");
    const city = rng.weighted(open, (c) => Math.pow(c.pop, 0.7) / (1 + 1.5 * (used.get(c.name) ?? 0)));
    const n = used.get(city.name) ?? 0;
    used.set(city.name, n + 1);
    places.push({ city: city.name, place: n === 0 ? city.name : districts.get(city.name)![n - 1]!, pop: city.pop });
  }
  return places;
}

/** Calidad de un club según su puesto en la liga: cola larga (pocos clubes muy fuertes). */
function leagueQuality(rng: Rng, rank: number, teams: number, quality: number, spread: number): number {
  const x = teams > 1 ? rank / (teams - 1) : 0;
  return quality + spread * (Math.pow(1 - x, 1.6) - 0.385) + rng.normal(0, 0.2);
}

const FOREIGN_CACHE = new Map<string, { nations: NationData[]; base: number[] }>();

/** Nacionalidad de un extranjero: talento × fuerza^(exponente según nivel del club) × afinidad. */
function pickForeignNation(rng: Rng, host: NationData, clubQuality: number, shadow: boolean): NationData {
  const key = `${host.code}|${shadow}`;
  let entry = FOREIGN_CACHE.get(key);
  if (!entry) {
    const nations = NATIONS.filter((n) => n.code !== host.code);
    const base = nations.map((n) => {
      const shared = n.languages.some((l) => host.languages.includes(l)) ? 3 : 1;
      const confed = n.confed === host.confed ? (shadow ? 5 : 1.5) : 1;
      return n.talent * shared * confed;
    });
    FOREIGN_CACHE.set(key, (entry = { nations, base }));
  }
  const exponent = 2 + 3 * clamp01((clubQuality - 9) / 6);
  const { nations, base } = entry;
  return rng.weighted(nations, (n, i) => base[i]! * Math.pow(n.strength, exponent));
}

function fixedOf(r: RealClub): NonNullable<Parameters<typeof generateClub>[1]["fixed"]> {
  const fixed: NonNullable<Parameters<typeof generateClub>[1]["fixed"]> = { name: r.n, colors: r.col };
  if (r.s) fixed.shortName = r.s;
  if (r.st) fixed.stadium = r.st;
  if (r.f) fixed.founded = r.f;
  return fixed;
}

function squadStatusFor(depth: number, prospect: boolean): SquadStatus {
  if (prospect) return "prospect";
  return depth === 0 ? "firstTeam" : depth === 1 ? "rotation" : "backup";
}

function wageFor(ca: number, club: Club): number {
  const factor = Math.pow(Math.max(1, club.finances.revenue) / 100, 0.6);
  return Math.max(250, Math.round((900 * Math.exp((ca - 8) * 0.5) * factor) / 50) * 50);
}

function generateSquad(
  world: World,
  root: Rng,
  club: Club,
  nation: NationData,
  foreignShare: number,
  size: "full" | "shadow",
  real: readonly RealPlayerRecord[] = [],
): void {
  const rng = root.fork(`gen/squad/${club.id}`);
  const today = world.meta.today;
  const contractEnd = (years: number) => dayOf(world.meta.startYear + years, 6, 30);
  const realByPosition = new Map<Position, number>();

  // Jugadores reales primero (titulares y rotación); luego se rellenan los huecos.
  for (const record of real) {
    const position = normalizePosition(record.position)!;
    realByPosition.set(position, (realByPosition.get(position) ?? 0) + 1);
    const birthDay = (dayOf(record.birthYear, 1, 1) + rng.int(0, 364)) as GameDay;
    const id = nextId<PlayerId>(world, "pl");
    const player = generatePlayer(rng, root, {
      id,
      nation: nationByCode(record.nation),
      position,
      targetCA: record.rating,
      age: Math.max(15, ageOn(birthDay, today)),
      today,
      clubId: club.id,
      homegrown: false,
      youthQuality: club.facilities.youth,
      allowSeed: false,
      fixed: { ...splitName(record.name), ...(record.knownAs ? { knownAs: record.knownAs } : {}), birthDay },
    });
    const ca = currentAbility(player);
    player.contract = {
      clubId: club.id,
      wage: wageFor(ca, club),
      expires: contractEnd(rng.int(1, 5)),
      signed: (today - rng.int(30, 1500)) as GameDay,
      squadStatus: record.rating >= club.quality + 0.8 ? "keyPlayer" : record.rating >= club.quality - 0.3 ? "firstTeam" : "rotation",
    };
    player.reputation = round(clamp01(0.7 * player.reputation + 0.3 * club.reputation), 3);
    world.players[id] = player;
    club.squad.push(id);
  }

  const slots: { position: Position; depth: number; prospect: boolean }[] = [];
  for (const [pos, count] of Object.entries(SQUAD_TEMPLATE) as [Position, number][]) {
    const n = size === "full" ? count : Math.max(1, Math.round((count * SHADOW_SQUAD_SIZE) / 29));
    // Con jugadores reales, los ficticios solo cubren los huecos (como suplentes).
    // Con una plantilla real ya amplia (≥ 20), solo se completan porteros.
    if (real.length >= 20 && pos !== "GK") continue;
    for (let d = realByPosition.get(pos) ?? 0; d < n; d++) slots.push({ position: pos, depth: real.length ? Math.max(d, 2) + 1 : d, prospect: false });
  }
  if (size === "full") {
    const positions = Object.keys(SQUAD_TEMPLATE) as Position[];
    for (let i = 0; i < PROSPECTS_PER_SQUAD; i++) slots.push({ position: rng.pick(positions), depth: 9, prospect: true });
  }
  for (const slot of slots) {
    const age = slot.prospect ? rng.int(17, 19) : Math.round(clamp(rng.normal(AGE_MEAN, AGE_SD), AGE_MIN, AGE_MAX));
    const extraDepth = Math.max(0, slot.depth - (DEPTH_OFFSETS.length - 1));
    const offset = slot.prospect
      ? PROSPECT_OFFSET
      : DEPTH_OFFSETS[Math.min(slot.depth, DEPTH_OFFSETS.length - 1)]! - 0.8 * extraDepth;
    const agePenalty = Math.max(0, 22 - age) * YOUTH_CA_PENALTY + Math.max(0, age - 32) * VETERAN_CA_PENALTY;
    const targetCA = clamp(club.quality + offset - agePenalty + rng.normal(0, 0.45), 3, 19.5);
    const foreign = !slot.prospect && rng.chance(foreignShare * (0.7 + 0.6 * club.reputation));
    const playerNation = foreign ? pickForeignNation(rng, nation, club.quality, size === "shadow") : nation;
    const id = nextId<PlayerId>(world, "pl");
    const player = generatePlayer(rng, root, {
      id,
      nation: playerNation,
      position: slot.position,
      targetCA,
      age,
      today,
      clubId: club.id,
      homegrown: !foreign && (slot.prospect || rng.chance(0.15)),
      youthQuality: club.facilities.youth,
    });
    const ca = currentAbility(player);
    player.contract = {
      clubId: club.id,
      wage: wageFor(ca, club),
      expires: contractEnd(slot.prospect ? rng.int(2, 3) : rng.int(1, 5)),
      signed: (today - rng.int(30, 1500)) as GameDay,
      squadStatus: squadStatusFor(slot.depth, slot.prospect),
    };
    player.reputation = round(clamp01(0.7 * player.reputation + 0.3 * club.reputation), 3);
    world.players[id] = player;
    club.squad.push(id);
  }
}

function addStaff(world: World, root: Rng, club: Club | null, nation: NationData, role: Parameters<typeof generateStaff>[1]["role"], level: number, path: string): StaffId {
  const id = nextId<StaffId>(world, "st");
  const staff = generateStaff(root.fork(path), { id, nation, role, clubId: club?.id ?? null, level, today: world.meta.today });
  world.staff[id] = staff;
  club?.staff.push(id);
  return id;
}

/** Convoca a los 26 mejores elegibles de cada selección (3 porteros, 9 defensas, 8 medios, 6 delanteros). */
export function callUps(world: World): void {
  const byNation = new Map<string, { id: PlayerId; ca: number; line: string }[]>();
  for (const p of Object.values(world.players)) {
    if (p.retired) continue;
    const list = byNation.get(p.internationalNation) ?? [];
    list.push({ id: p.id, ca: currentAbility(p), line: p.position === "GK" ? "GK" : lineOf(p) });
    byNation.set(p.internationalNation, list);
  }
  const quota: Record<string, number> = { GK: 3, DEF: 9, MID: 8, FWD: 6 };
  for (const team of Object.values(world.nationalTeams)) {
    const pool = (byNation.get(team.nation) ?? []).sort((a, b) => b.ca - a.ca || a.id.localeCompare(b.id));
    const chosen: typeof pool = [];
    for (const [line, n] of Object.entries(quota)) chosen.push(...pool.filter((x) => x.line === line).slice(0, n));
    for (const x of pool) {
      if (chosen.length >= 26) break;
      if (!chosen.includes(x)) chosen.push(x);
    }
    team.squad = chosen.sort((a, b) => b.ca - a.ca || a.id.localeCompare(b.id)).map((x) => x.id);
  }
}

function lineOf(p: Player): string {
  switch (p.position) {
    case "CB": case "LB": case "RB": return "DEF";
    case "DM": case "CM": case "LM": case "RM": case "AM": return "MID";
    default: return "FWD";
  }
}

export function generateWorld(opts: GenerateOptions): World {
  const startYear = opts.startYear ?? DEFAULT_START_YEAR;
  const real = opts.dataPack === "real";
  const root = Rng.create(opts.seed);
  const world: World = {
    meta: {
      saveVersion: SAVE_VERSION,
      seed: String(opts.seed),
      startYear,
      today: seasonStartDay(startYear),
      season: startYear,
      generator: GENERATOR_VERSION,
      ...(real ? { dataPack: "real" as const } : {}),
    },
    nations: {},
    nationalTeams: {},
    leagues: {},
    clubs: {},
    players: {},
    staff: {},
    competitions: {},
    matches: {},
    hosts: {},
    history: [],
    events: [],
    idCounters: {},
  };
  const playable = new Set(NATION_LEAGUES.map((l) => l.nation as string));
  for (const n of NATIONS) {
    const nation: Nation = {
      id: n.code as NationId,
      short: n.short,
      confed: n.confed,
      languages: n.languages,
      cultures: n.cultures,
      strength: n.strength,
      talent: n.talent,
      climate: n.climate,
      playable: playable.has(n.code),
    };
    world.nations[n.code] = nation;
  }

  const realPlayers = real ? (opts.players ?? REAL_PLAYERS) : [];
  if (realPlayers.length) {
    const errors = validateRealPlayers(realPlayers);
    if (errors.length) throw new Error(`Jugadores reales con errores:\n${errors.slice(0, 20).join("\n")}`);
  }
  const realByClub = new Map<string, RealPlayerRecord[]>();
  for (const r of realPlayers) (realByClub.get(r.club) ?? realByClub.set(r.club, []).get(r.club)!).push(r);

  const usedNames = new Set<string>();
  const clubNation = new Map<ClubId, { nation: NationData; foreignShare: number }>();

  // Naciones jugables: dos divisiones + nivel en sombra.
  for (const data of NATION_LEAGUES) {
    const nation = nationByCode(data.nation);
    const rng = root.fork(`gen/clubs/${data.nation}`);
    const [d1, d2] = data.tiers;
    const total = d1.teams + d2.teams + data.shadowTierClubs;
    const pack = real ? REAL_LEAGUES[data.nation] : undefined;
    const realClubs = pack ? [...pack.tier1, ...pack.tier2, ...pack.tier3] : [];
    if (pack && (pack.tier1.length !== d1.teams || pack.tier2.length !== d2.teams)) {
      throw new Error(`Paquete real de ${data.nation}: ${pack.tier1.length}/${pack.tier2.length} clubes, se esperaban ${d1.teams}/${d2.teams}`);
    }
    const places: Place[] = pack
      ? realClubs.map((r) => ({ city: r.c, place: r.c, pop: 500 }))
      : pickPlaces(rng, PLAYABLE_CITIES[data.nation]!, total)
          .map((p) => ({ p, score: Math.log10(p.pop) * 0.6 + rng.normal(0, 1) }))
          .sort((a, b) => b.score - a.score)
          .map((x) => x.p);
    const tier1Count = d1.teams;
    const tier2Count = d2.teams;
    const leagues: League[] = [d1, d2].map((tier) => {
      const id = nextId<LeagueId>(world, "lg", 3);
      const league: League = { id, nation: data.nation as NationId, tier: tier.tier, clubs: [], currentCompetition: null };
      world.leagues[id] = league;
      return league;
    });
    places.forEach((place, i) => {
      const tierIndex = i < tier1Count ? 0 : i < tier1Count + tier2Count ? 1 : 2;
      const realClub = realClubs[i];
      const tier = tierIndex === 0 ? d1 : tierIndex === 1 ? d2 : null;
      const rank = tierIndex === 0 ? i : tierIndex === 1 ? i - d1.teams : i - d1.teams - d2.teams;
      const quality = realClub
        ? realClub.q
        : tier
          ? leagueQuality(rng, rank, tier.teams, tier.quality, tier.spread)
          : d2.quality + SHADOW_TIER3_OFFSET + rng.normal(0, 0.5);
      const id = nextId<ClubId>(world, "cl", 4);
      const club = generateClub(rng, {
        id,
        nation,
        city: place.city,
        place: place.place,
        cityPop: place.pop,
        leagueId: tier ? leagues[tierIndex]!.id : null,
        ...(tier ? {} : { shadowTier: 3 }),
        quality,
        leagueRevenue: tier ? tier.revenue : d2.revenue * 0.25,
        ...(realClub ? { fixed: fixedOf(realClub) } : {}),
      }, usedNames);
      world.clubs[id] = club;
      if (tier) leagues[tierIndex]!.clubs.push(id);
      clubNation.set(id, { nation, foreignShare: tier ? tier.foreignShare : d2.foreignShare * 0.5 });
    });
  }

  // Naciones no jugables: clubes en sombra.
  for (const nation of NATIONS) {
    if (playable.has(nation.code)) continue;
    const rng = root.fork(`gen/clubs/${nation.code}`);
    const realShadow = real ? (REAL_SHADOW_CLUBS[nation.code] ?? []) : [];
    const count = realShadow.length || 1 + Math.round(SHADOW_CLUBS_A * nation.strength * nation.strength + SHADOW_CLUBS_B * nation.talent);
    const cities = nation.cities.length ? nation.cities : [nation.short];
    for (let i = 0; i < count; i++) {
      const realClub = realShadow[i];
      const city = realClub?.c ?? cities[i % cities.length]!;
      const quality = realClub?.q ?? SHADOW_QUALITY_BASE + SHADOW_QUALITY_K * nation.strength - SHADOW_QUALITY_STEP * i + rng.normal(0, 0.3);
      const id = nextId<ClubId>(world, "cl", 4);
      const club = generateClub(rng, {
        id,
        nation,
        city,
        place: city,
        cityPop: 800 / (1 + i),
        leagueId: null,
        shadowTier: 1,
        quality,
        leagueRevenue: 4 + 60 * Math.pow(nation.strength, 3),
        ...(realClub ? { fixed: fixedOf(realClub) } : {}),
      }, usedNames);
      world.clubs[id] = club;
      clubNation.set(id, { nation, foreignShare: SHADOW_FOREIGN_SHARE });
    }
  }

  // Plantillas y staff.
  for (const club of Object.values(world.clubs)) {
    const { nation, foreignShare } = clubNation.get(club.id)!;
    const full = club.leagueId !== null;
    generateSquad(world, root, club, nation, foreignShare, full ? "full" : "shadow", realByClub.get(club.name) ?? []);
    const level = clamp(club.quality * 0.85 + 1.5, 4, 19);
    if (full) {
      for (const [role, n] of Object.entries(STAFF_PER_CLUB) as [keyof typeof STAFF_PER_CLUB, number][]) {
        for (let i = 0; i < n; i++) addStaff(world, root, club, nation, role, level, `gen/staff/${club.id}/${role}/${i}`);
      }
    } else {
      addStaff(world, root, club, nation, "headCoach", level, `gen/staff/${club.id}/headCoach/0`);
    }
  }

  // Selecciones, seleccionadores y árbitros.
  for (const n of NATIONS) {
    const rng = root.fork(`gen/national/${n.code}`);
    const id = nationalTeamIdOf(n.code);
    const team: NationalTeam = {
      id,
      nation: n.code as NationId,
      elo: round(ELO_BASE + ELO_STRENGTH_K * n.strength + rng.normal(0, 25), 1),
      coachId: null,
      squad: [],
    };
    team.coachId = addStaff(world, root, null, n, "nationalCoach", 8 + 9 * n.strength, `gen/staff/${id}/coach`);
    world.staff[team.coachId]!.nationalTeamId = id;
    world.nationalTeams[id] = team;
    const referees = playable.has(n.code) ? REFEREES_PLAYABLE : REFEREES_OTHER + (n.strength > 0.6 ? 2 : 0);
    for (let i = 0; i < referees; i++) addStaff(world, root, null, n, "referee", 8 + 8 * n.strength, `gen/staff/ref/${n.code}/${i}`);
  }
  callUps(world);
  return world;
}
