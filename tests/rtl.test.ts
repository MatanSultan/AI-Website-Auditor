import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
it("declares Hebrew and RTL at the document root", () => { const layout = readFileSync("app/layout.tsx", "utf8"); expect(layout).toContain('lang="he" dir="rtl"'); });
it("keeps questionnaire data-handling copy truthful in Demo and persisted modes", () => {
  const auditForm = readFileSync("components/audit-form.tsx", "utf8");

  expect(auditForm).toContain("מצב הדגמה: לא מתבצעת סריקה חיצונית אמיתית");
  expect(auditForm).toContain("אינם נשמרים במסד נתונים או ב־CRM");
  expect(auditForm).toContain("הנתונים נשמרים לצורך ביצוע הבדיקה ובהתאם למדיניות הפרטיות");
});
