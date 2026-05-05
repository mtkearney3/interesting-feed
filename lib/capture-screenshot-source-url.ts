/**
 * Optional source URL shown under screenshot images (feed + detail).
 */

import { isSupabaseUserCaptureImageUrl } from "@/lib/capture-kind";

export type ScreenshotSourceLink = {
  href: string;
  label: string;
};

/**
 * When the clip is screenshot/image (or a user-uploaded capture image with a
 * reference `url`) return a safe `{ href, label }` where `label` is the hostname
 * without leading `www.`. Does not depend on {@link captureUrlForDisplay}.
 */
export function screenshotSourceLinkFromCapture(c: {
  capture_type: string | null | undefined;
  url: string | null | undefined;
  image_url?: string | null | undefined;
}): ScreenshotSourceLink | null {
  const ct = String(c.capture_type ?? "").trim().toLowerCase();
  const img = String(c.image_url ?? "").trim();
  const userScreenshot =
    Boolean(img) && isSupabaseUserCaptureImageUrl(img);
  const screenshotLike =
    ct === "screenshot" ||
    ct === "image" ||
    (userScreenshot && Boolean(String(c.url ?? "").trim()));
  if (!screenshotLike) return null;
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
