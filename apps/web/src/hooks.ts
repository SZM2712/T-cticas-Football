import { useEffect, useState } from "react";
import { call } from "./client";
import type { Api, Method } from "./protocol";
import { useUi } from "./store";

/** Pide una vista al Worker y la recarga cuando cambia el mundo o los argumentos. */
export function useView<M extends Method>(method: M, args: Parameters<Api[M]>[0] | null): Awaited<ReturnType<Api[M]>> | null {
  const version = useUi((s) => s.version);
  const [data, setData] = useState<Awaited<ReturnType<Api[M]>> | null>(null);
  const key = JSON.stringify(args);
  useEffect(() => {
    if (args === null) {
      setData(null);
      return;
    }
    let alive = true;
    call(method, args)
      .then((d) => alive && setData(d))
      .catch((e: Error) => useUi.getState().set({ error: e.message }));
    return () => {
      alive = false;
    };
    // `key` resume `args` (serializado) para no recargar en cada render.
  }, [method, key, version]);
  return data;
}

/** Ejecuta una acción que cambia el mundo y refresca las vistas. */
export async function act<T>(fn: () => Promise<T>): Promise<T | undefined> {
  const ui = useUi.getState();
  ui.set({ busy: true, error: null });
  try {
    return await fn();
  } catch (e) {
    ui.set({ error: (e as Error).message });
    return undefined;
  } finally {
    const s = useUi.getState();
    s.set({ busy: false, version: s.version + 1 });
  }
}
