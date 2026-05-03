import { getServiceSupabase } from "@/lib/supabase-service";
import { randomUUID } from "crypto";

export const maxDuration = 60;

const BUCKET = "capture-images";
const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export async function POST(request: Request) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return Response.json(
      {
        error:
          "Server misconfiguration: set SUPABASE_SERVICE_ROLE_KEY to enable image upload.",
      },
      { status: 503 }
    );
  }

  const reqUrl = new URL(request.url);
  const shortcutToken = reqUrl.searchParams.get("token")?.trim() ?? "";
  let storageUserPrefix: string | null = null;
  if (shortcutToken) {
    const { data: tok, error: tokErr } = await supabase
      .from("user_shortcut_tokens")
      .select("user_id")
      .eq("token", shortcutToken)
      .is("revoked_at", null)
      .maybeSingle();
    if (tokErr || !tok?.user_id) {
      return Response.json(
        { error: "Invalid or revoked shortcut token." },
        { status: 401 }
      );
    }
    storageUserPrefix = String(tok.user_id);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file field (image)" }, { status: 400 });
  }

  const mime = (file.type || "application/octet-stream").toLowerCase();
  const ext = ALLOWED.get(mime);
  if (!ext) {
    return Response.json(
      { error: "Only JPEG, PNG, WebP, or GIF images are allowed." },
      { status: 400 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) {
    return Response.json({ error: "Empty file" }, { status: 400 });
  }
  if (buf.length > MAX_BYTES) {
    return Response.json(
      { error: `Image too large (max ${MAX_BYTES / 1024 / 1024}MB)` },
      { status: 400 }
    );
  }

  const path = storageUserPrefix
    ? `shortcut/${storageUserPrefix}/${randomUUID()}.${ext}`
    : `${randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, {
      contentType: mime,
      upsert: false,
    });

  if (uploadError) {
    console.error("[capture-image] upload failed", uploadError.message);
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return Response.json({ image_url: publicUrl });
}
