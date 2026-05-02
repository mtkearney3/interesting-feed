/** Shared column width; horizontal padding lives on header/feed (`px-3`) so cards align edge-to-edge in the column. */
export const rabbitHoleMainWidthClass = "mx-auto w-full max-w-[390px]";

/** Full-viewport shell background (see `globals.css` `.rabbit-hole-page-bg`). */
export const rabbitHolePageBgClass = "rabbit-hole-page-bg";

/**
 * Same background layer as `.rabbit-hole-page-bg` without min-height — for sticky strips
 * so `background-*` matches the feed shell exactly (including `background-attachment: fixed`).
 */
export const rabbitHolePageBgPaintClass = "rabbit-hole-page-bg-paint";

/** Same gradient paint as nav, for bars without `background-attachment: fixed`. */
export const rabbitHoleMastheadFillClass = "rabbit-hole-masthead-fill";

/** Outermost page shell: branded gradient + column flex. */
export const rabbitHolePageShellClass = `${rabbitHolePageBgClass} w-full flex flex-1 flex-col`;

/** Feed + post detail: transparent masthead blending into `.rabbit-hole-page-bg`. */
export const rabbitHoleBlendedHeaderExpandedChrome =
  "border-b border-transparent bg-transparent shadow-none ring-0";

/** When scrolled: same CSS paint as `.rabbit-hole-page-bg` (via `.rabbit-hole-page-bg-paint`). */
export const rabbitHoleBlendedHeaderCollapsedChrome = `border-b border-white/5 shadow-none ring-0 ${rabbitHolePageBgPaintClass}`;

/** Break out of `max-w-[390px]` so a sticky bar can span the viewport (main feed header). */
export const rabbitHoleFeedHeaderViewportBleedClass =
  "w-screen ml-[calc(50%-50vw)] sm:ml-0 sm:w-full";

/**
 * Same `background-image` as the masthead (`var(--rabbit-hole-masthead-gradient)` in `globals.css`).
 */
export const rabbitHoleMastheadBackgroundImage =
  "var(--rabbit-hole-masthead-gradient)" as const;

/** Reuse masthead gradient on elements via the shared `.rabbit-hole-masthead-fill` utility. */
export const rabbitHoleHeaderGradientBgClass = rabbitHoleMastheadFillClass;

/** @deprecated Alias of {@link rabbitHoleHeaderGradientBgClass}. */
export const rabbitHolePageBackdropGradientClass =
  rabbitHoleHeaderGradientBgClass;

/** @deprecated Use {@link rabbitHolePageBgClass} on the page shell. */
export const rabbitHoleGradientBgClass = rabbitHolePageBackdropGradientClass;
