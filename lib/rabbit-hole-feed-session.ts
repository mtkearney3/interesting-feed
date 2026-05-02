/** Same key as legacy header — last visit timestamp written after each feed load. */
export const RABBIT_HOLE_LAST_SEEN_KEY = "rabbit-hole-last-seen";

/** Feed-only: clip ids the user has opened in the detail modal. */
export const RABBIT_HOLE_REVIEWED_CLIP_IDS_KEY = "rabbit-hole.reviewedClipIds";

/** Normalize clip ids for Set / localStorage (handles numeric ids from JSON). */
export function normalizeFeedClipId(id: unknown): string {
  return String(id ?? "").trim();
}

export function countNewClipsSince(
  clipList: { created_at: string }[],
  lastSeenIso: string | null
): number {
  if (clipList.length === 0) return 0;
  if (!lastSeenIso) return clipList.length;
  const t = new Date(lastSeenIso).getTime();
  return clipList.filter((c) => new Date(c.created_at).getTime() > t).length;
}

/** Matches header “new since last session” semantics per clip. */
export function isClipNewSince(
  createdAt: string,
  lastSeenIso: string | null
): boolean {
  if (!lastSeenIso) return true;
  return new Date(createdAt).getTime() > new Date(lastSeenIso).getTime();
}

export function loadReviewedClipIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(RABBIT_HOLE_REVIEWED_CLIP_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    const out = new Set<string>();
    for (const x of parsed) {
      const id = normalizeFeedClipId(x);
      if (id) out.add(id);
    }
    return out;
  } catch {
    return new Set();
  }
}

export function persistReviewedClipIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  const list = [...ids].map((id) => normalizeFeedClipId(id)).filter(Boolean);
  localStorage.setItem(
    RABBIT_HOLE_REVIEWED_CLIP_IDS_KEY,
    JSON.stringify(list)
  );
}
