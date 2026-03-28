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
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                Invalid or missing reset token. Please request a new password reset link.
                <div className="mt-4">
                    <a href="/forgot-password" className="text-red-700 font-medium hover:underline">
                        Go back to forgot password
                    </a>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="text-center py-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Password reset successful</h2>
                <p className="text-sm text-gray-500">
                    Your password has been reset. You will be redirected to the sign-in page momentarily.
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                </label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    disabled={isLoading}
                    placeholder="Min. 8 characters"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
                />
            </div>

            <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                </label>
                <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    disabled={isLoading}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
                />
            </div>

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
                {isLoading ? "Resetting..." : "Reset password"}
            </button>
        </form>
    );
}
