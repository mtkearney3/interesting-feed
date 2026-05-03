"use client";

import Link from "next/link";
import { rabbitHoleMainWidthClass } from "@/lib/rabbit-hole-layout";

export function RabbitHoleLoginPrompt() {
  return (
    <div
      className={`${rabbitHoleMainWidthClass} flex min-h-[60dvh] flex-col justify-center px-4 py-12`}
    >
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        Rabbit Hole
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-white/75">
        Sign in to see your clips and save new ones. Each account has its own
        private feed.
      </p>
      <Link
        href="/login"
        className="mt-8 inline-flex w-fit items-center justify-center rounded-xl bg-[color:var(--rabbit-hole-accent)] px-5 py-3 text-sm font-semibold text-zinc-950 shadow-sm transition hover:brightness-110 active:scale-[0.98]"
      >
        Sign in or create account
      </Link>
    </div>
  );
}
