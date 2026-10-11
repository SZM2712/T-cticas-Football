// npm run gen -- --seed=123 [--real] [--current] [--players=jugadores.csv] [--leagues=ligas.json] [--export-players=jugadores.csv]
//                 [--seasons=4] [--stats] [--top=20] [--squad="Real Madrid" | --squad=ES] [--out=world.json]
// Genera un mundo, imprime su hash y, opcionalmente, estadísticas y simulación de temporadas
// (con el modelo rápido provisional de la Fase 1).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  advanceSeasons, ageOn, classifyArchetype, currentAbility, displayName, hashValue, newGame, quantile, teamRating,
  type GenerateOptions, type World,
} from "@tf/core";
import { REAL_PLAYERS, realPlayersFromCsv, realPlayersToCsv } from "@tf/data";
import { competitionName, nationName } from "@tf/i18n";

function args(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of process.argv.slice(2)) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) out[m[1]!] = m[2] ?? "true";
  }
  return out;
}

function stats(world: World): void {
  const players = Object.values(world.players);
  const today = world.meta.today;
  const cas = players.map(currentAbility).sort((a, b) => a - b);
  const ages = players.map((p) => ageOn(p.birthDay, today));
  const fmt = (x: number) => x.toFixed(2);
  console.log(`\nJugadores: ${players.length} · clubes: ${Object.keys(world.clubs).length} · staff: ${Object.keys(world.staff).length}`);
  console.log(`CA  P10 ${fmt(quantile(cas, 0.1))} · P50 ${fmt(quantile(cas, 0.5))} · P90 ${fmt(quantile(cas, 0.9))} · P99 ${fmt(quantile(cas, 0.99))} · máx ${fmt(cas.at(-1)!)}`);
  console.log(`Edad media ${fmt(ages.reduce((a, b) => a + b, 0) / ages.length)}`);
  const archetypes: Record<string, number> = {};
  for (const p of players) {
    const a = classifyArchetype(p.psych, ageOn(p.birthDay, today)).primary;
    archetypes[a] = (archetypes[a] ?? 0) + 1;
  }
  console.log("Arquetipos:", Object.entries(archetypes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${((100 * v) / players.length).toFixed(1)}%`).join(" · "));
  for (const league of Object.values(world.leagues)) {
    const clubs = league.clubs.map((id) => world.clubs[id]!);
    const top = clubs.slice().sort((a, b) => b.quality - a.quality).slice(0, 3).map((c) => c.name).join(", ");
    console.log(`${nationName("es", league.nation)} ${league.tier}: ${clubs.length} clubes · más fuertes: ${top}`);
  }
}

/** Clubes más fuertes del mundo según la media de su mejor once. */
function top(world: World, n: number): void {
  const rows = Object.values(world.clubs)
    .map((c) => ({ c, r: teamRating(world, c.id) }))
    .sort((a, b) => b.r - a.r)
    .slice(0, n);
  console.log(`\nLos ${n} clubes más fuertes (media del mejor once):`);
  rows.forEach(({ c, r }, i) => {
    const league = c.leagueId ? `${nationName("es", c.nation)} ${world.leagues[c.leagueId]!.tier}` : nationName("es", c.nation);
    console.log(`${String(i + 1).padStart(3)}. ${c.name.padEnd(28)} ${r.toFixed(2)}  (${league})`);
  });
}

/** Plantilla de un club (por nombre) o convocatoria de una selección (por código: ES, GB-ENG…). */
function squad(world: World, query: string): void {
  const team = world.nationalTeams[`nt_${query}`];
  const club = Object.values(world.clubs).find((c) => c.name.toLowerCase() === query.toLowerCase());
  const ids = team ? team.squad : club?.squad;
  if (!ids) {
    console.log(`\nNo encuentro "${query}" (usa el nombre exacto del club o el código de la selección).`);
    return;
  }
  console.log(`\n${team ? nationName("es", query) : club!.name}:`);
  ids
    .map((id) => world.players[id]!)
    .sort((a, b) => currentAbility(b) - currentAbility(a))
    .forEach((p) => {
      const age = ageOn(p.birthDay, world.meta.today);
      console.log(`  ${p.position.padEnd(3)} ${displayName(p).padEnd(28)} ${String(age).padStart(2)} años  ${p.internationalNation.padEnd(6)} ${currentAbility(p).toFixed(1)}`);
    });
}

function history(world: World): void {
  for (const record of world.history) {
    console.log(`\nTemporada ${record.season}/${String(record.season + 1).slice(2)}`);
    for (const [key, winner] of Object.entries(record.champions)) {
      const name = world.clubs[winner]?.name ?? nationName("es", winner.slice(3));
      if (!key.startsWith("comp.qualifier") && !key.startsWith("comp.nationsLeague.")) console.log(`  ${competitionName("es", key)}: ${name}`);
    }
  }
}

const opts = args();
const seed = opts.seed ?? "123";
const t0 = performance.now();
if (opts["export-players"]) {
  writeFileSync(opts["export-players"], realPlayersToCsv(REAL_PLAYERS));
  console.log(`${REAL_PLAYERS.length} jugadores reales exportados a ${opts["export-players"]}`);
}
const genOpts: GenerateOptions = { seed };
// --current: datos importados con `npm run import:football-data` (packages/data/current).
if (opts.current) {
  const dir = "packages/data/current";
  if (!existsSync(`${dir}/players.csv`)) {
    console.error(`No hay importación en ${dir}. Ejecuta antes: npm run import:football-data`);
    process.exit(1);
  }
  opts.players ??= `${dir}/players.csv`;
  opts.leagues ??= `${dir}/leagues.json`;
}
if (opts.real || opts.players || opts.leagues) genOpts.dataPack = "real";
if (opts.leagues && existsSync(opts.leagues)) genOpts.leagues = JSON.parse(readFileSync(opts.leagues, "utf8"));
if (opts.players) {
  const { records, errors } = realPlayersFromCsv(readFileSync(opts.players, "utf8"));
  if (errors.length) {
    console.error(`Errores en ${opts.players}:\n${errors.join("\n")}`);
    process.exit(1);
  }
  genOpts.players = records;
  console.log(`${records.length} jugadores cargados de ${opts.players}`);
}
let game: ReturnType<typeof newGame>;
try {
  game = newGame(genOpts);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
const genMs = performance.now() - t0;
console.log(`${genOpts.dataPack ? "Datos reales · " : ""}Semilla ${seed} · mundo generado en ${genMs.toFixed(0)} ms · hash ${hashValue(game.world)}`);
if (opts.stats) stats(game.world);
if (opts.top) top(game.world, Number(opts.top) || 20);
if (opts.squad) squad(game.world, opts.squad);
const seasons = Number(opts.seasons ?? 0);
if (seasons > 0) {
  const t1 = performance.now();
  advanceSeasons(game, seasons);
  console.log(`\n${seasons} temporada(s) simuladas en ${((performance.now() - t1) / 1000).toFixed(1)} s · choques de calendario: ${game.ctx.clashes} · hash ${hashValue(game.world)}`);
  history(game.world);
}
if (opts.out) {
  writeFileSync(opts.out, JSON.stringify(game.world));
  console.log(`Mundo guardado en ${opts.out}`);
}
