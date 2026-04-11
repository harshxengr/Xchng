"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  CandlestickChart,
  ChartNoAxesCombined,
  CircleDot,
  LayoutGrid,
  Search,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { SignOutButton } from "@/components/auth/sign-out-button";

type ProtectedShellNavProps = {
  user: {
    name?: string | null;
    email: string;
  };
  canManageMmBot: boolean;
};

function navLinkClassName(active: boolean) {
  return [
    "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-[var(--exchange-yellow)] text-slate-950"
      : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
  ].join(" ");
}

export function ProtectedShellNav({ user, canManageMmBot }: ProtectedShellNavProps) {
  const pathname = usePathname();
  const userName = user.name?.trim() || user.email.split("@")[0] || "Trader";
  const initials = userName
    .split(" ")
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const links = [
    {
      href: "/dashboard",
      label: "Overview",
      icon: LayoutGrid,
      active: pathname === "/dashboard"
    },
    {
      href: "/markets",
      label: "Markets",
      icon: Search,
      active: pathname === "/markets"
    },
    {
      href: "/trade/TATA_INR",
      label: "Trade",
      icon: ChartNoAxesCombined,
      active: pathname.startsWith("/trade/")
    }
  ];

  if (canManageMmBot) {
    links.push({
      href: "/ops/mm-bot",
      label: "Ops",
      icon: Bot,
      active: pathname.startsWith("/ops/")
    });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070b12]/92 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 w-full max-w-[1600px] flex-col gap-3 px-3 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--exchange-yellow)] text-slate-950 shadow-[0_16px_44px_rgba(240,185,11,0.16)]">
                <CandlestickChart className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-slate-500">XCHNG</p>
              <p className="text-sm font-semibold text-white">Spot Exchange</p>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
            {links.map(({ href, label, icon: Icon, active }) => (
              <Link key={href} href={href} className={navLinkClassName(active)}>
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button asChild className="h-10 rounded-xl bg-[var(--exchange-yellow)] px-4 text-sm font-semibold text-slate-950 hover:bg-yellow-300">
            <Link href="/trade/TATA_INR">Trade TATA/INR</Link>
          </Button>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-white/8 text-xs font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{userName}</p>
              <p className="max-w-[180px] truncate text-xs text-slate-500">{user.email}</p>
            </div>
            <div className="hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200 sm:inline-flex sm:items-center sm:gap-1.5">
              <CircleDot className="size-3" />
              Live
            </div>
          </div>

          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
