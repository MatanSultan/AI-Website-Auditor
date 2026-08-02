import { expect, request as playwrightRequest, test } from "@playwright/test";

const consoleErrors = new WeakMap<object, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  consoleErrors.set(page, errors);
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(async ({ page }) => {
  const unexpected = (consoleErrors.get(page) ?? []).filter((message) => !/Failed to load resource:.*403 \(Forbidden\)/.test(message));
  expect(unexpected).toEqual([]);
});

test("full report capability is audit-specific and Audit ID alone is insufficient", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "authorization behavior is viewport-independent");
  await page.goto("/");
  const payload = { url: "https://example.com", locale: "he", questionnaire: { siteType: "ecommerce", primaryGoal: "sales", industry: "test industry", monthlyVisits: "unknown", conversionRate: null, monthlyRevenue: "unknown", valuePerConversion: null } };
  const ids = await page.evaluate(async (body) => Promise.all([body, body].map(async (item) => {
    const response = await fetch("/api/audits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
    return (await response.json() as { id: string }).id;
  })), payload);
  const cookies = await page.context().cookies();
  const firstToken = cookies.find((cookie) => cookie.name === `audit_access_${ids[0]}`)?.value;
  expect(firstToken).toBeTruthy();
  await page.context().addCookies([{ name: `audit_access_${ids[1]}`, value: firstToken!, domain: "127.0.0.1", path: `/api/audits/${ids[1]}`, httpOnly: true, sameSite: "Lax" }]);
  expect(await page.evaluate(async (id) => (await fetch(`/api/audits/${id}/full`)).status, ids[1])).toBe(403);
  const anonymous = await playwrightRequest.newContext({ baseURL: "http://127.0.0.1:3000" });
  expect((await anonymous.get(`/api/audits/${ids[0]}/full`)).status()).toBe(401);
  await anonymous.dispose();
});
test("demo audit reaches a free result without exposing the full report", async ({ page }) => { await page.goto("/"); await expect(page.getByRole("heading", { name: /עוצר לקוחות/ })).toBeVisible(); await page.getByLabel("כתובת האתר לבדיקה").fill("demo-shop.co.il"); await page.getByRole("button", { name: /בדקו את האתר/ }).click(); await page.getByLabel("תחום פעילות").fill("עיצוב הבית"); await page.getByRole("button", { name: "התחילו את הבדיקה" }).click(); await expect(page).toHaveURL(/\/progress/); await expect(page).toHaveURL(/\/results/, { timeout: 15000 }); await expect(page.getByText("3 הדברים שכדאי לבדוק קודם")).toBeVisible(); const fullLink = page.url().replace("/results", "/report"); await page.goto(fullLink); await expect(page.getByRole("heading", { name: /נדרש תשלום מאומת/ })).toBeVisible(); await expect(page.getByText("תוכנית העבודה לאתר")).toHaveCount(0); });
test("lead form succeeds", async ({ page }) => { await page.goto("/audit/new?url=https%3A%2F%2Fdemo-shop.co.il"); await page.getByLabel("תחום פעילות").fill("עיצוב הבית"); await page.getByRole("button", { name: "התחילו את הבדיקה" }).click(); await expect(page).toHaveURL(/\/results/, { timeout: 15000 }); await page.getByLabel("שם מלא").fill("ישראל ישראלי"); await page.getByLabel("טלפון").fill("050-1234567"); await page.getByLabel("אימייל").fill("israel@example.com"); await page.getByText(/אני מסכים/).click(); await page.getByRole("button", { name: /אשמח שיחזרו/ }).click(); await expect(page).toHaveURL(/\/thank-you/); });
