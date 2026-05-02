"use client";

import type { ReactNode } from "react";
import type { CaptureRow } from "@/lib/capture";

type Props = {
  title: string;
};

const titleTypographyClass =
  "text-lg font-semibold leading-tight tracking-tight text-[#1f2a20] max-md:text-xl dark:text-zinc-100 sm:text-xl md:text-base";

const headingClass = `min-w-0 flex-1 break-words ${titleTypographyClass}`;

/** Rounded title card only (no outer masking). */
const titleBoxClass =
  "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-md dark:border-zinc-700 dark:bg-zinc-800";

const titleRowClass = "flex w-full min-w-0 items-start gap-2";

type BrandDotProps = {
  /** `detail`: `mt-1` for clip modal header; default matches feed title row. */
  align?: "feed" | "detail";
};

/** Feed + detail header: outer olive ring, inner gold dot (same size as sticky feed title). */
export function CaptureFeedTitleBrandDot({ align = "feed" }: BrandDotProps) {
  const mtClass = align === "detail" ? "mt-1" : "mt-[5px]";
  return (
    <span
      className={`${mtClass} flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-[#2f3e2f] dark:bg-[#3d5240]`}
      aria-hidden
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#d4a017]" />
    </span>
  );
}

function TitleRow({ children }: { children: ReactNode }) {
  return <div className={titleRowClass}>{children}</div>;
}

/** Standalone in-body title (e.g. no screenshot). */
export function CaptureFeedTitleInBody({ title }: Props) {
  return (
    <div className="mb-2 w-full">
      <div className={titleBoxClass}>
        <TitleRow>
          <CaptureFeedTitleBrandDot />
          <h2 className={headingClass}>{title}</h2>
        </TitleRow>
      </div>
    </div>
  );
}

/**
 * Title above card body: horizontal inset comes from feed `px-3`; `top` tracks header height.
 * Same sticky behavior for screenshot, text-only, URL, and mixed clips.
 */
function StickyFeedTitleChrome({
  title,
  titleTrailing,
}: {
  title: string;
  titleTrailing?: ReactNode;
}) {
  return (
    <div className="w-full max-sm:sticky max-sm:top-[var(--rabbit-hole-sticky-header-height)] max-sm:z-30 sm:static sm:top-auto sm:z-auto">
      <div
        className={`${titleBoxClass} sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none`}
      >
        <div
          className={`${titleRowClass} ${title ? "items-start" : "items-center"}`}
        >
          <CaptureFeedTitleBrandDot />
          <div className="min-w-0 flex-1">
            {title ? (
              <h2
                className={`inline min-w-0 max-w-full align-middle break-words ${titleTypographyClass}`}
              >
                {title}
              </h2>
            ) : null}
            {titleTrailing ? (
              <span className="ms-2 inline-flex shrink-0 align-middle">
                {titleTrailing}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Feed: sticky AI title when present (all clip types). */
export function StickyClipTitle({
  clip,
  titleTrailing,
}: {
  clip: Pick<CaptureRow, "ai_title">;
  titleTrailing?: ReactNode;
}) {
  const title = clip.ai_title?.trim() ?? "";
  if (!title && !titleTrailing) return null;
  return <StickyFeedTitleChrome title={title} titleTrailing={titleTrailing} />;
}

export function CaptureStickyFeedTitleDual({ title }: Props) {
  return <StickyFeedTitleChrome title={title} />;
}
