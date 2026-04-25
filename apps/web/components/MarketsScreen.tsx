"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, RefreshCcw, Search, Star } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { ExchangeCard, ExchangePage, SectionTitle } from "@/components/exchange-ui";
import { getTickers, type Ticker } from "@/app/lib/api";

function uniqueTickersBySymbol(tickers: Ticker[]) {
  const seen = new Set<string>();
  return tickers.filter((ticker) => {
    const symbol = ticker.symbol?.trim();
    if (!symbol || seen.has(symbol)) return false;
    seen.add(symbol);
    return true;
  });
}

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
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);

  // Load favorites on mount
  useEffect(() => {
    const saved = localStorage.getItem("favorites");
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse favorites", e);
      }
    }
    setFavoritesLoaded(true);
  }, []);

  // Save favorites when changed
  useEffect(() => {
    if (favoritesLoaded) {
      localStorage.setItem("favorites", JSON.stringify(favorites));
    }
  }, [favorites, favoritesLoaded]);

  const toggleFavorite = (e: React.MouseEvent, symbol: string) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites(prev => 
      prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
    );
  };

  async function loadTickers() {
    try {
      setLoading(true);
      setMessage("");
      setTickers(uniqueTickersBySymbol(await getTickers()));
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
      .filter((ticker) => !normalized || ticker.symbol?.toLowerCase().includes(normalized));
  }, [query, tickers]);

  const featured = useMemo(() => {
    return tickers.filter((ticker) => favorites.includes(ticker.symbol));
  }, [tickers, favorites]);

  return (
    <ExchangePage>
      {message ? (
        <ExchangeCard className="border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200">
          {message}
        </ExchangeCard>
      ) : null}

      <ExchangeCard>
        <SectionTitle eyebrow="Pinned" title="Pinned markets" />
        {featured.length > 0 ? (
          <div className="grid gap-3 p-4 lg:grid-cols-3">
            {featured.map((ticker, index) => {
              const changePercent = Number(ticker.priceChangePercent || 0);
              return (
                <Link key={ticker.symbol || index} href={`/trade/${ticker.symbol}`} className="exchange-card-soft rounded-2xl p-4 transition hover:bg-white/[0.06]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-white">{ticker.symbol?.replace("_", " / ")}</p>
                      <p className="mt-1 text-xs text-slate-500">{ticker.trades} trades</p>
                    </div>
                    <button
                      onClick={(event) => toggleFavorite(event, ticker.symbol)}
                      className="group/star rounded-full p-1.5 transition hover:bg-white/10"
                    >
                      <Star
                        className={`size-4 transition-all ${favorites.includes(ticker.symbol) ? "fill-yellow-400 text-yellow-400 scale-110" : "text-slate-500 group-hover/star:text-yellow-400"}`}
                      />
                    </button>
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
        ) : (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-slate-500">Star markets to see them here in your watchlist.</p>
          </div>
        )}
      </ExchangeCard>

      <ExchangeCard>
        {loading && tickers.length === 0 ? (
          <div className="flex h-64 items-center justify-center border-b border-white/10 bg-white/[0.02]">
            <div className="flex flex-col items-center gap-3">
              <RefreshCcw className="size-8 animate-spin text-emerald-500" />
              <p className="text-sm text-slate-500">Loading markets...</p>
            </div>
          </div>
        ) : null}

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
            <div className="grid grid-cols-[1.3fr_repeat(5,minmax(0,1fr))_160px] gap-3 border-b border-white/10 bg-white/[0.025] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              <span>Pair</span>
              <span className="text-right">Last price</span>
              <span className="text-right">24h change</span>
              <span className="text-right">High</span>
              <span className="text-right">Low</span>
              <span className="text-right">Volume</span>
              <span className="text-right">Actions</span>
            </div>

            <div className="divide-y divide-white/10">
              {filteredTickers.map((ticker, index) => {
                const changePercent = Number(ticker.priceChangePercent || 0);
                return (
                  <div key={ticker.symbol || index} className="grid grid-cols-[1.3fr_repeat(5,minmax(0,1fr))_160px] items-center gap-3 px-4 py-3 text-sm text-slate-200 transition hover:bg-white/[0.035]">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={(e) => toggleFavorite(e, ticker.symbol)}
                        className="group/star rounded-full p-1 transition hover:bg-white/10"
                      >
                        <Star 
                          className={`size-3.5 transition-all ${favorites.includes(ticker.symbol) ? "fill-yellow-400 text-yellow-400 scale-110" : "text-slate-600 group-hover/star:text-yellow-400"}`} 
                        />
                      </button>
                      <div>
                        <p className="font-semibold text-white">{ticker.symbol?.replace("_", " / ")}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">{ticker.trades} trades</p>
                      </div>
                    </div>
                    <span className="text-right font-medium tabular-nums">{formatNumber(Number(ticker.lastPrice), 2)}</span>
                    <span className={`text-right font-semibold tabular-nums ${changePercent >= 0 ? "text-[var(--exchange-green)]" : "text-[var(--exchange-red)]"}`}>
                      {changePercent >= 0 ? "+" : ""}
                      {formatNumber(changePercent, 2)}%
                    </span>
                    <span className="text-right tabular-nums">{formatNumber(Number(ticker.high), 2)}</span>
                    <span className="text-right tabular-nums">{formatNumber(Number(ticker.low), 2)}</span>
                    <span className="text-right tabular-nums">{formatNumber(Number(ticker.volume), 2)}</span>
                    <div className="flex justify-end gap-2">
                      <Link href={`/trade/${ticker.symbol}`}>
                        <Button className="h-8 rounded-lg bg-emerald-500 px-3 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors">
                          Trade
                        </Button>
                      </Link>
                      <Link href={`/wallet?asset=${ticker.symbol?.split("_")[0]}`}>
                        <Button variant="outline" className="h-8 rounded-lg border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-300 hover:bg-white/10">
                           Deposit
                        </Button>
                      </Link>
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
              <div key={ticker.symbol} className="exchange-card-soft rounded-2xl p-5 bg-white/[0.03] border border-white/5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={(e) => toggleFavorite(e, ticker.symbol)}
                      className="group/star rounded-full p-1.5 transition hover:bg-white/10"
                    >
                      <Star 
                        className={`size-4 transition-all ${favorites.includes(ticker.symbol) ? "fill-yellow-400 text-yellow-400 scale-110" : "text-slate-600 group-hover/star:text-yellow-400"}`} 
                      />
                    </button>
                    <div>
                      <p className="text-lg font-bold text-white">{ticker.symbol?.replace("_", " / ")}</p>
                      <p className="mt-1 text-xs text-slate-500">{ticker.trades} trades · Vol {formatNumber(Number(ticker.volume), 2)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white tabular-nums">{formatNumber(Number(ticker.lastPrice), 2)}</p>
                    <p className={`text-xs font-semibold mt-1 ${changePercent >= 0 ? "text-[var(--exchange-green)]" : "text-[var(--exchange-red)]"}`}>
                      {changePercent >= 0 ? "+" : ""}
                      {formatNumber(changePercent, 2)}%
                    </p>
                  </div>
                </div>
                
                <div className="mt-6 flex gap-3">
                  <Link href={`/trade/${ticker.symbol}`} className="flex-1">
                    <Button className="w-full h-10 rounded-xl bg-emerald-500 font-bold text-slate-950 hover:bg-emerald-400">
                      Trade
                      <ArrowRight className="size-4 ml-2" />
                    </Button>
                  </Link>
                  <Link href={`/wallet?asset=${ticker.symbol?.split("_")[0]}`}>
                    <Button variant="outline" className="h-10 px-4 rounded-xl border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 font-semibold">
                      Deposit
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </ExchangeCard>
    </ExchangePage>
  );
}
