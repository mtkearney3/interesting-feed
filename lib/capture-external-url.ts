/**
 * @deprecated Import from `@/lib/capture-kind` instead. Barrel kept for older imports.
 */

export {
  getCaptureKind,
  isExternalArticleUrl,
  isStorageImageUrl,
  stripStorageUrlsFromRawText,
  type CaptureKind,
  type CaptureKindInput,
  type CaptureKindPipeline,
  type CaptureKindResult,
} from "@/lib/capture-kind";

import { isStorageImageUrl } from "@/lib/capture-kind";

/** @deprecated Use {@link isStorageImageUrl}. */
export function isStorageOrImageAssetUrl(urlStr: string): boolean {
  return isStorageImageUrl(urlStr);
}

/** Narrower raster / storage heuristic (legacy). Prefer {@link isStorageImageUrl}. */
export function isImageUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u) return false;
  return (
    u.includes("supabase.co/storage") ||
    u.includes("/storage/v1/object/") ||
    u.endsWith(".png") ||
    u.endsWith(".jpg") ||
    u.endsWith(".jpeg") ||
    u.endsWith(".webp") ||
    u.endsWith(".gif")
  );
}
