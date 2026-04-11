"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Bot, RefreshCcw, Wallet } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ExchangeCard, ExchangePage, SectionTitle, SoftCard, StatTile, StatusPill } from "@/components/exchange-ui";
import {
  getBalances,
  getOrderHistory,
  getTickers,
  type OrderHistoryEntry,
  type Ticker,
  type UserBalances
} from "@/app/lib/api";

type DashboardUser = {
  name?: string | null;
  email: string;
};

type DashboardScreenProps = {
  user: DashboardUser;
  canManageMmBot: boolean;
};

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

export function DashboardScreen({ user, canManageMmBot }: DashboardScreenProps) {
  const [balances, setBalances] = useState<UserBalances>({});
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [orders, setOrders] = useState<OrderHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const userName = user.name?.trim() || user.email.split("@")[0] || "Trader";

  async function loadDashboard() {
    try {
      setLoading(true);
      setMessage("");

      const [balanceData, tickerData, orderData] = await Promise.all([
        getBalances(user.email),
        getTickers(),
        getOrderHistory({ userId: user.email, limit: 8 })
      ]);

      setBalances(balanceData);
      setTickers(tickerData);
      setOrders(orderData);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const summary = useMemo(() => {
    const tickerBySymbol = new Map(tickers.map((ticker) => [ticker.symbol, Number(ticker.lastPrice || 0)]));
    let cashValue = 0;
    let assetsValue = 0;

    for (const [asset, balance] of Object.entries(balances)) {
      const b = balance as { available: number; locked: number };
      const total = Number(b.available || 0) + Number(b.locked || 0);

      if (asset === "INR") {
        cashValue += total;
      } else {
        assetsValue += total * (tickerBySymbol.get(`${asset}_INR`) ?? 0);
      }
    }

    return {
      totalValue: cashValue + assetsValue,
      cashValue,
      assetsValue,
      activeOrders: orders.filter((order) => order.status === "OPEN" || order.status === "PARTIALLY_FILLED").length,
      activeMarkets: tickers.filter((ticker) => Number(ticker.trades) > 0).length
    };
  }, [balances, orders, tickers]);

  const topMarkets = useMemo(() => {
    return [...tickers].sort((left, right) => Number(right.trades || 0) - Number(left.trades || 0)).slice(0, 6);
  }, [tickers]);

  return (
    <ExchangePage>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <ExchangeCard className="overflow-hidden">
          <div className="border-b border-white/10 bg-gradient-to-r from-yellow-400/10 via-white/[0.03] to-sky-500/10 px-5 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <StatusPill tone="yellow">Portfolio dashboard</StatusPill>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Welcome back, {userName}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Monitor funds, jump into active markets, and review recent execution from one clean exchange cockpit.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild className="h-10 rounded-xl bg-[var(--exchange-yellow)] px-4 text-slate-950 hover:bg-yellow-300">
                  <Link href="/markets">
                    Browse markets
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                {canManageMmBot ? (
                  <Button asChild variant="outline" className="h-10 rounded-xl border-white/10 bg-white/[0.04] px-4 text-slate-100 hover:bg-white/[0.08]">
                    <Link href="/ops/mm-bot">
                      <Bot className="size-4" />
                      MM ops
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-4">
            <StatTile label="Portfolio value" value={`₹${formatNumber(summary.totalValue, 2)}`} tone="yellow" detail="Estimated from INR marks" className="md:col-span-2" />
            <StatTile label="Cash" value={`₹${formatNumber(summary.cashValue, 2)}`} />
            <StatTile label="Assets" value={`₹${formatNumber(summary.assetsValue, 2)}`} />
          </div>
        </ExchangeCard>

        <ExchangeCard className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Account snapshot</p>
              <p className="mt-2 text-2xl font-semibold text-white">{user.email}</p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-white/[0.06] text-[var(--exchange-yellow)]">
              <Wallet className="size-5" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatTile label="Open orders" value={summary.activeOrders} tone="blue" />
            <StatTile label="Active markets" value={summary.activeMarkets} tone="green" />
          </div>

          <Button variant="outline" className="mt-4 h-10 w-full rounded-xl border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]" onClick={() => void loadDashboard()} disabled={loading}>
            <RefreshCcw className="size-4" />
            {loading ? "Refreshing..." : "Refresh dashboard"}
          </Button>
        </ExchangeCard>
      </section>

      {message ? (
        <ExchangeCard className="border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200">
          {message}
        </ExchangeCard>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <ExchangeCard>
          <SectionTitle eyebrow="Wallet" title="Balances" />
          <div className="divide-y divide-white/10">
            {Object.entries(balances).length === 0 && !loading ? (
              <div className="px-4 py-12 text-center text-sm text-slate-500">No balances available yet.</div>
            ) : null}

            {Object.entries(balances).map(([asset, balance]) => {
              const b = balance as { available: number; locked: number };
              const available = Number(b.available || 0);
              const locked = Number(b.locked || 0);
              const total = available + locked;

              return (
                <div key={asset} className="grid gap-3 px-4 py-4 text-sm sm:grid-cols-[1fr_repeat(3,140px)] sm:items-center">
                  <div>
                    <p className="text-base font-semibold text-white">{asset}</p>
                    <p className="mt-1 text-xs text-slate-500">Spot wallet</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Available</p>
                    <p className="mt-1 font-medium text-white tabular-nums">{formatNumber(available, 4)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Locked</p>
                    <p className="mt-1 font-medium text-amber-200 tabular-nums">{formatNumber(locked, 4)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Total</p>
                    <p className="mt-1 font-medium text-slate-200 tabular-nums">{formatNumber(total, 4)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </ExchangeCard>

        <div className="grid gap-4">
          <ExchangeCard>
            <SectionTitle eyebrow="Markets" title="Top pairs" action={<Link href="/markets" className="text-sm font-medium text-[var(--exchange-yellow)]">View all</Link>} />
            <div className="divide-y divide-white/10">
              {topMarkets.map((ticker) => {
                const changePercent = Number(ticker.priceChangePercent || 0);
                return (
                  <Link key={ticker.symbol} href={`/trade/${ticker.symbol}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3 text-sm transition hover:bg-white/[0.04]">
                    <div>
                      <p className="font-semibold text-white">{ticker.symbol.replace("_", " / ")}</p>
                      <p className="mt-1 text-xs text-slate-500">{ticker.trades} trades</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-white tabular-nums">{formatNumber(Number(ticker.lastPrice), 2)}</p>
                      <p className="mt-1 text-xs text-slate-500">Last</p>
                    </div>
                    <div className={`text-right text-sm font-semibold tabular-nums ${changePercent >= 0 ? "text-[var(--exchange-green)]" : "text-[var(--exchange-red)]"}`}>
                      {changePercent >= 0 ? "+" : ""}
                      {formatNumber(changePercent, 2)}%
                    </div>
                  </Link>
                );
              })}
            </div>
          </ExchangeCard>

          <ExchangeCard>
            <SectionTitle eyebrow="Activity" title="Recent orders" />
            <div className="divide-y divide-white/10">
              {orders.length === 0 && !loading ? <div className="px-4 py-12 text-center text-sm text-slate-500">No order history yet.</div> : null}
              {orders.slice(0, 5).map((order) => (
                <SoftCard key={order.id} className="m-3 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={order.side === "buy" ? "font-semibold text-[var(--exchange-green)]" : "font-semibold text-[var(--exchange-red)]"}>
                        {order.side.toUpperCase()} {order.market.replace("_", " / ")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{order.status.replaceAll("_", " ")} · {formatDate(order.updatedAt)}</p>
                    </div>
                    <p className="text-right text-sm text-white tabular-nums">{formatNumber(order.price, 2)}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-400">
                    <span>Qty {formatNumber(order.quantity, 4)}</span>
                    <span className="text-right">Filled {formatNumber(order.filledQuantity, 4)}</span>
                  </div>
                </SoftCard>
              ))}
            </div>
          </ExchangeCard>
        </div>
      </section>
    </ExchangePage>
  );
}
