"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { RabbitHolePageShell } from "@/components/rabbit-hole-page-shell";
import { rabbitHoleMainWidthClass } from "@/lib/rabbit-hole-layout";

type Props = {
  endpointUrl: string;
};

export function ShortcutSetupClient({ endpointUrl }: Props) {
  const [copied, setCopied] = useState(false);

  const copyEndpoint = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(endpointUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert("Could not copy — select the URL and copy manually.");
    }
  }, [endpointUrl]);

  return (
    <RabbitHolePageShell>
      <div className={`${rabbitHoleMainWidthClass} px-4 py-10 sm:px-6`}>
        <Link
          href="/"
          className="text-sm font-medium text-white/70 hover:text-white"
        >
          ← Back to Rabbit Hole
        </Link>

        <h1 className="mt-6 text-2xl font-semibold text-white">
          Set up iPhone Shortcut
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">
          Your personal endpoint sends clips to your account only. Paste it
          into the Shortcut when asked for the Rabbit Hole URL.
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/55">
            Your endpoint
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-black/25 px-3 py-2.5 text-xs leading-relaxed text-[color:var(--rabbit-hole-accent)] sm:text-sm">
              {endpointUrl}
            </code>
            <button
              type="button"
              onClick={() => void copyEndpoint()}
              className="shrink-0 rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <ol className="mt-10 max-w-xl list-decimal space-y-3 pl-5 text-sm leading-relaxed text-white/85">
          <li>Install the shortcut on your iPhone.</li>
          <li>
            When prompted, paste your personal Rabbit Hole endpoint (above).
          </li>
          <li>
            Share screenshots, links, or text to Rabbit Hole — they appear in
            your feed here. Images are normalized to PNG or JPEG on the server
            for AI; optional JSON field{" "}
            <code className="rounded bg-black/30 px-1">image_mime_type</code>{" "}
            may be set to{" "}
            <code className="rounded bg-black/30 px-1">image/jpeg</code>,{" "}
            <code className="rounded bg-black/30 px-1">image/png</code>,{" "}
            <code className="rounded bg-black/30 px-1">image/webp</code>, or{" "}
            <code className="rounded bg-black/30 px-1">image/gif</code>.
          </li>
        </ol>

        <p className="mt-8 text-xs text-white/50">
          Keep this URL private. Anyone with the link could add clips to your
          account until you revoke the token in the future.
        </p>
      </div>
    </RabbitHolePageShell>
  );
}
