import { CaptureFeedWithDetail } from "@/components/capture-feed-with-detail";
import { FeedClipStatusProvider } from "@/components/feed-clip-status-context";
import { FeedFilterScrollProvider } from "@/components/feed-filter-scroll-context";
import { MobilePullToRefresh } from "@/components/mobile-pull-to-refresh";
import { RabbitHoleLoginPrompt } from "@/components/rabbit-hole-login-prompt";
import { RabbitHolePageShell } from "@/components/rabbit-hole-page-shell";
import { RabbitHoleScrollProvider } from "@/components/rabbit-hole-scroll-context";
import { RabbitHoleStickyHeader } from "@/components/rabbit-hole-sticky-header";
import type { CaptureRow } from "@/lib/capture";
import { rabbitHoleMainWidthClass } from "@/lib/rabbit-hole-layout";
import { capturesListQueryWithColumnFallback } from "@/lib/captures-db-columns";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <RabbitHolePageShell>
        <RabbitHoleLoginPrompt />
      </RabbitHolePageShell>
    );
  }

  const { data: captures, error } = await capturesListQueryWithColumnFallback(
    supabase,
    user.id
  );

  if (error) {
    return (
      <RabbitHolePageShell>
        <div
          className={`${rabbitHoleMainWidthClass} bg-transparent px-3 py-8`}
        >
          <h1 className="text-lg font-semibold text-white">Rabbit Hole</h1>
          <p className="mt-3 text-sm text-red-200">
            Could not load your clips: {error.message}
          </p>
        </div>
      </RabbitHolePageShell>
    );
  }

  const rows = (captures ?? []) as CaptureRow[];

  return (
    <RabbitHolePageShell>
      <RabbitHoleScrollProvider>
        <FeedClipStatusProvider userId={user.id}>
          <FeedFilterScrollProvider>
            <MobilePullToRefresh>
              <div className={`${rabbitHoleMainWidthClass} bg-transparent`}>
                <RabbitHoleStickyHeader
                  clips={rows.map((r) => ({ created_at: r.created_at }))}
                  userId={user.id}
                />

                <div className="w-full bg-transparent px-3 pb-28 pt-0 sm:pb-8 sm:pt-8">
                  <CaptureFeedWithDetail rows={rows} />
                </div>
              </div>
            </MobilePullToRefresh>
          </FeedFilterScrollProvider>
        </FeedClipStatusProvider>
      </RabbitHoleScrollProvider>
    </RabbitHolePageShell>
  );
}
