/**
 * Shared capture feed + detail typography (avoid drifting class strings).
 * Feed AI summary sets the rhythm; everything listed should match it.
 */

/** Main read copy: AI summary, why, notes, raw text, URL, note/original blocks, follow-up Q text, answers. */
export const captureBodyCopySizeClass =
  "text-base max-md:text-lg leading-relaxed sm:text-lg";

/** Alias for shared “description / body” sizing. */
export const bodyTextClass = captureBodyCopySizeClass;

/** Preset / custom follow-up question label text — same size as {@link captureBodyCopySizeClass}. */
export const captureFollowUpQuestionTextClass = captureBodyCopySizeClass;

/** Alias — question rows use the same typography token as description. */
export const followUpQuestionTextClass = captureBodyCopySizeClass;

/** Row metadata (type · source · date · status) and similar small lines. */
export const captureMetadataTextSizeClass =
  "text-sm leading-relaxed";

/** Uppercase section headings (Follow-up questions, Your question, Keep going). */
export const captureSectionLabelSizeClass =
  "text-sm font-semibold uppercase leading-relaxed tracking-wide";

/** Domain link under screenshot images (feed + detail). */
export const captureScreenshotSourceUrlClass =
  "text-xs text-zinc-500 underline decoration-zinc-400/25 underline-offset-2 transition-colors hover:text-zinc-700 hover:decoration-zinc-500/45 dark:text-zinc-400 dark:decoration-zinc-500/15 dark:hover:text-zinc-300";
