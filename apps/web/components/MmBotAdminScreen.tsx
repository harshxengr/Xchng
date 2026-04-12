"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, PauseCircle, PlayCircle, RefreshCcw, TriangleAlert } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { getMmBotStatuses, setMmBotPaused, type MmBotStatus } from "@/app/lib/api";

function panelClassName(className = "") {
  return `rounded-[28px] border border-white/10 bg-slate-950/70 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl ${className}`.trim();
}

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: number | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDurationMs(value: number | null) {
  if (value === null) {
    return "n/a";
  }

  if (value < 1000) {
    return `${value} ms`;
  }

  return `${(value / 1000).toFixed(2)} s`;
}

function healthTone(health: MmBotStatus["health"]) {
  if (health === "healthy") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }

  if (health === "paused") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }

  if (health === "stale") {
    return "border-orange-500/30 bg-orange-500/10 text-orange-200";
  }

  return "border-rose-500/30 bg-rose-500/10 text-rose-200";
}

export function MmBotAdminScreen() {
  const [statuses, setStatuses] = useState<MmBotStatus[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [togglingMarket, setTogglingMarket] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  async function loadStatuses() {
    try {
      setLoading(true);
      setMessage("");
      setStatuses(await getMmBotStatuses());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load market-maker status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatuses();
  }, []);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadStatuses();
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [autoRefresh]);

  async function togglePaused(status: MmBotStatus) {
    try {
      setTogglingMarket(status.market);
      setMessage("");
      await setMmBotPaused(status.market, !status.paused);
      await loadStatuses();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update market-maker control");
    } finally {
      setTogglingMarket(null);
    }
  }

  const summary = useMemo(() => {
    return {
      markets: statuses.length,
      paused: statuses.filter((status) => status.paused).length,
      healthy: statuses.filter((status) => status.health === "healthy").length,
      degraded: statuses.filter((status) => status.health === "degraded" || status.health === "stale").length,
      totalPlaced: statuses.reduce((sum, status) => sum + status.totalQuotesPlaced, 0),
      totalCancelled: statuses.reduce((sum, status) => sum + status.totalQuotesCancelled, 0)
    };
  }, [statuses]);

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className={panelClassName()}>
        <div className="flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-7">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-200">
              <Bot className="size-3.5" />
              Operator console
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Market maker control</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Monitor quote health, inspect inventory posture, and pause or resume liquidity per market without leaving the exchange.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="h-11 rounded-2xl border-white/10 bg-white/5 px-5 text-slate-100 hover:bg-white/10"
              onClick={() => void loadStatuses()}
              disabled={loading}
            >
              <RefreshCcw className="size-4" />
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-2xl border-white/10 bg-white/5 px-5 text-slate-100 hover:bg-white/10"
              onClick={() => setAutoRefresh((current) => !current)}
            >
              {autoRefresh ? "Auto refresh: on" : "Auto refresh: off"}
            </Button>
            <Button asChild className="h-11 rounded-2xl bg-emerald-500 px-5 text-slate-950 hover:bg-emerald-400">
              <Link href="/markets">Back to markets</Link>
            </Button>
          </div>
        </div>
      </section>

      {message ? (
        <section className={panelClassName("border-rose-500/35 bg-rose-500/10 px-5 py-4 text-sm font-medium text-rose-200")}>
          {message}
        </section>
      ) : null}

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
        <div className={panelClassName("p-5")}>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Tracked markets</p>
          <p className="mt-4 text-3xl font-semibold text-white">{summary.markets}</p>
        </div>
        <div className={panelClassName("p-5")}>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Healthy markets</p>
          <p className="mt-4 text-3xl font-semibold text-white">{summary.healthy}</p>
        </div>
        <div className={panelClassName("p-5")}>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Paused markets</p>
          <p className="mt-4 text-3xl font-semibold text-white">{summary.paused}</p>
        </div>
        <div className={panelClassName("p-5")}>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Markets with errors</p>
          <p className="mt-4 text-3xl font-semibold text-white">{summary.degraded}</p>
        </div>
        <div className={panelClassName("p-5")}>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Quote churn</p>
          <p className="mt-4 text-3xl font-semibold text-white">{summary.totalPlaced + summary.totalCancelled}</p>
          <p className="mt-2 text-sm text-slate-400">
            {summary.totalPlaced} placed · {summary.totalCancelled} cancelled
          </p>
        </div>
      </section>

      <section className={panelClassName("p-5")}>
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Runtime state</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Per-market status</h2>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {statuses.length === 0 && !loading ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-slate-500">
              No market-maker status has been published yet.
            </div>
          ) : null}

          {statuses.map((status) => (
            <article key={status.market} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-xl font-semibold text-white">{status.market.replace("_", "/")}</h3>
                    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${healthTone(status.health)}`}>
                      {status.health.toUpperCase()}
                    </span>
                    {status.lastError ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-200">
                        <TriangleAlert className="size-3.5" />
                        Error
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    Ref price {formatNumber(status.referencePrice, 2)} · Active bids {status.activeBidOrders} · Active asks {status.activeAskOrders}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Loop #{status.loopCount} · Last cycle {status.lastCyclePlaced} placed / {status.lastCycleCancelled} cancelled · Last loop {formatDurationMs(status.lastLoopDurationMs)}
                  </p>
                </div>

                <Button
                  variant={status.paused ? "default" : "outline"}
                  className={`h-11 rounded-2xl px-5 ${
                    status.paused
                      ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                      : "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                  }`}
                  onClick={() => void togglePaused(status)}
                  disabled={togglingMarket === status.market}
                >
                  {status.paused ? <PlayCircle className="size-4" /> : <PauseCircle className="size-4" />}
                  {togglingMarket === status.market ? "Updating..." : status.paused ? "Resume market maker" : "Pause market maker"}
                </Button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Desired quotes</p>
                  <p className="mt-2 text-sm text-white">Bid {status.desiredBidQuotes} · Ask {status.desiredAskQuotes}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Churn {status.totalQuotesPlaced} placed · {status.totalQuotesCancelled} cancelled
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Bid account</p>
                  <p className="mt-2 text-sm text-white">{formatNumber(status.bidBaseInventory, 4)} base</p>
                  <p className="mt-1 text-xs text-slate-400">{formatNumber(status.bidQuoteInventory, 2)} quote</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ask account</p>
                  <p className="mt-2 text-sm text-white">{formatNumber(status.askBaseInventory, 4)} base</p>
                  <p className="mt-1 text-xs text-slate-400">{formatNumber(status.askQuoteInventory, 2)} quote</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Last success</p>
                  <p className="mt-2 text-sm text-white">{formatDate(status.lastSuccessAt)}</p>
                  <p className="mt-1 text-xs text-slate-400">Last refresh {formatDate(status.lastRefreshAt)}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Error posture</p>
                  <p className="mt-2 text-sm text-white">{status.errorCount} total errors</p>
                  <p className="mt-1 text-xs text-slate-400">{status.consecutiveErrorCount} consecutive failures</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Success rate</p>
                  <p className="mt-2 text-sm text-white">
                    {status.loopCount > 0 ? formatNumber((status.successCount / status.loopCount) * 100, 1) : "0"}%
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{status.successCount} successful loops</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Inventory skew</p>
                  <p className="mt-2 text-sm text-white">{formatNumber(status.inventorySkewBps, 1)} bps</p>
                  <p className="mt-1 text-xs text-slate-400">Control updated {formatDate(status.controlUpdatedAt)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Worker started</p>
                  <p className="mt-2 text-sm text-white">{formatDate(status.startedAt)}</p>
                  <p className="mt-1 text-xs text-slate-400">Last loop {formatDurationMs(status.lastLoopDurationMs)}</p>
                </div>
              </div>

              {status.lastError ? (
                <div className="mt-4 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {status.lastError}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
