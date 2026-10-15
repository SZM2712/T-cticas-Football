import { LOCALES, type Locale } from "@tf/i18n";
import { useEffect, useState } from "react";
import { call } from "./client";
import { LeagueTable } from "./components/LeagueTable";
import { MatchPanel } from "./components/MatchPanel";
import { Results } from "./components/Results";
import { Scorers } from "./components/Scorers";
import { Dressing } from "./components/Dressing";
import { Inbox } from "./components/Inbox";
import { Squad } from "./components/Squad";
import { TacticsPanel } from "./components/TacticsPanel";
import { act, useView } from "./hooks";
import { useT } from "./i18n";
import { useUi, type Tab } from "./store";

const TABS: Tab[] = ["table", "results", "squad", "dressing", "inbox", "scorers", "tactics", "match"];

function formatDay(day: number, locale: Locale): string {
  // GameDay = días desde el 1/1/2000 (UTC). Solo la UI usa Date.
  return new Date(Date.UTC(2000, 0, 1) + day * 86400000).toLocaleDateString(locale, {
    weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}

export function App() {
  const { t, comp, locale } = useT();
  const ui = useUi();
  const [seed, setSeed] = useState("123");
  const [real, setReal] = useState(false);
  const leagues = useView("leagues", ui.summary ? {} : null);

  useEffect(() => {
    void act(async () => {
      const summary = await call("newGame", { seed: "123", real: false });
      useUi.getState().set({ summary });
    });
  }, []);

  useEffect(() => {
    if (!leagues?.length) return;
    const s = useUi.getState();
    if (!s.competition || !leagues.some((l) => l.competitionId === s.competition)) s.set({ competition: leagues[0]!.competitionId });
  }, [leagues]);

  const start = () =>
    act(async () => {
      useUi.getState().set({ summary: null, team: null, competition: null });
      const summary = await call("newGame", { seed, real });
      useUi.getState().set({ summary });
    });
  const advance = (days: number) => act(async () => useUi.getState().set({ summary: await call("advance", { days }) }));
  const toMatch = () =>
    ui.team && act(async () => useUi.getState().set({ summary: await call("advanceToMatch", { team: ui.team! }) }));

  return (
    <div className="app">
      <header>
        <h1>{t("ui.title")}</h1>
        <div className="controls">
          <label>
            {t("ui.seed")} <input value={seed} onChange={(e) => setSeed(e.target.value)} size={8} />
          </label>
          <label>
            <input type="checkbox" checked={real} onChange={(e) => setReal(e.target.checked)} /> {t("ui.realData")}
          </label>
          <button onClick={start} disabled={ui.busy}>{t("ui.newGame")}</button>
          <span className="sep" />
          <button onClick={() => advance(1)} disabled={ui.busy || !ui.summary}>{t("ui.advanceDay")}</button>
          <button onClick={() => advance(7)} disabled={ui.busy || !ui.summary}>{t("ui.advanceWeek")}</button>
          <button onClick={toMatch} disabled={ui.busy || !ui.team}>{t("ui.toNextMatch")}</button>
          <span className="sep" />
          <label>
            {t("ui.language")}{" "}
            <select
              value={locale}
              onChange={(e) => {
                try {
                  localStorage.setItem("tf.locale", e.target.value);
                } catch {
                  /* sin almacenamiento: no pasa nada */
                }
                ui.set({ locale: e.target.value as Locale });
              }}
            >
              {LOCALES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
        </div>
        <div className="status">
          {ui.summary ? (
            <>
              <strong>{t("ui.today", { date: formatDay(ui.summary.today, locale) })}</strong> · {t("ui.matchesPlayed", { n: ui.summary.played })}
            </>
          ) : t("ui.loading")}
          {ui.busy && ui.summary && <span className="busy"> · {t("ui.working")}</span>}
          {ui.error && <span className="error"> · {ui.error}</span>}
        </div>
        <div className="controls">
          <label>
            {t("ui.league")}{" "}
            <select value={ui.competition ?? ""} onChange={(e) => ui.set({ competition: e.target.value as never })}>
              {leagues?.map((l) => l.competitionId && <option key={l.leagueId} value={l.competitionId}>{comp(l.nameKey)}</option>)}
            </select>
          </label>
        </div>
        <nav>
          {TABS.map((tab) => (
            <button key={tab} className={ui.tab === tab ? "active" : ""} onClick={() => ui.set({ tab })}>{t(`tab.${tab}`)}</button>
          ))}
        </nav>
      </header>
      <main>
        {ui.summary && ui.tab === "table" && <LeagueTable />}
        {ui.summary && ui.tab === "results" && <Results />}
        {ui.summary && ui.tab === "squad" && <Squad />}
        {ui.summary && ui.tab === "dressing" && <Dressing />}
        {ui.summary && ui.tab === "inbox" && <Inbox />}
        {ui.summary && ui.tab === "scorers" && <Scorers />}
        {ui.summary && ui.tab === "tactics" && <TacticsPanel />}
        {ui.summary && ui.tab === "match" && <MatchPanel />}
      </main>
    </div>
  );
}
