"use client";

import type { Kline } from "@/app/lib/api";

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  }).format(Number.isFinite(value) ? value : 0);
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

export function CandleChart({
  candles,
  interval
}: {
  candles: Kline[];
  interval: string;
}) {
  if (candles.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] text-sm text-slate-500">
        No candle data yet.
      </div>
    );
  }

  const maxPrice = Math.max(...candles.map((candle) => Number(candle.high)));
  const minPrice = Math.min(...candles.map((candle) => Number(candle.low)));
  const priceRange = Math.max(maxPrice - minPrice, 0.00000001);
  const width = 960;
  const height = 340;
  const topPadding = 20;
  const volumeHeight = 48;
  const bottomPadding = 34;
  const chartHeight = height - topPadding - bottomPadding - volumeHeight - 14;
  const candleWidth = width / candles.length;
  const bodyWidth = Math.max(Math.min(candleWidth * 0.58, 18), 6);
  const maxVolume = Math.max(...candles.map((candle) => Number(candle.baseVolume)), 1);

  const toY = (price: number) => {
    const normalized = (price - minPrice) / priceRange;
    return topPadding + chartHeight - normalized * chartHeight;
  };

  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const value = maxPrice - (priceRange / 4) * index;
    return {
      value,
      y: toY(value)
    };
  });

  const xLabels = candles.filter((_, index) => {
    const step = Math.max(Math.floor(candles.length / 4), 1);
    return index === 0 || index === candles.length - 1 || index % step === 0;
  });

  const latest = candles[candles.length - 1]!;
  const first = candles[0]!;
  const change = Number(latest.close) - Number(first.open);
  const changeTone = change >= 0 ? "text-emerald-300" : "text-rose-300";

  return (
    <div className="rounded-2xl border border-white/10 bg-[#070b12] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{interval} candles</p>
          <p className="mt-2 text-lg font-semibold text-white">
            O {formatNumber(Number(latest.open), 2)} · H {formatNumber(Number(latest.high), 2)} · L {formatNumber(Number(latest.low), 2)} · C {formatNumber(Number(latest.close), 2)}
          </p>
        </div>
        <div className={`text-sm font-medium ${changeTone}`}>
          Session change {change >= 0 ? "+" : ""}
          {formatNumber(change, 2)}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-[340px] w-full overflow-visible">
        {yTicks.map((tick) => (
          <g key={tick.value}>
            <line x1="0" x2={width} y1={tick.y} y2={tick.y} stroke="rgba(148,163,184,0.14)" strokeDasharray="4 6" />
            <text x={width - 8} y={tick.y - 6} textAnchor="end" fontSize="12" fill="rgba(148,163,184,0.72)">
              {formatNumber(tick.value, 2)}
            </text>
          </g>
        ))}

        {candles.map((candle, index) => {
          const open = Number(candle.open);
          const close = Number(candle.close);
          const high = Number(candle.high);
          const low = Number(candle.low);
          const volume = Number(candle.baseVolume);

          const x = index * candleWidth + candleWidth / 2;
          const openY = toY(open);
          const closeY = toY(close);
          const highY = toY(high);
          const lowY = toY(low);
          const isBullish = close >= open;
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.max(Math.abs(closeY - openY), 2);
          const tone = isBullish ? "#0ecb81" : "#f6465d";
          const volumeBarHeight = Math.max((volume / maxVolume) * volumeHeight, 1);
          const volumeY = height - bottomPadding - volumeBarHeight;

          return (
            <g key={`${candle.bucketStart}-${index}`}>
              <line x1={x} x2={x} y1={highY} y2={lowY} stroke={tone} strokeWidth="1.5" />
              <rect
                x={x - bodyWidth / 2}
                y={bodyTop}
                width={bodyWidth}
                height={bodyHeight}
                rx="2"
                fill={tone}
                fillOpacity={isBullish ? 0.92 : 0.85}
              />
              <rect
                x={x - bodyWidth / 2}
                y={volumeY}
                width={bodyWidth}
                height={volumeBarHeight}
                rx="1.5"
                fill={tone}
                fillOpacity={0.18}
              />
            </g>
          );
        })}

        {xLabels.map((candle) => {
          const index = candles.findIndex((entry) => entry.bucketStart === candle.bucketStart);
          const x = index * candleWidth + candleWidth / 2;

          return (
            <text
              key={candle.bucketStart}
              x={x}
              y={height - 8}
              textAnchor="middle"
              fontSize="12"
              fill="rgba(148,163,184,0.72)"
            >
              {formatTime(candle.bucketStart)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
