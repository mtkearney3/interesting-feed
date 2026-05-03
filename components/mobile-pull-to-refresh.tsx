"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const PULL_THRESHOLD_PX = 70;
/** Tailwind `sm` breakpoint — PTR only below this width. */
const MOBILE_MQ = "(max-width: 639px)";

type PullLabel = "pull" | "release" | "refreshing" | null;

export function MobilePullToRefresh({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [label, setLabel] = useState<PullLabel>(null);
  const [visualPull, setVisualPull] = useState(0);

  const startY = useRef(0);
  const tracking = useRef(false);
  const pullMax = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  const stopTracking = useCallback(() => {
    tracking.current = false;
    setVisualPull(0);
  }, []);

  useEffect(() => {
    if (!isMobile) return;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 2) return;
      if (e.touches.length !== 1) return;
      startY.current = e.touches[0].clientY;
      tracking.current = true;
      pullMax.current = 0;
      setLabel(null);
      setVisualPull(0);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking.current) return;
      if (window.scrollY > 2) {
        stopTracking();
        setLabel(null);
        pullMax.current = 0;
        return;
      }
      const y = e.touches[0].clientY;
      const delta = y - startY.current;
      if (delta <= 0) {
        setVisualPull(0);
        setLabel(null);
        pullMax.current = 0;
        return;
      }
      pullMax.current = Math.max(pullMax.current, delta);
      const clamped = Math.min(delta, 120);
      setVisualPull(clamped);
      setLabel(delta >= PULL_THRESHOLD_PX ? "release" : "pull");
    };

    const onTouchEnd = () => {
      if (!tracking.current) return;
      const reached = pullMax.current >= PULL_THRESHOLD_PX;
      stopTracking();
      pullMax.current = 0;
      if (reached) {
        setLabel("refreshing");
        clearRefreshTimer();
        router.refresh();
        refreshTimer.current = setTimeout(() => {
          setLabel(null);
          refreshTimer.current = null;
        }, 1200);
      } else {
        setLabel(null);
      }
    };

    const onTouchCancel = () => {
      stopTracking();
      setLabel(null);
      pullMax.current = 0;
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchCancel);
      clearRefreshTimer();
    };
  }, [isMobile, router, stopTracking, clearRefreshTimer]);

  const showIndicator = isMobile && (visualPull > 0 || label === "refreshing");
  const text =
    label === "refreshing"
      ? "Refreshing…"
      : label === "release"
        ? "Release to refresh"
        : "Pull to refresh";

  const nudgeY = Math.min(visualPull * 0.35, 28);

  return (
    <>
      {showIndicator ? (
        <div
          className="pointer-events-none fixed left-1/2 z-[60] max-w-[min(calc(100vw-2rem),18rem)] sm:hidden"
          style={{
            top: "max(0.75rem, env(safe-area-inset-top, 0px))",
            transform: `translate(-50%, ${nudgeY}px)`,
          }}
          aria-live="polite"
        >
          <div className="rounded-full border border-zinc-200/80 bg-white/80 px-3 py-1.5 text-center text-sm font-medium leading-normal text-zinc-600 shadow-sm backdrop-blur-sm dark:border-zinc-600/80 dark:bg-zinc-800/80 dark:text-zinc-300">
            {text}
          </div>
        </div>
      ) : null}
      {children}
    </>
  );
}
