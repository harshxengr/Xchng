import { SignInForm } from "@/components/auth/sign-in-form";

export default function SignInPage() {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-gray-900">Welcome back</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Sign in to your account to continue
                </p>
            </div>
            <SignInForm />
            <p className="text-sm text-center text-gray-500 mt-6">
                Don&apos;t have an account?{" "}
                <a href="/sign-up" className="text-blue-600 hover:underline font-medium">
                    Sign up
                </a>
            </p>
        </div>
    );
}