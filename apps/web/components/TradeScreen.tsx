"use client";

import { useEffect, useMemo, useState } from "react";
import {
    ArrowDownRight,
    ArrowUpRight,
    CandlestickChart,
    CircleDot,
    Landmark,
    Layers3,
    RadioTower,
    ReceiptText,
    Wallet
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import {
    cancelOrder,
    getBalances,
    getDepth,
    getOpenOrders,
    getTicker,
    getTrades,
    getWsUrl,
    placeOrder,
    type Depth,
    type OpenOrder,
    type Ticker,
    type Trade
} from "@/app/lib/api";

type WsDepthMessage = {
    type: "depth";
    symbol: string;
    data: Depth;
};

type WsTradeMessage = {
    type: "trade";
    symbol: string;
    data: Trade;
};

type WsTickerMessage = {
    type: "ticker";
    symbol: string;
    data: Ticker;
};

type AssetBalance = {
    available: number;
    locked: number;
};

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

const EMPTY_BALANCE: AssetBalance = {
    available: 0,
    locked: 0
};

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

function formatNumber(value: number, digits = 2) {
    return new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits
    }).format(Number.isFinite(value) ? value : 0);
}

function formatSignedNumber(value: number, digits = 2) {
    const formatted = formatNumber(Math.abs(value), digits);
    if (value === 0) {
        return formatted;
    }

    return `${value > 0 ? "+" : "-"}${formatted}`;
}

