import type { MatchChange } from "@tf/core";
import { useEffect, useState } from "react";
import { call } from "../client";
import { act, useView } from "../hooks";
import { useT } from "../i18n";
import { useUi } from "../store";
import type { WatchedMatch } from "../protocol";
import { FixtureLine } from "./Results";
import { MatchViewer } from "./MatchViewer";

/** Próximos partidos del equipo seguido y visor del partido en directo. */
export function MatchPanel() {
  const { t, comp } = useT();
  const team = useUi((s) => s.team);
  const busy = useUi((s) => s.busy);
  const fixtures = useView("fixtures", team ? { team } : null);
  const [watched, setWatched] = useState<WatchedMatch | null>(null);

  useEffect(() => {
    void call("lastWatched", {}).then(setWatched);
  }, []);

  if (!team) return <p>{t("match.noWatch")}</p>;
  const refresh = async () => useUi.getState().set({ summary: await call("summary", {}) });
  const watch = (id: string) =>
    act(async () => {
      setWatched(await call("startLive", { match: id as never, team }));
      await refresh();
    });
  const intervene = async (step: number, side: 0 | 1, change: MatchChange): Promise<string | null> => {
    const r = await call("intervene", { step, side, change });
    if (!r.ok) return r.error;
    setWatched(r.match);
    return null;
  };
  const finish = () =>
    act(async () => {
      setWatched(await call("finishLive", {}));
      await refresh();
    });

  return (
    <div className="match-panel">
      <aside>
        <h3>{t("match.upcoming")}</h3>
        <ul className="fixtures">
          {fixtures?.next.map((f) => (
            <li key={f.id}>
              <small>{comp(f.competitionKey)}</small>
              <FixtureLine f={f} />
              <button disabled={busy || watched?.live} onClick={() => watch(f.id)}>{t("match.watch")}</button>
            </li>
          ))}
        </ul>
        <h3>{t("tab.results")}</h3>
        <ul className="fixtures">
          {fixtures?.past.map((f) => (
            <li key={f.id}>
              <small>{comp(f.competitionKey)}</small>
              <FixtureLine f={f} />
            </li>
          ))}
        </ul>
      </aside>
      <section>{watched ? <MatchViewer key={watched.fixture.id} m={watched} onIntervene={intervene} onFinish={finish} /> : <p>{t("match.noWatch")}</p>}</section>
    </div>
  );
}
