"use client";

import { authClient } from "@workspace/auth/client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignUpForm() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // ── Email + Password Sign Up ──────────────────────────────
    const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

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

        const { error } = await authClient.signUp.email({
            name: form.get("name") as string,
            email: form.get("email") as string,
            password,
            callbackURL: "/dashboard",
        });

        if (error) {
            setError(error.message ?? "Failed to create account");
            setIsLoading(false);
            return;
        }

        // If email verification is required, show success message
        // Otherwise redirect to dashboard
        setSuccess(true);
        setIsLoading(false);
    };

    // ── Social Sign Up ────────────────────────────────────────
    const handleSocialSignUp = async (provider: "google" | "github") => {
        setError(null);
        setIsLoading(true);

        const { error } = await authClient.signIn.social({
            provider,
            callbackURL: "/dashboard",
            newUserCallbackURL: "/dashboard", // redirect new users here
            errorCallbackURL: "/sign-up?error=oauth",
        });

        if (error) {
            setError(error.message ?? "OAuth sign up failed");
            setIsLoading(false);
        }
    };

    // ── Email Verification Sent State ─────────────────────────
    if (success) {
        return (
            <div className="text-center py-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h2>
                <p className="text-sm text-gray-500">
                    We sent a verification link to your email address. Click the link to
                    activate your account.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Social buttons */}
            <div className="space-y-2">
                <button
                    type="button"
                    onClick={() => handleSocialSignUp("google")}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                </button>
            </div>

            {/* Divider */}
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-400">or</span>
                </div>
            </div>

            {/* Email + Password form */}
            <form onSubmit={handleSignUp} className="space-y-3">
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                        Full name
                    </label>
                    <input
                        id="name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        required
                        disabled={isLoading}
                        placeholder="John Doe"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
                    />
                </div>

                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
                    />
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                        Password
                    </label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        required
                        disabled={isLoading}
                        placeholder="Min. 8 characters"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
                    />
                </div>

                <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        Confirm password
                    </label>
                    <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        required
                        disabled={isLoading}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
                    />
                </div>

                {/* Error message */}
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isLoading ? "Creating account..." : "Create account"}
                </button>

                <p className="text-xs text-center text-gray-400">
                    By creating an account you agree to our{" "}
                    <a href="/terms" className="underline hover:text-gray-600">Terms</a>{" "}
                    and{" "}
                    <a href="/privacy" className="underline hover:text-gray-600">Privacy Policy</a>
                </p>
            </form>
        </div>
    );
}