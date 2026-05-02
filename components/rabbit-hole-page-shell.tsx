import type { ComponentPropsWithoutRef } from "react";

import { rabbitHolePageShellClass } from "@/lib/rabbit-hole-layout";

/**
 * Outermost Rabbit Hole surface: same `className` chain as the feed page root
 * (`rabbitHolePageShellClass` = `.rabbit-hole-page-bg` + layout flex).
 */
export function RabbitHolePageShell({
  className,
  ...rest
}: ComponentPropsWithoutRef<"div">) {
  const merged = [rabbitHolePageShellClass, className].filter(Boolean).join(" ");
  return <div className={merged} {...rest} />;
}
