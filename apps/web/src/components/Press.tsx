import { ANSWER_TONES, type AnswerIntent, type AnswerTone, type ConferenceView, type JournalistRef, type PressDirectives } from "@tf/core";
import { useEffect, useState } from "react";
import { call } from "../client";
import { dateOfDay } from "../format";
import { act, useView } from "../hooks";
import { useT } from "../i18n";
import { useUi } from "../store";

/** "Diario de Lyon" / "Televisión nacional". */
export function useOutlet() {
  const { t } = useT();
  return (j: { outlet: string; city?: string }) => (j.city ? t("outlet.local", { outlet: t(`outlet.${j.outlet}`), city: j.city }) : t(`outlet.${j.outlet}.national`));
}

function Journalist({ j }: { j: JournalistRef }) {
  const { t } = useT();
  const outlet = useOutlet();
  return (
    <span className="journalist">
      <strong>{j.name}</strong> <span className="hint">({outlet(j)})</span>{" "}
      {j.relation !== "neutral" && <span className={`chip ${j.relation === "good" ? "ok" : "bad"}`}>{t(`relation.${j.relation}`)}</span>}
    </span>
  );
}

function Conference({ c }: { c: ConferenceView }) {
  const { t, locale } = useT();
  const [answers, setAnswers] = useState<{ intent: AnswerIntent; tone: AnswerTone }[]>(() => c.questions.map((q) => ({ intent: q.intents[0]!, tone: "calm" })));
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string[] | null>(null);
  const set = (i: number, patch: Partial<{ intent: AnswerIntent; tone: AnswerTone }>) => setAnswers(answers.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const send = () =>
    act(async () => {
      const r = await call("command", { cmd: { type: "answerPress", conference: c.id, answers } });
      if (r.ok) setResult(r.reactions ?? []);
      else setError(t(r.error));
    });
  const delegate = () => act(async () => {
    const r = await call("command", { cmd: { type: "delegatePress", conference: c.id } });
    if (!r.ok) setError(t(r.error));
  });
  return (
    <section className="conference">
      <h4>{t(`press.title.${c.kind}`, { opponent: c.opponent })}</h4>
      <p className="hint">{t("press.deadline", { date: dateOfDay(c.deadline, locale) })}</p>
      <ol className="questions">
        {c.questions.map((q, i) => (
          <li key={i}>
            <p><Journalist j={q.journalist} />{q.pointed && <span className="chip bad">{t("press.pointed")}</span>}</p>
            <p className="question">«{t(`press.q.${q.templateId}`, q.params)}»</p>
            <div className="row">
              <label>
                {t("press.intent")}{" "}
                <select id={`q${i}-intent`} value={answers[i]!.intent} onChange={(e) => set(i, { intent: e.target.value as AnswerIntent })}>
                  {q.intents.map((x) => <option key={x} value={x}>{t(`intent.${x}`)}</option>)}
                </select>
              </label>
              <label>
                {t("press.tone")}{" "}
                <select id={`q${i}-tone`} value={answers[i]!.tone} onChange={(e) => set(i, { tone: e.target.value as AnswerTone })}>
                  {ANSWER_TONES.map((x) => <option key={x} value={x}>{t(`tone.${x}`)}</option>)}
                </select>
              </label>
            </div>
            {result?.[i] && <p className="ok">{t(result[i]!, q.params)}</p>}
          </li>
        ))}
      </ol>
      <div className="row">
        <button className="primary" onClick={send}>{t("press.answer")}</button>
        <button onClick={delegate}>{t("press.delegate")}</button>
        {error && <span className="error">{error}</span>}
      </div>
    </section>
  );
}

function Directives({ d }: { d: PressDirectives }) {
  const { t } = useT();
  const [form, setForm] = useState(d);
  const [saved, setSaved] = useState(false);
  useEffect(() => setForm(d), [d]);
  const save = () => act(async () => {
    const r = await call("command", { cmd: { type: "setPressDirectives", directives: form } });
    setSaved(r.ok);
  });
  return (
    <section>
      <h4>{t("press.directives")}</h4>
      <p className="hint">{t("press.directivesHelp")}</p>
      <div className="row">
        {(["refereeCriticism", "criticizePlayers", "promises"] as const).map((k) => (
          <label key={k} className="inline">
            <input type="checkbox" checked={form[k]} onChange={(e) => { setForm({ ...form, [k]: e.target.checked }); setSaved(false); }} /> {t(`directive.${k}`)}
          </label>
        ))}
        <label>
          {t("press.tone")}{" "}
          <select value={form.tone} onChange={(e) => { setForm({ ...form, tone: e.target.value as AnswerTone }); setSaved(false); }}>
            {ANSWER_TONES.map((x) => <option key={x} value={x}>{t(`tone.${x}`)}</option>)}
          </select>
        </label>
        <button onClick={save}>{t("press.saveDirectives")}</button>
        {saved && <span className="ok">{t("tactics.saved")}</span>}
      </div>
    </section>
  );
}

/** Prensa: ruedas de prensa pendientes, lo que se cuenta del club y directrices del asistente. */
export function Press() {
  const { t, locale } = useT();
  const team = useUi((s) => s.team);
  const press = useView("press", team ? { team } : null);
  const narratives = useView("narratives", team ? { team } : null);
  if (!team) return <p>{t("match.noWatch")}</p>;
  if (!press || !narratives) return null;
  return (
    <div className="media">
      {press.pending.length ? press.pending.map((c) => <Conference key={c.id} c={c} />) : <p className="hint">{t("press.none")}</p>}
      <section>
        <h4>{t("press.stories")}</h4>
        {narratives.length ? (
          <ul className="factors stories">
            {narratives.map((n) => (
              <li key={n.id}>
                <span className={`chip heat-${n.heat}`}>{t(`heat.${n.heat}`)}</span>{" "}
                {n.subject.kind === "player" ? (
                  <span className="link" onClick={() => useUi.getState().set({ player: n.subject.id })}>{t(`narr.${n.kind}`, { name: n.subject.name, n: n.count ?? "" })}</span>
                ) : t(`narr.${n.kind}`, { name: n.subject.name, n: n.count ?? "" })}
              </li>
            ))}
          </ul>
        ) : <p className="hint">{t("press.noStories")}</p>}
      </section>
      <Directives d={press.directives} />
      {press.recent.length > 0 && (
        <section>
          <h4>{t("press.recent")}</h4>
          {press.recent.map((c) => (
            <div key={c.id} className="recent-conference">
              <p><strong>{t(`press.title.${c.kind}`, { opponent: c.opponent })}</strong> <span className="hint">{dateOfDay(c.day, locale)}{c.status === "delegated" ? ` · ${t("press.byAssistant")}` : ""}</span></p>
              <ul className="factors">
                {c.questions.map((q) => (
                  <li key={q.index}>
                    <span className="hint">«{t(`press.q.${q.templateId}`, q.params)}»</span>{" "}
                    {q.answer && <>→ {t(`intent.${q.answer.intent}`)} ({t(`tone.${q.answer.tone}`)}): {t(q.answer.reaction, q.params)}</>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
