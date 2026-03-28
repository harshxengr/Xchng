import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Suspense } from "react";

export default function ResetPasswordPage() {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-gray-900">Set new password</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Please enter your new password below
                </p>
            </div>
            <Suspense fallback={<div className="text-sm text-gray-500">Loading...</div>}>
                <ResetPasswordForm />
            </Suspense>
            <p className="text-sm text-center text-gray-500 mt-6">
                Remember your password?{" "}
                <a href="/sign-in" className="text-blue-600 hover:underline font-medium">
                    Sign in
                </a>
            </p>
        </div>
    );
}
