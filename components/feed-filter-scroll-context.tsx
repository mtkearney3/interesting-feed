"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Ctx = {
  /** True when the feed filter bar has scrolled entirely above the viewport. */
  filterBarScrolledPast: boolean;
  setFilterBarScrolledPast: (v: boolean) => void;
  /** Human label for the active filter (All, New, Unreviewed, or topic name). */
  filterPillLabel: string;
  setFilterPillLabel: (s: string) => void;
};

const FeedFilterScrollContext = createContext<Ctx | null>(null);

export function FeedFilterScrollProvider({ children }: { children: ReactNode }) {
  const [filterBarScrolledPast, setFilterBarScrolledPast] = useState(false);
  const [filterPillLabel, setFilterPillLabel] = useState("All");

  const value = useMemo(
    () => ({
      filterBarScrolledPast,
      setFilterBarScrolledPast,
      filterPillLabel,
      setFilterPillLabel,
    }),
    [filterBarScrolledPast, filterPillLabel]
  );

  return (
    <FeedFilterScrollContext.Provider value={value}>
      {children}
    </FeedFilterScrollContext.Provider>
  );
}

export function useFeedFilterScrollOptional(): Ctx | null {
  return useContext(FeedFilterScrollContext);
}
