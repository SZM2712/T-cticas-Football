// npm run import:football-data [-- --out=packages/data/current]
// Descarga las plantillas actuales de football-data.org (clave en FOOTBALL_DATA_API_KEY,
// plan gratuito: 10 peticiones/minuto) y genera:
//   players.csv   jugadores (los nuevos con nivel estimado, columna "estimated" = 1)
//   leagues.json  composición actual de las ligas importadas
//   report.md     resumen: clubes nuevos, jugadores nuevos a revisar, descartados

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { realPlayersToCsv } from "@tf/data";
import { SOURCES, buildImport, type CompetitionSource, type FdTeam } from "./match";

const API = "https://api.football-data.org/v4";
const SPACING_MS = 6500;

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getTeams(code: string, key: string): Promise<FdTeam[]> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${API}/competitions/${code}/teams`, { headers: { "X-Auth-Token": key } });
    if (res.status === 429) {
      const wait = Number(res.headers.get("X-RequestCounter-Reset") ?? 60);
      console.log(`  límite de peticiones: espero ${wait} s…`);
      await sleep((wait + 1) * 1000);
      continue;
    }
    if (res.status === 403) throw new Error(`${code}: tu plan de football-data.org no incluye esta competición`);
    if (!res.ok) throw new Error(`${code}: HTTP ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { teams?: FdTeam[] };
    return body.teams ?? [];
  }
  throw new Error(`${code}: demasiados reintentos`);
}

async function main(): Promise<void> {
  const key = process.env.FOOTBALL_DATA_API_KEY ?? "";
  if (!key && !process.argv.includes("--offline")) {
    console.error("Falta la variable FOOTBALL_DATA_API_KEY (guárdala como secreto, no en el código).");
    process.exit(1);
  }
  const out = arg("out", "packages/data/current");
  mkdirSync(out, { recursive: true });
  const responses: { source: CompetitionSource; teams: FdTeam[] }[] = [];
  const offline = process.argv.includes("--offline");
  if (offline) responses.push(...JSON.parse(readFileSync(join(out, "raw.json"), "utf8")));
  for (const [i, source] of (offline ? [] : SOURCES).entries()) {
    if (i > 0) await sleep(SPACING_MS);
    try {
      const teams = await getTeams(source.code, key);
      console.log(`${source.code}: ${teams.length} equipos, ${teams.reduce((s, t) => s + (t.squad?.length ?? 0), 0)} jugadores`);
      responses.push({ source, teams });
    } catch (e) {
      console.warn(`  ${(e as Error).message} — se omite`);
    }
  }
  // Respuesta original: permite reprocesar sin volver a descargar (npm run import:football-data -- --offline).
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "raw.json"), JSON.stringify(responses));
  const now = new Date();
  const season = `${now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1}/${String((now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1) + 1).slice(2)}`;
  const { update, players, report } = buildImport(responses, season, now);
  // Divisiones que la API no cubre (2.ª de ES/IT/DE/FR): se conservan de la importación anterior
  // si eran de esta misma temporada (revisadas a mano o por búsqueda web).
  try {
    const previous = JSON.parse(readFileSync(join(out, "leagues.json"), "utf8")) as typeof update;
    if (previous.season === season) {
      for (const l of previous.leagues) {
        if (!update.leagues.some((u) => u.nation === l.nation && u.tier === l.tier)) update.leagues.push(l);
      }
      if (previous.notes) update.notes = previous.notes;
    }
  } catch {
    // primera importación
  }

  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "players.csv"), realPlayersToCsv(players));
  writeFileSync(join(out, "leagues.json"), JSON.stringify(update, null, 2) + "\n");
  const estimated = players.filter((p) => p.estimated);
  writeFileSync(
    join(out, "report.md"),
    [
      `# Importación de football-data.org (${season})`,
      ``,
      `- Fecha: ${now.toISOString()}`,
      `- Clubes reconocidos: ${report.clubsMatched} · nuevos: ${report.clubsNew.length}`,
      `- Jugadores conocidos (conservan su nivel): ${report.playersKept}`,
      `- Jugadores nuevos con nivel **estimado** (revisar en players.csv, columna estimated=1): ${report.playersNew}`,
      `- Descartados: ${report.skipped.length}`,
      ``,
      `## Clubes nuevos`,
      ...report.clubsNew.map((c) => `- ${c}`),
      ``,
      `## Jugadores nuevos (nivel estimado)`,
      ...estimated.map((p) => `- ${p.name} — ${p.club} (${p.position}, ${p.birthYear}, ${p.nation}): ${p.rating}`),
      ``,
      `## Jugadores conocidos que ya no aparecen en su club (revisar destino)`,
      ...report.missing.map((s) => `- ${s}`),
      ``,
      `## Descartados`,
      ...report.skipped.map((s) => `- ${s}`),
      ``,
    ].join("\n"),
  );
  console.log(`\nListo en ${out}: ${players.length} jugadores (${report.playersNew} nuevos con nivel estimado), ${report.clubsNew.length} clubes nuevos.`);
  console.log(`Pruébalo: npm run gen -- --current --top=20`);
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
