import {
  MEETING_APPROACHES, MEETING_OBJECTIVES, MEETING_STYLES, type DressingRoomView, type MeetingApproach, type MeetingObjective, type MeetingStyle,
} from "@tf/core";
import { useState } from "react";
import { call } from "../client";
import { act } from "../hooks";
import { useT } from "../i18n";
import { useUi } from "../store";

const openPlayer = (id: string) => useUi.getState().set({ player: id });

/**
 * Reunión con la plantilla: la primera es la presentación del mánager. Se anuncia estilo,
 * objetivo y forma de llevar el grupo; cada jugador reacciona y lo recuerda.
 */
export function TeamMeeting({ meeting }: { meeting: DressingRoomView["meeting"] }) {
  const { t, locale } = useT();
  const [style, setStyle] = useState<MeetingStyle>("possession");
  const [objective, setObjective] = useState<MeetingObjective>("topHalf");
  const [approach, setApproach] = useState<MeetingApproach>("meritocracy");
  const [error, setError] = useState<string | null>(null);
  const date = (day: number) => new Date(Date.UTC(2000, 0, 1) + day * 86400000).toLocaleDateString(locale, { timeZone: "UTC" });
  const first = !meeting.last;
  const last = meeting.last;
  const hold = () =>
    act(async () => {
      const r = await call("command", { cmd: { type: "teamMeeting", style, objective, approach } });
      setError(r.ok ? null : t(r.error));
    });

  return (
    <section className="meeting">
      <h4>{t(first ? "meeting.present" : "meeting.title")}</h4>
      {meeting.available ? (
        <>
          <p className="hint">{t("meeting.help")}</p>
          <div className="plan-form">
            <label>
              {t("meeting.style")}
              <select id="meeting-style" value={style} onChange={(e) => setStyle(e.target.value as MeetingStyle)}>
                {MEETING_STYLES.map((x) => <option key={x} value={x}>{t(`mstyle.${x}`)}</option>)}
              </select>
            </label>
            <label>
              {t("meeting.objective")}
              <select id="meeting-objective" value={objective} onChange={(e) => setObjective(e.target.value as MeetingObjective)}>
                {MEETING_OBJECTIVES.map((x) => <option key={x} value={x}>{t(`mobjective.${x}`)}</option>)}
              </select>
            </label>
            <label>
              {t("meeting.approach")}
              <select id="meeting-approach" value={approach} onChange={(e) => setApproach(e.target.value as MeetingApproach)}>
                {MEETING_APPROACHES.map((x) => <option key={x} value={x}>{t(`mapproach.${x}`)}</option>)}
              </select>
            </label>
          </div>
          <div className="row">
            <button className="primary" onClick={hold}>{t(first ? "meeting.goFirst" : "meeting.go")}</button>
            {error && <span className="error">{error}</span>}
          </div>
        </>
      ) : meeting.nextDay !== undefined && <p className="hint">{t("meeting.next", { date: date(meeting.nextDay) })}</p>}
      {last && (
        <div className="meeting-result">
          <p>
            <strong>{t(last.first ? "meeting.lastFirst" : "meeting.last", { date: date(last.day) })}</strong>:{" "}
            {t(`mstyle.${last.style}`)} · {t(`mobjective.${last.objective}`)} · {t(`mapproach.${last.approach}`)}
          </p>
          <p>{t("meeting.summary", last.counts)}</p>
          {last.spokesman && <p><em>{t(`meeting.voice.${last.spokesman.stance}`, { name: last.spokesman.name })}</em></p>}
          <ul className="factors stances">
            {last.players.map((p) => (
              <li key={p.id}>
                <span className={`stance ${p.stance}`}>{t(`stance.${p.stance}`)}</span>{" "}
                <span className="link" onClick={() => openPlayer(p.id)}>{p.name}</span>{" "}
                <span className="hint">· {t(`reason.${p.reason}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
