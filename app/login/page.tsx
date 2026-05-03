import { redirect } from "next/navigation";
import { LoginClient } from "@/app/login/login-client";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const next =
    typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "/";

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect(next === "/login" ? "/" : next);
  }

  return <LoginClient redirectTo={next} />;
}
