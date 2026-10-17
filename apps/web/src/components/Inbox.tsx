import { call } from "../client";
import { act, useView } from "../hooks";
import { useT } from "../i18n";
import { useUi } from "../store";

/** Buzón del mánager: señales del vestuario, quejas, promesas en riesgo, cumplidas o rotas. */
export function Inbox() {
  const { t, locale } = useT();
  const team = useUi((s) => s.team);
  const items = useView("inbox", team ? { team } : null);
  if (!team) return <p>{t("match.noWatch")}</p>;
  if (!items) return null;
  if (!items.length) return <p className="hint">{t("inbox.empty")}</p>;
  const unread = items.filter((i) => !i.read).map((i) => i.id);
  const markRead = () => act(() => call("command", { cmd: { type: "markInboxRead", ids: unread } }));
  return (
    <div className="inbox">
      {unread.length > 0 && <button onClick={markRead}>{t("inbox.markRead")}</button>}
      <ul className="inbox-list">
        {items.map((i) => (
          <li key={i.id} className={i.read ? "read" : ""} onClick={() => i.player && useUi.getState().set({ player: i.player.id })}>
            <span className="hint">{new Date(Date.UTC(2000, 0, 1) + i.day * 86400000).toLocaleDateString(locale, { timeZone: "UTC" })}</span>{" "}
            {t(`inbox.${i.kind}`, {
              player: i.player?.name ?? "",
              other: i.other?.name ?? "",
              about: i.dynamic ? t(`dynamic.${i.dynamic}`) : "",
              channel: i.channel ? t(`channel.${i.channel}`) : "",
            })}
          </li>
        ))}
      </ul>
    </div>
  );
}
