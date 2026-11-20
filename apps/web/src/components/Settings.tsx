import { LOCALES, type Locale } from "@tf/i18n";
import { useEffect, useState } from "react";
import { useT } from "../i18n";
import { useUi } from "../store";

/**
 * Ajustes: idioma y reiniciar la carrera (semilla y datos reales). Empezar de nuevo no está
 * a mano en la cabecera: se pierde la partida, así que se pide confirmación.
 */
export function Settings({ seed, real, onRestart, onClose }: {
  seed: string;
  real: boolean;
  onRestart: (seed: string, real: boolean) => void;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const [newSeed, setNewSeed] = useState(seed);
  const [newReal, setNewReal] = useState(real);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const setLocale = (l: Locale) => {
    try {
      localStorage.setItem("tf.locale", l);
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
    useUi.getState().set({ locale: l });
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h3>{t("settings.title")}</h3>
          <span style={{ flex: 1 }} />
          <button onClick={onClose}>{t("settings.close")}</button>
        </div>
        <section>
          <label>
            {t("ui.language")}{" "}
            <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
              {LOCALES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
        </section>
        <section>
          <h4>{t("settings.restart")}</h4>
          <p className="hint">{t("settings.restartHelp")}</p>
          <div className="row">
            <label>
              {t("ui.seed")} <input value={newSeed} onChange={(e) => setNewSeed(e.target.value)} size={8} />
            </label>
            <label>
              <input type="checkbox" checked={newReal} onChange={(e) => setNewReal(e.target.checked)} /> {t("ui.realData")}
            </label>
          </div>
          {confirm ? (
            <div className="row">
              <strong className="bad">{t("settings.restartConfirm")}</strong>
              <button className="primary" onClick={() => onRestart(newSeed, newReal)}>{t("settings.restartYes")}</button>
              <button onClick={() => setConfirm(false)}>{t("settings.restartNo")}</button>
            </div>
          ) : (
            <button onClick={() => setConfirm(true)}>{t("settings.restart")}</button>
          )}
        </section>
      </div>
    </div>
  );
}
