import {
  DIETS, EXERCISES, INTENSITIES, SLEEP_PLANS, TRAINING_FOCUSES, type DevelopmentPlan, type PlayerDevelopmentView,
} from "@tf/core";
import { useEffect, useState } from "react";
import { call } from "../client";
import { act, useView } from "../hooks";
import { useT } from "../i18n";
import { useUi } from "../store";

const DEFAULT_PLAN: DevelopmentPlan = { focus: "balanced", intensity: "normal", diet: "standard", exercise: "none", sleep: "free" };

/** Evolución del nivel: línea simple en SVG (últimos 24 meses). */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values) - 0.2;
  const max = Math.max(...values) + 0.2;
  const w = 320;
  const h = 70;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / (max - min)) * h}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={2} />
    </svg>
  );
}

const stars = (n: number) => "★".repeat(Math.floor(n)) + (n % 1 ? "½" : "");

/** Ficha de desarrollo: evolución, «¿por qué?», plan individual, staff y ojeadores. */
export function PlayerPanel({ id }: { id: string }) {
  const { t, nation } = useT();
  const v = useView("player", { id }) as PlayerDevelopmentView | null;
  const [plan, setPlan] = useState<DevelopmentPlan>(DEFAULT_PLAN);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (v) setPlan(v.plan ?? DEFAULT_PLAN);
    setMsg(null);
  }, [v]);
  if (!v) return null;

  const save = () =>
    act(async () => {
      const r = await call("command", { cmd: { type: "setPlan", player: id as never, plan } });
      setMsg(r.ok ? t("dev.planSaved") : t(r.error));
    });
  const clear = () => act(() => call("command", { cmd: { type: "clearPlan", player: id as never } }));
  const sel = <K extends keyof DevelopmentPlan>(key: K, values: readonly string[], prefix: string) => (
    <label>
      {t(`dev.${key}`)}
      <select value={plan[key] as string} onChange={(e) => setPlan({ ...plan, [key]: e.target.value })}>
        {values.map((x) => <option key={x} value={x}>{t(`${prefix}.${x}`)}</option>)}
      </select>
    </label>
  );

  return (
    <div className="player-panel">
      <div className="row">
        <h3>{v.name}</h3>
        <span>{t(`pos.${v.position}`)} · {v.age} {t("squad.age").toLowerCase()} · {nation(v.nationality)} · {v.heightCm} cm · {v.weightKg} kg</span>
        <span className="hint">{t(`archetype.${v.archetype.primary}`)}</span>
        <button onClick={() => useUi.getState().set({ player: null })}>✕</button>
      </div>
      <div className="dev-grid">
        <section>
          <h4>{t("dev.evolution")}</h4>
          <p>{t("squad.level")}: <strong>{v.level.toFixed(1)}</strong> · {t("squad.fitness")}: {v.fitness}%{v.injuredDays > 0 && ` · ${t("status.injured", { days: v.injuredDays })}`}</p>
          <Sparkline values={v.monthly} />
          {v.yearly.length > 0 && <p className="hint">{t("dev.seasons")}: {v.yearly.map((x) => x.toFixed(1)).join(" → ")}</p>}
          <h4>{t("dev.why")}</h4>
          {v.factors.length ? (
            <ul className="factors">
              {v.factors.map((f) => (
                <li key={f.key} className={f.trend > 0 ? "ok" : "bad"}>
                  {f.trend > 0 ? (f.trend > 1 ? "⬆⬆" : "⬆") : f.trend < -1 ? "⬇⬇" : "⬇"} {t(`factor.${f.key}.${f.trend > 0 ? "up" : "down"}`)}
                </li>
              ))}
            </ul>
          ) : <p className="hint">{t("dev.noReport")}</p>}
        </section>
        <section>
          <h4>{t("dev.plan")}</h4>
          <p className="hint">{t("dev.planHelp")}</p>
          <div className="plan-form">
            {sel("focus", TRAINING_FOCUSES, "focus")}
            {sel("intensity", INTENSITIES, "intensity")}
            {sel("diet", DIETS, "diet")}
            {sel("exercise", EXERCISES, "exercise")}
            {sel("sleep", SLEEP_PLANS, "sleep")}
            <label>
              {t("dev.mentor")}
              <select value={plan.mentor ?? ""} onChange={(e) => {
                const next = { ...plan };
                if (e.target.value) next.mentor = e.target.value as never;
                else delete next.mentor;
                setPlan(next);
              }}>
                <option value="">—</option>
                {v.mentors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          </div>
          <div className="row">
            <button className="primary" onClick={save}>{t("tactics.save")}</button>
            {v.plan && <button onClick={clear}>{t("dev.clearPlan")}</button>}
            {msg && <span className="ok">{msg}</span>}
          </div>
          {v.adherence && (
            <>
              <h4>{t("dev.lastMonth")}</h4>
              <ul className="factors">
                {(["training", "diet", "exercise", "sleep"] as const).map((k) => (
                  <li key={k} className={v.adherence![k] === "full" ? "ok" : v.adherence![k] === "none" ? "bad" : ""}>
                    {t(`dev.part.${k}`)}: {t(`adherence.${v.adherence![k]}`)}
                  </li>
                ))}
              </ul>
            </>
          )}
          <h4>{t("dev.staff")}</h4>
          <ul className="factors">{v.staff.map((s, i) => <li key={i}>{t(`role.${s.role}`)}: {s.name}</li>)}</ul>
        </section>
        <section>
          <h4>{t("dev.scouts")}</h4>
          {v.scouts.length ? (
            <table className="grid">
              <thead>
                <tr><th className="left">{t("dev.scout")}</th><th>{t("dev.now")}</th><th>{t("dev.potential")}</th><th>{t("dev.confidence")}</th></tr>
              </thead>
              <tbody>
                {v.scouts.map((s) => (
                  <tr key={s.scout} title={s.lean ? t(`lean.${s.lean}`) : ""}>
                    <td className="left">{s.name}{s.lean ? " *" : ""}</td>
                    <td>{stars(s.ability)}</td>
                    <td>{stars(s.potential[0])}–{stars(s.potential[1])}</td>
                    <td>{t(`confidence.${s.confidence}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="hint">{t("dev.noScouts")}</p>}
          <p className="hint">{t("dev.scoutsHelp")}</p>
        </section>
      </div>
    </div>
  );
}
