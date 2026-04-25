import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
    return (
        <div className="animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 rounded-lg border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/30">
            <div className="mb-8">
                <h1 className="text-2xl font-semibold tracking-tight text-white">Reset password</h1>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                    Enter your email and we&apos;ll send you a reset link
                </p>
            </div>
            <ForgotPasswordForm />
            <p className="mt-8 text-sm text-slate-500">
                Remember your password?{" "}
                <a href="/sign-in" className="font-medium text-slate-100 underline-offset-4 hover:underline">
                    Sign in
                </a>
            </p>
        </div>
    );
}
