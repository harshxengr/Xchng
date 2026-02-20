import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-gray-900">Reset password</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Enter your email and we&apos;ll send you a reset link
                </p>
            </div>
            <ForgotPasswordForm />
            <p className="text-sm text-center text-gray-500 mt-6">
                Remember your password?{" "}
                <a href="/sign-in" className="text-blue-600 hover:underline font-medium">
                    Sign in
                </a>
            </p>
        </div>
    );
}