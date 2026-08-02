import dns from "node:dns/promises";
import net from "node:net";

const blockedNames = new Set(["localhost", "localhost.localdomain", "metadata.google.internal"]);

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((value, part) => (value << 8) + Number(part), 0) >>> 0;
}

function inV4Range(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

export function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  if (net.isIPv4(normalized)) {
    return [
      ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
      ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
      ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
      ["224.0.0.0", 4], ["240.0.0.0", 4],
    ].some(([base, bits]) => inV4Range(normalized, String(base), Number(bits)));
  }
  if (net.isIPv6(normalized)) {
    return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") ||
      normalized.startsWith("fd") || /^fe[89ab]/.test(normalized) || normalized.startsWith("ff") ||
      normalized.startsWith("::ffff:") && isPrivateAddress(normalized.slice(7));
  }
  return true;
}

export function normalizeUrl(input: string): URL {
  const trimmed = input.trim();
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try { url = new URL(candidate); } catch { throw new Error("INVALID_URL"); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("UNSUPPORTED_PROTOCOL");
  if (url.username || url.password || url.port && !['80', '443'].includes(url.port)) throw new Error("UNSAFE_URL");
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!hostname || blockedNames.has(hostname) || hostname.endsWith(".localhost") || hostname.includes("..")) {
    throw new Error("BLOCKED_HOST");
  }
  if (net.isIP(hostname) && isPrivateAddress(hostname)) throw new Error("BLOCKED_HOST");
  url.hostname = net.isIPv6(hostname) ? `[${hostname}]` : hostname;
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  return url;
}

export async function assertPublicUrl(input: string): Promise<URL> {
  const url = normalizeUrl(input);
  const records = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!records.length || records.some((record) => isPrivateAddress(record.address))) throw new Error("BLOCKED_HOST");
  return url;
}

export async function safeFetch(input: string, init: RequestInit = {}): Promise<Response> {
  let current = await assertPublicUrl(input);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const response = await fetch(current, { ...init, redirect: "manual", signal: AbortSignal.timeout(12_000) });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location || redirect === 3) throw new Error("REDIRECT_LIMIT");
    current = await assertPublicUrl(new URL(location, current).toString());
  }
  throw new Error("REDIRECT_LIMIT");
}
