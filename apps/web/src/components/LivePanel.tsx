import { FORMATION_IDS, INSTRUCTION_KEYS, type InstructionKey, type MatchChange, type PlayerInstruction, type Tactics } from "@tf/core";
import { useState } from "react";
import { useT } from "../i18n";
import type { WatchedMatch } from "../protocol";

type TacticsPatch = Extract<MatchChange, { type: "tactics" }>["tactics"];

/** Táctica vigente de un equipo: la inicial más las intervenciones ya hechas. */
function currentTactics(m: WatchedMatch, side: 0 | 1): { tactics: Tactics; instructions: PlayerInstruction[] } {
  const t: Tactics = { ...m.report.tactics[side] };
  let instructions = t.instructions;
  for (const iv of m.interventions) {
    if (iv.side !== side) continue;
    if (iv.change.type === "tactics") Object.assign(t, iv.change.tactics, { setPieces: { ...t.setPieces, ...iv.change.tactics.setPieces } });
    if (iv.change.type === "instructions") instructions = iv.change.instructions;
  }
  return { tactics: t, instructions };
}

/** Panel de intervención en una pausa del partido en directo: cambios, sistema, estilo e instrucciones. */
export function LivePanel({
  m, side, step, onField, used, subsMade, onIntervene,
}: {
  m: WatchedMatch;
  side: 0 | 1;
  step: number;
  onField: string[];
  used: Set<string>;
  subsMade: number;
  onIntervene: (step: number, side: 0 | 1, change: MatchChange) => Promise<string | null>;
}) {
  const { t } = useT();
  const { tactics, instructions } = currentTactics(m, side);
  const squad = m.squads[side];
  const pos = (id: string) => squad.find((p) => p.id === id)?.position ?? "";
  const name = (id: string) => m.names[id] ?? id;
  const bench = squad.filter((p) => p.bench && !used.has(p.id));
  const [out, setOut] = useState("");
  const [inn, setInn] = useState("");
  const [patch, setPatch] = useState<TacticsPatch>({});
  const [newIns, setNewIns] = useState<{ player: string; key: InstructionKey }>({ player: "", key: "shootMore" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const send = async (change: MatchChange, ok: string) => {
    setError(null);
    setDone(null);
    const e = await onIntervene(step, side, change);
    if (e) setError(t(e));
    else setDone(ok);
  };
  const value = <K extends keyof TacticsPatch>(k: K) => (patch[k] ?? tactics[k as keyof Tactics]) as NonNullable<TacticsPatch[K]>;

  return (
    <div className="live-panel">
      <p className="hint">{t("match.pausedHelp")}</p>
      <section>
        <h4>{t("match.subs", { n: subsMade })}</h4>
        <div className="row">
          <select value={out} onChange={(e) => setOut(e.target.value)}>
            <option value="">{t("match.out")}</option>
            {onField.map((id) => <option key={id} value={id}>{pos(id)} · {name(id)}</option>)}
          </select>
          <select value={inn} onChange={(e) => setInn(e.target.value)}>
            <option value="">{t("match.in")}</option>
            {bench.map((p) => <option key={p.id} value={p.id}>{p.position} · {name(p.id)}</option>)}
          </select>
          <button disabled={!out || !inn} onClick={() => send({ type: "sub", out: out as never, in: inn as never }, t("match.subDone")).then(() => { setOut(""); setInn(""); })}>
            {t("match.apply")}
          </button>
        </div>
      </section>
      <section>
        <h4>{t("tactics.style")}</h4>
        <div className="row">
          <label>
            {t("tactics.formation")}{" "}
            <select value={value("formation")} onChange={(e) => setPatch({ ...patch, formation: e.target.value as never })}>
              {FORMATION_IDS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </label>
          {(["mentality", "pressing", "tempo"] as const).map((k) => (
            <label key={k}>
              {t(`tactics.${k}`)}{" "}
              <input type="range" min={k === "mentality" ? -1 : 0} max={1} step={0.05} value={value(k)} onChange={(e) => setPatch({ ...patch, [k]: Number(e.target.value) })} />
            </label>
          ))}
          <button disabled={!Object.keys(patch).length} onClick={() => send({ type: "tactics", tactics: patch }, t("match.tacticsDone")).then(() => setPatch({}))}>
            {t("match.apply")}
          </button>
        </div>
      </section>
      <section>
        <h4>{t("tactics.instructions")}</h4>
        <ul className="instructions">
          {instructions.map((i, k) => (
            <li key={`${i.player}-${i.key}`}>
              {name(i.player)} · {t(`instruction.${i.key}`)}{" "}
              <button onClick={() => send({ type: "instructions", instructions: instructions.filter((_, j) => j !== k) }, t("match.instructionsDone"))}>
                {t("tactics.remove")}
              </button>
            </li>
          ))}
        </ul>
        <div className="row">
          <select value={newIns.player} onChange={(e) => setNewIns({ ...newIns, player: e.target.value })}>
            <option value="">—</option>
            {onField.map((id) => <option key={id} value={id}>{pos(id)} · {name(id)}</option>)}
          </select>
          <select value={newIns.key} onChange={(e) => setNewIns({ ...newIns, key: e.target.value as InstructionKey })}>
            {INSTRUCTION_KEYS.map((k) => <option key={k} value={k}>{t(`instruction.${k}`)}</option>)}
          </select>
          <button
            disabled={!newIns.player}
            onClick={() => send({ type: "instructions", instructions: [...instructions, { player: newIns.player as never, key: newIns.key }] }, t("match.instructionsDone"))}
          >
            {t("tactics.add")}
          </button>
        </div>
        <p className="hint">{t("tactics.instructionsHelp")}</p>
      </section>
      {error && <p className="error">{error}</p>}
      {done && <p className="ok">{done}</p>}
    </div>
  );
}
