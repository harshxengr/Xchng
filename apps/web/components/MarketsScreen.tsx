"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, RefreshCcw, Search, Star } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { ExchangeCard, ExchangePage, SectionTitle, StatTile, StatusPill } from "@/components/exchange-ui";
import { getTickers, type Ticker } from "@/app/lib/api";

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  }).format(Number.isFinite(value) ? value : 0);
}

export function MarketsScreen() {
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadTickers() {
    try {
      setLoading(true);
      setMessage("");
      setTickers(await getTickers());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load markets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTickers();
  }, []);

  const filteredTickers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...tickers]
      .sort((left, right) => Number(right.trades || 0) - Number(left.trades || 0))
      .filter((ticker) => !normalized || ticker.symbol.toLowerCase().includes(normalized));
  }, [query, tickers]);

  const summary = useMemo(() => {
    const totalTrades = tickers.reduce((sum, ticker) => sum + Number(ticker.trades || 0), 0);
    const topVolume = tickers.reduce((max, ticker) => Math.max(max, Number(ticker.quoteVolume || 0)), 0);

    return {
      total: tickers.length,
      active: tickers.filter((ticker) => Number(ticker.trades) > 0).length,
      trades: totalTrades,
      topVolume,
    };
  }, [tickers]);

  const featured = filteredTickers.slice(0, 3);

  return (
    <ExchangePage>
      <ExchangeCard className="overflow-hidden">
        <div className="grid gap-5 border-b border-white/10 bg-gradient-to-r from-yellow-400/10 via-white/[0.03] to-sky-500/10 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-end">
          <div>
            <StatusPill tone="yellow">Spot markets</StatusPill>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Markets</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Search pairs, compare activity, and open a trading workspace with live depth, candles, balances, and order management.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <StatTile label="Pairs" value={summary.total} />
            <StatTile label="Active" value={summary.active} tone="green" />
            <StatTile label="Trades" value={summary.trades} />
            <StatTile label="Top quote vol" value={formatNumber(summary.topVolume, 0)} tone="yellow" />
          </div>
        </div>

        <div className="grid gap-3 p-4 lg:grid-cols-3">
          {featured.map((ticker) => {
            const changePercent = Number(ticker.priceChangePercent || 0);
            return (
              <Link key={ticker.symbol} href={`/trade/${ticker.symbol}`} className="exchange-card-soft rounded-2xl p-4 transition hover:bg-white/[0.06]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">{ticker.symbol.replace("_", " / ")}</p>
                    <p className="mt-1 text-xs text-slate-500">{ticker.trades} trades</p>
                  </div>
                  <Star className="size-4 text-[var(--exchange-yellow)]" />
                </div>
                <div className="mt-5 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Last price</p>
                    <p className="mt-1 text-2xl font-semibold text-white tabular-nums">{formatNumber(Number(ticker.lastPrice), 2)}</p>
                  </div>
                  <p className={`text-sm font-semibold tabular-nums ${changePercent >= 0 ? "text-[var(--exchange-green)]" : "text-[var(--exchange-red)]"}`}>
                    {changePercent >= 0 ? "+" : ""}
                    {formatNumber(changePercent, 2)}%
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </ExchangeCard>

      {message ? (
        <ExchangeCard className="border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200">
          {message}
        </ExchangeCard>
      ) : null}

      <ExchangeCard>
        <SectionTitle
          eyebrow="Directory"
          title="All pairs"
          action={
            <div className="flex items-center gap-2">
              <div className="relative hidden sm:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search pair"
                  className="h-10 w-[260px] rounded-xl border-white/10 bg-white/[0.04] pl-10 text-slate-100 placeholder:text-slate-500"
                />
              </div>
              <Button variant="outline" className="h-10 rounded-xl border-white/10 bg-white/[0.04] px-3 text-slate-100 hover:bg-white/[0.08]" onClick={() => void loadTickers()} disabled={loading}>
                <RefreshCcw className="size-4" />
                <span className="hidden sm:inline">{loading ? "Refreshing" : "Refresh"}</span>
              </Button>
            </div>
          }
        />

        <div className="border-b border-white/10 p-3 sm:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search pair"
              className="h-10 rounded-xl border-white/10 bg-white/[0.04] pl-10 text-slate-100 placeholder:text-slate-500"
            />
          </div>
        </div>

        {filteredTickers.length === 0 && !loading ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            {query ? "No markets match your search." : "No markets available yet."}
          </div>
        ) : null}

        <div className="hidden overflow-x-auto lg:block">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[1.3fr_repeat(5,minmax(0,1fr))_110px] gap-3 border-b border-white/10 bg-white/[0.025] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              <span>Pair</span>
              <span className="text-right">Last price</span>
              <span className="text-right">24h change</span>
              <span className="text-right">High</span>
              <span className="text-right">Low</span>
              <span className="text-right">Volume</span>
              <span className="text-right">Action</span>
            </div>

            <div className="divide-y divide-white/10">
              {filteredTickers.map((ticker) => {
                const changePercent = Number(ticker.priceChangePercent || 0);
                return (
                  <div key={ticker.symbol} className="grid grid-cols-[1.3fr_repeat(5,minmax(0,1fr))_110px] items-center gap-3 px-4 py-3 text-sm text-slate-200 transition hover:bg-white/[0.035]">
                    <div>
                      <p className="font-semibold text-white">{ticker.symbol.replace("_", " / ")}</p>
                      <p className="mt-1 text-xs text-slate-500">{ticker.trades} trades</p>
                    </div>
                    <span className="text-right font-medium tabular-nums">{formatNumber(Number(ticker.lastPrice), 2)}</span>
                    <span className={`text-right font-semibold tabular-nums ${changePercent >= 0 ? "text-[var(--exchange-green)]" : "text-[var(--exchange-red)]"}`}>
                      {changePercent >= 0 ? "+" : ""}
                      {formatNumber(changePercent, 2)}%
                    </span>
                    <span className="text-right tabular-nums">{formatNumber(Number(ticker.high), 2)}</span>
                    <span className="text-right tabular-nums">{formatNumber(Number(ticker.low), 2)}</span>
                    <span className="text-right tabular-nums">{formatNumber(Number(ticker.volume), 2)}</span>
                    <div className="flex justify-end">
                      <Button asChild className="h-9 rounded-xl bg-[var(--exchange-yellow)] px-3 text-sm font-semibold text-slate-950 hover:bg-yellow-300">
                        <Link href={`/trade/${ticker.symbol}`}>
                          Trade
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-3 lg:hidden">
          {filteredTickers.map((ticker) => {
            const changePercent = Number(ticker.priceChangePercent || 0);
            return (
              <Link key={ticker.symbol} href={`/trade/${ticker.symbol}`} className="exchange-card-soft rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">{ticker.symbol.replace("_", " / ")}</p>
                    <p className="mt-1 text-xs text-slate-500">{ticker.trades} trades · Vol {formatNumber(Number(ticker.volume), 2)}</p>
                  </div>
                  <p className={`text-sm font-semibold ${changePercent >= 0 ? "text-[var(--exchange-green)]" : "text-[var(--exchange-red)]"}`}>
                    {changePercent >= 0 ? "+" : ""}
                    {formatNumber(changePercent, 2)}%
                  </p>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-slate-500">Last</p>
                    <p className="mt-1 text-xl font-semibold text-white">{formatNumber(Number(ticker.lastPrice), 2)}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--exchange-yellow)]">
                    Trade
                    <ArrowRight className="size-4" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </ExchangeCard>
    </ExchangePage>
  );
}
