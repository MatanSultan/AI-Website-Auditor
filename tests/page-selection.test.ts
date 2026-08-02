import { expect, it } from "vitest";
import { selectPages } from "@/lib/audit/page-selection";
it("prioritizes useful same-host pages and excludes private paths", () => { const origin = new URL("https://shop.test/"); const pages = selectPages(["https://shop.test/login", "https://evil.test/product", "/products/chair?utm=1", "/about", "/pricing", "/products/chair#details"], origin); expect(pages[0]).toEqual({ url: "https://shop.test/", pageType: "home" }); expect(pages.some((p) => p.url.includes("login"))).toBe(false); expect(pages.filter((p) => p.url.includes("chair"))).toHaveLength(1); expect(pages.map((p) => p.pageType)).toContain("pricing"); });

