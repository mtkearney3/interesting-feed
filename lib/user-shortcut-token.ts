import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** URL-safe token with ≥32 bytes entropy (43 chars in base64url). */
export function newShortcutTokenValue(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Ensures the signed-in user has one active (non-revoked) shortcut token.
 * Call with a Supabase client that carries the user session (RLS applies).
 */
export async function ensureActiveShortcutToken(
  supabase: SupabaseClient,
  userId: string
): Promise<{ token: string } | { error: string }> {
  const { data: existing, error: selErr } = await supabase
    .from("user_shortcut_tokens")
    .select("token")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selErr) {
    return { error: selErr.message };
  }
  if (existing?.token && typeof existing.token === "string") {
    return { token: existing.token };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const token = newShortcutTokenValue();
    const { error: insErr } = await supabase.from("user_shortcut_tokens").insert({
      user_id: userId,
      token,
    });
    if (!insErr) {
      return { token };
    }
    if (insErr.code !== "23505") {
      return { error: insErr.message };
    }
  }

  return { error: "Could not allocate a unique shortcut token." };
}
