import {
  FORMATION_IDS, INSTRUCTION_KEYS, type InstructionKey, type PlayerId, type PlayerInstruction, type SetPieces, type TacticsPlan,
} from "@tf/core";
import { useEffect, useState } from "react";
import { call } from "../client";
import { act, useView } from "../hooks";
import { useT } from "../i18n";
import { useUi } from "../store";

const ROUTINES: { key: keyof SetPieces; prefix: string; values: string[] }[] = [
  { key: "corners", prefix: "corners", values: ["nearPost", "farPost", "short", "edgeOfBox"] },
  { key: "cornerCrowd", prefix: "crowd", values: ["stay", "some", "all"] },
  { key: "freeKicks", prefix: "freeKicks", values: ["shoot", "cross", "short"] },
  { key: "throwIns", prefix: "throwIns", values: ["short", "long"] },
  { key: "kickoff", prefix: "kickoff", values: ["buildUp", "long"] },
];

const SLIDERS = ["mentality", "pressing", "tempo", "width", "directness"] as const;

/** Táctica del equipo seguido: sistema, estilo, balón parado e instrucciones individuales. */
export function TacticsPanel() {
  const { t } = useT();
  const team = useUi((s) => s.team);
  const view = useView("tactics", team ? { team } : null);
  const [plan, setPlan] = useState<TacticsPlan>({});
  const [saved, setSaved] = useState(false);
  const [newIns, setNewIns] = useState<{ player: string; key: InstructionKey }>({ player: "", key: "shootMore" });

  useEffect(() => {
    if (!view) return;
    const d = view.defaults;
    setPlan(view.plan ?? { formation: d.formation, mentality: d.mentality, pressing: d.pressing, tempo: d.tempo, width: d.width, directness: d.directness, setPieces: d.setPieces, instructions: [] });
    setSaved(false);
  }, [view]);

  if (!team) return <p>{t("match.noWatch")}</p>;
  if (!view) return null;
  const sp = { ...view.defaults.setPieces, ...plan.setPieces };
  const setSp = (patch: Partial<SetPieces>) => setPlan({ ...plan, setPieces: { ...sp, ...patch } });
  const name = (id: string) => view.squad.find((p) => p.id === id)?.name ?? id;
  const instructions = plan.instructions ?? [];

  const save = () =>
    act(async () => {
      const r = await call("command", { cmd: { type: "setTactics", team, plan } });
      if (!r.ok) throw new Error(t(r.error));
      setSaved(true);
    });
  const reset = () => act(() => call("command", { cmd: { type: "clearTactics", team } }));

  const takerSelect = (key: "freeKickTaker" | "cornerTaker" | "throwInTaker") => (
    <label key={key}>
      {t(`tactics.${key}`)}
      <select value={sp[key] ?? ""} onChange={(e) => setSp({ [key]: (e.target.value || null) as PlayerId | null })}>
        <option value="">{t("tactics.auto")}</option>
        {view.squad.map((p) => <option key={p.id} value={p.id}>{p.position} · {p.name}</option>)}
      </select>
    </label>
  );

  return (
    <div className="tactics">
      {!view.plan && <p className="hint">{t("tactics.aiControlled")}</p>}
      <section>
        <h3>{t("tactics.style")}</h3>
        <label>
          {t("tactics.formation")}
          <select value={plan.formation} onChange={(e) => setPlan({ ...plan, formation: e.target.value as never })}>
            {FORMATION_IDS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </label>
        {SLIDERS.map((k) => {
          const min = k === "mentality" ? -1 : 0;
          return (
            <label key={k}>
              {t(`tactics.${k}`)}
              <span className="range">
                <small>{t(k === "mentality" ? "tactics.defensive" : "tactics.low")}</small>
                <input type="range" min={min} max={1} step={0.05} value={plan[k] ?? 0} onChange={(e) => setPlan({ ...plan, [k]: Number(e.target.value) })} />
                <small>{t(k === "mentality" ? "tactics.attacking" : "tactics.high")}</small>
              </span>
            </label>
          );
        })}
      </section>
      <section>
        <h3>{t("tactics.setPieces")}</h3>
        {ROUTINES.map((r) => (
          <label key={r.key}>
            {t(`tactics.${r.key}`)}
            <select value={sp[r.key] as string} onChange={(e) => setSp({ [r.key]: e.target.value } as Partial<SetPieces>)}>
              {r.values.map((v) => <option key={v} value={v}>{t(`${r.prefix}.${v}`)}</option>)}
            </select>
          </label>
        ))}
        <label>
          {t("tactics.penaltyTaker")}
          <select value={sp.penaltyTakers?.[0] ?? ""} onChange={(e) => setSp({ penaltyTakers: e.target.value ? [e.target.value as PlayerId] : [] })}>
            <option value="">{t("tactics.auto")}</option>
            {view.squad.map((p) => <option key={p.id} value={p.id}>{p.position} · {p.name}</option>)}
          </select>
        </label>
        {takerSelect("freeKickTaker")}
        {takerSelect("cornerTaker")}
        {takerSelect("throwInTaker")}
      </section>
      <section>
        <h3>{t("tactics.instructions")}</h3>
        <p className="hint">{t("tactics.instructionsHelp")}</p>
        <ul className="instructions">
          {instructions.map((i: PlayerInstruction, k) => (
            <li key={`${i.player}-${i.key}`}>
              {name(i.player)} · {t(`instruction.${i.key}`)}{" "}
              <button onClick={() => setPlan({ ...plan, instructions: instructions.filter((_, j) => j !== k) })}>{t("tactics.remove")}</button>
            </li>
          ))}
        </ul>
        <div className="row">
          <select value={newIns.player} onChange={(e) => setNewIns({ ...newIns, player: e.target.value })}>
            <option value="">—</option>
            {view.squad.map((p) => <option key={p.id} value={p.id}>{p.position} · {p.name}</option>)}
          </select>
          <select value={newIns.key} onChange={(e) => setNewIns({ ...newIns, key: e.target.value as InstructionKey })}>
            {INSTRUCTION_KEYS.map((k) => <option key={k} value={k}>{t(`instruction.${k}`)}</option>)}
          </select>
          <button
            disabled={!newIns.player}
            onClick={() => setPlan({ ...plan, instructions: [...instructions, { player: newIns.player as PlayerId, key: newIns.key }] })}
          >
            {t("tactics.add")}
          </button>
        </div>
      </section>
      <div className="row">
        <button className="primary" onClick={save}>{t("tactics.save")}</button>
        <button onClick={reset}>{t("tactics.reset")}</button>
        {saved && <span className="ok">{t("tactics.saved")}</span>}
      </div>
    </div>
  );
}
