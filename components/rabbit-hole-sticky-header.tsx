"use client";

import type { MouseEvent } from "react";
import { useFeedFilterScrollOptional } from "@/components/feed-filter-scroll-context";
import { RabbitHoleHeader } from "@/components/rabbit-hole-header";
import { useRabbitHoleScrolled } from "@/components/rabbit-hole-scroll-context";
import {
  rabbitHoleBlendedHeaderCollapsedChrome,
  rabbitHoleBlendedHeaderExpandedChrome,
  rabbitHoleFeedHeaderViewportBleedClass,
  rabbitHoleMainWidthClass,
} from "@/lib/rabbit-hole-layout";

type Props = {
  clips: { created_at: string }[];
  userId: string;
};

const outerStickyBase = `sticky top-0 z-50 mb-7 ${rabbitHoleFeedHeaderViewportBleedClass} sm:static sm:top-auto sm:z-auto sm:mb-5`;

/** Ignore clicks that originate on real controls inside the masthead (none today). */
function mastheadClickShouldScroll(e: MouseEvent<HTMLDivElement>): boolean {
  const t = e.target;
  if (!(t instanceof Element)) return true;
  const nearest = t.closest(
    "a[href],button,input,select,textarea,summary,[role='link'],[role='button']"
  );
  if (!nearest) return true;
  return nearest === e.currentTarget;
}

const headerFilterPillClass =
  "rabbit-hole-feed-filter-pill--active max-w-[42%] truncate rounded-full border px-2.5 py-1 text-center text-sm font-semibold sm:max-w-[11rem]";

export function RabbitHoleStickyHeader({ clips, userId }: Props) {
  const isScrolled = useRabbitHoleScrolled();
  const filterScroll = useFeedFilterScrollOptional();
  const showFilterPill = Boolean(filterScroll?.filterBarScrolledPast);

  return (
    <header
      className={`${outerStickyBase} ${isScrolled ? rabbitHoleBlendedHeaderCollapsedChrome : rabbitHoleBlendedHeaderExpandedChrome}`}
    >
      <div className={`${rabbitHoleMainWidthClass} px-3`}>
        <div
          className={`flex gap-3 ${isScrolled ? "items-center" : "items-start"}`}
        >
          <div
            className="min-w-0 flex-1 cursor-pointer select-none rounded-xl px-4 py-2 transition-opacity active:opacity-90"
            onClick={(e) => {
              if (!mastheadClickShouldScroll(e)) return;
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <RabbitHoleHeader clips={clips} compact={isScrolled} userId={userId} />
          </div>
          {showFilterPill && filterScroll ? (
            <span
              className={`shrink-0 ${headerFilterPillClass}`}
              title={`Filter: ${filterScroll.filterPillLabel}`}
            >
              {filterScroll.filterPillLabel}
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
