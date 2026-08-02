import { afterEach, expect, it } from "vitest";
import { POST } from "@/app/api/internal/audit-worker/route";
import { resetEnvironmentForTests } from "@/lib/env";
import { productionEnvironment } from "@/tests/helpers/environment";

const original = { ...process.env };
afterEach(() => { process.env = { ...original }; resetEnvironmentForTests(); });
it("rejects an unsigned production delivery", async () => {
  Object.assign(process.env, productionEnvironment()); resetEnvironmentForTests();
  const response = await POST(new Request("https://audit.example.com/api/internal/audit-worker", { method: "POST", body: JSON.stringify({ auditId: crypto.randomUUID() }) }));
  expect(response.status).toBe(401);
});
