"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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

export function CaptureForm() {
  const router = useRouter();
  const rawTextRef = useRef("");
  const [rawText, setRawText] = useState("");
  const [url, setUrl] = useState("");
  const [source, setSource] = useState("manual");
  const [captureType, setCaptureType] = useState<"text" | "link" | "screenshot">(
    "link"
  );
  const [userNote, setUserNote] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const moreOptionsRef = useRef<HTMLDetailsElement>(null);
  const savedHideTimeoutRef = useRef<number | null>(null);
  const feedRefreshTimeoutRef = useRef<number | null>(null);

  rawTextRef.current = rawText;

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
    return () => {
      if (savedHideTimeoutRef.current) {
        clearTimeout(savedHideTimeoutRef.current);
      }
      if (feedRefreshTimeoutRef.current) {
        clearTimeout(feedRefreshTimeoutRef.current);
      }
    };
  }, []);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setShowSaved(false);
    setPending(true);
    try {
      if (captureType === "screenshot" && !imageFile) {
        setError("Screenshot captures require an image file.");
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

      const payload: Record<string, string | undefined> = {
        raw_text: rawText.trim(),
        url: url.trim(),
        source: source.trim() || "manual",
        capture_type: captureType,
        user_note: userNote.trim() || undefined,
      };
      if (imageUrl) payload.image_url = imageUrl;

      const res = await fetch("/api/captures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(body.error ?? `Request failed (${res.status})`);
        return;
      }

      setRawText("");
      setUrl("");
      setSource("manual");
      setCaptureType("link");
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
        setShowSaved(false);
        savedHideTimeoutRef.current = null;
      }, 1000);

      router.refresh();
      if (feedRefreshTimeoutRef.current) {
        clearTimeout(feedRefreshTimeoutRef.current);
      }
      feedRefreshTimeoutRef.current = window.setTimeout(() => {
        feedRefreshTimeoutRef.current = null;
        router.refresh();
      }, 2500);
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  function onCaptureTypeChange(next: "text" | "link" | "screenshot") {
    setCaptureType(next);
    if (next === "text") {
      setUrl("");
    }
    if (next !== "screenshot") {
      setImageFile(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  }

  const fieldClass =
    "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none ring-sky-500/30 placeholder:text-zinc-500 focus:border-sky-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-sky-600";

  const labelClass =
    "text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400";

  return (
    <section className="mb-4 sm:mb-8">
      <button
        type="button"
        onClick={() => setFormOpen(true)}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-white py-3 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:border-sky-400/60 hover:bg-sky-50/50 hover:text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-200 dark:hover:border-sky-700/50 dark:hover:bg-sky-950/30 sm:hidden"
      >
        <span className="text-lg leading-none text-sky-600 dark:text-sky-400" aria-hidden>
          +
        </span>
        New Capture
      </button>

      <div
        className={
          formOpen
            ? "block rounded-xl border border-zinc-200 bg-white p-4 shadow-md dark:border-zinc-800 dark:bg-zinc-900 sm:block sm:rounded-xl sm:border sm:p-5 sm:shadow-sm"
            : "hidden sm:block sm:rounded-xl sm:border sm:border-zinc-200 sm:bg-white sm:p-5 sm:shadow-sm dark:sm:border-zinc-800 dark:sm:bg-zinc-900"
        }
      >
        <div className="mb-3 flex items-center justify-between sm:mb-4">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 sm:text-lg">
            New capture
          </h2>
          <button
            type="button"
            onClick={() => setFormOpen(false)}
            className="text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 sm:hidden"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <label className="block">
            <span className={labelClass}>Text</span>
            <textarea
              name="raw_text"
              required={captureType === "text"}
              rows={3}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className={`${fieldClass} min-h-[4.5rem] resize-y font-sans sm:min-h-[6.5rem]`}
              placeholder="What you captured…"
            />
          </label>

          {captureType !== "text" ? (
            <label className="block">
              <span className={labelClass}>URL</span>
              <input
                name="url"
                type="url"
                required={captureType === "link"}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onPaste={handleUrlPaste}
                className={fieldClass}
                placeholder={
                  captureType === "screenshot"
                    ? "Optional page URL…"
                    : "https://…"
                }
              />
            </label>
          ) : null}

          <label className="block">
            <span className={labelClass}>Screenshot image</span>
            <input
              ref={imageInputRef}
              name="screenshot"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              required={captureType === "screenshot"}
              onChange={(e) =>
                setImageFile(e.target.files?.item(0) ?? null)
              }
              className={`${fieldClass} py-2.5 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-200 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-zinc-800 dark:file:bg-zinc-700 dark:file:text-zinc-200`}
            />
            <p className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
              JPEG, PNG, WebP, or GIF (max 5MB). Required for Screenshot type;
              optional otherwise.
            </p>
          </label>

          <label className="block">
            <span className={labelClass}>Capture type</span>
            <select
              name="capture_type"
              value={captureType}
              onChange={(e) =>
                onCaptureTypeChange(
                  e.target.value as "text" | "link" | "screenshot"
                )
              }
              className={fieldClass}
            >
              <option value="link">Link</option>
              <option value="text">Text</option>
              <option value="screenshot">Screenshot</option>
            </select>
          </label>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 sm:border-0 sm:p-0">
            <details ref={moreOptionsRef} className="group">
              <summary className="cursor-pointer list-none px-1 py-2 text-xs font-semibold text-zinc-600 marker:hidden before:content-none sm:hidden [&::-webkit-details-marker]:hidden">
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
              {pending ? "Saving…" : "Save capture"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
