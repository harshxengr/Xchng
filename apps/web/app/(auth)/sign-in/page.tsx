import { SignInForm } from "@/components/auth/sign-in-form";

export default function SignInPage() {
    return (
        <div className="animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 rounded-lg border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/30">
            <div className="mb-8">
                <h1 className="text-2xl font-semibold tracking-tight text-white">Sign in</h1>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                    Access your markets, balances, and trading workspace.
                </p>
            </div>
            <SignInForm />
            <p className="mt-8 text-sm text-slate-500">
                New to Xchng?{" "}
                <a href="/sign-up" className="font-medium text-slate-100 underline-offset-4 hover:underline">
                    Create an account
                </a>
            </p>
        </div>
    );
}
