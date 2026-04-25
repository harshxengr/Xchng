"use client";

import { authClient } from "@workspace/auth/client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        if (!token) {
            setError("Invalid or expired reset token");
            setIsLoading(false);
            return;
        }

        const form = new FormData(e.currentTarget);
        const password = form.get("password") as string;
        const confirmPassword = form.get("confirmPassword") as string;

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            setIsLoading(false);
            return;
        }

        if (password.length < 8) {
            setError("Password must be at least 8 characters");
            setIsLoading(false);
            return;
        }

        const { error } = await authClient.resetPassword({
            newPassword: password,
            token: token,
        });

        if (error) {
            setError(error.message ?? "Failed to reset password");
            setIsLoading(false);
            return;
        }

        setSuccess(true);
        setIsLoading(false);
    };

    useEffect(() => {
        if (!success) return;
        const t = setTimeout(() => router.replace("/sign-in"), 2000);
        return () => clearTimeout(t);
    }, [success, router]);

    if (!token) {
        return (
            <div className="rounded-md border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-200">
                Invalid or missing reset token. Please request a new password reset link.
                <div className="mt-4">
                    <a href="/forgot-password" className="font-medium text-slate-100 underline-offset-4 hover:underline">
                        Go back to forgot password
                    </a>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="py-4 text-center">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10">
                    <svg className="size-6 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="mb-2 text-lg font-semibold text-white">Password reset successful</h2>
                <p className="text-sm leading-6 text-slate-400">
                    Your password has been reset. You will be redirected to the sign-in page momentarily.
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <label htmlFor="password" className="text-sm text-slate-300">
                    New password
                </label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    disabled={isLoading}
                    placeholder="Min. 8 characters"
                    className="h-11 w-full rounded-md border border-white/10 bg-transparent px-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-slate-400 disabled:opacity-50"
                />
            </div>

            <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm text-slate-300">
                    Confirm new password
                </label>
                <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    disabled={isLoading}
                    placeholder="Repeat password"
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
                {isLoading ? "Resetting..." : "Reset password"}
            </button>
        </form>
    );
}
