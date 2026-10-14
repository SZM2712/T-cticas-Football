import { useView } from "../hooks";
import { useT } from "../i18n";
import { useUi } from "../store";

/** Clasificación de la liga seleccionada. Pulsar un equipo lo convierte en el equipo seguido. */
export function LeagueTable() {
  const { t, team: teamName } = useT();
  const competition = useUi((s) => s.competition);
  const followed = useUi((s) => s.team);
  const rows = useView("table", competition ? { competition } : null);
  if (!rows) return null;
  return (
    <table className="grid">
      <thead>
        <tr>
          <th>#</th>
          <th className="left">{t("table.team")}</th>
          <th>{t("table.played")}</th>
          <th>{t("table.won")}</th>
          <th>{t("table.drawn")}</th>
          <th>{t("table.lost")}</th>
          <th>{t("table.gf")}</th>
          <th>{t("table.ga")}</th>
          <th>{t("table.gd")}</th>
          <th>{t("table.pts")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.team.id} className={r.team.id === followed ? "followed" : ""} onClick={() => useUi.getState().set({ team: r.team.id })}>
            <td>{i + 1}</td>
            <td className="left link">{teamName(r.team)}</td>
            <td>{r.played}</td>
            <td>{r.won}</td>
            <td>{r.drawn}</td>
            <td>{r.lost}</td>
            <td>{r.gf}</td>
            <td>{r.ga}</td>
            <td>{r.gf - r.ga}</td>
            <td><strong>{r.points}</strong></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
