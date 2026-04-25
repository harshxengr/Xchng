"use client";

import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";

type NavUser = {
  name?: string | null;
  email?: string | null;
};

export function AppTopNav({ user = null }: { user?: NavUser | null }) {
  return (
    <header className="border-b border-white/10 bg-[#070a11] text-white">
      <div className="mx-auto flex max-w-[1800px] items-center justify-between px-5 py-3">
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/" className="font-medium text-white">
            Xchng
          </Link>
          <Link href="/markets" className="text-slate-300 hover:text-white">
            Markets
          </Link>
          <Link href="/wallet" className="text-slate-300 hover:text-white">
            Wallet
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden text-right text-xs sm:block">
                <p className="font-medium text-slate-100">{user.name || "Trader"}</p>
                <p className="text-slate-400">{user.email || ""}</p>
              </div>
              <div className="hidden sm:block">
                <SignOutButton />
              </div>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-slate-100 hover:bg-white/10">
                Sign in
              </Link>
              <Link href="/sign-up" className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-emerald-400">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
