import type { PlayerId, Position, TacticsView } from "@tf/core";
import { useState } from "react";
import { useT } from "../i18n";
import { useUi } from "../store";

const openPlayer = (id: string) => useUi.getState().set({ player: id });

/** Estrellas (0,5–5) en medias: el relleno dorado se recorta al porcentaje. */
export function Stars({ n }: { n: number }) {
  return (
    <span className="stars" title={`${n}/5`} aria-label={`${n}/5`}>
      <span style={{ width: `${(n / 5) * 100}%` }}>★★★★★</span>
    </span>
  );
}

const surname = (name: string) => name.split(" ").slice(-1)[0] ?? name;

/**
 * Alineación sobre el campo: se pulsa un puesto y luego un jugador de la lista (si ya jugaba,
 * se intercambian). La lista muestra en qué puestos sabe jugar cada uno y sus estrellas en el
 * puesto elegido, para ver quién rinde mejor dónde.
 */
export function LineupPitch({ view, formation, lineup, fixed, onChange }: {
  view: TacticsView;
  formation: string;
  lineup: PlayerId[];
  fixed: boolean;
  onChange: (lineup: PlayerId[]) => void;
}) {
  const { t } = useT();
  const [slot, setSlot] = useState(0);
  const slots = view.slots[formation] ?? [];
  const coords = view.pitch[formation] ?? [];
  // El dibujo ocupa todo el campo: de la portería propia (abajo) a la delantera (arriba).
  const xs = coords.map((c) => c.x);
  const x0 = Math.min(...xs, 0);
  const x1 = Math.max(...xs, 0.5);
  const role = (slots[slot] ?? "GK") as Position;
  const byId = new Map(view.squad.map((p) => [p.id, p]));
  const assign = (id: PlayerId) => {
    const next = [...lineup];
    const j = next.indexOf(id);
    if (j >= 0) next[j] = next[slot]!;
    next[slot] = id;
    onChange(next);
    // Pasa al siguiente puesto para elegir rápido.
    setSlot((slot + 1) % slots.length);
  };
  const list = [...view.squad].sort((a, b) => b.stars[role] - a.stars[role] || b.level - a.level || a.name.localeCompare(b.name));

  return (
    <div className="lineup-pitch">
      <div className="pitch" role="group" aria-label={t("tactics.lineup")}>
        <div className="pitch-lines" />
        {slots.map((r, i) => {
          const p = byId.get(lineup[i]!);
          const c = coords[i] ?? { x: 0.5, y: 0.5 };
          return (
            <button
              key={i}
              className={`token${i === slot ? " selected" : ""}${p && (p.injured || p.suspended) ? " unavailable" : ""}`}
              style={{ left: `${8 + c.y * 84}%`, top: `${91 - ((c.x - x0) / (x1 - x0)) * 80}%` }}
              onClick={() => setSlot(i)}
              title={t(`pos.${r}`)}
            >
              <span className="token-role">{r}</span>
              <span className="token-name">{p ? surname(p.name) : "—"}</span>
              {p && <Stars n={p.stars[r as Position]} />}
            </button>
          );
        })}
      </div>
      <div className="pitch-side">
        <p className="hint">{t(fixed ? "tactics.pickHelp" : "tactics.lineupAuto")}</p>
        <h4>{t("tactics.starsIn", { role: t(`pos.${role}`) })}</h4>
        <table className="grid pick-list">
          <thead>
            <tr>
              <th className="left">{t("squad.player")}</th>
              <th>{t("tactics.stars")}</th>
              <th className="left">{t("tactics.positions")}</th>
              <th>{t("squad.level")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const at = lineup.indexOf(p.id);
              return (
                <tr key={p.id} className={at === slot ? "followed" : ""} onClick={() => assign(p.id)}>
                  <td className="left">
                    <span className="link" onClick={(e) => { e.stopPropagation(); openPlayer(p.id); }}>{p.name}</span>
                    {at >= 0 && <span className="hint"> · {slots[at]}</span>}
                  </td>
                  <td><Stars n={p.stars[role]} /></td>
                  <td className="left">
                    {p.positions.map((x) => (
                      <span key={x.pos} className={`pos-chip ${x.comfort}`} title={t(`comfort.${x.comfort}`)}>{x.pos}</span>
                    ))}
                  </td>
                  <td>{p.level.toFixed(1)}</td>
                  <td className="left">
                    {p.injured ? <span className="bad">{t("tactics.injured")}</span> : p.suspended ? <span className="bad">{t("tactics.suspended")}</span> : p.fitness < 80 ? `${p.fitness}%` : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
