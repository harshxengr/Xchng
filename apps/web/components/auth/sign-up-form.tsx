"use client";

import { authClient } from "@workspace/auth/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function SignUpForm() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
            callbackURL: "/markets",
        });

        if (error) {
            setError(error.message ?? "Failed to create account");
            setIsLoading(false);
            return;
        }

        router.push("/markets");
        router.refresh();
    };

    const handleSocialSignUp = async (provider: "google" | "github") => {
        setError(null);
        setIsLoading(true);

        const { error } = await authClient.signIn.social({
            provider,
            callbackURL: "/markets",
            newUserCallbackURL: "/markets",
            errorCallbackURL: "/sign-up?error=oauth",
        });

        if (error) {
            setError(error.message ?? "OAuth sign up failed");
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-5">
            <button
                type="button"
                onClick={() => handleSocialSignUp("google")}
                disabled={isLoading}
                className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-white/10 bg-transparent px-4 text-sm font-medium text-slate-100 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
            >
                <svg className="size-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
            </button>

            <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs text-slate-500">
                    <span className="bg-[#070a11] px-3">or</span>
                </div>
            </div>

            <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                    <label htmlFor="name" className="text-sm text-slate-300">
                        Name
                    </label>
                    <input
                        id="name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        required
                        disabled={isLoading}
                        placeholder="Your name"
                        className="h-11 w-full rounded-md border border-white/10 bg-transparent px-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-slate-400 disabled:opacity-50"
                    />
                </div>

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

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <label htmlFor="password" className="text-sm text-slate-300">
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
                            className="h-11 w-full rounded-md border border-white/10 bg-transparent px-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-slate-400 disabled:opacity-50"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="confirmPassword" className="text-sm text-slate-300">
                            Confirm
                        </label>
                        <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type="password"
                            autoComplete="new-password"
                            required
                            disabled={isLoading}
                            placeholder="Repeat password"
                            className="h-11 w-full rounded-md border border-white/10 bg-transparent px-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-slate-400 disabled:opacity-50"
                        />
                    </div>
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
                    {isLoading ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
                </button>
            </form>
        </div>
    );
}
