"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CaptureRow } from "@/lib/capture";

function looksLikeHttpUrl(text: string): boolean {
  const t = text.trim();
  return t.startsWith("http://") || t.startsWith("https://");
}

function closeFormIfMobile(setFormOpen: (v: boolean) => void) {
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 639px)").matches
  ) {
    setFormOpen(false);
  }
}

type CaptureFormProps = {
  /**
   * Parent increments this (e.g. from the feed empty state) to open the New clip
   * panel and scroll it into view, matching the in-app “Add clip” behavior.
   */
  openAddClipRequestId?: number;
};

type ClipType = "text" | "url" | "screenshot" | null;

export function CaptureForm({ openAddClipRequestId = 0 }: CaptureFormProps) {
  const router = useRouter();
  const rawTextRef = useRef("");
  const [rawText, setRawText] = useState("");
  const [url, setUrl] = useState("");
  const [source, setSource] = useState("manual");
  const [userNote, setUserNote] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [clipType, setClipType] = useState<ClipType>("text");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const addClipPanelRef = useRef<HTMLDivElement | null>(null);
  const scrollAddClipIntoViewAfterOpen = useRef(false);
  const savedHideTimeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const lastOpenAddClipRequestRef = useRef(0);

  useEffect(() => {
    rawTextRef.current = rawText;
  }, [rawText]);

  useLayoutEffect(() => {
    if (openAddClipRequestId <= lastOpenAddClipRequestRef.current) return;
    lastOpenAddClipRequestRef.current = openAddClipRequestId;
    scrollAddClipIntoViewAfterOpen.current = true;
    setFormOpen(true);
  }, [openAddClipRequestId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (savedHideTimeoutRef.current) {
        clearTimeout(savedHideTimeoutRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (!formOpen || !scrollAddClipIntoViewAfterOpen.current) return;
    scrollAddClipIntoViewAfterOpen.current = false;
    requestAnimationFrame(() => {
      addClipPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [formOpen]);

  async function handleUrlPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData?.getData("text/plain")?.trim() ?? "";
    if (!looksLikeHttpUrl(pasted)) return;

    queueMicrotask(async () => {
      if (rawTextRef.current.trim() !== "") return;

      try {
        const res = await fetch("/api/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: pasted }),
        });
        if (!res.ok) return;

        const data = (await res.json()) as { title?: string };
        const title = data.title?.trim();
        if (title && rawTextRef.current.trim() === "") {
          setRawText(title);
        }
      } catch {
        /* ignore preview failures */
      }
    });
  }

  function hasValidInputForMode(): boolean {
    if (clipType === "text") return rawText.trim().length > 0;
    if (clipType === "url") return url.trim().length > 0;
    if (clipType === "screenshot") return Boolean(imageFile);
    return false;
  }

  function trySubmitClipFromEnter(e: React.KeyboardEvent) {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    if (pending) return;
    if (!hasValidInputForMode()) return;
    formRef.current?.requestSubmit();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!hasValidInputForMode()) return;
    setError(null);
    setShowSaved(false);
    setPending(true);
    try {
      const hasText = rawText.trim().length > 0;
      const hasUrl = url.trim().length > 0;
      const hasScreenshotFile = Boolean(imageFile);

      if (!hasText && !hasUrl && !hasScreenshotFile) {
        setError("Add text, a screenshot, or a URL.");
        return;
      }

      let imageUrl: string | undefined;
      if (imageFile) {
        const fd = new FormData();
        fd.append("file", imageFile);
        const up = await fetch("/api/capture-image", {
          method: "POST",
          body: fd,
        });
        const upBody = (await up.json()) as { image_url?: string; error?: string };
        if (!up.ok) {
          setError(upBody.error ?? `Image upload failed (${up.status})`);
          return;
        }
        if (!upBody.image_url) {
          setError("Image upload did not return a URL.");
          return;
        }
        imageUrl = upBody.image_url;
      }

      const hasImage = Boolean(imageUrl);

      let inferredType: "text" | "link" | "url" | "screenshot";
      if (hasUrl) {
        inferredType = "url";
      } else if (hasImage) {
        inferredType = "screenshot";
      } else {
        inferredType = "text";
      }

      const payload: Record<string, string | undefined> = {
        raw_text: rawText.trim(),
        url: url.trim(),
        source: source.trim() || "manual",
        capture_type: inferredType,
        user_note: userNote.trim() || undefined,
      };
      if (imageUrl) payload.image_url = imageUrl;

      console.log("CAPTURE_FORM_SUBMIT", {
        hasUrlField: Object.prototype.hasOwnProperty.call(payload, "url"),
        urlLen: (payload.url ?? "").length,
        urlPrefix: (payload.url ?? "").slice(0, 120),
        rawLen: (payload.raw_text ?? "").length,
        capture_type: payload.capture_type,
        hasImageUrl: Boolean(payload.image_url),
        source: payload.source,
      });

      const res = await fetch("/api/captures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let body: CaptureRow & { error?: string };
      try {
        body = (await res.json()) as CaptureRow & { error?: string };
      } catch (jsonErr) {
        console.error("CAPTURE_FORM_SUBMIT_RESPONSE", {
          ok: res.ok,
          status: res.status,
          parseJsonError:
            jsonErr instanceof Error ? jsonErr.message : String(jsonErr),
        });
        throw jsonErr;
      }

      console.log("CAPTURE_FORM_SUBMIT_RESPONSE", {
        ok: res.ok,
        status: res.status,
        responseId: body.id ?? null,
        responseUrl: typeof body.url === "string" ? body.url.slice(0, 120) : body.url,
        responseError: body.error ?? null,
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError("Sign in to save clips.");
          return;
        }
        setError(body.error ?? `Request failed (${res.status})`);
        return;
      }

      console.log("CAPTURE_FORM_SUBMIT_OK", {
        newClipId: body.id,
        willRouterRefresh: true,
      });

      const newClipId = body.id;

      if (!mountedRef.current) return;

      setRawText("");
      setUrl("");
      setSource("manual");
      setUserNote("");
      setClipType("text");
      setImageFile(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }

      closeFormIfMobile(setFormOpen);

      if (savedHideTimeoutRef.current) {
        clearTimeout(savedHideTimeoutRef.current);
      }
      setShowSaved(true);
      savedHideTimeoutRef.current = window.setTimeout(() => {
        if (mountedRef.current) {
          setShowSaved(false);
        }
        savedHideTimeoutRef.current = null;
      }, 1000);

      queueMicrotask(() => {
        if (!mountedRef.current) return;
        console.log("CAPTURE_FORM_ROUTER_REFRESH", { newClipId });
        router.refresh();
        if (newClipId) {
          window.setTimeout(() => {
            document
              .getElementById(`clip-${newClipId}`)
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 200);
        }
      });
    } catch {
      if (mountedRef.current) {
        setError("Network error");
      }
    } finally {
      if (mountedRef.current) {
        setPending(false);
      }
    }
  }

  const fieldClass =
    "w-full min-h-[3rem] rounded-2xl border border-[#263526]/12 bg-[#f3f2ed] px-4 py-3.5 text-base leading-snug text-[#1a221a] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none placeholder:text-zinc-500/80 transition-[border-color,box-shadow] focus:border-[#d4a017]/45 focus:ring-2 focus:ring-[#d4a017]/25 focus:ring-offset-0 dark:border-white/10 dark:bg-zinc-800/70 dark:text-zinc-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:placeholder:text-zinc-500 dark:focus:border-[#d4a017]/50";

  const panelShellClass =
    "rounded-[24px] border border-[#263526]/10 bg-[#fafaf8] p-5 shadow-[0_12px_40px_-12px_rgba(38,53,38,0.25)] ring-1 ring-black/[0.04] dark:border-[#2f3e2f]/40 dark:bg-[#161c16] dark:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.55)] dark:ring-white/[0.06] sm:p-6";

  const uploadCardClass =
    "relative flex min-h-[13rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#263526]/18 bg-[#f0efe8]/90 px-4 py-8 text-center transition-colors hover:border-[#d4a017]/35 hover:bg-[#ebe9e1] dark:border-white/15 dark:bg-zinc-800/40 dark:hover:border-[#d4a017]/30 dark:hover:bg-zinc-800/60 sm:min-h-[14rem]";

  const fileInputOverlayClass =
    "absolute inset-0 z-10 h-full w-full min-h-[13rem] cursor-pointer opacity-0 sm:min-h-[14rem]";

  const segmentWrapClass =
    "flex w-full rounded-full border border-[#263526]/12 bg-[#e8e6df]/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:border-white/10 dark:bg-zinc-800/60 dark:shadow-none";

  const segmentBtnClass =
    "min-h-[2.75rem] flex-1 rounded-full px-2 py-2 text-sm font-semibold transition-all duration-200 ease-out sm:min-h-0 sm:py-2.5";

  const segmentActiveClass =
    "bg-[#1a241a] text-white shadow-[0_2px_8px_rgba(26,36,26,0.35)] dark:bg-zinc-100 dark:text-[#1a221a] dark:shadow-md";

  const segmentInactiveClass =
    "text-zinc-500 hover:bg-white/50 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-200";

  const saveDisabled = pending || !hasValidInputForMode();

  const addClipPanelScroll =
    "scroll-mt-20 sm:scroll-mt-0";

  function handleOpenAddClip() {
    scrollAddClipIntoViewAfterOpen.current = true;
    setFormOpen(true);
  }

  return (
    <section className="mb-2 sm:mb-8">
      {!formOpen ? (
        <button
          type="button"
          onClick={handleOpenAddClip}
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] right-4 z-40 inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-br from-[#263526] via-[#2f3e2f] to-[#4a3f20] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(47,62,47,0.35)] ring-1 ring-[#d4a017]/35 transition active:scale-95 sm:hidden"
          aria-label="Add clip"
        >
          <span className="text-lg font-semibold leading-none text-[#d4a017]">
            +
          </span>
          Clips
        </button>
      ) : null}

      <div
        ref={addClipPanelRef}
        className={
          formOpen
            ? `block sm:block ${panelShellClass} ${addClipPanelScroll}`
            : `hidden sm:block ${panelShellClass} ${addClipPanelScroll}`
        }
      >
        <div className="mb-6 flex items-center justify-between gap-3 sm:mb-7">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-[#d4a017] shadow-[0_0_0_3px_rgba(212,160,23,0.2)]"
              aria-hidden
            />
            <h2 className="truncate text-xl font-bold tracking-tight text-[#1a221a] dark:text-zinc-50 sm:text-2xl">
              New clip
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setFormOpen(false)}
            className="shrink-0 rounded-full border border-[#263526]/12 bg-white/90 px-4 py-2 text-xs font-semibold text-zinc-600 shadow-sm transition hover:border-[#d4a017]/30 hover:bg-[#fffef8] hover:text-[#1a221a] active:scale-[0.97] dark:border-white/10 dark:bg-zinc-800/90 dark:text-zinc-300 dark:hover:border-[#d4a017]/35 dark:hover:bg-zinc-800 sm:hidden"
          >
            Close
          </button>
        </div>

        <form
          ref={formRef}
          noValidate
          onSubmit={handleSubmit}
          className="space-y-6 sm:space-y-7"
        >
          <div className="space-y-2.5">
            <div
              className={segmentWrapClass}
              role="group"
              aria-label="Clip type"
            >
              {(
                [
                  { id: "text" as const, label: "Text" },
                  { id: "url" as const, label: "URL" },
                  { id: "screenshot" as const, label: "Screenshot" },
                ] as const
              ).map(({ id, label }) => {
                const active = clipType === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setClipType(id)}
                    className={`${segmentBtnClass} ${
                      active ? segmentActiveClass : segmentInactiveClass
                    }`}
                    aria-pressed={active}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="px-0.5 text-center text-xs leading-snug text-zinc-500 dark:text-zinc-400">
              Choose what you want to add
            </p>
          </div>

          <div className="min-h-[1px]">
            {clipType === "text" ? (
              <textarea
                name="raw_text"
                rows={4}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                onKeyDown={trySubmitClipFromEnter}
                className={`${fieldClass} min-h-[7.5rem] resize-y bg-[#fdfcf7] font-sans leading-relaxed sm:min-h-[8rem] dark:bg-[#222a22]/80`}
                placeholder="Add text for a clip…"
              />
            ) : null}

            {clipType === "url" ? (
              <input
                name="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onPaste={handleUrlPaste}
                onKeyDown={trySubmitClipFromEnter}
                className={fieldClass}
                placeholder="Paste a link…"
              />
            ) : null}

            {clipType === "screenshot" ? (
              <div className={uploadCardClass}>
                <input
                  ref={imageInputRef}
                  name="screenshot"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) =>
                    setImageFile(e.target.files?.item(0) ?? null)
                  }
                  className={fileInputOverlayClass}
                  aria-label="Choose screenshot image"
                />
                <div className="pointer-events-none flex flex-col items-center gap-2 px-3">
                  {imageFile ? (
                    <>
                      <span className="max-w-full truncate text-sm font-semibold text-[#1a221a] dark:text-zinc-100">
                        {imageFile.name}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        Tap to replace
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-base font-semibold text-[#1a221a] dark:text-zinc-100">
                        Add screenshot
                      </span>
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        Tap or drop an image
                      </span>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 pt-2 sm:pt-1">
            {showSaved ? (
              <span
                className="text-center text-sm font-medium text-emerald-600 dark:text-emerald-400 sm:text-left"
                role="status"
              >
                Saved
              </span>
            ) : null}
            <button
              type="submit"
              disabled={saveDisabled}
              className="w-full rounded-2xl bg-gradient-to-br from-[#1a241a] via-[#263526] to-[#1f2a1f] px-4 py-4 text-base font-semibold text-white shadow-[0_8px_24px_-6px_rgba(38,53,38,0.55)] ring-1 ring-[#d4a017]/25 transition hover:brightness-110 hover:shadow-[0_10px_28px_-6px_rgba(38,53,38,0.6)] active:scale-[0.99] active:brightness-95 disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none disabled:ring-0 disabled:hover:brightness-100 dark:from-zinc-100 dark:via-zinc-50 dark:to-zinc-200 dark:text-[#1a221a] dark:ring-[#d4a017]/30 dark:hover:brightness-105 dark:disabled:hover:brightness-100"
            >
              {pending ? "Saving…" : "Save clip"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
