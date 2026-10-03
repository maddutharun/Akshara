import { defineConfig } from "vitest/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": resolve(dirname(fileURLToPath(import.meta.url))) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "app/**/*.test.ts", "lib/**/*.test.ts"],
  },
});
