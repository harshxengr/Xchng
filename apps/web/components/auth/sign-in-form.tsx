"use client";

import { authClient } from "@workspace/auth/client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Loader2, ArrowRight } from "lucide-react";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/markets";

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Email + Password ──────────────────────────────────────
  const handleEmailSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const form = new FormData(e.currentTarget);

    const { error } = await authClient.signIn.email({
      email: form.get("email") as string,
      password: form.get("password") as string,
      callbackURL: callbackUrl,
    });

    if (error) {
      setError(error.message ?? "Invalid email or password");
      setIsLoading(false);
      return;
    }

    router.push(callbackUrl);
  };

  // ── Social OAuth ──────────────────────────────────────────
  const handleSocialSignIn = async (provider: "google" | "github") => {
    setError(null);
    setIsLoading(true);

    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: callbackUrl,
      errorCallbackURL: "/sign-in?error=oauth",
    });

    if (error) {
      setError(error.message ?? "OAuth sign in failed");
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Social buttons */}
      <button
        type="button"
        onClick={() => handleSocialSignIn("google")}
        disabled={isLoading}
        className="group relative w-full flex items-center justify-center gap-3 px-4 py-3 border border-white/10 rounded-xl text-sm font-semibold text-white bg-white/[0.03] hover:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-inner"
      >
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        <span className="tracking-tight">Continue with Google</span>
      </button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
          <span className="px-4 bg-[#0d131f] rounded-full">or use email</span>
        </div>
      </div>

      {/* Email + Password form */}
      <form onSubmit={handleEmailSignIn} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">
            <Mail className="size-3" />
            Email Address
          </label>
          <div className="relative">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={isLoading}
              placeholder="you@example.com"
              className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all disabled:opacity-50"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between ml-1">
            <label htmlFor="password" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Lock className="size-3" />
              Password
            </label>
            <a href="/forgot-password" size="sm" className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors">
              Forgot password?
            </a>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={isLoading}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all disabled:opacity-50"
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="animate-in fade-in slide-in-from-top-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
            <p className="text-xs font-medium text-rose-400 text-center">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="group relative w-full overflow-hidden rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 hover:shadow-blue-600/30 active:scale-[0.98] disabled:opacity-50"
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                Sign In
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </span>
        </button>
      </form>
    </div>
  );
}