// npm run sim:media -- --seasons=20 --seed=123 [--out=docs/balance/fase5.md]
// Simulación headless de los medios (Fase 5) con un mánager humano cuyas ruedas de prensa
// atiende siempre el asistente. Comprueba los criterios de aceptación (DISEÑO §7):
// - 0 preguntas repetidas (tema + sujeto) en una temporada sin un hecho nuevo;
// - el asistente nunca viola una directriz;
// - toda sanción tiene expediente con hechos enlazados;
// - ninguna publicación expone números ocultos.

import { writeFileSync } from "node:fs";
import {
  advanceDay, applyCommand, factView, forbiddenBy, newGame, subjectKey, type ClubId, type PressDirectives,
} from "@tf/core";

function args(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of process.argv.slice(2)) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) out[m[1]!] = m[2] ?? "true";
  }
  return out;
}

const opts = args();
const seed = opts.seed ?? "123";
const seasons = Number(opts.seasons ?? 20);
const game = newGame({ seed });
const w = game.world;
const club = Object.values(w.clubs).filter((c) => c.leagueId && c.nation === "ES")
  .sort((a, b) => b.reputation - a.reputation || a.id.localeCompare(b.id))[4]!.id as ClubId;
applyCommand(w, { type: "takeCharge", club, name: "Simulación" });
// Directrices que cambian cada temporada (todas las combinaciones van saliendo).
const DIRECTIVES: PressDirectives[] = [
  { refereeCriticism: false, criticizePlayers: false, promises: false, tone: "calm" },
  { refereeCriticism: true, criticizePlayers: false, promises: true, tone: "firm" },
  { refereeCriticism: true, criticizePlayers: true, promises: false, tone: "combative" },
  { refereeCriticism: false, criticizePlayers: true, promises: true, tone: "calm" },
];
const ALLOWED_PARAMS = new Set(["narrative", "n"]);

interface SeasonRow {
  season: number;
  conferences: number;
  questions: number;
  narrativeQuestions: number;
  posts: number;
  viral: number;
  controversies: number;
  cases: number;
  sanctions: number;
  narratives: number;
}

const rows: SeasonRow[] = [];
const seenConf = new Set<string>();
const lastAsked = new Map<string, number>();
let repeats = 0;
let violations = 0;
let answered = 0;
const seenPosts = new Set<string>();
let badPosts = 0;
let ms = 0;
let days = 0;
const startSeason = w.meta.season;
let directives = DIRECTIVES[0]!;
applyCommand(w, { type: "setPressDirectives", directives });

while (w.meta.season < startSeason + seasons) {
  const season = w.meta.season;
  const row: SeasonRow = { season, conferences: 0, questions: 0, narrativeQuestions: 0, posts: 0, viral: 0, controversies: 0, cases: 0, sanctions: 0, narratives: 0 };
  const casesBefore = new Set(Object.keys(w.media.cases));
  const ctrvBefore = new Set(Object.keys(w.media.controversies));
  const narrBefore = new Set(Object.keys(w.media.narratives));
  directives = DIRECTIVES[(season - startSeason) % DIRECTIVES.length]!;
  applyCommand(w, { type: "setPressDirectives", directives });
  const banned = forbiddenBy(directives);
  // En las temporadas impares el mánager es impulsivo: critica al árbitro en redes tras una polémica
  // que le perjudica, y alega y recurre (así se ejercita el comité de disciplina).
  const hotHead = (season - startSeason) % 2 === 1;
  while (w.meta.season === season) {
    const t = performance.now();
    advanceDay(game);
    ms += performance.now() - t;
    days++;
    if (hotHead) {
      const today = w.meta.today;
      const m = Object.values(w.matches).find((x) => x.day === today && x.result && (x.home === club || x.away === club) && w.media.controversies[x.id]);
      const side = m ? (m.home === club ? 0 : 1) : -1;
      if (m && w.media.controversies[m.id]!.some((c) => c.harmed === side)) {
        applyCommand(w, { type: "post", intent: "criticizeReferee", tone: today % 2 ? "combative" : "firm", subject: { kind: "match", id: m.id } });
      }
      for (const c of Object.values(w.media.cases)) {
        if (c.status === "allegations" && !c.allegation) applyCommand(w, { type: "allegeCase", case: c.id, allegation: (["accept", "contest", "apologize"] as const)[today % 3]! });
        if (c.status === "sanctioned" && today % 2 === 0) applyCommand(w, { type: "appealCase", case: c.id });
      }
    }
    for (const c of Object.values(w.media.conferences)) {
      // Preguntas nuevas: anti-repetición con el calor de la narrativa en ese momento.
      if (!seenConf.has(c.id)) {
        seenConf.add(c.id);
        row.conferences++;
        for (const q of c.questions) {
          row.questions++;
          const n = q.narrative ? w.media.narratives[q.narrative] : undefined;
          if (!n) continue;
          row.narrativeQuestions++;
          const key = `${n.kind}|${subjectKey(q.subject)}|${w.meta.season}`;
          const prev = lastAsked.get(key);
          if (prev !== undefined && !(n.lastFedDay > prev)) repeats++;
          lastAsked.set(key, c.day);
        }
      }
      for (const q of c.questions) {
        if (q.answer?.by !== "assistant" || (q as { checked?: boolean }).checked) continue;
        (q as { checked?: boolean }).checked = true;
        answered++;
        if (banned.has(q.answer.intent) || q.answer.tone !== directives.tone) violations++;
      }
    }
    for (const p of w.media.posts) {
      if (seenPosts.has(p.id)) continue;
      seenPosts.add(p.id);
      row.posts++;
      if (p.reach === "viral") row.viral++;
      for (const [k, v] of Object.entries(p.params)) if (!ALLOWED_PARAMS.has(k) || (typeof v === "number" && !Number.isInteger(v))) badPosts++;
    }
  }
  row.cases = Object.keys(w.media.cases).filter((id) => !casesBefore.has(id)).length;
  row.sanctions = Object.keys(w.media.cases).filter((id) => !casesBefore.has(id) && w.media.cases[id]!.sanctions?.length).length;
  row.controversies = Object.keys(w.media.controversies).filter((id) => !ctrvBefore.has(id)).reduce((s, id) => s + w.media.controversies[id]!.length, 0);
  row.narratives = Object.keys(w.media.narratives).filter((id) => !narrBefore.has(id)).length;
  rows.push(row);
  console.log(`Temporada ${season}: ${row.conferences} ruedas de prensa, ${row.questions} preguntas, ${row.posts} publicaciones (${row.viral} virales), ${row.controversies} polémicas, ${row.cases} expedientes, ${row.sanctions} sancionados`);
}

