"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CaptureForm } from "@/app/capture-form";
import { CaptureFeedCard } from "@/components/capture-feed-card";
import { CaptureDetailModal } from "@/components/capture-detail-modal";
import { useFeedClipStatusOptional } from "@/components/feed-clip-status-context";
import { useFeedFilterScrollOptional } from "@/components/feed-filter-scroll-context";
import { RabbitHoleFeedFilterBar } from "@/components/rabbit-hole-feed-filter-bar";
import { clipMatchesFeedFilter } from "@/lib/clip-matches-feed-filter";
import type { CaptureRow } from "@/lib/capture";
import {
  FEED_BUILTIN_FILTER,
  feedFilterTopicNormalizedKey,
  type FeedFilterKey,
  isFeedFilterTopicKey,
} from "@/lib/rabbit-hole-feed-filter-keys";
import { buildTopicFilterOptions } from "@/lib/rabbit-hole-feed-topic-labels";

type Props = {
  rows: CaptureRow[];
};

export function CaptureFeedWithDetail({ rows }: Props) {
  const router = useRouter();
  const feedClipStatus = useFeedClipStatusOptional();
  const filterScroll = useFeedFilterScrollOptional();
  const clipBadgeFn = feedClipStatus?.clipBadge;
  const [selected, setSelected] = useState<CaptureRow | null>(null);
  const [feedFilter, setFeedFilter] = useState<FeedFilterKey>(
    FEED_BUILTIN_FILTER.ALL
  );
  const startedEnrichRef = useRef(new Set<string>());
  const filterBarSentinelRef = useRef<HTMLDivElement | null>(null);

  const topicOptions = useMemo(() => buildTopicFilterOptions(rows), [rows]);

  const filterPillLabel = useMemo(() => {
    if (feedFilter === FEED_BUILTIN_FILTER.ALL) return "All";
    if (feedFilter === FEED_BUILTIN_FILTER.NEW) return "New";
    if (feedFilter === FEED_BUILTIN_FILTER.UNREVIEWED) return "Unreviewed";
    if (isFeedFilterTopicKey(feedFilter)) {
      const tk = feedFilterTopicNormalizedKey(feedFilter);
      return topicOptions.find((t) => t.key === tk)?.label ?? tk;
    }
    return "All";
  }, [feedFilter, topicOptions]);

  useEffect(() => {
    if (!isFeedFilterTopicKey(feedFilter)) return;
    const tk = feedFilterTopicNormalizedKey(feedFilter);
    const stillExists = topicOptions.some((t) => t.key === tk);
    if (!stillExists) setFeedFilter(FEED_BUILTIN_FILTER.ALL);
  }, [feedFilter, topicOptions]);

  const filteredRows = useMemo(() => {
    const badge = (id: string, createdAt: string) =>
      clipBadgeFn?.(id, createdAt) ?? null;
    return rows.filter((c) => clipMatchesFeedFilter(feedFilter, c, badge));
  }, [rows, feedFilter, clipBadgeFn]);

  const analyzingKey = useMemo(() => {
    return rows
      .filter((r) => {
        const s = String(r.status ?? "").toLowerCase();
        const pendingAi = !String(r.ai_title ?? "").trim();
        return pendingAi && (s === "analyzing" || s === "processing");
      })
      .map((r) => r.id)
      .join(",");
  }, [rows]);

  useEffect(() => {
    if (!analyzingKey) return;
    const id = window.setInterval(() => {
      queueMicrotask(() => {
        router.refresh();
      });
    }, 3500);
    return () => clearInterval(id);
  }, [analyzingKey, router]);

  useEffect(() => {
    for (const clip of rows) {
      const s = String(clip.status ?? "").toLowerCase();
      const pendingAi = !String(clip.ai_title ?? "").trim();
      if (!pendingAi || (s !== "analyzing" && s !== "processing")) continue;
      if (startedEnrichRef.current.has(clip.id)) continue;
      startedEnrichRef.current.add(clip.id);
      queueMicrotask(() => {
        void fetch(`/api/captures/${clip.id}/enrich`, { method: "POST" }).catch(
          () => {
            /* Retry on card if needed */
          }
        );
      });
    }
  }, [rows]);

  const filterScrollRef = useRef(filterScroll);
  filterScrollRef.current = filterScroll;

  useEffect(() => {
    filterScrollRef.current?.setFilterPillLabel(filterPillLabel);
  }, [filterPillLabel]);

  useEffect(() => {
    const el = filterBarSentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        const ctx = filterScrollRef.current;
        if (!ctx) return;
        const { isIntersecting, boundingClientRect } = entry;
        const scrolledPast =
          !isIntersecting && boundingClientRect.bottom < 1;
        ctx.setFilterBarScrolledPast(scrolledPast);
      },
      { root: null, threshold: 0 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <CaptureForm />
      <div ref={filterBarSentinelRef} className="min-w-0">
        <RabbitHoleFeedFilterBar
          selected={feedFilter}
          onChange={setFeedFilter}
          topics={topicOptions}
        />
      </div>
      {filteredRows.length === 0 && rows.length > 0 ? (
        <p
          className={`rounded-xl border border-zinc-200/80 bg-zinc-50/90 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400`}
        >
          No clips match this filter.
        </p>
      ) : (
        <ul className="flex flex-col">
          {filteredRows.map((c) => (
            <li key={c.id} className="min-w-0">
              <CaptureFeedCard
                c={c}
                onOpenDetail={() => {
                  feedClipStatus?.markClipReviewed(String(c.id));
                  setSelected(c);
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <CaptureDetailModal
        capture={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
