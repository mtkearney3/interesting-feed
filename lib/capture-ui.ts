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
  "text-xs max-md:text-sm leading-relaxed md:text-xs";

/** Uppercase section headings (Follow-up questions, Your question, Keep going). */
export const captureSectionLabelSizeClass =
  "text-xs max-md:text-sm font-semibold uppercase leading-relaxed tracking-wide md:text-xs";
