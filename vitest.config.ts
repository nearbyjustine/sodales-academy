import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
// @ts-expect-error - dotenv is available as a transitive dependency
import { config } from "dotenv";

// Load .env.local for test environment (DATABASE_URL, etc.)
config({ path: ".env.local" });

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      "server-only": new URL("./src/test/server-only-stub.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    // Node 26's native localStorage shadows jsdom's; without a backing file it's
    // silently undefined instead of the jsdom Storage implementation tests expect.
    env: {
      NODE_OPTIONS: "--localstorage-file=node_modules/.cache/vitest-localstorage",
    },
  },
});
