import { requireGuest } from "@/lib/auth-session";
import Link from "next/link";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireGuest(); // already logged in → redirect to /dashboard

  return (
    <main className="min-h-screen bg-[#070a11] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[1800px] items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-6 block text-center text-sm font-semibold text-white">
            Xchng
          </Link>
          {children}
        </div>
      </div>
    </main>
  );
}
