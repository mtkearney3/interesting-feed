/**
 * Built-in feed filter keys. Topic filters use {@link feedFilterTopicKey} (`cat:…` prefix).
 * To add a **Reviewed** filter later: define `REVIEWED` here, add a pill in
 * `RabbitHoleFeedFilterBar`, and handle it in `clipMatchesFeedFilter`.
 */
export const FEED_BUILTIN_FILTER = {
  ALL: "all",
  NEW: "new",
  UNREVIEWED: "unreviewed",
} as const;

/** Reserved for a future “Reviewed only” pill — not wired in the bar yet. */
export const FEED_FILTER_REVIEWED_KEY = "reviewed" as const;

export type FeedBuiltinFilterId =
  (typeof FEED_BUILTIN_FILTER)[keyof typeof FEED_BUILTIN_FILTER];

export type FeedFilterKey = string;

const TOPIC_PREFIX = "cat:" as const;

export function feedFilterTopicKey(normalizedTopicKey: string): FeedFilterKey {
  return `${TOPIC_PREFIX}${normalizedTopicKey}`;
}

export function isFeedFilterTopicKey(key: FeedFilterKey): boolean {
  return key.startsWith(TOPIC_PREFIX);
}

export function feedFilterTopicNormalizedKey(key: FeedFilterKey): string {
  return key.slice(TOPIC_PREFIX.length);
}
