import { describe, expect, it } from "vitest";
import { isPrivateAddress, normalizeUrl, safeFetch } from "@/lib/security/url";

describe("URL normalization and SSRF", () => {
  it("adds HTTPS, removes tracking parts and normalizes a trailing dot/slash", () => expect(normalizeUrl("Example.com./path/?x=1#top").toString()).toBe("https://example.com/path"));
  it.each(["http://localhost", "http://foo.localhost", "http://127.0.0.1", "http://[::1]", "file:///etc/passwd", "http://user:pass@example.com", "https://example.com:8443"])("blocks unsafe target %s", (target) => expect(() => normalizeUrl(target)).toThrow());
  it.each(["10.0.0.1", "172.20.1.2", "192.168.1.1", "169.254.169.254", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:c0a8:101"])("recognizes private address %s", (ip) => expect(isPrivateAddress(ip)).toBe(true));
  it("allows public addresses", () => expect(isPrivateAddress("8.8.8.8")).toBe(false));
  it("rejects DNS answers containing any private address", async () => {
    const resolver = async () => [{ address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 }];
    await expect(safeFetch("https://public.example", {}, resolver, async () => new Response("never"))).rejects.toThrow("BLOCKED_HOST");
  });
  it("revalidates and blocks a redirect to a private address", async () => {
    const resolver = async (hostname: string) => hostname === "public.example" ? [{ address: "8.8.8.8", family: 4 }] : [{ address: "169.254.169.254", family: 4 }];
    const requester = async () => new Response(null, { status: 302, headers: { location: "http://metadata.example/latest" } });
    await expect(safeFetch("https://public.example", {}, resolver, requester)).rejects.toThrow("BLOCKED_HOST");
  });
});
