import type { FixtureView } from "@tf/core";
import { useView } from "../hooks";
import { useT } from "../i18n";
import { useUi } from "../store";

export function FixtureLine({ f }: { f: FixtureView }) {
  const { team } = useT();
  return (
    <>
      <span className="home">{team(f.home)}</span>
      <span className="score">
        {f.score ? `${f.score[0]} – ${f.score[1]}` : "–"}
        {f.pens && ` (${f.pens[0]}–${f.pens[1]} p.)`}
      </span>
      <span className="away">{team(f.away)}</span>
    </>
  );
}

export function Results() {
  const { t } = useT();
  const competition = useUi((s) => s.competition);
  const list = useView("results", competition ? { competition } : null);
  if (!list) return null;
  if (!list.length) return <p>{t("ui.none")}</p>;
  return (
    <ul className="fixtures">
      {list.map((f) => (
        <li key={f.id}>
          <span className="day">{new Date(Date.UTC(2000, 0, 1) + f.day * 86400000).toISOString().slice(5, 10)}</span>
          <FixtureLine f={f} />
        </li>
      ))}
    </ul>
  );
}
