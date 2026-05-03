import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const BUCKET = "capture-images";
const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

function extFromMime(mime: string): string | null {
  return ALLOWED.get(mime.toLowerCase()) ?? null;
}

function sniffMime(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
    return "image/webp";
  }
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return "image/gif";
  }
  return "image/jpeg";
}

/**
 * Upload raw image bytes to `capture-images`, under `shortcut/{userId}/` when
 * `userId` is set (token-validated shortcut flow).
 */
export async function uploadCaptureImageBuffer(
  supabase: SupabaseClient,
  buf: Buffer,
  userId: string | null
): Promise<{ image_url: string } | { error: string; status: number }> {
  if (buf.length === 0) {
    return { error: "Empty image data", status: 400 };
  }
  if (buf.length > MAX_BYTES) {
    return {
      error: `Image too large (max ${MAX_BYTES / 1024 / 1024}MB)`,
      status: 400,
    };
  }

  const mime = sniffMime(buf);
  const ext = extFromMime(mime);
  if (!ext) {
    return { error: "Unsupported image type", status: 400 };
  }

  const prefix = userId ? `shortcut/${userId}` : "shortcut/anon";
  const path = `${prefix}/${randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, {
      contentType: mime,
      upsert: false,
    });

  if (uploadError) {
    return { error: uploadError.message, status: 500 };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return { image_url: publicUrl };
}
