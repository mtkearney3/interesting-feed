"use client";

import { Rabbit } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  countNewClipsSince,
  rabbitHoleLastSeenKeyForUser,
} from "@/lib/rabbit-hole-feed-session";

export type RabbitHoleClip = { created_at: string };

type Props = {
  clips?: RabbitHoleClip[];
  /** Scrolled: tighter vertical padding + smaller icon in parent shell. */
  compact?: boolean;
  /** Signed-in user — scopes “last seen” / new-count localStorage. */
  userId: string;
};

export function RabbitHoleHeader({
  clips = [],
  compact = false,
  userId,
}: Props) {
  const { signOut } = useAuth();
  const lastSeenKey = rabbitHoleLastSeenKeyForUser(userId);
  const [newCount, setNewCount] = useState<number | null>(null);
  const lastSeenRead = useRef<string | null | undefined>(undefined);
  const clipsRef = useRef<RabbitHoleClip[]>(clips);
  const didMountInit = useRef(false);
  const prevUserIdRef = useRef(userId);

  useEffect(() => {
    if (prevUserIdRef.current !== userId) {
      prevUserIdRef.current = userId;
      didMountInit.current = false;
      lastSeenRead.current = undefined;
      setNewCount(null);
    }
  }, [userId]);

  useEffect(() => {
    clipsRef.current = clips;

    if (!didMountInit.current) {
      didMountInit.current = true;
      if (lastSeenRead.current === undefined) {
        lastSeenRead.current = localStorage.getItem(lastSeenKey);
      }
      const prev = lastSeenRead.current;
      const n = countNewClipsSince(clipsRef.current, prev);
      setNewCount(n);
      localStorage.setItem(lastSeenKey, new Date().toISOString());
    }
  }, [clips, lastSeenKey]);

  return (
    <div className={`flex gap-3 ${compact ? "items-center" : "items-start"}`}>
      <Rabbit
        className={`shrink-0 text-[color:var(--rabbit-hole-accent)] ${compact ? "h-7 w-7" : "h-9 w-9"}`}
        strokeWidth={1.8}
        aria-hidden
      />
      <div className="flex min-w-0 min-h-0 flex-1 flex-col justify-center">
        <h1
          className={`truncate font-semibold leading-tight tracking-tight text-white ${compact ? "text-lg" : "text-xl"}`}
        >
          Rabbit Hole
        </h1>
        {!compact ? (
          <>
            <p className="mt-0 truncate text-sm leading-tight text-white/80">
              A user-curated AI feed
            </p>
            <p
              className={
                newCount === null
                  ? "invisible mt-0.5 text-sm leading-tight"
                  : newCount > 0
                    ? "mt-0.5 truncate text-sm font-medium leading-tight text-[color:var(--rabbit-hole-accent)]"
                    : "mt-0.5 truncate text-sm leading-tight text-white/45"
              }
            >
              {newCount === null
                ? "No new clips"
                : newCount > 0
                  ? `${newCount} new clips`
                  : "No new clips"}
            </p>
          </>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => void signOut()}
        className={`shrink-0 self-start rounded-lg px-2 py-1 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white active:opacity-90 ${compact ? "mt-0" : "mt-1"}`}
      >
        Sign out
      </button>
    </div>
  );
}
