"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { RabbitHolePageShell } from "@/components/rabbit-hole-page-shell";
import { rabbitHoleMainWidthClass } from "@/lib/rabbit-hole-layout";

export function LoginClient({ redirectTo = "/" }: { redirectTo?: string }) {
  const router = useRouter();
  const { signIn, signUp, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const { error: err } = await signIn(email, password);
      if (err) {
        setError(err.message);
        return;
      }
      router.refresh();
      router.push(redirectTo);
    } finally {
      setBusy(false);
    }
  }

  async function onSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const { error: err } = await signUp(email, password);
      if (err) {
        setError(err.message);
        return;
      }
      setMessage(
        "Check your email to confirm your account, if required. You can try signing in once your account is active."
      );
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || authLoading;

  return (
    <RabbitHolePageShell>
      <div className={`${rabbitHoleMainWidthClass} px-4 py-10`}>
        <Link
          href="/"
          className="text-sm font-medium text-white/70 hover:text-white"
        >
          ← Back to Rabbit Hole
        </Link>
        <h1 className="mt-6 text-2xl font-semibold text-white">Sign in</h1>
        <p className="mt-2 text-sm text-white/65">
          Use your email and password. New here? Create an account with Sign
          up.
        </p>

        <form className="mt-8 space-y-4" onSubmit={onSignIn}>
          <label className="block">
            <span className="text-sm font-semibold text-white/80">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none ring-sky-400/40 focus:border-sky-400/60 focus:ring-2"
              placeholder="you@example.com"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-white/80">
              Password
            </span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none ring-sky-400/40 focus:border-sky-400/60 focus:ring-2"
              placeholder="••••••••"
            />
          </label>

          {error ? (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="text-sm text-[color:var(--rabbit-hole-accent)]">
              {message}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={disabled}
              className="inline-flex justify-center rounded-xl bg-[color:var(--rabbit-hole-accent)] px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-sm transition hover:brightness-110 disabled:opacity-50"
            >
              Sign in
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={onSignUp}
              className="inline-flex justify-center rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              Sign up
            </button>
          </div>
        </form>
      </div>
    </RabbitHolePageShell>
  );
}
