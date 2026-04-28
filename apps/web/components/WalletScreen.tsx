"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { 
  Wallet, 
  ArrowDownLeft, 
  ArrowRightLeft,
  Loader2,
  Info,
  CheckCircle2,
  XCircle,
  Search
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { type UserBalance, type Ticker, getBalances, deposit } from "@/app/lib/api";

type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
};

interface WalletScreenProps {
  balances: UserBalance;
  tickers: Ticker[];
  sessionUser: SessionUser;
}

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number.isFinite(value) ? value : 0);
}

export function WalletScreen({ balances: initialBalances, tickers, sessionUser }: WalletScreenProps) {
  const [balances, setBalances] = useState<UserBalance>(initialBalances);
  const [isDepositing, setIsDepositing] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>("1000");
  const [message, setMessage] = useState<{ text: string, type: "success" | "error" } | null>(null);
  const searchParams = useSearchParams();
  const highlightedAsset = searchParams.get("asset");

  useEffect(() => {
    if (highlightedAsset) {
      const el = document.getElementById(`asset-${highlightedAsset}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("bg-emerald-500/10");
        setTimeout(() => el.classList.remove("bg-emerald-500/10"), 3000);
      }
    }
  }, [highlightedAsset]);

  const handleDeposit = async (asset: string) => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      setMessage({ text: "Please enter a valid amount", type: "error" });
      return;
    }

    try {
      setIsDepositing(asset);
      setMessage(null);
      await deposit(sessionUser.id, asset, amount);
      
      const newBalances = await getBalances(sessionUser.id);
      setBalances(newBalances);
      
      setMessage({ text: `Successfully deposited ${amount} ${asset}`, type: "success" });
      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Deposit failed", type: "error" });
    } finally {
      setIsDepositing(null);
    }
  };

  const [searchQuery, setSearchQuery] = useState("");

  const assetData = useMemo(() => {
    const allAssets = new Set<string>();
    tickers.forEach((t) => {
      if (t.symbol) {
        const [base, quote] = t.symbol.split("_");
        if (base) allAssets.add(base);
        if (quote) allAssets.add(quote);
      }
    });
    Object.keys(balances).forEach((a) => allAssets.add(a));

    return Array.from(allAssets)
      .filter((asset) => asset.toLowerCase().includes(searchQuery.toLowerCase()))
      .map((asset) => {
        const balance = balances[asset] || { available: 0, locked: 0 };
      const ticker = tickers.find(t => t.symbol === `${asset}_INR` || t.symbol === `${asset}_USDT`);
      let price = 1;
      if (ticker) {
        price = Number(ticker.lastPrice);
      } else if (asset === "TATA") {
        price = 500;
      }
      
      const total = balance.available + balance.locked;
      const valueBase = total * price;

      return {
        asset,
        available: balance.available,
        locked: balance.locked,
        total,
        valueBase,
        price,
        isQuote: asset === "INR" || asset === "USDT"
      };
    }).sort((a, b) => {
      if (b.valueBase !== a.valueBase) return b.valueBase - a.valueBase;
      if (b.isQuote !== a.isQuote) return b.isQuote ? 1 : -1;
      return a.asset.localeCompare(b.asset);
    });
  }, [balances, tickers, searchQuery]);

  const totalValueINR = useMemo(() => {
    return assetData.reduce((sum, item) => sum + item.valueBase, 0);
  }, [assetData]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 text-white animate-in fade-in duration-500">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Spot Wallet</h1>
          <p className="text-slate-400">Manage your assets and check balances</p>
        </div>
      </div>

      {message && (
        <div className={`mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg transition-all ${
          message.type === "success" 
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" 
            : "border-rose-500/30 bg-rose-500/10 text-rose-400"
        }`}>
          {message.type === "success" ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
          {message.text}
        </div>
      )}

      {/* Summary Card */}
      <div className="mb-8 rounded-2xl border border-white/10 bg-gradient-to-br from-[#0b111b] to-[#151f2e] p-8 shadow-2xl">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
              <Wallet className="size-4 text-emerald-400" /> Total Portfolio Value
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-black tracking-tighter">₹{formatNumber(totalValueINR, 2)}</span>
              <span className="text-2xl font-semibold text-slate-500">INR</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 bg-white/5 w-fit px-2 py-1 rounded-md border border-white/5">
              <Info className="size-3" />
              Values estimated based on last trade prices
            </div>
          </div>
          
          <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-5 min-w-[240px]">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Trading Account</div>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
                {sessionUser.name?.[0] || sessionUser.email?.[0] || "U"}
              </div>
              <div>
                <div className="text-sm font-bold text-slate-200">{sessionUser.name || "User"}</div>
                <div className="text-[11px] text-slate-500 truncate max-w-[140px]">{sessionUser.email}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assets Table */}
      <div className="rounded-2xl border border-white/10 bg-[#0b111b] shadow-2xl overflow-hidden">
        <div className="border-b border-white/10 bg-white/[0.02] px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 flex-1">
            <h3 className="text-lg font-bold text-slate-100 shrink-0">Asset Balances</h3>
            <div className="relative flex-1 max-w-xs">
               <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
               <Input 
                 placeholder="Search asset..." 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="h-9 pl-10 bg-white/5 border-white/10 text-xs focus:ring-emerald-500/20"
               />
            </div>
          </div>
          <div className="flex items-center gap-3">
             <span className="text-xs text-slate-500 font-medium">Deposit Amount:</span>
             <Input 
                type="number" 
                value={depositAmount} 
                onChange={(e) => setDepositAmount(e.target.value)}
                className="h-9 w-24 bg-white/5 border-white/10 text-xs font-bold text-emerald-400 focus:ring-emerald-500/20"
             />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.01] text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-6 py-4">Asset</th>
                <th className="px-6 py-4">Total Balance</th>
                <th className="px-6 py-4">Available</th>
                <th className="px-6 py-4">In Orders</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {assetData.map((item) => (
                <tr 
                  key={item.asset} 
                  id={`asset-${item.asset}`}
                  className="group hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-white/10 to-white/5 text-sm font-black text-white border border-white/10 group-hover:border-emerald-500/30 transition-colors">
                        {item.asset}
                      </div>
                      <div>
                        <div className="font-bold text-slate-200">{item.asset}</div>
                        <div className="text-[10px] text-slate-500 font-medium uppercase">Crypto Asset</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 font-bold text-slate-100 tabular-nums">
                    {formatNumber(item.total, 4)}
                    <div className="text-[10px] text-slate-500 mt-1 font-medium">
                      ≈ {item.asset === "INR" ? "₹" : "₹"}{formatNumber(item.valueBase, 2)}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-slate-400 tabular-nums font-medium">{formatNumber(item.available, 4)}</td>
                  <td className="px-6 py-5 text-slate-500 tabular-nums font-medium">{formatNumber(item.locked, 4)}</td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex justify-end gap-3 opacity-80 group-hover:opacity-100 transition-opacity">
                      <Button 
                        onClick={() => handleDeposit(item.asset)}
                        disabled={isDepositing === item.asset}
                        size="sm" 
                        className="h-9 rounded-lg bg-emerald-500 px-4 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                      >
                        {isDepositing === item.asset ? <Loader2 className="size-3 animate-spin" /> : <ArrowDownLeft className="size-3 mr-1.5" />}
                        Deposit
                      </Button>
                      
                      {(() => {
                        const market = tickers.find(t => t.symbol?.startsWith(item.asset + "_") || t.symbol?.endsWith("_" + item.asset));
                        return market ? (
                          <Link href={`/trade/${market.symbol}`}>
                            <Button size="sm" variant="outline" className="h-9 rounded-lg border-white/10 bg-white/5 px-4 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white">
                              <ArrowRightLeft className="size-3 mr-1.5 text-emerald-400" />
                              Trade
                            </Button>
                          </Link>
                        ) : null;
                      })()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
