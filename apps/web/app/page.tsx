import { ArrowRight, CandlestickChart, Layers3, RadioTower, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import Link from "next/link";

const highlights = [
  {
    title: "Live market streaming",
    description: "Depth, ticker, and trade updates flow into the interface in real time for a true exchange feel.",
    icon: RadioTower,
  },
  {
    title: "Fast order workflow",
    description: "Clean buy and sell flows, wallet context, and open-order management keep execution friction low.",
    icon: CandlestickChart,
  },
  {
    title: "Operator-grade clarity",
    description: "Designed for scanning: market stats, order book, balances, and trade tape all stay readable under pressure.",
    icon: Layers3,
  },
];

const stats = [
  { label: "Default market", value: "TATA/INR" },
  { label: "Streaming channels", value: "3 live feeds" },
  { label: "Trader modes", value: "Buy / Sell" },
  { label: "Order control", value: "Place + cancel" },
];

const featureCards = [
  {
    title: "Professional market surface",
    body: "A modern trading canvas with strong hierarchy, rich spacing, and fast visual parsing across desktop and mobile.",
    icon: Sparkles,
  },
  {
    title: "Balance-aware execution",
    body: "Portfolio snapshots and quote/base availability stay near the order form so traders can move without context switching.",
    icon: Wallet,
  },
  {
    title: "Built for confidence",
    body: "Real-time signal states, clean affordances, and clear action feedback help the product feel dependable end to end.",
    icon: ShieldCheck,
  },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_24%),radial-gradient(circle_at_85%_15%,_rgba(16,185,129,0.18),_transparent_22%),linear-gradient(180deg,_#020617_0%,_#020617_45%,_#07111f_100%)] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:84px_84px] opacity-20" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <section className="rounded-[32px] border border-white/10 bg-slate-950/65 shadow-[0_24px_80px_rgba(2,6,23,0.5)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 border-b border-white/10 px-6 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-emerald-400 text-slate-950 shadow-lg">
                <CandlestickChart className="size-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">XCHNG</p>
                <h1 className="mt-1 text-xl font-semibold text-white">Modern exchange workspace</h1>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-200">
                <RadioTower className="size-4" />
                Live-ready UI
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300">
                In-memory matching engine
              </span>
            </div>
          </div>

          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1.2fr)_420px] lg:px-8 lg:py-10">
            <div className="space-y-8">
              <div className="space-y-5">
                <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1.5 text-xs uppercase tracking-[0.24em] text-sky-200">
                  <Sparkles className="size-3.5" />
                  Exchange Interface
                </span>

                <div className="space-y-4">
                  <h2 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                    Trade with a cleaner, sharper, more modern market experience.
                  </h2>
                  <p className="max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
                    Xchng brings together live market data, execution controls, open orders, and account visibility in a UI designed to feel like a serious trading product instead of a demo.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 rounded-2xl bg-emerald-500 px-5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
                  >
                    <Link href="/trade/TATA_INR">
                      Open TATA/INR market
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>

                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="h-12 rounded-2xl border-white/10 bg-white/5 px-5 text-sm text-slate-100 hover:bg-white/10"
                  >
                    <Link href="/sign-in">Sign in to dashboard</Link>
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {highlights.map(({ title, description, icon: Icon }) => (
                  <article
                    key={title}
                    className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_16px_48px_rgba(2,6,23,0.28)]"
                  >
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-white/8 text-sky-200">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
                  </article>
                ))}
              </div>
            </div>

            <aside className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(15,23,42,0.75))] p-5 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Launch Panel</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">Ready to trade</h3>
                </div>
                <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                  Online
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {stats.map((stat) => (
                  <div key={stat.label} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{stat.label}</p>
                    <p className="mt-2 text-lg font-semibold text-white">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-[24px] border border-sky-500/20 bg-sky-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-sky-200">Workflow</p>
                <div className="mt-3 space-y-3 text-sm text-slate-200">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex size-6 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">1</span>
                    <p>Open the live market view and monitor the stream, ticker, and order book.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex size-6 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">2</span>
                    <p>Choose a trader, set price and size, then submit a buy or sell order.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex size-6 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">3</span>
                    <p>Track fills and cancel open orders from the same workspace.</p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[30px] border border-white/10 bg-slate-950/60 p-6 shadow-[0_20px_60px_rgba(2,6,23,0.35)] backdrop-blur-xl">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Product Direction</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                A frontend that feels like a real exchange, not a placeholder.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-400 sm:text-base">
                The interface leans into modern trading product patterns: dense but readable information, decisive color semantics, strong panel separation, and clear actions that stay discoverable across smaller screens.
              </p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {featureCards.map(({ title, body, icon: Icon }) => (
                <article key={title} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-white/8 text-emerald-200">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(9,14,26,0.82))] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.35)] backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Preview</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Trading workspace snapshot</h2>

            <div className="mt-6 space-y-4">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Market</p>
                    <p className="mt-1 text-xl font-semibold text-white">TATA / INR</p>
                  </div>
                  <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                    Live feed
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/65 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Last</p>
                    <p className="mt-2 text-lg font-semibold text-white">₹100.00</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/65 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">High</p>
                    <p className="mt-2 text-lg font-semibold text-emerald-300">₹104.20</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/65 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Low</p>
                    <p className="mt-2 text-lg font-semibold text-rose-300">₹97.40</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[24px] border border-rose-500/20 bg-rose-500/[0.06] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-rose-200">Asks</p>
                  <div className="mt-4 space-y-2 text-sm">
                    {["101.20", "101.00", "100.80"].map((price) => (
                      <div key={price} className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-3 py-2">
                        <span className="text-rose-300">{price}</span>
                        <span className="text-slate-300">250</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Bids</p>
                  <div className="mt-4 space-y-2 text-sm">
                    {["99.90", "99.70", "99.50"].map((price) => (
                      <div key={price} className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-3 py-2">
                        <span className="text-emerald-300">{price}</span>
                        <span className="text-slate-300">300</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Button
                asChild
                size="lg"
                className="h-12 w-full rounded-2xl bg-sky-500 text-sm font-semibold text-slate-950 hover:bg-sky-400"
              >
                <Link href="/trade/TATA_INR">
                  Launch workspace
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
