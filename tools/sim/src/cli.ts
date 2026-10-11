// npm run sim -- --seasons=20 --seed=123 [--engine=auto|full|quick] [--real] [--compare] [--out=docs/balance/fase2.md]
//                [--replay=mt_000123]
// Simulación headless de balance del motor de partido (Fase 2). Imprime las métricas de
// los partidos de liga frente a los criterios de aceptación y, con --compare, compara el
// motor completo con el rápido sobre los mismos emparejamientos.

import { writeFileSync } from "node:fs";
import {
  advanceDay, buildMatchInput, hashValue, newGame, seasonStartDay, simulateMatch, worldRng, type EngineMode, type Game,
  type GenerateOptions,
} from "@tf/core";
import { addReport, checkTargets, compareEngines, isLeagueMatch, newAccumulator, summarize, type Summary } from "./metrics";

function args(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of process.argv.slice(2)) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) out[m[1]!] = m[2] ?? "true";
  }
  return out;
}

const f2 = (x: number) => x.toFixed(2);
const f1 = (x: number) => x.toFixed(1);

function table(rows: [string, Summary][]): string[] {
  const keys: [keyof Summary, string, (x: number) => string][] = [
    ["matches", "Partidos", String],
    ["goalsPerMatch", "Goles/partido", f2],
    ["homeWinPct", "Victoria local %", f1],
    ["drawPct", "Empates %", f1],
    ["awayWinPct", "Victoria visitante %", f1],
    ["redsPerMatch", "Rojas/partido", f2],
    ["yellowsPerMatch", "Amarillas/partido", f2],
    ["shotsPerMatch", "Tiros/partido", f1],
    ["onTargetPerMatch", "A puerta/partido", f1],
    ["xgPerMatch", "xG/partido", f2],
    ["foulsPerMatch", "Faltas/partido", f1],
    ["cornersPerMatch", "Córners/partido", f1],
    ["penaltiesPerMatch", "Penaltis/partido", f2],
    ["injuriesPerMatch", "Lesiones/partido", f2],
    ["scorerP50", "Goleadores P50", String],
    ["scorerP90", "Goleadores P90", String],
    ["scorerP99", "Goleadores P99", String],
    ["scorerMax", "Máximo goleador", String],
    ["singleGoalShare", "% goleadores con 1 gol", f1],
    ["msPerMatch", "ms/partido", f2],
  ];
  const out = [`| Métrica | ${rows.map((r) => r[0]).join(" | ")} |`, `|---|${rows.map(() => "---:").join("|")}|`];
  for (const [k, label, fmt] of keys) out.push(`| ${label} | ${rows.map((r) => fmt(r[1][k])).join(" | ")} |`);
  return out;
}

const opts = args();
const seed = opts.seed ?? "123";
const seasons = Number(opts.seasons ?? 1);
const engine = (opts.engine ?? "auto") as EngineMode;
const genOpts: GenerateOptions = { seed };
if (opts.real) genOpts.dataPack = "real";

const t0 = performance.now();
const game: Game = newGame(genOpts, engine);
console.log(`Semilla ${seed} · motor ${engine} · mundo generado en ${((performance.now() - t0) / 1000).toFixed(1)} s`);
const lines: string[] = [];

if (opts.compare) {
  const t1 = performance.now();
  const { full, quick } = compareEngines(game.world, Number(opts.compare) || 1);
  console.log(`Comparación de motores en ${((performance.now() - t1) / 1000).toFixed(1)} s`);
  const diff = (a: number, b: number) => (b ? (100 * (a - b)) / b : 0);
  lines.push(`## Motor completo frente al rápido (mismos emparejamientos)`, "", ...table([["Completo", full], ["Rápido", quick]]), "");
  lines.push(
    `Diferencia del rápido: goles ${f1(diff(quick.goalsPerMatch, full.goalsPerMatch))} %, ` +
      `victorias locales ${f1(quick.homeWinPct - full.homeWinPct)} pp, empates ${f1(quick.drawPct - full.drawPct)} pp.`,
    "",
  );
}

if (opts.replay) {
  // Repite un partido: avanza hasta su día, construye la entrada y lo simula dos veces.
  const id = opts.replay;
  const m = game.world.matches[id];
  if (!m) throw new Error(`No existe el partido ${id}`);
  while (game.world.meta.today < m.day - 1) advanceDay(game);
  const input = buildMatchInput(game.world, m);
  const a = simulateMatch(input, worldRng(game.world).fork(input.seedPath));
  const b = simulateMatch(input, worldRng(game.world).fork(input.seedPath), { frames: true });
  console.log(`${id}: ${a.score.join("-")} · repetido ${b.score.join("-")} · idéntico: ${hashValue({ ...b, frames: undefined }) === hashValue(a)} · fotogramas ${b.frames?.t.length}`);
}

if (seasons > 0 && !opts.replay) {
  const acc = newAccumulator();
  const accAll = newAccumulator();
  const t1 = performance.now();
  const target = seasonStartDay(game.world.meta.season + seasons);
  let lastSeason = game.world.meta.season;
  while (game.world.meta.today < target) {
    const ts = performance.now();
    const played = advanceDay(game);
    const ms = played.length ? (performance.now() - ts) / played.length : 0;
    for (const p of played) {
      const key = p.match.competitionId;
      addReport(accAll, p.report, key);
      accAll.ms += ms;
      if (p.engine === "full" && isLeagueMatch(game.world, p)) {
        addReport(acc, p.report, key);
        acc.ms += ms;
      }
    }
    if (game.world.meta.season !== lastSeason) {
      lastSeason = game.world.meta.season;
      console.log(`  temporada ${lastSeason - 1}/${String(lastSeason).slice(2)} terminada · ${((performance.now() - t1) / 1000).toFixed(1)} s`);
    }
  }
  const secs = (performance.now() - t1) / 1000;
  const league = summarize(acc);
  const all = summarize(accAll);
  lines.push(`## ${seasons} temporada(s), semilla ${seed}, motor ${engine}`, "");
  lines.push(`Tiempo total ${f1(secs)} s (${f1(secs / seasons)} s por temporada) · choques de calendario: ${game.ctx.clashes} · hash final ${hashValue(game.world)}`, "");
  lines.push(...table([["Ligas", league], ["Todos los partidos", all]]), "");
  lines.push("### Criterios de aceptación (partidos de liga)", "");
  for (const c of checkTargets(league)) lines.push(`- ${c.ok ? "✅" : "❌"} ${c.key}: ${f2(c.value)} (objetivo ${c.range[0]}–${c.range[1]})`);
  lines.push("");
}

const text = lines.join("\n");
console.log(`\n${text}`);
if (opts.out) {
  writeFileSync(opts.out, `# Balance de la Fase 2 — motor de partido\n\nGenerado con \`npm run sim -- ${process.argv.slice(2).join(" ")}\`.\n\n${text}\n`);
  console.log(`Informe guardado en ${opts.out}`);
}
