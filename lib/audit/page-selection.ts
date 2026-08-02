const forbidden = /\/(login|log-in|signin|account|checkout|admin|payment|wp-admin|cart\/checkout)(\/|$)/i;
const priorities: Array<[RegExp, number, string]> = [
  [/^\/$/, 100, "home"], [/\/(pricing|plans|מחיר)/i, 90, "pricing"],
  [/\/(product|products|shop|store|מוצר)/i, 85, "product"], [/\/(service|services|שירות)/i, 82, "service"],
  [/\/(category|collection|קטגור)/i, 78, "category"], [/\/(contact|צור-קשר)/i, 72, "contact"],
  [/\/(about|אודות)/i, 65, "about"], [/\/(faq|questions|שאלות)/i, 60, "faq"],
  [/\/(blog|article|guide|מאמר)/i, 50, "content"], [/\/(cart|basket|עגלה)/i, 40, "cart"],
];

export type SelectedPage = { url: string; pageType: string };

export function canonicalPageUrl(input: string | URL): string {
  const url = new URL(input);
  url.hash = "";
  url.search = "";
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  return url.toString();
}

export function selectPages(candidates: string[], origin: URL, limit = 10): SelectedPage[] {
  const unique = new Map<string, SelectedPage & { priority: number }>();
  for (const candidate of [origin.toString(), ...candidates]) {
    try {
      const url = new URL(candidate, origin);
      if (url.protocol !== origin.protocol || url.hostname !== origin.hostname || forbidden.test(url.pathname)) continue;
      const normalized = canonicalPageUrl(url);
      const normalizedUrl = new URL(normalized);
      const [match, priority, pageType] = priorities.find(([regex]) => regex.test(url.pathname)) ?? [null, 10, "other"];
      void match;
      if (!unique.has(normalized)) unique.set(normalized, { url: normalizedUrl.toString(), pageType, priority });
    } catch { /* invalid discovery result */ }
  }
  return [...unique.values()].sort((a, b) => b.priority - a.priority).slice(0, limit).map(({ url, pageType }) => ({ url, pageType }));
}
