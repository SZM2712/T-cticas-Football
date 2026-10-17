import type { ClubOptionView, LeagueOption } from "@tf/core";
import { useEffect, useState } from "react";
import { call } from "../client";
import { money } from "../format";
import { act, useView } from "../hooks";
import { useT } from "../i18n";
import { useUi } from "../store";

const stars = (n: number) => "★".repeat(Math.floor(n)) + (n % 1 ? "½" : "");

/** Al empezar: elegir liga y club, y tomar el mando con tu nombre. */
export function ClubPicker({ leagues, real, onData }: { leagues: LeagueOption[]; real: boolean; onData: (real: boolean) => void }) {
  const { t, comp, locale } = useT();
  const [league, setLeague] = useState(leagues[0]?.leagueId ?? "");
  // Al cambiar de mundo (real ↔ ficticio) cambian las ligas: se vuelve a la primera.
  useEffect(() => {
    if (!leagues.some((l) => l.leagueId === league)) setLeague(leagues[0]?.leagueId ?? "");
  }, [leagues, league]);
  const [name, setName] = useState("Stefan");
  const [error, setError] = useState<string | null>(null);
  const clubs = useView("clubs", league ? { league } : null) as ClubOptionView[] | null;
  const close = () => useUi.getState().set({ picker: false });
  const choose = (club: ClubOptionView) =>
    act(async () => {
      const r = await call("command", { cmd: { type: "takeCharge", club: club.id, name: name.trim() || "Manager" } });
      if (!r.ok) return setError(t(r.error));
      const competition = leagues.find((l) => l.leagueId === league)?.competitionId ?? null;
      useUi.getState().set({ picker: false, team: club.id, competition, tab: "squad" });
    });
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal picker" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h3>{t("picker.title")}</h3>
          <button onClick={close}>✕</button>
        </div>
        <p className="hint">{t("picker.help")}</p>
        <div className="row data-choice">
          <span>{t("picker.world")}</span>
          <button className={real ? "primary" : ""} onClick={() => !real && onData(true)}>{t("picker.real")}</button>
          <button className={!real ? "primary" : ""} onClick={() => real && onData(false)}>{t("picker.fictional")}</button>
        </div>
        <div className="row">
          <label>
            {t("dressing.yourName")} <input value={name} onChange={(e) => setName(e.target.value)} size={14} />
          </label>
          <label>
            {t("ui.league")}{" "}
            <select value={league} onChange={(e) => setLeague(e.target.value)}>
              {leagues.map((l) => <option key={l.leagueId} value={l.leagueId}>{comp(l.nameKey)}</option>)}
            </select>
          </label>
          {error && <span className="error">{error}</span>}
        </div>
        <table className="grid">
          <thead>
            <tr>
              <th className="left">{t("picker.club")}</th>
              <th>{t("picker.reputation")}</th>
              <th>{t("squad.level")}</th>
              <th className="left">{t("picker.stadium")}</th>
              <th>{t("picker.budget")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {clubs?.map((c) => (
              <tr key={c.id}>
                <td className="left"><strong>{c.name}</strong> <span className="hint">{c.city}</span></td>
                <td title={`${c.stars}`}>{stars(c.stars)}</td>
                <td>{c.level.toFixed(1)}</td>
                <td className="left">{c.stadium} <span className="hint">({c.capacity.toLocaleString(locale)})</span></td>
                <td>{money(c.transferBudget, locale)}</td>
                <td>
                  {c.takenBy
                    ? <span className="hint">{t("picker.taken", { name: c.takenBy })}</span>
                    : <button className="primary" onClick={() => choose(c)}>{t("picker.choose")}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
