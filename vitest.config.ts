import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // The real `server-only` guard throws outside a React Server Components
      // runtime; shim it so unit tests can import server modules directly.
      "server-only": fileURLToPath(new URL("./tests/setup/server-only-shim.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    setupFiles: ["tests/setup/load-env.ts"],
    globals: true,
  },
});
