import { useView } from "../hooks";
import { useT } from "../i18n";
import { useUi } from "../store";

export function Scorers() {
  const { t, team } = useT();
  const competition = useUi((s) => s.competition);
  const rows = useView("scorers", competition ? { competition } : null);
  if (!rows) return null;
  if (!rows.length) return <p>{t("ui.none")}</p>;
  return (
    <table className="grid">
      <thead>
        <tr>
          <th>#</th>
          <th className="left">{t("squad.player")}</th>
          <th className="left">{t("table.team")}</th>
          <th>{t("squad.apps")}</th>
          <th>{t("squad.goals")}</th>
          <th>{t("squad.assists")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id}>
            <td>{i + 1}</td>
            <td className="left">{r.name}</td>
            <td className="left">{team(r.team)}</td>
            <td>{r.apps}</td>
            <td><strong>{r.goals}</strong></td>
            <td>{r.assists}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
