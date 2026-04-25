"use client";

import { authClient } from "@workspace/auth/client";
import { useState } from "react";

export function ForgotPasswordForm() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        const form = new FormData(e.currentTarget);

        const { error } = await authClient.requestPasswordReset({
            email: form.get("email") as string,
            redirectTo: "/reset-password",
        });

        if (error) {
            setError(error.message ?? "Failed to send reset email");
            setIsLoading(false);
            return;
        }

        setSuccess(true);
        setIsLoading(false);
    };

    if (success) {
        return (
            <div className="py-4 text-center">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10">
                    <svg className="size-6 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                </div>
                <h2 className="mb-2 text-lg font-semibold text-white">Check your email</h2>
                <p className="text-sm leading-6 text-slate-400">
                    If an account exists for that email, we sent a password reset link.
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <label htmlFor="email" className="text-sm text-slate-300">
                    Email
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    disabled={isLoading}
                    placeholder="you@example.com"
                    className="h-11 w-full rounded-md border border-white/10 bg-transparent px-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-slate-400 disabled:opacity-50"
                />
            </div>

            {error && (
                <div className="rounded-md border border-rose-500/25 bg-rose-500/10 px-3 py-2">
                    <p className="text-sm text-rose-200">{error}</p>
                </div>
            )}

            <button
                type="submit"
                disabled={isLoading}
                className="flex h-11 w-full items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {isLoading ? "Sending..." : "Send reset link"}
            </button>
        </form>
    );
}
