/**
 * Optional source URL shown under screenshot images (feed + detail).
 */

export type ScreenshotSourceLink = {
  href: string;
  label: string;
};

/**
 * When `capture_type` is screenshot/image and `url` is set, return a safe
 * `{ href, label }` where `label` is the hostname without leading `www.`.
 * Returns `null` for invalid URLs or non-screenshot clips.
 */
export function screenshotSourceLinkFromCapture(c: {
  capture_type: string | null | undefined;
  url: string | null | undefined;
}): ScreenshotSourceLink | null {
  const ct = String(c.capture_type ?? "").trim().toLowerCase();
  if (ct !== "screenshot" && ct !== "image") return null;
  const href = String(c.url ?? "").trim();
  if (!href) return null;
  try {
    const u = new URL(href);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const label = u.hostname.replace(/^www\./i, "");
    if (!label) return null;
    return { href, label };
  } catch {
    return null;
  }
}
