import { TALK_TOPICS, type PlayerSocialView, type SymbolicRole, type TalkTopic } from "@tf/core";
import { useState } from "react";
import { call } from "../client";
import { act, useView } from "../hooks";
import { useT } from "../i18n";
import { useConcernText } from "./Dressing";

const ROLES: SymbolicRole[] = ["penalties", "freeKicks", "captain"];

/** Vida en el vestuario de un jugador y conversación con él (solo si su club lo diriges tú). */
export function SocialPanel({ id }: { id: string }) {
  const { t, locale } = useT();
  const v = useView("playerSocial", { id }) as PlayerSocialView | null;
  const concern = useConcernText();
  const [topic, setTopic] = useState<TalkTopic>("praise");
  const [pct, setPct] = useState(50);
  const [role, setRole] = useState<SymbolicRole>("penalties");
  const [other, setOther] = useState("");
  const [otherRole, setOtherRole] = useState<SymbolicRole>("freeKicks");
  const [wage, setWage] = useState("");
  const [years, setYears] = useState(3);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!v?.managed) return null;

  const run = (cmd: Parameters<typeof call<"command">>[1]["cmd"], okText?: string) =>
    act(async () => {
      const r = await call("command", { cmd });
      if (!r.ok) setMsg({ ok: false, text: t(r.error) });
      else if (r.talk) setMsg({ ok: r.talk.success, text: t(r.talk.reaction) + (r.talk.commitments.length ? ` ${t("talk.promiseMade")}` : "") });
      else setMsg({ ok: true, text: okText ?? t("talk.done") });
    });
  const talk = () => {
    const cmd: Record<string, unknown> = { type: "talk", player: id, topic };
    if (topic === "promisePlayingTime") cmd.minStartsPct = pct / 100;
    if (topic === "promiseRole" || topic === "agreeRoles") cmd.role = role;
    if (topic === "agreeRoles") Object.assign(cmd, { other: other || v.roosters[0]?.id, otherRole });
    if (topic === "promiseContract" && wage) cmd.wage = Number(wage);
    return run(cmd as never);
  };
  const receptivity = v.talk.topics.find((x) => x.topic === topic)?.mood;

  return (
    <div className="dev-grid social">
      <section>
        <h4>{t("social.title")}</h4>
        <ul className="factors">
          <li>{t("dressing.level")}: {t(`level.${v.level}`)}</li>
          <li>{t("dressing.mood")}: {t(`mood.${v.mood}`)}</li>
          <li>{t("dressing.trust")}: {t(`trust.${v.trust}`)}</li>
          {v.fit && (
            <li>
              {t("dressing.fit")}: {t(`fit.${v.fit.total}`)}{" "}
              <span className="hint">({(["tactical", "cultural", "social", "manager"] as const).map((k) => `${t(`fitPart.${k}`)} ${t(`fit.${v.fit![k]}`)}`).join(", ")})</span>
            </li>
          )}
          {v.transferRequest && <li className="bad"><strong>{t("dressing.transferRequest")}</strong></li>}
          {v.concerns.map((c, i) => <li key={i} className={c.stage >= 4 ? "bad" : ""}>{concern(c)}</li>)}
        </ul>
        {v.friends.length > 0 && <p>{t("social.friends")}: {v.friends.map((f) => f.name).join(", ")}</p>}
        {v.rivals.length > 0 && <p>{t("social.rivals")}: {v.rivals.map((f) => f.name).join(", ")}</p>}
        <h4>{t("social.memories")}</h4>
        {v.memories.length ? (
          <ul className="factors">
            {v.memories.map((m, i) => (
              <li key={i} className={m.positive ? "ok" : "bad"}>
                {t(`memory.${m.kind}`, { about: m.about.join(", ") })}{" "}
                <span className="hint">{new Date(Date.UTC(2000, 0, 1) + m.day * 86400000).toLocaleDateString(locale, { timeZone: "UTC" })}</span>
              </li>
            ))}
          </ul>
        ) : <p className="hint">{t("social.noMemories")}</p>}
      </section>
      <section>
        <h4>{t("talk.title")}</h4>
        {!v.talk.available && <p className="hint">{t("error.talkedRecently")}</p>}
        <div className="plan-form">
          <label>
            {t("talk.topic")}
            <select value={topic} onChange={(e) => setTopic(e.target.value as TalkTopic)}>
              {TALK_TOPICS.map((x) => <option key={x} value={x}>{t(`topic.${x}`)}</option>)}
            </select>
          </label>
          {topic === "promisePlayingTime" && (
            <label>
              {t("talk.starts")}
              <select value={pct} onChange={(e) => setPct(Number(e.target.value))}>
                {[30, 50, 70, 90].map((x) => <option key={x} value={x}>{x}%</option>)}
              </select>
            </label>
          )}
          {(topic === "promiseRole" || topic === "agreeRoles") && (
            <label>
              {t("talk.role")}
              <select value={role} onChange={(e) => setRole(e.target.value as SymbolicRole)}>
                {ROLES.map((x) => <option key={x} value={x}>{t(`srole.${x}`)}</option>)}
              </select>
            </label>
          )}
          {topic === "agreeRoles" && (
            <>
              <label>
                {t("talk.other")}
                <select value={other || v.roosters[0]?.id || ""} onChange={(e) => setOther(e.target.value)}>
                  {v.roosters.length ? v.roosters.map((r) => <option key={r.id} value={r.id}>{r.name}</option>) : <option value="">—</option>}
                </select>
              </label>
              <label>
                {t("talk.otherRole")}
                <select value={otherRole} onChange={(e) => setOtherRole(e.target.value as SymbolicRole)}>
                  {ROLES.map((x) => <option key={x} value={x}>{t(`srole.${x}`)}</option>)}
                </select>
              </label>
            </>
          )}
          {topic === "promiseContract" && (
            <label>
              {t("talk.wage")}
              <input value={wage} onChange={(e) => setWage(e.target.value.replace(/\D/g, ""))} size={9} />
            </label>
          )}
        </div>
        {receptivity && <p className="hint">{t(`receptive.${receptivity}`)}</p>}
        <div className="row">
          <button className="primary" disabled={!v.talk.available} onClick={talk}>{t("talk.go")}</button>
        </div>
        <h4>{t("social.decisions")}</h4>
        <div className="row">
          <button onClick={() => run({ type: "setCaptain", player: id as never })}>{t("social.makeCaptain")}</button>
          <button onClick={() => run({ type: "setRoleTaker", role: "penalties", player: id as never })}>{t("social.penaltyTaker")}</button>
          <button onClick={() => run({ type: "setRoleTaker", role: "freeKicks", player: id as never })}>{t("social.freeKickTaker")}</button>
        </div>
        <div className="row">
          <label>
            {t("talk.wage")} <input value={wage} onChange={(e) => setWage(e.target.value.replace(/\D/g, ""))} size={9} />
          </label>
          <label>
            {t("social.years")}{" "}
            <select value={years} onChange={(e) => setYears(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <button disabled={!wage} onClick={() => run({ type: "renewContract", player: id as never, wage: Number(wage), years }, t("social.renewed"))}>{t("social.renew")}</button>
        </div>
        {msg && <p className={msg.ok ? "ok" : "bad"}>{msg.text}</p>}
        {v.commitments.length > 0 && (
          <>
            <h4>{t("dressing.commitments")}</h4>
            <ul className="factors">
              {v.commitments.map((c) => (
                <li key={c.id} className={c.status === "atRisk" ? "bad" : ""}>
                  {t(`commit.${c.type}`, { pct: Math.round(Number(c.params.minStartsPct ?? 0) * 100), role: t(`srole.${String(c.params.role ?? "")}`), wage: Number(c.params.minWage ?? 0).toLocaleString(locale) })} · {t(`commitStatus.${c.status}`)}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
