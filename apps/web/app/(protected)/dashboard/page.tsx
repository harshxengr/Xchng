import { requireSession } from "@/lib/auth-session";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function DashboardPage() {
  const session = await requireSession();

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Welcome, {session.user.name ?? "User"}
            </h1>
            <p className="text-sm text-gray-500">{session.user.email}</p>
          </div>
          <SignOutButton />
        </div>
        {/* your dashboard content */}
      </div>
    </main>
  );
}