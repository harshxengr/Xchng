"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createChart, CandlestickSeries, ColorType, type UTCTimestamp } from "lightweight-charts";
import { Menu, Search } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { SignOutButton } from "@/components/auth/sign-out-button";
import {
  getBalances,
  getDepth,
  getTicker,
  getTickers,
  getTrades,
  getWsUrl,
  placeOrder,
  type Depth,
  type Ticker,
  type Trade
} from "@/app/lib/api";

type WsDepthMessage = { type: "depth"; symbol: string; data: Depth };
type WsTradeMessage = { type: "trade"; symbol: string; data: Trade };
type WsTickerMessage = { type: "ticker"; symbol: string; data: Ticker };

type SessionUser = {
  name?: string | null;
  email?: string | null;
};

type AssetBalance = { available: number; locked: number };
type OrderType = "limit" | "market";
type OrderSide = "buy" | "sell";

const EMPTY_BALANCE: AssetBalance = { available: 0, locked: 0 };
const DEFAULT_TICKER: Ticker = {
  symbol: "",
  lastPrice: "0",
  high: "0",
  low: "0",
  volume: "0",
  quoteVolume: "0",
  firstPrice: "0",
  priceChange: "0",
  priceChangePercent: "0",
  trades: 0
};

const MINUTE_MS = 60_000;

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPct(value: number) {
  if (!Number.isFinite(value)) return "0.00%";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasType(value: unknown): value is { type: string } {
  return isObject(value) && typeof value.type === "string";
}

function isWsDepthMessage(value: unknown): value is WsDepthMessage {
  return hasType(value) && value.type === "depth" && "data" in value;
}
function isWsTradeMessage(value: unknown): value is WsTradeMessage {
  return hasType(value) && value.type === "trade" && "data" in value;
}
function isWsTickerMessage(value: unknown): value is WsTickerMessage {
  return hasType(value) && value.type === "ticker" && "data" in value;
}

function buildCandles(trades: Trade[]) {
  const byBucket = new Map<number, { time: UTCTimestamp; open: number; high: number; low: number; close: number }>();
  for (const trade of [...trades].reverse()) {
    const price = Number(trade.price);
    const bucketMs = Math.floor(trade.timestamp / MINUTE_MS) * MINUTE_MS;
    const bucketSec = Math.floor(bucketMs / 1000);
    const existing = byBucket.get(bucketSec);
    if (!existing) {
      byBucket.set(bucketSec, { time: bucketSec as UTCTimestamp, open: price, high: price, low: price, close: price });
      continue;
    }
    existing.high = Math.max(existing.high, price);
    existing.low = Math.min(existing.low, price);
    existing.close = price;
  }
  return [...byBucket.values()].sort((a, b) => a.time - b.time);
}

function LightweightCandleChart({ trades }: { trades: Trade[] }) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRef = useRef<ReturnType<ReturnType<typeof createChart>["addSeries"]> | null>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: { textColor: "#94a3b8", background: { type: ColorType.Solid, color: "#070b12" } },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.08)" },
        horzLines: { color: "rgba(148,163,184,0.08)" }
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: { vertLine: { color: "#334155" }, horzLine: { color: "#334155" } }
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#0ecb81",
      downColor: "#f6465d",
      borderUpColor: "#0ecb81",
      borderDownColor: "#f6465d",
      wickUpColor: "#0ecb81",
      wickDownColor: "#f6465d"
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resize = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.clientWidth;
      chart.applyOptions({ width, height: 420 });
    });
    resize.observe(el);
    chart.applyOptions({ width: el.clientWidth, height: 420 });

    return () => {
      resize.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;
    const candles = buildCandles(trades);
    seriesRef.current.setData(candles);
    chartRef.current?.timeScale().fitContent();
  }, [trades]);

  return <div ref={wrapperRef} className="h-[420px] w-full rounded-sm" />;
}

