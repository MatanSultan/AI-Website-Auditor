import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const output = resolve("lib/demo/generated-signing-key.ts");
const key = randomBytes(32).toString("base64url");

await mkdir(dirname(output), { recursive: true });
await writeFile(
  output,
  `// Generated locally at build/test time. Never commit this file.\nexport const demoAuditSigningKey = "${key}";\n`,
  { encoding: "utf8", mode: 0o600 },
);

console.log("[demo] Generated an ephemeral deployment-scoped signing key.");
