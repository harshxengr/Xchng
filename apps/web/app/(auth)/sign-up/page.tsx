import { SignUpForm } from "@/components/auth/sign-up-form";

export default function SignUpPage() {
    return (
        <div className="animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 rounded-lg border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/30">
            <div className="mb-8">
                <h1 className="text-2xl font-semibold tracking-tight text-white">Create account</h1>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                    Start trading with a secure Xchng account.
                </p>
            </div>
            <SignUpForm />
            <p className="mt-8 text-sm text-slate-500">
                Already have an account?{" "}
                <a href="/sign-in" className="font-medium text-slate-100 underline-offset-4 hover:underline">
                    Sign in
                </a>
            </p>
        </div>
    );
}
