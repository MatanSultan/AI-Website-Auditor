import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const environment = { ...process.env };
if (environment.DEMO_MODE === "true") {
  const validationUrl = "postgresql://demo:demo@127.0.0.1:5432/demo?schema=public";
  environment.DATABASE_URL ||= validationUrl;
  environment.DIRECT_URL ||= validationUrl;
}

const prismaCli = resolve("node_modules/prisma/build/index.js");
const result = spawnSync(process.execPath, [prismaCli, "validate"], {
  env: environment,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
