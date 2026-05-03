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
  isClipNewSince,
  loadReviewedClipIds,
  normalizeFeedClipId,
  persistReviewedClipIds,
  rabbitHoleLastSeenKeyForUser,
  rabbitHoleReviewedClipIdsKeyForUser,
} from "@/lib/rabbit-hole-feed-session";

export type FeedClipBadge = "new" | "reviewed" | null;

type Ctx = {
  markClipReviewed: (id: string) => void;
  clipBadge: (clipId: string, createdAt: string) => FeedClipBadge;
};

const FeedClipStatusContext = createContext<Ctx | null>(null);

export function FeedClipStatusProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const lastSeenKey = rabbitHoleLastSeenKeyForUser(userId);
  const reviewedKey = rabbitHoleReviewedClipIdsKeyForUser(userId);

  const [hydrated, setHydrated] = useState(false);
  const [newSinceCutoff, setNewSinceCutoff] = useState<string | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(() => new Set());

  useLayoutEffect(() => {
    setNewSinceCutoff(localStorage.getItem(lastSeenKey));
    setReviewedIds(loadReviewedClipIds(reviewedKey));
    setHydrated(true);
  }, [userId, lastSeenKey, reviewedKey]);

  const markClipReviewed = useCallback((id: string) => {
    const key = normalizeFeedClipId(id);
    if (!key) return;
    setReviewedIds((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      persistReviewedClipIds(next, reviewedKey);
      return next;
    });
  }, [reviewedKey]);

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
