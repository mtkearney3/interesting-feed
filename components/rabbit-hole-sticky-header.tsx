"use client";

import { RabbitHoleHeader } from "@/components/rabbit-hole-header";
import { useRabbitHoleScrolled } from "@/components/rabbit-hole-scroll-context";

type Props = {
  clips: { created_at: string }[];
};

/** Sticky shell: opaque gradient fills the full sticky footprint so feed never shows through. */
const stickyHeaderSurface =
  "bg-[linear-gradient(110deg,#1f2a20_0%,#334533_60%,#6b5a22_100%)] shadow-sm border border-white/10";

/** Flush to viewport top when sticky — no pt/mt on this wrapper. */
const outerSticky = `sticky top-0 z-50 mb-7 px-3 sm:static sm:top-auto sm:z-auto sm:mb-5 sm:px-3 ${stickyHeaderSurface}`;

const innerHeaderClass = "w-full overflow-hidden rounded-2xl px-4 py-2";

export function RabbitHoleStickyHeader({ clips }: Props) {
  const isScrolled = useRabbitHoleScrolled();

  return (
    <header className={outerSticky}>
      <div className={innerHeaderClass}>
        <RabbitHoleHeader clips={clips} compact={isScrolled} />
      </div>
    </header>
  );
}
