import { SignUpForm } from "@/components/auth/sign-up-form";

export default function SignUpPage() {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-gray-900">Create account</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Get started for free today
                </p>
            </div>
            <SignUpForm />
            <p className="text-sm text-center text-gray-500 mt-6">
                Already have an account?{" "}
                <a href="/sign-in" className="text-blue-600 hover:underline font-medium">
                    Sign in
                </a>
            </p>
        </div>
    );
}