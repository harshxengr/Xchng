"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createChart, CandlestickSeries, ColorType, type UTCTimestamp } from "lightweight-charts";
import { RefreshCcw, Search } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { AppTopNav } from "@/components/AppTopNav";
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
  id: string;
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
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  }).format(Number.isFinite(value) ? value : 0);
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
    if (isNaN(price)) continue;
    
    // Convert string timestamp to number
    const timestamp = typeof trade.timestamp === "string" ? new Date(trade.timestamp).getTime() : trade.timestamp;
    if (isNaN(timestamp)) continue;

    const bucketMs = Math.floor(timestamp / MINUTE_MS) * MINUTE_MS;
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
      timeScale: { 
        borderVisible: false, 
        timeVisible: true, 
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 6 
      },
      crosshair: { vertLine: { color: "#334155" }, horzLine: { color: "#334155" } }
    });
    
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = candleSeries;

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
  const activeUserId = sessionUser?.id || null;
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
  const quoteBalance = balances[quoteAsset] ?? EMPTY_BALANCE;
  const baseBalance = balances[baseAsset] ?? EMPTY_BALANCE;
  
  const calculatedPrice = orderType === "market" 
    ? (side === "buy" ? (bestAsk || currentPrice || 1) * 1.05 : (bestBid || currentPrice || 1) * 0.95) 
    : Number(price);
  const estimatedValue = calculatedPrice * Number(quantity || 0);

  const asks = depth.asks.slice(0, 18);
  const bids = depth.bids.slice(0, 18);
  useEffect(() => {
    async function load() {
      try {
        const [depthData, tradeData, tickerData, balanceData, tickers] = await Promise.all([
          getDepth(market),
          getTrades(market),
          getTicker(market),
          activeUserId ? getBalances(activeUserId) : Promise.resolve({}),
          getTickers()
        ]);
        setDepth(depthData);
        setTrades(tradeData);
        setTicker(tickerData);
        if (activeUserId && balanceData) setBalances(balanceData);
        setAllTickers(uniqueTickersBySymbol(tickers));
        
        // Only set initial price if current price state is unset or 0
        setPrice((prev) => {
          const currentTickerPrice = String(Number(tickerData.lastPrice || 0) || 0);
          if (!prev || prev === "0" || Number(prev) <= 0) {
            return currentTickerPrice !== "0" ? currentTickerPrice : "100"; // Fallback to 100 if no market price
          }
          return prev;
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load market");
      }
    }
    void load();
  }, [market, activeUserId]);

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
      if (isWsTradeMessage(parsed)) {
        setTrades((prev) => [parsed.data, ...prev].slice(0, 250));
        if (activeUserId) {
          void getBalances(activeUserId).then(setBalances).catch(() => {});
        }
      }
      if (isWsTickerMessage(parsed)) setTicker(parsed.data);
    };
    return () => ws.close();
  }, [market, activeUserId]);

  async function onPlaceOrder() {
    try {
      if (!activeUserId) {
        setMessage("Please sign in to place orders");
        return;
      }
      if (Number(quantity) <= 0) {
        setMessage("Quantity must be greater than 0");
        return;
      }
      if (calculatedPrice <= 0) {
        setMessage("Invalid price");
        return;
      }
      setIsSubmitting(true);
      setMessage("");
      await placeOrder({
        market,
        userId: activeUserId,
        side,
        orderType,
        quantity: Number(quantity),
        price: calculatedPrice
      });
      setMessage(`${side.toUpperCase()} ${orderType.toUpperCase()} order placed`);
      
      // Auto-clear message after 3 seconds
      setTimeout(() => setMessage(""), 3000);

      // Refresh balances
      const balanceData = await getBalances(activeUserId);
      setBalances(balanceData);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to place order");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#070a11] text-white">
      <AppTopNav user={sessionUser} />
      <div className="mx-auto max-w-[1800px] px-3 py-3">
        <section className="mt-2 flex items-center justify-between border-b border-white/10 px-2 py-2 text-xs">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="text-lg font-bold text-white pl-2">{baseAsset} / {quoteAsset}</div>
            </div>
            <div className={`text-lg font-bold ${Number(currentPrice) > 0 ? "text-emerald-400" : "text-slate-400"}`}>
              {Number(currentPrice) > 0 ? `$${formatNumber(currentPrice, 2)}` : "--"}
            </div>
            <div className={`font-medium ${Number(ticker.priceChangePercent) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {Number(ticker.priceChangePercent) >= 0 ? "+" : ""}{formatNumber(Number(ticker.priceChangePercent), 2)}%
            </div>
            <div className="hidden space-x-4 sm:flex">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase">24H High</span>
                <span className="text-slate-200">{formatNumber(Number(ticker.high), 2)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase">24H Low</span>
                <span className="text-slate-200">{formatNumber(Number(ticker.low), 2)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase">24H Vol ({baseAsset})</span>
                <span className="text-slate-200">{formatNumber(Number(ticker.volume), 2)}</span>
              </div>
            </div>
          </div>
        </section>

        {message ? <p className="mt-2 rounded border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">{message}</p> : null}

        <section className="mt-3 grid gap-3 xl:grid-cols-[1.9fr_0.9fr_0.8fr]">
          <div className="rounded border border-white/10 bg-[#0b111b] p-2">
            <LightweightCandleChart trades={trades} />
          </div>

          <div className="rounded border border-white/10 bg-[#0b111b] flex flex-col">
            <div className="border-b border-white/10 px-3 py-2">
              <h3 className="text-sm font-semibold text-slate-200">Orderbook</h3>
            </div>
            <div className="grid grid-cols-3 border-b border-white/10 px-3 py-2 text-[11px] text-slate-400">
              <span>Price</span>
              <span className="text-right">Size</span>
              <span className="text-right">Total</span>
            </div>
            <div className="flex flex-1 flex-col overflow-hidden p-3 text-[11px]">
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                {asks.length > 0 ? (
                  asks.map((ask) => (
                    <div key={ask[0]} className="flex cursor-pointer items-center justify-between py-1 transition hover:bg-rose-500/10 px-1 rounded" onClick={() => setPrice(ask[0])}>
                      <span className="font-bold text-rose-400 w-1/3">{formatNumber(Number(ask[0]), 2)}</span>
                      <span className="text-right text-slate-300 w-1/3 tabular-nums">{formatNumber(Number(ask[1]), 4)}</span>
                      <span className="text-right text-slate-500 w-1/3 tabular-nums">{formatNumber(Number(ask[0]) * Number(ask[1]), 2)}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-600 italic">No sell orders</div>
                )}
              </div>

              <div className="my-3 border-y border-white/5 py-3 text-center">
                 <div className="text-2xl font-black text-emerald-400 tracking-tight">{formatNumber(currentPrice, 2)}</div>
                 <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Market Price</div>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-hide">
                {bids.length > 0 ? (
                  bids.map((bid) => (
                    <div key={bid[0]} className="flex cursor-pointer items-center justify-between py-1 transition hover:bg-emerald-500/10 px-1 rounded" onClick={() => setPrice(bid[0])}>
                      <span className="font-bold text-emerald-400 w-1/3">{formatNumber(Number(bid[0]), 2)}</span>
                      <span className="text-right text-slate-300 w-1/3 tabular-nums">{formatNumber(Number(bid[1]), 4)}</span>
                      <span className="text-right text-slate-500 w-1/3 tabular-nums">{formatNumber(Number(bid[0]) * Number(bid[1]), 2)}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-600 italic">No buy orders</div>
                )}
              </div>
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
            <label 
              className="mb-3 block text-xs text-slate-400 cursor-pointer hover:text-emerald-400 transition-colors"
              onClick={() => {
                const maxQty = side === "buy"
                  ? (calculatedPrice > 0 ? quoteBalance.available / calculatedPrice : 0)
                  : baseBalance.available;
                setQuantity(maxQty.toFixed(4));
              }}
            >
              Available Balance {formatNumber(quoteBalance.available, 2)} {quoteAsset}
            </label>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">Price ({quoteAsset})</span>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  disabled={orderType === "market"}
                  value={orderType === "market" ? formatNumber(calculatedPrice, 2) : price}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (Number(val) >= 0 || val === "") setPrice(val);
                  }}
                  className="h-11 border-white/10 bg-white/5 text-white disabled:opacity-70"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">Quantity ({baseAsset})</span>
                <Input 
                  type="number" 
                  min="0.0001" 
                  step="any"
                  value={quantity} 
                  onChange={(e) => {
                    const val = e.target.value;
                    if (Number(val) >= 0 || val === "") setQuantity(val);
                  }} 
                  className="h-11 border-white/10 bg-white/5 text-white" 
                />
              </label>
              <p className="text-xs text-slate-400">Estimated: {formatNumber(estimatedValue, 2)} {quoteAsset}</p>
              <div className="grid grid-cols-4 gap-2 text-xs">
                {[25, 50, 75, 100].map((percent) => (
                  <button
                    key={percent}
                    type="button"
                    disabled={!activeUserId}
                    onClick={() => {
                      const maxQty = side === "buy"
                        ? (calculatedPrice > 0 ? quoteBalance.available / calculatedPrice : 0)
                        : baseBalance.available;
                      setQuantity((maxQty * percent / 100).toFixed(4));
                    }}
                    className="rounded border border-white/10 py-1 text-slate-300 hover:bg-white/10 disabled:opacity-30"
                  >
                    {percent}%
                  </button>
                ))}
              </div>
              {activeUserId ? (
                <Button
                  className={`h-11 w-full ${side === "buy" ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400" : "bg-rose-500 text-white hover:bg-rose-400"}`}
                  onClick={onPlaceOrder}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Placing..." : side === "buy" ? "Buy" : "Sell"}
                </Button>
              ) : (
                <div className="space-y-3">
                  <Link href="/sign-in" className="block">
                    <Button className="h-11 w-full bg-white/10 text-white hover:bg-white/20">
                      Sign in to Trade
                    </Button>
                  </Link>
                  <p className="text-center text-[10px] text-slate-500">
                    Sign in to access your wallet and place orders
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-3 rounded border border-white/10 bg-[#0b111b] p-2">
          <h3 className="mb-2 px-2 text-sm font-semibold text-slate-200">Markets & Trades</h3>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded border border-white/10 bg-black/20 p-2">
              <p className="mb-2 flex items-center gap-2 border-b border-white/10 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <Search className="size-3" />
                Market Directory
              </p>
              <div className="grid grid-cols-3 px-2 pb-1 text-[9px] font-bold text-slate-600 uppercase">
                <span>Pair</span>
                <span className="text-right">Price</span>
                <span className="text-right">24h%</span>
              </div>
              <div className="max-h-52 space-y-0.5 overflow-auto text-xs">
                {allTickers.map((entry, index) => (
                  <Link key={entry.symbol || index} href={`/trade/${entry.symbol}`} className="grid grid-cols-3 rounded px-2 py-1.5 transition hover:bg-white/5">
                    <span className="font-medium text-slate-200">{entry.symbol?.split("_")[0]}</span>
                    <span className="text-right text-slate-300 tabular-nums">{formatNumber(Number(entry.lastPrice), 2)}</span>
                    <span className={`text-right tabular-nums ${Number(entry.priceChangePercent) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {Number(entry.priceChangePercent) >= 0 ? "+" : ""}{formatNumber(Number(entry.priceChangePercent), 2)}%
                    </span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="rounded border border-white/10 bg-black/20 p-2">
              <p className="mb-2 flex items-center gap-2 border-b border-white/10 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <RefreshCcw className="size-3" />
                Recent Trades
              </p>
              <div className="grid grid-cols-3 px-2 pb-1 text-[9px] font-bold text-slate-600 uppercase">
                <span>Price</span>
                <span className="text-right">Size</span>
                <span className="text-right">Time</span>
              </div>
              <div className="max-h-52 space-y-0.5 overflow-auto text-[11px] pr-1">
                {trades.slice(0, 50).map((trade, i) => (
                  <div key={`${trade.timestamp}-${trade.price}-${trade.quantity}-${i}`} className="grid grid-cols-3 rounded px-2 py-1 transition hover:bg-white/5">
                    <span className={`font-bold ${i % 2 === 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatNumber(Number(trade.price), 2)}</span>
                    <span className="text-right text-slate-300 tabular-nums">{formatNumber(Number(trade.quantity), 4)}</span>
                    <span className="text-right text-slate-500 tabular-nums">
                      {new Date(trade.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                    </span>
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
