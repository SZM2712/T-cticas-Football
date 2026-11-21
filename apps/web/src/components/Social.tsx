import { ANSWER_TONES, type AnswerIntent, type AnswerTone, type MediaSubject, type PostView } from "@tf/core";
import { useState } from "react";
import { call } from "../client";
import { dateOfDay } from "../format";
import { act, useView } from "../hooks";
import { useT } from "../i18n";
import { useUi } from "../store";
import { useOutlet } from "./Press";

const BY_SUBJECT: Record<"club" | "player" | "match", AnswerIntent[]> = {
  club: ["ambitious", "humble", "calm"],
  player: ["praisePlayer", "criticizePlayer"],
  match: ["calm", "humble", "criticizeReferee"],
};

function Post({ p }: { p: PostView }) {
  const { t, locale } = useT();
  const outlet = useOutlet();
  const author =
    p.author.kind === "journalist" ? `${p.author.name} (${outlet({ outlet: p.author.outlet ?? "newspaper" })})`
      : p.author.kind === "fans" ? t("post.fansOf", { segment: t(`segment.${p.author.segment}`), club: p.author.name })
      : p.author.kind === "refereeCollective" ? t("post.refereeCollective")
      : p.author.name;
  return (
    <li className={`post sentiment-${p.sentiment}`}>
      <div className="post-head">
        <span className="chip">{t(`platform.${p.platform}`)}</span> <strong>{author}</strong>{" "}
        <span className="hint">{dateOfDay(p.day, locale)}</span>
        {p.reach !== "low" && <span className={`chip reach-${p.reach}`}>{t(`reach.${p.reach}`)}</span>}
      </div>
      <p>{t(p.key, p.params)}</p>
    </li>
  );
}

/** Redes: ánimo de la afición, lo que se publica sobre el club y tus publicaciones. */
export function Social() {
  const { t } = useT();
  const team = useUi((s) => s.team);
  const feed = useView("feed", team ? { team } : null);
  const fans = useView("fans", team ? { team } : null);
  const dressing = useView("dressing", team ? { team } : null);
  const fixtures = useView("fixtures", team ? { team } : null);
  const [kind, setKind] = useState<"club" | "player" | "match">("club");
  const [player, setPlayer] = useState("");
  const [intent, setIntent] = useState<AnswerIntent>("ambitious");
  const [tone, setTone] = useState<AnswerTone>("calm");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!team) return <p>{t("match.noWatch")}</p>;
  if (!feed || !fans) return null;
  const lastMatch = fixtures?.past.at(-1);
  const subject: MediaSubject | null =
    kind === "club" ? { kind: "club", id: team as never }
      : kind === "player" ? (player || dressing?.players[0]?.id ? { kind: "player", id: (player || dressing!.players[0]!.id) as never } : null)
      : lastMatch ? { kind: "match", id: lastMatch.id as never } : null;
  const publish = () => subject && act(async () => {
    const r = await call("command", { cmd: { type: "post", intent, tone, subject } });
    setMsg(r.ok ? { ok: true, text: t("social.posted") } : { ok: false, text: t(r.error) });
  });
  const intents = BY_SUBJECT[kind];
  return (
    <div className="media">
      <section>
        <h4>{t("social.fans")}</h4>
        <ul className="factors fans">
          {fans.segments.map((s) => (
            <li key={s.segment}>
              <strong>{t(`segment.${s.segment}`)}</strong> <span className="hint">({t(`fanSize.${s.size}`)})</span>:{" "}
              <span className={`mood-${s.mood}`}>{t(`fanMood.${s.mood}`)}</span>
            </li>
          ))}
        </ul>
        {fans.form && <p className="hint">{t("social.form")}: <span className="form">{fans.form.split("").map((r, i) => <b key={i} className={`form-${r}`}>{t(`formLetter.${r}`)}</b>)}</span></p>}
      </section>
      {dressing?.manager && (
        <section>
          <h4>{t("social.publish")}</h4>
          <p className="hint">{t("social.publishHelp")}</p>
          <div className="row">
            <label>
              {t("social.about")}{" "}
              <select value={kind} onChange={(e) => { const k = e.target.value as typeof kind; setKind(k); setIntent(BY_SUBJECT[k][0]!); }}>
                <option value="club">{t("social.aboutClub")}</option>
                <option value="player">{t("social.aboutPlayer")}</option>
                {lastMatch && <option value="match">{t("social.aboutMatch", { opponent: lastMatch.home.id === team ? lastMatch.away.name : lastMatch.home.name })}</option>}
              </select>
            </label>
            {kind === "player" && (
              <select value={player || dressing.players[0]?.id || ""} onChange={(e) => setPlayer(e.target.value)}>
                {dressing.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <label>
              {t("press.intent")}{" "}
              <select value={intent} onChange={(e) => setIntent(e.target.value as AnswerIntent)}>
                {intents.map((x) => <option key={x} value={x}>{t(`intent.${x}`)}</option>)}
              </select>
            </label>
            <label>
              {t("press.tone")}{" "}
              <select value={tone} onChange={(e) => setTone(e.target.value as AnswerTone)}>
                {ANSWER_TONES.map((x) => <option key={x} value={x}>{t(`tone.${x}`)}</option>)}
              </select>
            </label>
            <button className="primary" disabled={!subject} onClick={publish}>{t("social.post")}</button>
            {msg && <span className={msg.ok ? "ok" : "error"}>{msg.text}</span>}
          </div>
        </section>
      )}
      <section>
        <h4>{t("social.feed")}</h4>
        {feed.length ? <ul className="feed">{feed.map((p) => <Post key={p.id} p={p} />)}</ul> : <p className="hint">{t("social.empty")}</p>}
      </section>
    </div>
  );
}
