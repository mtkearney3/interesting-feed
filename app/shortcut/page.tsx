import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ShortcutSetupClient } from "@/app/shortcut/shortcut-setup-client";
import { ensureActiveShortcutToken } from "@/lib/user-shortcut-token";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function inferRequestBaseUrl(): Promise<string> {
  const h = await headers();
  const host =
    h.get("x-forwarded-host") ??
    h.get("host") ??
    "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (process.env.VERCEL ? "https" : "http");
  return `${proto}://${host}`;
}

export default async function ShortcutSetupPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fshortcut");
  }

  const tokenResult = await ensureActiveShortcutToken(supabase, user.id);
  if ("error" in tokenResult) {
    return (
      <div className="rabbit-hole-page-bg flex min-h-screen flex-col px-4 py-12 text-white">
        <p className="text-sm text-red-200">
          Could not load shortcut token: {tokenResult.error}
        </p>
        <p className="mt-2 text-xs text-white/60">
          Confirm the{" "}
          <code className="rounded bg-white/10 px-1">user_shortcut_tokens</code>{" "}
          table and RLS migration have been applied in Supabase.
        </p>
      </div>
    );
  }

  const base = await inferRequestBaseUrl();
  const endpointUrl = `${base}/api/captures/shortcut?token=${encodeURIComponent(tokenResult.token)}`;

  return <ShortcutSetupClient endpointUrl={endpointUrl} />;
}
