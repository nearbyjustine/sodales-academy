import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
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
  },
});
