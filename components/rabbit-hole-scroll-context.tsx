"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const RabbitHoleScrollContext = createContext(false);

export function RabbitHoleScrollProvider({ children }: { children: ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setIsScrolled(window.scrollY > 20);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <RabbitHoleScrollContext.Provider value={isScrolled}>
      {children}
    </RabbitHoleScrollContext.Provider>
  );
}

/** `true` when `window.scrollY > 20` (compact masthead). */
export function useRabbitHoleScrolled() {
  return useContext(RabbitHoleScrollContext);
}
