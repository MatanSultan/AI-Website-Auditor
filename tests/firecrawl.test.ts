import { afterEach, expect, it, vi } from "vitest";
import { canonicalPageUrl, selectPages } from "@/lib/audit/page-selection";
import { FirecrawlProvider } from "@/lib/providers/firecrawl";

afterEach(() => vi.unstubAllGlobals());

it("matches canonical URLs despite queries and trailing slashes", () => {
  expect(canonicalPageUrl("https://Example.com/products/?utm_source=x#top")).toBe("https://example.com/products");
  expect(selectPages(["https://example.com/products/", "https://example.com/products?x=1"], new URL("https://example.com/"))).toHaveLength(2);
});
it("keeps partial crawl pages when the provider completes without repeating them", async () => {
  const responses = [
    new Response(JSON.stringify({ id: "job" })),
    new Response(JSON.stringify({ status: "scraping", data: [{ url: "https://example.com/products/", markdown: "content", metadata: { title: "Product" } }] })),
    new Response(JSON.stringify({ status: "completed", data: [] })),
  ];
  vi.stubGlobal("fetch", vi.fn(async () => responses.shift()!));
  await expect(new FirecrawlProvider("key", 0).crawl(["https://example.com/products"])).resolves.toEqual([expect.objectContaining({ url: "https://example.com/products", markdown: "content" })]);
});