// Toda sanción con hechos enlazados y que se pueden enseñar.
let sanctionsWithoutFacts = 0;
let unknownFacts = 0;
for (const c of Object.values(w.media.cases)) {
  if (c.sanctions?.length && !c.facts.length) sanctionsWithoutFacts++;
  for (const f of c.facts) if (factView(w, f, c.club).key === "fact.unknown") unknownFacts++;
}

const ok = (b: boolean) => (b ? "✅" : "❌");
const lines = [
  `# Balance de la Fase 5 — medios, redes y disciplina`,
  "",
  `Generado con \`npm run sim:media -- --seasons=${seasons} --seed=${seed}\`. Un mánager humano en un club de la liga española; todas sus ruedas de prensa las atiende el asistente, con directrices que cambian cada temporada. En las temporadas impares el mánager es impulsivo: tras una polémica que le perjudica critica al árbitro en redes, y alega y recurre los expedientes.`,
  "",
  `| Temporada | Ruedas de prensa | Preguntas | De narrativas | Publicaciones | Virales | Polémicas | Expedientes | Sancionados | Narrativas nuevas |`,
  `|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|`,
  ...rows.map((r) => `| ${r.season} | ${r.conferences} | ${r.questions} | ${r.narrativeQuestions} | ${r.posts} | ${r.viral} | ${r.controversies} | ${r.cases} | ${r.sanctions} | ${r.narratives} |`),
  "",
  `## Criterios de aceptación`,
  "",
  `- ${ok(repeats === 0)} Preguntas repetidas en una temporada sin hecho nuevo: ${repeats} (de ${rows.reduce((s, r) => s + r.narrativeQuestions, 0)} preguntas de narrativas).`,
  `- ${ok(violations === 0)} Respuestas del asistente que violan una directriz: ${violations} (de ${answered}).`,
  `- ${ok(sanctionsWithoutFacts === 0 && unknownFacts === 0)} Sanciones sin hechos enlazados: ${sanctionsWithoutFacts}; hechos que no se pueden enseñar: ${unknownFacts}.`,
  `- ${ok(badPosts === 0)} Publicaciones con parámetros que no son nombres o recuentos visibles: ${badPosts} (de ${seenPosts.size}).`,
  `- Coste: ${(ms / days).toFixed(1)} ms por día de juego de media (${days} días, motor completo solo para el club humano).`,
  "",
];
console.log(lines.slice(-7).join("\n"));
if (opts.out) {
  writeFileSync(opts.out, lines.join("\n"));
  console.log(`Informe guardado en ${opts.out}`);
}
if (repeats || violations || sanctionsWithoutFacts || unknownFacts || badPosts) process.exitCode = 1;
