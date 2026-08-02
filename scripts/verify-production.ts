import { spawnSync } from "node:child_process";
import { validateEnvironment } from "../lib/env";

const environment = validateEnvironment(process.env);
if (environment.demoMode) throw new Error("verify:production requires DEMO_MODE=false");
const commands: Array<[string, string[]]> = [
  ["npm", ["run", "db:validate"]], ["npm", ["run", "db:generate"]], ["npx", ["prisma", "migrate", "status"]], ["npm", ["run", "lint"]],
  ["npm", ["run", "typecheck"]], ["npm", ["test"]],
];
if (process.env.TEST_DATABASE_URL) commands.push(["npm", ["run", "test:integration"]]);
else console.log("SKIP integration tests: TEST_DATABASE_URL is not configured");
commands.push(["npm", ["run", "build"]]);
commands.push(["npm", ["run", "test:e2e"]]);
for (const [command, args] of commands) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32", env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`Production verification completed (${environment.appMode})`);
