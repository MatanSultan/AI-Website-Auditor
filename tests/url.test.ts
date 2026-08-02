import { describe, expect, it } from "vitest";
import { isPrivateAddress, normalizeUrl } from "@/lib/security/url";
describe("URL normalization and SSRF", () => {
  it("adds HTTPS and removes tracking parts", () => expect(normalizeUrl("Example.com/path/?x=1#top").toString()).toBe("https://example.com/path"));
  it.each(["http://localhost", "http://127.0.0.1", "http://[::1]", "file:///etc/passwd", "http://user:pass@example.com"])("blocks unsafe target %s", (target) => expect(() => normalizeUrl(target)).toThrow());
  it.each(["10.0.0.1", "172.20.1.2", "192.168.1.1", "169.254.169.254", "::1", "fd00::1", "fe80::1"])("recognizes private address %s", (ip) => expect(isPrivateAddress(ip)).toBe(true));
  it("allows public addresses", () => expect(isPrivateAddress("8.8.8.8")).toBe(false));
});

