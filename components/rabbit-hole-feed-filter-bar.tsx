"use client";

import type { ReactNode } from "react";
import type { FeedTopicOption } from "@/lib/rabbit-hole-feed-topic-labels";
import {
  FEED_BUILTIN_FILTER,
  feedFilterTopicKey,
  type FeedFilterKey,
} from "@/lib/rabbit-hole-feed-filter-keys";

export type { FeedFilterKey } from "@/lib/rabbit-hole-feed-filter-keys";
export {
  feedFilterTopicKey,
  feedFilterTopicNormalizedKey,
  isFeedFilterTopicKey,
} from "@/lib/rabbit-hole-feed-filter-keys";

const scrollClass =
  "-mx-1 flex gap-2 overflow-x-auto px-1 pb-1.5 pt-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

const pillBase =
  "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition active:scale-[0.97] active:opacity-90";

const pillInactive =
  "border-white/10 bg-white/10 text-white/90 hover:border-white/15 hover:bg-white/15";

const pillActive = "rabbit-hole-feed-filter-pill--active border shadow-sm";

function Pill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`${pillBase} ${active ? pillActive : pillInactive}`}
    >
      {children}
    </button>
  );
}

export function RabbitHoleFeedFilterBar({
  selected,
  onChange,
  topics,
}: {
  selected: FeedFilterKey;
  onChange: (key: FeedFilterKey) => void;
  topics: FeedTopicOption[];
}) {
  return (
    <div className="mb-3 w-full min-w-0 sm:mb-4" role="tablist" aria-label="Filter clips">
      <div className={scrollClass}>
        <Pill
          active={selected === FEED_BUILTIN_FILTER.ALL}
          onClick={() => onChange(FEED_BUILTIN_FILTER.ALL)}
        >
          All
        </Pill>
        <Pill
          active={selected === FEED_BUILTIN_FILTER.NEW}
          onClick={() => onChange(FEED_BUILTIN_FILTER.NEW)}
        >
          New
        </Pill>
        <Pill
          active={selected === FEED_BUILTIN_FILTER.UNREVIEWED}
          onClick={() => onChange(FEED_BUILTIN_FILTER.UNREVIEWED)}
        >
          Unreviewed
        </Pill>
        {topics.map((t) => (
          <Pill
            key={t.key}
            active={selected === feedFilterTopicKey(t.key)}
            onClick={() => onChange(feedFilterTopicKey(t.key))}
          >
            {t.label}
          </Pill>
        ))}
      </div>
    </div>
  );
}
