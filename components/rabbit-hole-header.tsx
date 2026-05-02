"use client";

import { Rabbit } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  countNewClipsSince,
  RABBIT_HOLE_LAST_SEEN_KEY,
} from "@/lib/rabbit-hole-feed-session";

export type RabbitHoleClip = { created_at: string };

type Props = {
  clips?: RabbitHoleClip[];
  /** Scrolled: tighter vertical padding + smaller icon in parent shell. */
  compact?: boolean;
};

export function RabbitHoleHeader({
  clips = [],
  compact = false,
}: Props) {
  const [newCount, setNewCount] = useState<number | null>(null);
  const lastSeenRead = useRef<string | null | undefined>(undefined);
  const clipsRef = useRef<RabbitHoleClip[]>(clips);
  const didMountInit = useRef(false);

  useEffect(() => {
    clipsRef.current = clips;

    if (!didMountInit.current) {
      didMountInit.current = true;
      if (lastSeenRead.current === undefined) {
        lastSeenRead.current = localStorage.getItem(RABBIT_HOLE_LAST_SEEN_KEY);
      }
      const prev = lastSeenRead.current;
      const n = countNewClipsSince(clipsRef.current, prev);
      setNewCount(n);
      localStorage.setItem(RABBIT_HOLE_LAST_SEEN_KEY, new Date().toISOString());
    }
  }, [clips]);

  return (
    <div className={`flex gap-3 ${compact ? "items-center" : "items-start"}`}>
      <Rabbit
        className={`shrink-0 text-[color:var(--rabbit-hole-accent)] ${compact ? "h-7 w-7" : "h-9 w-9"}`}
        strokeWidth={1.8}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
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
                  ? "invisible mt-0.5 text-xs leading-tight"
                  : newCount > 0
                    ? "mt-0.5 truncate text-xs font-medium leading-tight text-[color:var(--rabbit-hole-accent)]"
                    : "mt-0.5 truncate text-xs leading-tight text-white/45"
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
    </div>
  );
}
