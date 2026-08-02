import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
it("declares Hebrew and RTL at the document root", () => { const layout = readFileSync("app/layout.tsx", "utf8"); expect(layout).toContain('lang="he" dir="rtl"'); });

