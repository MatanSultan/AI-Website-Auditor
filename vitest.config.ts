import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({ test: { include: ["tests/**/*.test.ts"], environment: "node", globals: true, env: { DEMO_MODE: "true" }, coverage: { reporter: ["text", "html"] } }, resolve: { alias: { "@": path.resolve(__dirname, ".") } } });
