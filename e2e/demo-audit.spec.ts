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

test("Demo never grants access to the paid full report", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "authorization behavior is viewport-independent");
  await page.goto("/");
  const payload = { url: "https://example.com", locale: "he", questionnaire: { siteType: "ecommerce", primaryGoal: "sales", industry: "test industry", monthlyVisits: "unknown", conversionRate: null, monthlyRevenue: "unknown", valuePerConversion: null } };
  const id = await page.evaluate(async (body) => {
    const response = await fetch("/api/audits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return (await response.json() as { id: string }).id;
  }, payload);
  expect((await page.context().cookies()).some((cookie) => cookie.name.startsWith("audit_access_"))).toBe(false);
  const anonymous = await playwrightRequest.newContext({ baseURL: "http://127.0.0.1:3000" });
  expect((await anonymous.get(`/api/audits/${id}/full`)).status()).toBe(401);
  expect((await anonymous.get(`/api/audits/${id}x/public`)).status()).toBe(404);
  await anonymous.dispose();
});

test("Vercel-like stateless Demo flow reaches results, survives refresh, and accepts a non-persistent lead", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /עוצר לקוחות/ })).toBeVisible();
  await page.getByLabel("כתובת האתר לבדיקה").fill("demo-shop.co.il");
  await page.getByRole("button", { name: /בדקו את האתר/ }).click();
  await page.getByLabel("תחום פעילות").fill("עיצוב הבית");
  await page.getByRole("button", { name: "התחילו את הבדיקה" }).click();
  await expect(page).toHaveURL(/\/results/, { timeout: 15_000 });
  await expect(page.getByText("3 הדברים שכדאי לבדוק קודם")).toBeVisible();

  const id = new URL(page.url()).pathname.split("/")[2];
  const firstResponse = await page.request.get(`/api/audits/${id}/public`);
  expect(firstResponse.status()).toBe(200);
  const first = await firstResponse.json();
  expect(first).toMatchObject({ status: "COMPLETED", demoMode: true, dataSource: "fixture" });

  await page.reload();
  await expect(page.getByText("3 הדברים שכדאי לבדוק קודם")).toBeVisible();
  const second = await (await page.request.get(`/api/audits/${id}/public`)).json();
  expect(second).toEqual(first);

  await page.getByLabel("שם מלא").fill("בדיקת Preview");
  await page.getByLabel("טלפון").fill("050-1234567");
  await page.getByLabel("אימייל").fill("preview@example.com");
  await page.getByText(/אני מסכים/).click();
  const leadResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/leads") && response.request().method() === "POST");
  await page.getByRole("button", { name: /אשמח שיחזרו/ }).click();
  const leadResponse = await leadResponsePromise;
  expect(leadResponse.status()).toBe(202);
  await expect(page).toHaveURL(/\/thank-you/);
});
