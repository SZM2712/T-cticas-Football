import { GOALKEEPING, MENTAL, PHYSICAL, TECHNICAL, type AttrKey } from "@tf/core";
import { useT } from "../i18n";

/** Color de una barra según el valor (1–20): rojo, ámbar, verde, verde intenso. */
function tone(v: number): string {
  return v >= 16 ? "var(--attr-top, #1b7f3b)" : v >= 12 ? "var(--attr-good, #4caf50)" : v >= 8 ? "var(--attr-mid, #e0a100)" : "var(--attr-low, #d84315)";
}

function Group({ title, keys, values }: { title: string; keys: readonly AttrKey[]; values: Record<AttrKey, number> }) {
  const { t } = useT();
  return (
    <div className="attr-group">
      <h5>{title}</h5>
      {keys.map((k) => {
        const v = values[k] ?? 0;
        return (
          <div key={k} className="attr-row" title={`${t(`attr.${k}`)}: ${v}`}>
            <span className="attr-name">{t(`attr.${k}`)}</span>
            <span className="attr-bar"><span style={{ width: `${(v / 20) * 100}%`, background: tone(v) }} /></span>
            <span className="attr-val">{v}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Habilidades visibles del jugador (1–20) en barras por grupo; los porteros ven las suyas. */
export function AttributeChart({ values, goalkeeper }: { values: Record<AttrKey, number>; goalkeeper: boolean }) {
  const { t } = useT();
  return (
    <div className="attr-chart">
      {goalkeeper && <Group title={t("attrGroup.goalkeeping")} keys={GOALKEEPING} values={values} />}
      {!goalkeeper && <Group title={t("attrGroup.technical")} keys={TECHNICAL} values={values} />}
      <Group title={t("attrGroup.mental")} keys={MENTAL} values={values} />
      <Group title={t("attrGroup.physical")} keys={PHYSICAL} values={values} />
    </div>
  );
}
