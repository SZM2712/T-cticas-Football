// npm run gen -- --seed=123 [--seasons=4] [--stats] [--out=world.json]
// Genera un mundo, imprime su hash y, opcionalmente, estadísticas y simulación de temporadas
// (con el modelo rápido provisional de la Fase 1).

import { writeFileSync } from "node:fs";
import {
  advanceSeasons, ageOn, classifyArchetype, currentAbility, hashValue, newGame, quantile, type World,
} from "@tf/core";
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
const game = newGame({ seed });
const genMs = performance.now() - t0;
console.log(`Semilla ${seed} · mundo generado en ${genMs.toFixed(0)} ms · hash ${hashValue(game.world)}`);
if (opts.stats) stats(game.world);
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
