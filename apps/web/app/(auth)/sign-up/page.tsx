import { SignUpForm } from "@/components/auth/sign-up-form";

export default function SignUpPage() {
    return (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-8 shadow-2xl backdrop-blur-xl">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold tracking-tight text-white">Get Started</h1>
                <p className="mt-2 text-sm text-slate-400">
                    Join thousands of traders on the most advanced exchange
                </p>
            </div>
            <SignUpForm />
            <p className="mt-8 text-center text-sm text-slate-500">
                Already have an account?{" "}
                <a href="/sign-in" className="font-semibold text-blue-400 hover:text-blue-300 transition-colors">
                    Sign in
                </a>
            </p>
        </div>
    );
}