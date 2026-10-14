import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// UI de depuración (Fase 2). El juego corre en un Web Worker; la UI solo envía comandos
// y pide vistas. Los datos reales se cargan bajo demanda (import dinámico) y nunca por defecto.
export default defineConfig({
  plugins: [react()],
  worker: { format: "es" },
  server: { fs: { allow: ["../.."] } },
  build: { target: "es2022", chunkSizeWarningLimit: 4000 },
});