function formatTime(timestamp: number) {
    return new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

function panelClassName(className = "") {
    return `rounded-[28px] border border-white/10 bg-slate-950/70 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl ${className}`.trim();
}

export function TradeScreen({ market }: { market: string }) {
    const [depth, setDepth] = useState<Depth>({ bids: [], asks: [] });
    const [trades, setTrades] = useState<Trade[]>([]);
    const [ticker, setTicker] = useState<Ticker>({ ...DEFAULT_TICKER, symbol: market });
    const [balances, setBalances] = useState<Record<string, AssetBalance>>({});
    const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
    const [userId, setUserId] = useState("1");
    const [side, setSide] = useState<"buy" | "sell">("buy");
    const [price, setPrice] = useState("100");
    const [quantity, setQuantity] = useState("1");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [streamStatus, setStreamStatus] = useState<"connecting" | "live" | "offline">("connecting");

    const [baseAsset, quoteAsset] = useMemo(() => {
        const [base = "", quote = ""] = market.split("_");
        return [base, quote] as const;
    }, [market]);

    const baseBalance = balances[baseAsset] ?? EMPTY_BALANCE;
    const quoteBalance = balances[quoteAsset] ?? EMPTY_BALANCE;

    const bestBid = depth.bids[0]?.[0] ? Number(depth.bids[0][0]) : 0;
    const bestAsk = depth.asks[0]?.[0] ? Number(depth.asks[0][0]) : 0;
    const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;

    const orderPrice = Number(price);
    const orderQuantity = Number(quantity);
    const orderValue = orderPrice * orderQuantity;
    const latestPrice = Number(ticker.lastPrice || 0);
    const priceChange = Number(ticker.priceChange || 0);
    const priceChangePercent = Number(ticker.priceChangePercent || 0);
    const notionalBalance = quoteBalance.available + quoteBalance.locked;
    const basePosition = baseBalance.available + baseBalance.locked;
    const portfolioEstimate = notionalBalance + basePosition * latestPrice;

    const askLevels = depth.asks.slice(0, 8);
    const bidLevels = depth.bids.slice(0, 8);

    const askMaxQuantity = askLevels.reduce((max: number, [, qty]) => Math.max(max, Number(qty)), 0);
    const bidMaxQuantity = bidLevels.reduce((max: number, [, qty]) => Math.max(max, Number(qty)), 0);
    const depthMaxQuantity = Math.max(askMaxQuantity, bidMaxQuantity, 1);

    const tradeCountLabel = `${trades.length} prints`;
    const statusTone =
        side === "buy"
            ? "border-emerald-500/40 bg-emerald-500/12 text-emerald-200"
            : "border-rose-500/40 bg-rose-500/12 text-rose-200";
    const streamTone =
        streamStatus === "live"
            ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
            : streamStatus === "connecting"
              ? "border-amber-500/35 bg-amber-500/10 text-amber-200"
              : "border-rose-500/35 bg-rose-500/10 text-rose-200";
    const messageTone = message.toLowerCase().includes("fail")
        ? "border-rose-500/35 bg-rose-500/10 text-rose-200"
        : "border-sky-500/35 bg-sky-500/10 text-sky-200";

    async function loadAll(selectedUserId: string) {
        setIsInitialLoading(true);

        try {
            const [depthData, tradesData, tickerData, balanceData, openOrdersData] = await Promise.all([
                getDepth(market),
                getTrades(market),
                getTicker(market),
                getBalances(selectedUserId),
                getOpenOrders(market, selectedUserId)
            ]);

            setDepth(depthData);
            setTrades(tradesData);
            setTicker(tickerData);
            setBalances(balanceData);
            setOpenOrders(openOrdersData);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to load market");
        } finally {
            setIsInitialLoading(false);
        }
    }

    async function refreshUserData(selectedUserId: string) {
        const [balanceData, openOrdersData] = await Promise.all([
            getBalances(selectedUserId),
            getOpenOrders(market, selectedUserId)
        ]);

        setBalances(balanceData);
        setOpenOrders(openOrdersData);
    }

    useEffect(() => {
        void loadAll(userId);
    }, [market, userId]);

    useEffect(() => {
        setStreamStatus("connecting");
        const ws = new WebSocket(getWsUrl());

        ws.onopen = () => {
            setStreamStatus("live");
            ws.send(
                JSON.stringify({
                    method: "SUBSCRIBE",
                    params: [`depth@${market}`, `trade@${market}`, `ticker@${market}`]
                })
            );
        };

        ws.onmessage = (event) => {
            const parsed: unknown = JSON.parse(event.data);

            if (isWsDepthMessage(parsed)) {
                setDepth(parsed.data);
                return;
            }

            if (isWsTradeMessage(parsed)) {
                setTrades((current) => [parsed.data, ...current].slice(0, 20));
                return;
            }

            if (isWsTickerMessage(parsed)) {
                setTicker(parsed.data);
            }
        };

        ws.onerror = () => {
            setStreamStatus("offline");
        };

        ws.onclose = () => {
            setStreamStatus("offline");
        };

        return () => {
            ws.close();
        };
    }, [market]);

    async function onSubmit() {
        try {
            setLoading(true);
            setMessage("");

            await placeOrder({
                market,
                userId,
                side,
                price: Number(price),
                quantity: Number(quantity)
            });

            await refreshUserData(userId);
            setMessage("Order placed successfully");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to place order");
        } finally {
            setLoading(false);
        }
    }

    async function onCancel(orderId: string) {
        try {
            setCancelingOrderId(orderId);
            setMessage("");

            await cancelOrder({
                market,
                orderId
            });

            await refreshUserData(userId);
            setMessage("Order cancelled successfully");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to cancel order");
        } finally {
            setCancelingOrderId(null);
        }
    }

    return (
        <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.16),_transparent_26%),linear-gradient(180deg,_#020617_0%,_#020617_42%,_#07111f_100%)] text-slate-100">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:90px_90px] opacity-20" />

            <div className="relative mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8">
                <section className={`${panelClassName()} overflow-hidden`}>
                    <div className="flex flex-col gap-6 px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-7">
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">
                                    <CandlestickChart className="size-3.5" />
                                    Spot Market
                                </span>
                                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${streamTone}`}>
                                    <RadioTower className="size-3.5" />
                                    {streamStatus === "live" ? "Stream live" : streamStatus === "connecting" ? "Connecting" : "Stream offline"}
                                </span>
                            </div>

                            <div className="space-y-2">
                                <div className="flex flex-wrap items-end gap-3">
                                    <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                                        {baseAsset || "Market"}/{quoteAsset || "Pair"}
                                    </h1>
                                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">
                                        {market}
                                    </span>
                                </div>
                                <p className="max-w-2xl text-sm leading-6 text-slate-400">
                                    Professional market view with live order flow, account balances, and one-click order management.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${statusTone}`}>
                                    {side === "buy" ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                                    {side === "buy" ? "Buy bias" : "Sell bias"}
                                </div>
                                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300">
                                    <CircleDot className="size-4 text-sky-300" />
                                    {tradeCountLabel}
                                </div>
                            </div>
                        </div>

                        <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Last price</p>
                                <div className="mt-3 flex items-end gap-2">
                                    <span className="text-2xl font-semibold text-white">{formatNumber(latestPrice, 2)}</span>
                                    <span className={`mb-1 text-sm font-medium ${priceChange >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                                        {formatSignedNumber(priceChangePercent, 2)}%
                                    </span>
                                </div>
                            </div>
                            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">24h range</p>
                                <div className="mt-3 text-sm text-slate-200">
                                    <div className="flex items-center justify-between">
                                        <span>Low</span>
                                        <span>{ticker.low}</span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span>High</span>
                                        <span>{ticker.high}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Spread</p>
                                <div className="mt-3 text-2xl font-semibold text-white">{formatNumber(spread, 2)}</div>
                                <p className="mt-1 text-sm text-slate-400">
                                    Bid {formatNumber(bestBid, 2)} / Ask {formatNumber(bestAsk, 2)}
                                </p>
                            </div>
                            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Quote volume</p>
                                <div className="mt-3 text-2xl font-semibold text-white">{ticker.quoteVolume}</div>
                                <p className="mt-1 text-sm text-slate-400">{ticker.trades} trades matched</p>
                            </div>
                        </div>
                    </div>
                </section>

                {message ? (
                    <section className={`${panelClassName(messageTone)} px-5 py-4 text-sm font-medium`}>
                        {message}
                    </section>
                ) : null}

                <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)_380px]">
                    <div className="flex flex-col gap-6">
                        <section className={`${panelClassName()} p-5`}>
                            <div className="mb-5 flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Order Entry</p>
                                    <h2 className="mt-2 text-xl font-semibold text-white">Place order</h2>
                                </div>
                                <div className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone}`}>
                                    {side === "buy" ? "Long flow" : "Sell flow"}
                                </div>
                            </div>

                            <div className="grid gap-4">
                                <label className="grid gap-2">
                                    <span className="text-sm text-slate-400">Trader</span>
                                    <select
                                        value={userId}
                                        onChange={(e) => setUserId(e.target.value)}
                                        className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-slate-100 outline-none transition focus:border-sky-400/60 focus:bg-slate-900"
                                    >
                                        <option value="1">User 1</option>
                                        <option value="2">User 2</option>
                                        <option value="5">User 5</option>
                                    </select>
                                </label>

                                <div className="grid grid-cols-2 gap-2 rounded-[22px] border border-white/10 bg-white/5 p-1">
                                    <button
                                        type="button"
                                        className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                                            side === "buy"
                                                ? "bg-emerald-500 text-slate-950 shadow-[0_10px_30px_rgba(16,185,129,0.35)]"
                                                : "text-slate-300 hover:bg-white/5"
                                        }`}
                                        onClick={() => setSide("buy")}
                                    >
                                        Buy {baseAsset || "Asset"}
                                    </button>
                                    <button
                                        type="button"
                                        className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                                            side === "sell"
                                                ? "bg-rose-500 text-white shadow-[0_10px_30px_rgba(244,63,94,0.32)]"
                                                : "text-slate-300 hover:bg-white/5"
                                        }`}
                                        onClick={() => setSide("sell")}
                                    >
                                        Sell {baseAsset || "Asset"}
                                    </button>
                                </div>

                                <label className="grid gap-2">
                                    <span className="text-sm text-slate-400">Limit price</span>
                                    <div className="relative">
                                        <Input
                                            value={price}
                                            onChange={(e) => setPrice(e.target.value)}
                                            type="number"
                                            className="h-12 rounded-2xl border-white/10 bg-white/5 px-4 pr-16 text-slate-100"
                                        />
                                        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs uppercase tracking-[0.2em] text-slate-500">
                                            {quoteAsset || "Quote"}
                                        </span>
                                    </div>
                                </label>

                                <label className="grid gap-2">
                                    <span className="text-sm text-slate-400">Quantity</span>
                                    <div className="relative">
                                        <Input
                                            value={quantity}
                                            onChange={(e) => setQuantity(e.target.value)}
                                            type="number"
                                            className="h-12 rounded-2xl border-white/10 bg-white/5 px-4 pr-16 text-slate-100"
                                        />
                                        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs uppercase tracking-[0.2em] text-slate-500">
                                            {baseAsset || "Base"}
                                        </span>
                                    </div>
                                </label>

                                <div className="rounded-[24px] border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-4">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-400">Estimated value</span>
                                        <span className="font-medium text-white">
                                            {formatNumber(orderValue, 2)} {quoteAsset}
                                        </span>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between text-sm">
                                        <span className="text-slate-400">Available quote</span>
                                        <span className="text-slate-200">
                                            {formatNumber(quoteBalance.available, 2)} {quoteAsset}
                                        </span>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between text-sm">
                                        <span className="text-slate-400">Available base</span>
                                        <span className="text-slate-200">
                                            {formatNumber(baseBalance.available, 2)} {baseAsset}
                                        </span>
                                    </div>
                                </div>

                                <Button
                                    className={`h-12 rounded-2xl text-sm font-semibold ${
                                        side === "buy"
                                            ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                                            : "bg-rose-500 text-white hover:bg-rose-400"
                                    }`}
                                    onClick={onSubmit}
                                    disabled={loading}
                                >
                                    {loading ? "Submitting order..." : `${side === "buy" ? "Buy" : "Sell"} ${baseAsset || "Asset"}`}
                                </Button>
                            </div>
                        </section>

                        <section className={`${panelClassName()} p-5`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Account Snapshot</p>
                                    <h2 className="mt-2 text-xl font-semibold text-white">Balances</h2>
                                </div>
                                <Wallet className="size-5 text-slate-400" />
                            </div>

                            <div className="mt-5 space-y-3">
                                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
                                        <span>{quoteAsset || "Quote"} wallet</span>
                                        <span>Total {formatNumber(notionalBalance, 2)}</span>
                                    </div>
                                    <div className="mt-3 grid gap-2 text-sm text-slate-200">
                                        <div className="flex items-center justify-between">
                                            <span>Available</span>
                                            <span>{formatNumber(quoteBalance.available, 2)}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>Locked</span>
                                            <span>{formatNumber(quoteBalance.locked, 2)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
                                        <span>{baseAsset || "Base"} wallet</span>
                                        <span>Total {formatNumber(basePosition, 2)}</span>
                                    </div>
                                    <div className="mt-3 grid gap-2 text-sm text-slate-200">
                                        <div className="flex items-center justify-between">
                                            <span>Available</span>
                                            <span>{formatNumber(baseBalance.available, 2)}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>Locked</span>
                                            <span>{formatNumber(baseBalance.locked, 2)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-[22px] border border-sky-500/20 bg-sky-500/10 p-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-sky-100">Estimated portfolio value</span>
                                        <span className="text-lg font-semibold text-white">
                                            {formatNumber(portfolioEstimate, 2)} {quoteAsset}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    <div className="grid gap-6">
                        <section className={`${panelClassName()} p-5`}>
                            <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Market Depth</p>
                                    <h2 className="mt-2 text-xl font-semibold text-white">Order book</h2>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm text-slate-300 sm:min-w-[250px]">
                                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Best bid</p>
                                        <p className="mt-2 font-medium text-emerald-300">{formatNumber(bestBid, 2)}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Best ask</p>
                                        <p className="mt-2 font-medium text-rose-300">{formatNumber(bestAsk, 2)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                <div className="rounded-[24px] border border-rose-500/15 bg-rose-500/[0.05]">
                                    <div className="grid grid-cols-3 gap-3 border-b border-white/10 px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                                        <span>Price</span>
                                        <span className="text-right">Qty</span>
                                        <span className="text-right">Depth</span>
                                    </div>
                                    <div className="max-h-[360px] overflow-auto px-2 py-2">
                                        {askLevels.length === 0 ? (
                                            <div className="px-2 py-10 text-center text-sm text-slate-500">No asks yet</div>
                                        ) : (
                                            askLevels.map(([levelPrice, levelQty]: [string, string]) => {
                                                const quantityValue = Number(levelQty);
                                                const depthWidth = `${Math.max((quantityValue / depthMaxQuantity) * 100, 6)}%`;

                                                return (
                                                    <div key={`ask-${levelPrice}-${levelQty}`} className="relative grid grid-cols-3 items-center gap-3 overflow-hidden rounded-2xl px-2 py-2 text-sm">
                                                        <div
                                                            className="absolute inset-y-1 right-1 rounded-xl bg-rose-500/10"
                                                            style={{ width: depthWidth }}
                                                        />
                                                        <span className="relative z-10 font-medium text-rose-300">{levelPrice}</span>
                                                        <span className="relative z-10 text-right text-slate-200">{levelQty}</span>
                                                        <span className="relative z-10 text-right text-slate-500">{formatNumber(quantityValue, 2)}</span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-[24px] border border-emerald-500/15 bg-emerald-500/[0.05]">
                                    <div className="grid grid-cols-3 gap-3 border-b border-white/10 px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                                        <span>Price</span>
                                        <span className="text-right">Qty</span>
                                        <span className="text-right">Depth</span>
                                    </div>
                                    <div className="max-h-[360px] overflow-auto px-2 py-2">
                                        {bidLevels.length === 0 ? (
                                            <div className="px-2 py-10 text-center text-sm text-slate-500">No bids yet</div>
                                        ) : (
                                            bidLevels.map(([levelPrice, levelQty]: [string, string]) => {
                                                const quantityValue = Number(levelQty);
                                                const depthWidth = `${Math.max((quantityValue / depthMaxQuantity) * 100, 6)}%`;

                                                return (
                                                    <div key={`bid-${levelPrice}-${levelQty}`} className="relative grid grid-cols-3 items-center gap-3 overflow-hidden rounded-2xl px-2 py-2 text-sm">
                                                        <div
                                                            className="absolute inset-y-1 right-1 rounded-xl bg-emerald-500/10"
                                                            style={{ width: depthWidth }}
                                                        />
                                                        <span className="relative z-10 font-medium text-emerald-300">{levelPrice}</span>
                                                        <span className="relative z-10 text-right text-slate-200">{levelQty}</span>
                                                        <span className="relative z-10 text-right text-slate-500">{formatNumber(quantityValue, 2)}</span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className={`${panelClassName()} p-5`}>
                            <div className="flex items-center justify-between border-b border-white/10 pb-4">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Orders</p>
                                    <h2 className="mt-2 text-xl font-semibold text-white">Open positions</h2>
                                </div>
                                <ReceiptText className="size-5 text-slate-400" />
                            </div>

                            <div className="mt-4 space-y-3">
                                {openOrders.length === 0 ? (
                                    <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-slate-500">
                                        No open orders for the selected trader.
                                    </div>
                                ) : (
                                    openOrders.map((order) => {
                                        const remaining = order.quantity - order.filled;

                                        return (
                                            <div
                                                key={order.orderId}
                                                className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-4 lg:flex-row lg:items-center lg:justify-between"
                                            >
                                                <div className="space-y-3">
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <span
                                                            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                                                                order.side === "buy"
                                                                    ? "bg-emerald-500/15 text-emerald-300"
                                                                    : "bg-rose-500/15 text-rose-300"
                                                            }`}
                                                        >
                                                            {order.side}
                                                        </span>
                                                        <span className="text-sm text-slate-400">#{order.orderId}</span>
                                                    </div>

                                                    <div className="grid gap-2 text-sm text-slate-200 sm:grid-cols-4">
                                                        <div>
                                                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Price</p>
                                                            <p className="mt-1">{formatNumber(order.price, 2)}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Qty</p>
                                                            <p className="mt-1">{formatNumber(order.quantity, 2)}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Filled</p>
                                                            <p className="mt-1">{formatNumber(order.filled, 2)}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Remaining</p>
                                                            <p className="mt-1">{formatNumber(remaining, 2)}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <Button
                                                    variant="destructive"
                                                    className="h-11 rounded-2xl px-5"
                                                    onClick={() => onCancel(order.orderId)}
                                                    disabled={cancelingOrderId === order.orderId}
                                                >
                                                    {cancelingOrderId === order.orderId ? "Cancelling..." : "Cancel order"}
                                                </Button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </section>
                    </div>

                    <div className="flex flex-col gap-6">
                        <section className={`${panelClassName()} p-5`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Tape</p>
                                    <h2 className="mt-2 text-xl font-semibold text-white">Recent trades</h2>
                                </div>
                                <Layers3 className="size-5 text-slate-400" />
                            </div>

                            <div className="mt-4 grid grid-cols-3 gap-3 border-b border-white/10 pb-3 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                                <span>Price</span>
                                <span className="text-right">Quantity</span>
                                <span className="text-right">Time</span>
                            </div>

                            <div className="mt-3 max-h-[460px] space-y-2 overflow-auto pr-1">
                                {trades.length === 0 ? (
                                    <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-slate-500">
                                        No trades yet.
                                    </div>
                                ) : (
                                    trades.map((trade) => {
                                        const isBuyTrade = trade.buyerUserId === userId;

                                        return (
                                            <div
                                                key={trade.tradeId}
                                                className="grid grid-cols-3 items-center gap-3 rounded-[20px] border border-white/8 bg-white/[0.04] px-3 py-3 text-sm"
                                            >
                                                <span className={isBuyTrade ? "font-medium text-emerald-300" : "font-medium text-rose-300"}>
                                                    {formatNumber(Number(trade.price), 2)}
                                                </span>
                                                <span className="text-right text-slate-200">{formatNumber(Number(trade.quantity), 2)}</span>
                                                <span className="text-right text-slate-500">{formatTime(trade.timestamp)}</span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </section>

                        <section className={`${panelClassName()} p-5`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Session</p>
                                    <h2 className="mt-2 text-xl font-semibold text-white">Market pulse</h2>
                                </div>
                                <Landmark className="size-5 text-slate-400" />
                            </div>

                            <div className="mt-5 grid gap-3">
                                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Opening price</p>
                                    <p className="mt-2 text-lg font-semibold text-white">{ticker.firstPrice}</p>
                                </div>
                                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Volume</p>
                                    <p className="mt-2 text-lg font-semibold text-white">{ticker.volume}</p>
                                </div>
                                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">P&L proxy</p>
                                    <p className={`mt-2 text-lg font-semibold ${priceChange >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                                        {formatSignedNumber(priceChange, 2)}
                                    </p>
                                </div>
                            </div>
                        </section>
                    </div>
                </section>

                {isInitialLoading ? (
                    <div className="pointer-events-none fixed inset-x-0 bottom-6 mx-auto w-fit rounded-full border border-white/10 bg-slate-950/85 px-4 py-2 text-sm text-slate-300 shadow-xl backdrop-blur">
                        Loading market data...
                    </div>
                ) : null}
            </div>
        </main>
    );
}
