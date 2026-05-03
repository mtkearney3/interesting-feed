import sharp from "sharp";

/** MIME types OpenAI vision accepts for image_url. */
const OPENAI_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

/** Minimum decoded bytes to accept as an image payload. */
const MIN_DECODED_BYTES = 32;

/** Minimum base64 payload length (after stripping whitespace, before decode). */
const MIN_BASE64_CHARS = 60;

export function parseShortcutDeclaredImageMime(
  body: Record<string, unknown>
): string | null {
  const keys = [
    "image_mime_type",
    "mime_type",
    "mime",
    "content_type",
    "imageMimeType",
  ] as const;
  for (const k of keys) {
    const v = body[k];
    if (typeof v !== "string") continue;
    const m = v.trim().toLowerCase();
    if (OPENAI_IMAGE_MIMES.has(m)) return m;
  }
  return null;
}

function normalizeAllowedMime(m: string | null | undefined): string | null {
  if (!m || typeof m !== "string") return null;
  const base = m.trim().toLowerCase().split(";")[0]?.trim() ?? "";
  return OPENAI_IMAGE_MIMES.has(base) ? base : null;
}

/**
 * Split `data:image/...;base64,...` or raw base64 into payload + optional MIME
 * from the data URL prefix only (must be an OpenAI-allowed type to be used).
 */
export function splitDataUrlBase64(raw: string): {
  b64Payload: string;
  dataUrlMime: string | null;
} {
  let s = raw.trim();
  const m = s.match(/^data:([^;]+);base64,([\s\S]*)$/i);
  if (m) {
    const mime = normalizeAllowedMime(m[1]);
    const b64 = m[2].replace(/\s/g, "");
    return { b64Payload: b64, dataUrlMime: mime };
  }
  return { b64Payload: s.replace(/\s/g, ""), dataUrlMime: null };
}

export function decodeShortcutImageBase64Field(raw: unknown): {
  buffer: Buffer;
  dataUrlMime: string | null;
} | null {
  if (typeof raw !== "string") return null;
  const { b64Payload, dataUrlMime } = splitDataUrlBase64(raw);
  if (b64Payload.length < MIN_BASE64_CHARS) {
    return null;
  }
  try {
    const buffer = Buffer.from(b64Payload, "base64");
    if (buffer.length < MIN_DECODED_BYTES) {
      return null;
    }
    return { buffer, dataUrlMime };
  } catch {
    return null;
  }
}

function isGifBuffer(buf: Buffer): boolean {
  return (
    buf.length >= 6 &&
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x39 || buf[4] === 0x37)
  );
}

function isHeicOrHeifBuffer(buf: Buffer): boolean {
  if (buf.length < 16) return false;
  const ftyp = buf.toString("ascii", 4, 8);
  if (ftyp !== "ftyp") return false;
  const brand = buf.toString("ascii", 8, 12);
  return /heic|heix|hevc|heis|heim|mif1|msf1/i.test(brand);
}

export type NormalizeShortcutImageResult =
  | { ok: true; buffer: Buffer; contentType: string; extension: string }
  | { ok: false; error: string };

/**
 * Transcode shortcut ingress bytes to an OpenAI-compatible raster (PNG by
 * default, JPEG/WebP when explicitly requested, GIF pass-through).
 */
export async function normalizeShortcutImageForOpenAi(
  input: Buffer,
  declaredMime: string | null
): Promise<NormalizeShortcutImageResult> {
  const declared = normalizeAllowedMime(declaredMime ?? undefined);

  if (isGifBuffer(input)) {
    return {
      ok: true,
      buffer: input,
      contentType: "image/gif",
      extension: "gif",
    };
  }

  try {
    const pipeline = sharp(input, { failOn: "none" }).rotate();

    if (declared === "image/jpeg") {
      const buffer = await pipeline
        .jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: "4:4:4" })
        .toBuffer();
      return { ok: true, buffer, contentType: "image/jpeg", extension: "jpg" };
    }

    if (declared === "image/webp") {
      const buffer = await pipeline.webp({ quality: 86 }).toBuffer();
      return { ok: true, buffer, contentType: "image/webp", extension: "webp" };
    }

    if (declared === "image/png") {
      const buffer = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      return { ok: true, buffer, contentType: "image/png", extension: "png" };
    }

    // No allowed declaration (or only gif which is handled): default PNG.
    // HEIC/HEIF/unknown raster → PNG so OpenAI never sees HEIC mislabeled as JPEG.
    if (isHeicOrHeifBuffer(input)) {
      console.info("[shortcut-image] HEIC/HEIF detected; transcoding to PNG");
    }
    const buffer = await pipeline.png({ compressionLevel: 9 }).toBuffer();
    return { ok: true, buffer, contentType: "image/png", extension: "png" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[shortcut-image] sharp normalize failed", { message });
    return {
      ok: false,
      error:
        "Could not read or convert this image. Try JPEG or PNG from the Shortcut, or ensure iOS is not sending HEIC without conversion.",
    };
  }
}

/** Prefer explicit body MIME, else MIME from data URL if allowed. */
export function mergeShortcutImageMimeHints(
  bodyMime: string | null,
  dataUrlMime: string | null
): string | null {
  if (bodyMime) return bodyMime;
  return dataUrlMime;
}
