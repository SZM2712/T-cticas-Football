import { ALLEGATIONS, type CaseView, type FactView, type Sanction } from "@tf/core";
import { useState } from "react";
import { call } from "../client";
import { dateOfDay, money } from "../format";
import { act, useView } from "../hooks";
import { useT } from "../i18n";
import { useUi } from "../store";

/** Texto de un hecho enlazado (traduce también las claves que lleva dentro). */
function useFactText() {
  const { t } = useT();
  return (f: FactView) => {
    const p: Record<string, string | number> = { ...f.params };
    if (typeof p.intent === "string") p.intent = t(`intent.${p.intent}`);
    if (typeof p.tone === "string") p.tone = t(`tone.${p.tone}`);
    if (typeof p.clarity === "string") p.clarity = t(`clarity.${p.clarity}`);
    if (typeof p.verdict === "string") p.verdict = t(`verdict.${p.verdict}`);
    if (typeof p.incident === "string") p.incident = t(`case.${p.incident}`);
    return t(f.key, p);
  };
}

function sanctionText(t: ReturnType<typeof useT>["t"], locale: string, s: Sanction): string {
  if (s.kind === "fine") return t("sanction.fine", { amount: money(s.amount ?? 0, locale) });
  return t(`sanction.${s.kind}`, { n: s.matches ?? 0 });
}

function Case({ c }: { c: CaseView }) {
  const { t, locale } = useT();
  const fact = useFactText();
  const [error, setError] = useState<string | null>(null);
  const run = (cmd: Parameters<typeof call<"command">>[1]["cmd"]) => act(async () => {
    const r = await call("command", { cmd });
    setError(r.ok ? null : t(r.error));
  });
  return (
    <section className={`case status-${c.status}`}>
      <h4>{t(`case.${c.kind}`)} · {c.subject.name} <span className={`chip case-${c.status}`}>{t(`caseStatus.${c.status}`)}</span></h4>
      <p className="hint">
        {t("discipline.opened", { date: dateOfDay(c.openedDay, locale) })}
        {c.referee ? ` · ${t("discipline.referee", { name: c.referee })}` : ""}
        {(c.status === "allegations" || c.status === "sanctioned") ? ` · ${t("discipline.deadline", { date: dateOfDay(c.deadline, locale) })}` : ""}
      </p>
      <h5>{t("discipline.facts")}</h5>
      <ul className="factors">
        {c.facts.map((f, i) => <li key={i}>{f.day !== undefined && <span className="hint">{dateOfDay(f.day, locale)} </span>}{fact(f)}</li>)}
      </ul>
      {c.allegation && <p>{t("discipline.yourAllegation")}: {t(`allegation.${c.allegation}`)}</p>}
      {c.sanctions.length > 0 && <p><strong>{t("discipline.sanction")}:</strong> {c.sanctions.map((s) => sanctionText(t, locale, s)).join(" · ")}</p>}
      {c.status === "dismissed" && <p className="ok">{t("discipline.dismissed")}</p>}
      {c.appeal && <p className={c.appeal.outcome === "upheld" ? "bad" : "ok"}>{t(`appeal.${c.appeal.outcome}`)}</p>}
      {c.status === "allegations" && (
        <div className="row">
          {ALLEGATIONS.map((a) => (
            <button key={a} className={c.allegation === a ? "primary" : ""} onClick={() => run({ type: "allegeCase", case: c.id, allegation: a })}>{t(`allegation.${a}`)}</button>
          ))}
          <span className="hint">{t("discipline.allegeHelp")}</span>
        </div>
      )}
      {c.status === "sanctioned" && (
        <div className="row">
          <button onClick={() => run({ type: "appealCase", case: c.id })}>{t("discipline.appeal")}</button>
          <span className="hint">{t("discipline.appealHelp")}</span>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

/** Disciplina: expedientes con sus hechos, alegaciones, sanciones y recursos; relación con los árbitros. */
export function Discipline() {
  const { t } = useT();
  const team = useUi((s) => s.team);
  const v = useView("discipline", team ? { team } : null);
  if (!team) return <p>{t("match.noWatch")}</p>;
  if (!v) return null;
  return (
    <div className="media">
      {v.touchlineBan > 0 && <p className="bad"><strong>{t("discipline.touchlineBan", { n: v.touchlineBan })}</strong></p>}
      {v.stadiumClosure > 0 && <p className="bad"><strong>{t("discipline.closure", { n: v.stadiumClosure })}</strong></p>}
      {v.cases.length ? v.cases.map((c) => <Case key={c.id} c={c} />) : <p className="hint">{t("discipline.none")}</p>}
      {v.referees.length > 0 && (
        <section>
          <h4>{t("discipline.referees")}</h4>
          <ul className="factors">
            {v.referees.map((r) => <li key={r.id}>{r.name}: <span className={r.mood === "normal" ? "" : "bad"}>{t(`refMood.${r.mood}`)}</span>{r.criticisms ? ` · ${t("discipline.criticisms", { n: r.criticisms })}` : ""}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
