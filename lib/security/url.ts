import dns from "node:dns/promises";
import net from "node:net";
import http from "node:http";
import https from "node:https";

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

type LookupRecord = { address: string; family: number };
type Resolver = (hostname: string) => Promise<LookupRecord[]>;

async function resolveOnce(input: string, resolver: Resolver): Promise<{ url: URL; address: LookupRecord }> {
  const url = normalizeUrl(input);
  const records = await resolver(url.hostname);
  if (!records.length || records.some((record) => isPrivateAddress(record.address))) throw new Error("BLOCKED_HOST");
  return { url, address: records[0] };
}

async function pinnedRequest(url: URL, address: LookupRecord, init: RequestInit): Promise<Response> {
  if (init.body && typeof init.body !== "string" && !Buffer.isBuffer(init.body)) throw new Error("UNSUPPORTED_REQUEST_BODY");
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const request = transport.request(url, {
      method: init.method ?? "GET", headers, signal: AbortSignal.timeout(12_000),
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      ...(url.protocol === "https:" ? { servername: url.hostname } : {}),
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => resolve(new Response(Buffer.concat(chunks), { status: response.statusCode ?? 502, headers: response.headers as HeadersInit })));
    });
    request.on("error", reject);
    if (init.body) request.write(init.body);
    request.end();
  });
}

export async function safeFetch(input: string, init: RequestInit = {}, resolver: Resolver = async (hostname) => dns.lookup(hostname, { all: true, verbatim: true }), requester = pinnedRequest): Promise<Response> {
  let resolved = await resolveOnce(input, resolver);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const response = await requester(resolved.url, resolved.address, init);
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location || redirect === 3) throw new Error("REDIRECT_LIMIT");
    resolved = await resolveOnce(new URL(location, resolved.url).toString(), resolver);
  }
  throw new Error("REDIRECT_LIMIT");
}
