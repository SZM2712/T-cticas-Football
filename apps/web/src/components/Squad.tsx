import { useView } from "../hooks";
import { money } from "../format";
import { useT } from "../i18n";
import { useUi } from "../store";

export function Squad() {
  const { t, nation, locale } = useT();
  const team = useUi((s) => s.team);
  const competition = useUi((s) => s.competition);
  const rows = useView("squad", team ? { team, ...(competition ? { competition } : {}) } : null);
  const open = useUi((s) => s.player);
  if (!team) return <p>{t("match.noWatch")}</p>;
  if (!rows) return null;
  return (
    <>
    <table className="grid">
      <thead>
        <tr>
          <th>{t("squad.position")}</th>
          <th className="left">{t("squad.player")}</th>
          <th>{t("squad.age")}</th>
          <th className="left">{t("ui.nationality")}</th>
          <th>{t("squad.level")}</th>
          <th>{t("squad.fitness")}</th>
          <th className="left">{t("squad.status")}</th>
          <th>{t("squad.apps")}</th>
          <th>{t("squad.goals")}</th>
          <th>{t("squad.assists")}</th>
          <th>{t("squad.rating")}</th>
          <th>{t("squad.wage")}</th>
          <th>{t("squad.value")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className={r.id === open ? "followed" : ""} onClick={() => useUi.getState().set({ player: r.id })}>
            <td title={t(`pos.${r.position}`)}>{r.position}</td>
            <td className="left link">{r.name}</td>
            <td>{r.age}</td>
            <td className="left">{nation(r.nationality)}</td>
            <td>{r.level.toFixed(1)}</td>
            <td>
              <span className="bar"><span style={{ width: `${r.fitness}%` }} /></span>
            </td>
            <td className="left">
              {r.retirement ? <strong className="bad">{t(`status.${r.retirement}`)}</strong> : r.injuredDays > 0 ? t("status.injured", { days: r.injuredDays }) : r.suspended ? t("status.suspended") : t("status.ok")}
            </td>
            <td>{r.apps}</td>
            <td>{r.goals}</td>
            <td>{r.assists}</td>
            <td>{r.avgRating?.toFixed(2) ?? "–"}</td>
            <td>{r.wage !== null ? `${r.wage.toLocaleString(locale)} €` : "–"}</td>
            <td>{money(r.value, locale)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </>
  );
}
