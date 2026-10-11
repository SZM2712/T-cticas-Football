// Cliente RPC del Worker del juego.

import type { Api, Method, Request, Response } from "./protocol";

const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
let next = 1;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

worker.onmessage = (e: MessageEvent<Response>) => {
  const p = pending.get(e.data.id);
  if (!p) return;
  pending.delete(e.data.id);
  if (e.data.ok) p.resolve(e.data.data);
  else p.reject(new Error(e.data.error));
};

export function call<M extends Method>(method: M, args: Parameters<Api[M]>[0]): Promise<Awaited<ReturnType<Api[M]>>> {
  const id = next++;
  const req: Request<M> = { id, method, args };
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    worker.postMessage(req);
  });
}

// Depuración: permite llamar al Worker desde la consola del navegador (y desde Playwright).
(globalThis as unknown as { tf: typeof call }).tf = call;
