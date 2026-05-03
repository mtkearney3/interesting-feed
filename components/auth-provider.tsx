"use client";

import type { AuthError, User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    void supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      return { error };
    },
    [supabase]
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      const origin =
        typeof window !== "undefined" ? window.location.origin : undefined;
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: origin ? { emailRedirectTo: `${origin}/` } : undefined,
      });
      return { error };
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  }, [supabase, router]);

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut }),
    [user, loading, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
