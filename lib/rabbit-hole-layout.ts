import type { CSSProperties } from "react";

/** Shared column width; horizontal padding lives on header/feed (`px-3`) so cards align edge-to-edge in the column. */
export const rabbitHoleMainWidthClass = "mx-auto w-full max-w-[390px]";

/** Outermost layout shell (pairs with {@link rabbitHolePageShellStyle}). */
export const rabbitHolePageShellClass =
  "min-h-screen w-full flex flex-1 flex-col";

/**
 * Same `background-image` as the header inner card (`var(--rabbit-hole-masthead-gradient)` in `globals.css`).
 * Prefer `style={{ backgroundImage: rabbitHoleMastheadBackgroundImage }}` when stacking with other backgrounds.
 */
export const rabbitHoleMastheadBackgroundImage =
  "var(--rabbit-hole-masthead-gradient)" as const;

/** Header inner: gradient only — border/shadow stay on the element in `rabbit-hole-sticky-header`. */
export const rabbitHoleHeaderGradientBgClass =
  "bg-[image:var(--rabbit-hole-masthead-gradient)]";

/**
 * Page shell: identical `background-image` as the header, with geometry that matches the
 * header’s painted box (centered strip `min(100vw, 390px) − 24px` = column minus `px-3`).
 * Gutter fill uses the gradient’s start color so edges don’t flash a mismatched tone.
 */
export const rabbitHolePageShellStyle = {
  backgroundColor: "#1f2a20",
  backgroundImage: rabbitHoleMastheadBackgroundImage,
  backgroundSize: "calc(min(100vw, 390px) - 24px) 100%",
  backgroundPosition: "center top",
  backgroundRepeat: "no-repeat",
} satisfies CSSProperties;

/** @deprecated Alias of {@link rabbitHoleHeaderGradientBgClass}. */
export const rabbitHolePageBackdropGradientClass =
  rabbitHoleHeaderGradientBgClass;

/** @deprecated Use {@link rabbitHolePageShellStyle} on the page shell. */
export const rabbitHoleGradientBgClass = rabbitHolePageBackdropGradientClass;
