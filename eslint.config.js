import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "coverage/**", "out/**", "**/dist/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Regla 1 de CLAUDE.md: el núcleo es determinista.
    files: ["packages/core/src/**/*.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Usa el RNG con semilla de core/rng." },
        { object: "Date", property: "now", message: "El núcleo usa GameDay, no el reloj real." },
      ],
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "El núcleo usa GameDay (core/time), nunca Date." },
        { name: "performance", message: "Sin reloj real en el núcleo." },
        { name: "window", message: "El núcleo es headless." },
        { name: "document", message: "El núcleo es headless." },
        { name: "fetch", message: "El núcleo no hace IO." },
      ],
    },
  },
);
