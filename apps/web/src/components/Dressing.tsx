import type { ConcernView, DressingRoomView } from "@tf/core";
import { useState } from "react";
import { call } from "../client";
import { act, useView } from "../hooks";
import { useT } from "../i18n";
import { useUi } from "../store";

const STATUS_RANK: Record<string, number> = { prospect: 0, backup: 1, rotation: 2, firstTeam: 3, keyPlayer: 4 };

/** Texto de una preocupación: dinámica + escalón (+ con quién). */
export function useConcernText() {
  const { t } = useT();
  return (c: ConcernView) => t(`concern.${c.dynamic}.${c.stage}`, { other: c.other?.name ?? "" });
}

function languageName(locale: string, code: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

const openPlayer = (id: string) => useUi.getState().set({ player: id });

/** Vestuario: tomar el mando, camarillas, jerarquía, ánimo y promesas. */
export function Dressing() {
  const { t, locale, nation } = useT();
  const team = useUi((s) => s.team);
  const open = useUi((s) => s.player);
  const v = useView("dressing", team ? { team } : null) as DressingRoomView | null;
  const commitments = useView("commitments", team && v?.manager ? { team } : null);
  const gossip = useView("gossip", team && v?.manager ? { team } : null);
  const concern = useConcernText();
  const [name, setName] = useState("Stefan");
  const [msg, setMsg] = useState<string | null>(null);
  if (!team) return <p>{t("match.noWatch")}</p>;
  if (!v) return null;

  if (!v.manager) {
    const take = () =>
      act(async () => {
        const r = await call("command", { cmd: { type: "takeCharge", club: team as never, name } });
        setMsg(r.ok ? null : t(r.error));
      });
    return (
      <div className="dressing">
        <p>{t("dressing.notManaged")}</p>
        <div className="row">
          <label>
            {t("dressing.yourName")} <input value={name} onChange={(e) => setName(e.target.value)} size={14} />
          </label>
          <button className="primary" onClick={take}>{t("dressing.takeCharge")}</button>
          {msg && <span className="error">{msg}</span>}
        </div>
      </div>
    );
  }

  const renegotiate = (id: string) => act(() => call("command", { cmd: { type: "renegotiateCommitment", commitment: id } }));
  const baseName = (c: DressingRoomView["cliques"][number]) =>
    t(`clique.${c.label}`, { param: c.labelParam ? (c.label === "language" ? languageName(locale, c.labelParam) : nation(c.labelParam)) : "" });
  // Dos grupos con el mismo rasgo se numeran ("Los de casa 1", "Los de casa 2").
  const cliqueName = (c: DressingRoomView["cliques"][number]) => {
    const same = v.cliques.filter((x) => baseName(x) === baseName(c));
    return same.length > 1 ? `${baseName(c)} ${same.indexOf(c) + 1}` : baseName(c);
  };

  return (
    <div className="dressing">
      <p className="hint">{t("dressing.managedBy", { name: v.manager })}</p>
      <section>
        <h4>{t("dressing.leaders")}</h4>
        <p>
          {v.leaders.length
            ? v.leaders.map((l, i) => (
              <span key={l.id}>
                <span className="link" onClick={() => openPlayer(l.id)}>{l.name}</span>{i < v.leaders.length - 1 ? ", " : ""}
              </span>
            ))
            : t("dressing.noLeaders")}
        </p>
      </section>
      <section>
        <h4>{t("dressing.gossip")}</h4>
        {gossip?.length ? (
          <ul className="factors gossip">
            {gossip.map((g, i) => (
              <li key={i} className="link" onClick={() => openPlayer(g.player.id)}>
                <span className="hint">{new Date(Date.UTC(2000, 0, 1) + g.day * 86400000).toLocaleDateString(locale, { timeZone: "UTC" })}</span>{" "}
                {t(`gossip.${g.kind}`, { player: g.player.name, other: g.other?.name ?? "", about: g.about ? t(`dynamic.${g.about}`) : "" })}
              </li>
            ))}
          </ul>
        ) : <p className="hint">{t("dressing.noGossip")}</p>}
      </section>
      <section>
        <h4>{t("dressing.cliques")}</h4>
        {v.cliques.length ? (
          <ul className="factors">
            {v.cliques.map((c, i) => (
              <li key={i}>
                <strong>{cliqueName(c)}</strong>:{" "}
                {c.members.map((m, j) => (
                  <span key={m.id}><span className="link" onClick={() => openPlayer(m.id)}>{m.name}</span>{j < c.members.length - 1 ? ", " : ""}</span>
                ))}
              </li>
            ))}
          </ul>
        ) : <p className="hint">{t("dressing.noCliques")}</p>}
        <p className="hint">
          {t("dressing.roles", { pens: v.roles.penalties ?? "—", fks: v.roles.freeKicks ?? "—" })}
        </p>
      </section>
      <table className="grid dressing-table">
        <thead>
          <tr>
            <th className="left">{t("squad.player")}</th>
            <th>{t("squad.position")}</th>
            <th className="left">{t("dressing.level")}</th>
            <th className="left">{t("dressing.mood")}</th>
            <th className="left">{t("dressing.trust")}</th>
            <th className="left">{t("dressing.fit")}</th>
            <th className="left">{t("dressing.status")}</th>
            <th className="left">{t("dressing.concerns")}</th>
          </tr>
        </thead>
        <tbody>
          {v.players.map((p) => (
            <tr key={p.id} className={p.id === open ? "followed" : ""} onClick={() => useUi.getState().set({ player: p.id })}>
              <td className="left link">{p.name}{p.captain ? " (C)" : ""}</td>
              <td title={t(`pos.${p.position}`)}>{p.position}</td>
              <td className="left">{t(`level.${p.level}`)}</td>
              <td className={`left mood-${p.mood}`}>{t(`mood.${p.mood}`)}</td>
              <td className="left">{t(`trust.${p.trust}`)}</td>
              <td className="left">{t(`fit.${p.fit}`)}</td>
              <td className="left">
                {STATUS_RANK[p.perceived]! >= STATUS_RANK[p.expected]! ? t(`sstatus.${p.perceived}`) : t("dressing.statusGap", { expected: t(`sstatus.${p.expected}`), perceived: t(`sstatus.${p.perceived}`) })}
              </td>
              <td className="left">
                {p.transferRequest && <strong className="bad">{t("dressing.transferRequest")} </strong>}
                {p.concerns.map((c, i) => <span key={i} className={c.stage >= 4 ? "bad" : ""}>{concern(c)}{i < p.concerns.length - 1 ? " · " : ""}</span>)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <section>
        <h4>{t("dressing.commitments")}</h4>
        {commitments?.length ? (
          <table className="grid">
            <thead>
              <tr>
                <th className="left">{t("squad.player")}</th>
                <th className="left">{t("commit.what")}</th>
                <th>{t("commit.deadline")}</th>
                <th>{t("commit.progress")}</th>
                <th className="left">{t("commit.status")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {commitments.map((c) => (
                <tr key={c.id}>
                  <td className="left">{c.player.name}</td>
                  <td className="left">{t(`commit.${c.type}`, { pct: Math.round(Number(c.params.minStartsPct ?? 0) * 100), role: t(`srole.${String(c.params.role ?? "")}`), wage: Number(c.params.minWage ?? 0).toLocaleString(locale) })}</td>
                  <td>{new Date(Date.UTC(2000, 0, 1) + c.deadline * 86400000).toLocaleDateString(locale, { timeZone: "UTC" })}</td>
                  <td>{Math.round(c.progress * 100)}%</td>
                  <td className={`left ${c.status === "broken" ? "bad" : c.status === "kept" ? "ok" : ""}`}>{t(`commitStatus.${c.status}`)}</td>
                  <td>{(c.status === "active" || c.status === "atRisk") && <button onClick={() => renegotiate(c.id)}>{t("commit.renegotiate")}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="hint">{t("dressing.noCommitments")}</p>}
      </section>
    </div>
  );
}
