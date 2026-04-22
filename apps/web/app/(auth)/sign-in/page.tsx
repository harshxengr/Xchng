import { SignInForm } from "@/components/auth/sign-in-form";

export default function SignInPage() {
    return (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-8 shadow-2xl backdrop-blur-xl">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold tracking-tight text-white">Welcome Back</h1>
                <p className="mt-2 text-sm text-slate-400">
                    Enter your credentials to access your trading desk
                </p>
            </div>
            <SignInForm />
            <p className="mt-8 text-center text-sm text-slate-500">
                New to Xchng?{" "}
                <a href="/sign-up" className="font-semibold text-blue-400 hover:text-blue-300 transition-colors">
                    Create an account
                </a>
            </p>
        </div>
    );
}