export function TradeScreen({ market, sessionUser = null }: { market: string; sessionUser?: SessionUser | null }) {
  const [depth, setDepth] = useState<Depth>({ bids: [], asks: [] });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [ticker, setTicker] = useState<Ticker>({ ...DEFAULT_TICKER, symbol: market });
  const [balances, setBalances] = useState<Record<string, AssetBalance>>({});
  const [allTickers, setAllTickers] = useState<Ticker[]>([]);
  const [userId, setUserId] = useState("1");
  const [side, setSide] = useState<OrderSide>("buy");
  const [orderType, setOrderType] = useState<OrderType>("limit");
  const [price, setPrice] = useState("0");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [baseAsset, quoteAsset] = useMemo(() => {
    const [base = "", quote = ""] = market.split("_");
    return [base, quote] as const;
  }, [market]);

  const bestBid = Number(depth.bids[0]?.[0] ?? 0);
  const bestAsk = Number(depth.asks[0]?.[0] ?? 0);
  const currentPrice = Number(ticker.lastPrice || 0);
  const changePercent = Number(ticker.priceChangePercent || 0);

  const quoteBalance = balances[quoteAsset] ?? EMPTY_BALANCE;
  const baseBalance = balances[baseAsset] ?? EMPTY_BALANCE;
  const calculatedPrice = orderType === "market" ? (side === "buy" ? bestAsk || currentPrice : bestBid || currentPrice) : Number(price);
  const estimatedValue = calculatedPrice * Number(quantity || 0);

  const asks = depth.asks.slice(0, 18);
  const bids = depth.bids.slice(0, 18);
  const maxDepthQty = Math.max(
    1,
    ...asks.map(([, q]) => Number(q)),
    ...bids.map(([, q]) => Number(q))
  );

  useEffect(() => {
    async function load() {
      try {
        const [depthData, tradeData, tickerData, balanceData, tickers] = await Promise.all([
          getDepth(market),
          getTrades(market),
          getTicker(market),
          getBalances(userId),
          getTickers()
        ]);
        setDepth(depthData);
        setTrades(tradeData);
        setTicker(tickerData);
        setBalances(balanceData);
        setAllTickers(tickers);
        if (!price || Number(price) <= 0) setPrice(String(Number(tickerData.lastPrice || 0) || 0));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load market");
      }
    }
    void load();
  }, [market, userId, price]);

  useEffect(() => {
    const ws = new WebSocket(getWsUrl());
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          method: "SUBSCRIBE",
          params: [`depth@${market}`, `trade@${market}`, `ticker@${market}`]
        })
      );
    };
    ws.onmessage = (event) => {
      const parsed: unknown = JSON.parse(event.data);
      if (isWsDepthMessage(parsed)) setDepth(parsed.data);
      if (isWsTradeMessage(parsed)) setTrades((prev) => [parsed.data, ...prev].slice(0, 250));
      if (isWsTickerMessage(parsed)) setTicker(parsed.data);
    };
    return () => ws.close();
  }, [market]);

  async function onPlaceOrder() {
    try {
      setIsSubmitting(true);
      setMessage("");
      await placeOrder({
        market,
        userId,
        side,
        quantity: Number(quantity),
        // backend currently accepts price only; for market orders we execute at best level
        price: calculatedPrice
      });
      setMessage(`${side.toUpperCase()} ${orderType.toUpperCase()} order placed`);
      const balanceData = await getBalances(userId);
      setBalances(balanceData);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to place order");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#070a11] text-white">
      <div className="mx-auto max-w-[1800px] px-3 py-3">
        <header className="flex items-center justify-between border-b border-white/10 px-2 pb-3">
          <div className="flex items-center gap-6">
            <button className="rounded-md p-1 text-slate-300 hover:bg-white/10"><Menu className="size-5" /></button>
            <nav className="flex items-center gap-6 text-sm">
              <Link href="/" className="font-medium text-white">Exchange</Link>
              <Link href="/markets" className="text-slate-300 hover:text-white">Markets</Link>
              <Link href={`/trade/${market}`} className="text-slate-300 hover:text-white">Trade</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {sessionUser ? (
              <>
                <div className="hidden text-right text-xs sm:block">
                  <p className="font-medium text-slate-100">{sessionUser.name || "Trader"}</p>
                  <p className="text-slate-400">{sessionUser.email || ""}</p>
                </div>
                <div className="hidden [&>button]:rounded-lg [&>button]:border-white/20 [&>button]:bg-transparent [&>button]:text-slate-100 sm:block">
                  <SignOutButton />
                </div>
              </>
            ) : (
              <>
                <Link href="/sign-in" className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-slate-100 hover:bg-white/10">Sign in</Link>
                <Link href="/sign-up" className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-emerald-400">Sign up</Link>
              </>
            )}
          </div>
        </header>

        <section className="mt-2 flex items-center justify-between border-b border-white/10 px-2 py-2 text-xs">
          <div className="flex items-center gap-5">
            <div className="font-semibold">{baseAsset} / {quoteAsset}</div>
            <div className="text-emerald-400">${formatNumber(currentPrice, 2)}</div>
            <div className={changePercent >= 0 ? "text-emerald-400" : "text-rose-400"}>{formatPct(changePercent)}</div>
            <div className="text-slate-300">24H High {ticker.high}</div>
            <div className="text-slate-300">24H Low {ticker.low}</div>
            <div className="text-slate-300">24H Vol {ticker.quoteVolume}</div>
          </div>
          <button className="rounded p-1 text-slate-400 hover:bg-white/10"><Search className="size-4" /></button>
        </section>

        {message ? <p className="mt-2 rounded border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">{message}</p> : null}

        <section className="mt-3 grid gap-3 xl:grid-cols-[1.9fr_0.9fr_0.8fr]">
          <div className="rounded border border-white/10 bg-[#0b111b] p-2">
            <LightweightCandleChart trades={trades} />
          </div>

          <div className="rounded border border-white/10 bg-[#0b111b]">
            <div className="grid grid-cols-3 border-b border-white/10 px-3 py-2 text-[11px] text-slate-400">
              <span>Price</span>
              <span className="text-right">Size</span>
              <span className="text-right">Total</span>
            </div>
            <div className="h-[420px] overflow-auto p-2 text-xs">
              {asks.map(([p, q]) => {
                const qty = Number(q);
                return (
                  <div key={`ask-${p}-${q}`} className="relative mb-1 grid grid-cols-3 items-center rounded px-2 py-1">
                    <div className="absolute inset-y-0 right-0 rounded bg-rose-500/10" style={{ width: `${Math.max((qty / maxDepthQty) * 100, 7)}%` }} />
                    <span className="relative text-rose-300">{p}</span>
                    <span className="relative text-right text-slate-300">{q}</span>
                    <span className="relative text-right text-slate-400">{formatNumber(Number(p) * qty, 2)}</span>
                  </div>
                );
              })}
              <div className="my-2 border-y border-white/10 py-2 text-center text-sm font-semibold text-emerald-300">
                {formatNumber(currentPrice, 2)}
              </div>
              {bids.map(([p, q]) => {
                const qty = Number(q);
                return (
                  <div key={`bid-${p}-${q}`} className="relative mb-1 grid grid-cols-3 items-center rounded px-2 py-1">
                    <div className="absolute inset-y-0 right-0 rounded bg-emerald-500/10" style={{ width: `${Math.max((qty / maxDepthQty) * 100, 7)}%` }} />
                    <span className="relative text-emerald-300">{p}</span>
                    <span className="relative text-right text-slate-300">{q}</span>
                    <span className="relative text-right text-slate-400">{formatNumber(Number(p) * qty, 2)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded border border-white/10 bg-[#0b111b] p-3">
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button onClick={() => setSide("buy")} className={`rounded py-2 text-sm font-medium ${side === "buy" ? "bg-emerald-500 text-slate-950" : "bg-white/5 text-slate-300"}`}>Buy</button>
              <button onClick={() => setSide("sell")} className={`rounded py-2 text-sm font-medium ${side === "sell" ? "bg-rose-500 text-white" : "bg-white/5 text-slate-300"}`}>Sell</button>
            </div>
            <div className="mb-3 flex gap-2 text-sm">
              <button onClick={() => setOrderType("limit")} className={`rounded px-3 py-1 ${orderType === "limit" ? "bg-white/15 text-white" : "text-slate-400"}`}>Limit</button>
              <button onClick={() => setOrderType("market")} className={`rounded px-3 py-1 ${orderType === "market" ? "bg-white/15 text-white" : "text-slate-400"}`}>Market</button>
            </div>
            <label className="mb-3 block text-xs text-slate-400">Available Balance {formatNumber(quoteBalance.available, 2)} {quoteAsset}</label>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">Price</span>
                <Input
                  type="number"
                  disabled={orderType === "market"}
                  value={orderType === "market" ? formatNumber(calculatedPrice, 2) : price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="h-10 border-white/10 bg-white/5 text-white disabled:opacity-70"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">Quantity</span>
                <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-10 border-white/10 bg-white/5 text-white" />
              </label>
              <p className="text-xs text-slate-400">Estimated: {formatNumber(estimatedValue, 2)} {quoteAsset}</p>
              <div className="grid grid-cols-4 gap-2 text-xs">
                {[25, 50, 75, 100].map((percent) => (
                  <button
                    key={percent}
                    type="button"
                    onClick={() => {
                      const maxQty = side === "buy"
                        ? (calculatedPrice > 0 ? quoteBalance.available / calculatedPrice : 0)
                        : baseBalance.available;
                      setQuantity((maxQty * percent / 100).toFixed(4));
                    }}
                    className="rounded border border-white/10 py-1 text-slate-300 hover:bg-white/10"
                  >
                    {percent}%
                  </button>
                ))}
              </div>
              <Button
                className={`h-11 w-full ${side === "buy" ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400" : "bg-rose-500 text-white hover:bg-rose-400"}`}
                onClick={onPlaceOrder}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Placing..." : side === "buy" ? "Buy" : "Sell"}
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-3 rounded border border-white/10 bg-[#0b111b] p-2">
          <h3 className="mb-2 px-2 text-sm font-semibold text-slate-200">Markets & Trades</h3>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded border border-white/10 p-2">
              <p className="mb-2 text-xs text-slate-400">Markets</p>
              <div className="max-h-40 space-y-1 overflow-auto text-xs">
                {allTickers.map((entry) => (
                  <Link key={entry.symbol} href={`/trade/${entry.symbol}`} className="grid grid-cols-3 rounded px-2 py-1 hover:bg-white/5">
                    {/* <span className="text-slate-200">{entry.symbol.replace("_", "/")}</span> */}
                    <span className="text-right text-slate-300">{entry.lastPrice}</span>
                    <span className={`text-right ${Number(entry.priceChangePercent) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {formatPct(Number(entry.priceChangePercent))}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="rounded border border-white/10 p-2">
              <p className="mb-2 text-xs text-slate-400">Trades</p>
              <div className="max-h-40 space-y-1 overflow-auto text-xs">
                {trades.slice(0, 25).map((trade) => (
                  <div key={trade.tradeId} className="grid grid-cols-3 rounded px-2 py-1 hover:bg-white/5">
                    <span className={trade.buyerUserId === userId ? "text-emerald-300" : "text-rose-300"}>{formatNumber(Number(trade.price), 2)}</span>
                    <span className="text-right text-slate-300">{formatNumber(Number(trade.quantity), 4)}</span>
                    <span className="text-right text-slate-500">{new Date(trade.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
