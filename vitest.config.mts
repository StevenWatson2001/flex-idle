import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // Database tests make dozens of calls to dev and run side by side; from
    // CI they can pass 5 s, so a slow network isn't reported as a failure.
    testTimeout: 20_000,
    // Playwright runs e2e/ itself.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
