"use client";

import { RabbitHoleHeader } from "@/components/rabbit-hole-header";
import { useRabbitHoleScrolled } from "@/components/rabbit-hole-scroll-context";

type Props = {
  clips: { created_at: string }[];
};

/** Flush to viewport top when sticky — no pt/mt on this wrapper. */
const outerSticky =
  "sticky top-0 z-[70] px-3 sm:static sm:top-auto sm:z-auto sm:px-3";

const innerHeader =
  "w-full overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(110deg,#1f2a20_0%,#334533_60%,#6b5a22_100%)] px-4 py-2 shadow-[0_10px_24px_rgba(31,42,32,0.20)]";

export function RabbitHoleStickyHeader({ clips }: Props) {
  const isScrolled = useRabbitHoleScrolled();

  return (
    <header className={outerSticky}>
      <div className={innerHeader}>
        <RabbitHoleHeader clips={clips} compact={isScrolled} />
      </div>
    </header>
  );
}
