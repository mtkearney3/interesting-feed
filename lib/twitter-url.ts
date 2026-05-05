/**
 * Detect X / Twitter article URLs for special-case enrichment (no readable article HTML).
 */

function normalizeHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^www\./, "");
}

export function isTwitterOrXHostname(hostname: string): boolean {
  const h = normalizeHost(hostname);
  return (
    h === "x.com" ||
    h === "twitter.com" ||
    h.endsWith(".x.com") ||
    h.endsWith(".twitter.com")
  );
}

export function isTwitterOrXArticleUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr.trim());
    return isTwitterOrXHostname(u.hostname);
  } catch {
    return false;
  }
}
