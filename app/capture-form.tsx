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

export function CaptureForm({ openAddClipRequestId = 0 }: CaptureFormProps) {
  const router = useRouter();
  const rawTextRef = useRef("");
  const [rawText, setRawText] = useState("");
  const [url, setUrl] = useState("");
  const [source, setSource] = useState("manual");
  const [userNote, setUserNote] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const moreOptionsRef = useRef<HTMLDetailsElement>(null);
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
    const syncMoreOpen = () => {
      const el = moreOptionsRef.current;
      if (!el) return;
      el.open = window.matchMedia("(min-width: 640px)").matches;
    };
    syncMoreOpen();
    window.addEventListener("resize", syncMoreOpen);
    return () => window.removeEventListener("resize", syncMoreOpen);
  }, []);

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

  function trySubmitClipFromEnter(e: React.KeyboardEvent) {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    if (pending) return;
    formRef.current?.requestSubmit();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
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
    "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none ring-sky-500/30 placeholder:text-zinc-500 focus:border-sky-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-sky-600";

  const labelClass =
    "text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400";

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
            ? `block rounded-xl border border-zinc-200 bg-white p-4 shadow-md dark:border-zinc-800 dark:bg-zinc-900 sm:block sm:rounded-xl sm:border sm:p-5 sm:shadow-sm ${addClipPanelScroll}`
            : `hidden sm:block sm:rounded-xl sm:border sm:border-zinc-200 sm:bg-white sm:p-5 sm:shadow-sm dark:sm:border-zinc-800 dark:sm:bg-zinc-900 ${addClipPanelScroll}`
        }
      >
        <div className="mb-3 flex items-center justify-between sm:mb-4">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 sm:text-lg">
            New clip
          </h2>
          <button
            type="button"
            onClick={() => setFormOpen(false)}
            className="text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 sm:hidden"
          >
            Close
          </button>
        </div>

        <form
          ref={formRef}
          noValidate
          onSubmit={handleSubmit}
          className="space-y-3 sm:space-y-4"
        >
          <label className="block">
            <span className={labelClass}>Text</span>
            <textarea
              name="raw_text"
              rows={3}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              onKeyDown={trySubmitClipFromEnter}
              className={`${fieldClass} min-h-[4.5rem] resize-y font-sans sm:min-h-[6.5rem]`}
              placeholder="What you saved…"
            />
          </label>

          <label className="block">
            <span className={labelClass}>URL</span>
            <input
              name="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onPaste={handleUrlPaste}
              onKeyDown={trySubmitClipFromEnter}
              className={fieldClass}
              placeholder="Optional — https://…"
            />
          </label>

          <label className="block">
            <span className={labelClass}>Screenshot image</span>
            <input
              ref={imageInputRef}
              name="screenshot"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) =>
                setImageFile(e.target.files?.item(0) ?? null)
              }
              className={`${fieldClass} py-2.5 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-200 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-zinc-800 dark:file:bg-zinc-700 dark:file:text-zinc-200`}
            />
            <p className="mt-1 text-sm leading-normal text-zinc-500 dark:text-zinc-400">
              JPEG, PNG, WebP, or GIF (max 5MB). Optional unless you are not
              adding text or a URL.
            </p>
          </label>

          <p className="text-sm leading-normal text-zinc-500 dark:text-zinc-400">
            Clip type is set when you save: URL → url, else image →
            screenshot, else → text.
          </p>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 sm:border-0 sm:p-0">
            <details ref={moreOptionsRef} className="group">
              <summary className="cursor-pointer list-none px-1 py-2 text-sm font-semibold text-zinc-600 marker:hidden before:content-none sm:hidden [&::-webkit-details-marker]:hidden">
                <span className="text-sky-700 dark:text-sky-400">
                  Source &amp; note
                </span>
                <span className="ml-1 font-normal text-zinc-400">(optional)</span>
              </summary>
              <div className="space-y-3 border-t border-zinc-100 px-1 pb-1 pt-2 dark:border-zinc-800 sm:border-0 sm:px-0 sm:pb-0 sm:pt-0">
                <label className="block">
                  <span className={labelClass}>Source</span>
                  <input
                    name="source"
                    type="text"
                    required
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className={fieldClass}
                    placeholder="manual"
                  />
                </label>

                <label className="block">
                  <span className={labelClass}>Note</span>
                  <input
                    name="user_note"
                    type="text"
                    value={userNote}
                    onChange={(e) => setUserNote(e.target.value)}
                    className={fieldClass}
                    placeholder="Optional"
                  />
                </label>
              </div>
            </details>
          </div>

          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:pt-0">
            {showSaved ? (
              <span
                className="order-first text-center text-sm font-medium text-emerald-600 dark:text-emerald-400 sm:order-none sm:mr-auto sm:text-left"
                role="status"
              >
                Saved
              </span>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 sm:w-auto sm:py-2"
            >
              {pending ? "Saving…" : "Save clip"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
