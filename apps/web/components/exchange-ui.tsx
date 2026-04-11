import type { ReactNode } from "react";
import { cn } from "@workspace/ui/lib/utils";

export function ExchangePage({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={cn("mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-3 py-4 sm:px-5 lg:px-6", className)}>
      {children}
    </main>
  );
}

export function ExchangeCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn("exchange-card rounded-2xl", className)}>{children}</section>;
}

export function SoftCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("exchange-card-soft rounded-xl", className)}>{children}</div>;
}

export function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
      <div>
        {eyebrow ? <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{eyebrow}</p> : null}
        <h2 className="mt-1 text-base font-semibold text-slate-50">{title}</h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function StatTile({
  label,
  value,
  detail,
  tone = "neutral",
  className = "",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "neutral" | "green" | "red" | "yellow" | "blue";
  className?: string;
}) {
  const toneClass = {
    neutral: "text-slate-50",
    green: "text-[var(--exchange-green)]",
    red: "text-[var(--exchange-red)]",
    yellow: "text-[var(--exchange-yellow)]",
    blue: "text-sky-300",
  }[tone];

  return (
    <SoftCard className={cn("p-4", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <div className={cn("mt-2 text-2xl font-semibold tabular-nums", toneClass)}>{value}</div>
      {detail ? <div className="mt-1 text-xs text-slate-500">{detail}</div> : null}
    </SoftCard>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "red" | "yellow" | "blue";
}) {
  const toneClass = {
    neutral: "border-white/10 bg-white/[0.04] text-slate-300",
    green: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    red: "border-rose-400/20 bg-rose-400/10 text-rose-200",
    yellow: "border-yellow-400/25 bg-yellow-400/10 text-yellow-100",
    blue: "border-sky-400/20 bg-sky-400/10 text-sky-200",
  }[tone];

  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", toneClass)}>{children}</span>;
}
