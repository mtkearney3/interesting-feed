"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function looksLikeHttpUrl(text: string): boolean {
  const t = text.trim();
  return t.startsWith("http://") || t.startsWith("https://");
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
  const savedHideTimeoutRef = useRef<number | null>(null);
  const feedRefreshTimeoutRef = useRef<number | null>(null);

  rawTextRef.current = rawText;

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
    "mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-foreground shadow-sm outline-none ring-zinc-400 placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-600";

  const labelClass = "text-sm font-medium text-zinc-500 dark:text-zinc-500";

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-foreground">New capture</h2>
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex flex-col gap-4">
          <label className="block">
            <span className={labelClass}>Text</span>
            <textarea
              name="raw_text"
              required={captureType === "text"}
              rows={4}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className={`${fieldClass} resize-y font-sans`}
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
              className={`${fieldClass} py-2 file:mr-3 file:rounded file:border-0 file:bg-zinc-200 file:px-2 file:py-1 file:text-xs file:font-medium file:text-zinc-800 dark:file:bg-zinc-700 dark:file:text-zinc-200`}
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              JPEG, PNG, WebP, or GIF (max 5MB). Required for capture type
              &quot;Screenshot&quot;; optional otherwise.
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

        {error ? (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-end gap-3">
          {showSaved ? (
            <span
              className="text-sm font-medium text-emerald-600 dark:text-emerald-400"
              role="status"
            >
              Saved
            </span>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {pending ? "Saving…" : "Save capture"}
          </button>
        </div>
      </form>
    </section>
  );
}
