"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  RABBIT_HOLE_LAST_SEEN_KEY,
  isClipNewSince,
  loadReviewedClipIds,
  normalizeFeedClipId,
  persistReviewedClipIds,
} from "@/lib/rabbit-hole-feed-session";

export type FeedClipBadge = "new" | "reviewed" | null;

type Ctx = {
  markClipReviewed: (id: string) => void;
  clipBadge: (clipId: string, createdAt: string) => FeedClipBadge;
};

const FeedClipStatusContext = createContext<Ctx | null>(null);

export function FeedClipStatusProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [newSinceCutoff, setNewSinceCutoff] = useState<string | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(() => new Set());

  useLayoutEffect(() => {
    setNewSinceCutoff(localStorage.getItem(RABBIT_HOLE_LAST_SEEN_KEY));
    setReviewedIds(loadReviewedClipIds());
    setHydrated(true);
  }, []);

  const markClipReviewed = useCallback((id: string) => {
    const key = normalizeFeedClipId(id);
    if (!key) return;
    setReviewedIds((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      persistReviewedClipIds(next);
      return next;
    });
  }, []);

  const clipBadge = useCallback(
    (clipId: string, createdAt: string): FeedClipBadge => {
      if (!hydrated) return null;
      const key = normalizeFeedClipId(clipId);
      if (key && reviewedIds.has(key)) return "reviewed";
      if (isClipNewSince(createdAt, newSinceCutoff)) return "new";
      return null;
    },
    [hydrated, reviewedIds, newSinceCutoff]
  );

  const value = useMemo(
    () => ({ markClipReviewed, clipBadge }),
    [markClipReviewed, clipBadge]
  );

  return (
    <FeedClipStatusContext.Provider value={value}>
      {children}
    </FeedClipStatusContext.Provider>
  );
}

export function useFeedClipStatusOptional(): Ctx | null {
  return useContext(FeedClipStatusContext);
}
