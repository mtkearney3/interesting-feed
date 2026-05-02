import { CaptureFeedWithDetail } from "@/components/capture-feed-with-detail";
import { MobilePullToRefresh } from "@/components/mobile-pull-to-refresh";
import { RabbitHoleScrollProvider } from "@/components/rabbit-hole-scroll-context";
import { RabbitHoleStickyHeader } from "@/components/rabbit-hole-sticky-header";
import type { CaptureRow } from "@/lib/capture";
import {
  rabbitHoleMainWidthClass,
  rabbitHolePageShellClass,
  rabbitHolePageShellStyle,
} from "@/lib/rabbit-hole-layout";
import { capturesListQueryWithColumnFallback } from "@/lib/captures-db-columns";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data: captures, error } =
    await capturesListQueryWithColumnFallback(supabase);

  if (error) {
    return (
      <div className={rabbitHolePageShellClass} style={rabbitHolePageShellStyle}>
        <div
          className={`${rabbitHoleMainWidthClass} bg-transparent px-3 py-8`}
        >
          <h1 className="text-lg font-semibold text-white">Rabbit Hole</h1>
          <p className="mt-3 text-sm text-red-200">
            Could not load your clips: {error.message}
          </p>
        </div>
      </div>
    );
  }

  const rows = (captures ?? []) as CaptureRow[];

  return (
    <div className={rabbitHolePageShellClass} style={rabbitHolePageShellStyle}>
      <RabbitHoleScrollProvider>
        <MobilePullToRefresh>
          <div className={`${rabbitHoleMainWidthClass} bg-transparent`}>
            <RabbitHoleStickyHeader
              clips={rows.map((r) => ({ created_at: r.created_at }))}
            />

            <div className="w-full bg-transparent px-3 pb-28 pt-0 sm:pb-8 sm:pt-8">
              <CaptureFeedWithDetail rows={rows} />
            </div>
          </div>
        </MobilePullToRefresh>
      </RabbitHoleScrollProvider>
    </div>
  );
}
