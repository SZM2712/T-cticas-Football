import { useEffect } from "react";
import { useUi } from "../store";
import { PlayerPanel } from "./PlayerPanel";

/** La ficha del jugador se abre encima de cualquier pestaña al pulsar su nombre (Esc o ✕ la cierran). */
export function PlayerModal({ id }: { id: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") useUi.getState().set({ player: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="modal-backdrop" onClick={() => useUi.getState().set({ player: null })}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <PlayerPanel id={id} />
      </div>
    </div>
  );
}
