import type { PersistedTickerInput, PersistedTradeInput } from "@workspace/types";


export function toTradeCreateManyInput(trade: PersistedTradeInput) {
    return {
        id: `${trade.market}-${trade.tradeId}`,
        tradeId: trade.tradeId,
        market: trade.market,
        price: trade.price.toString(),
        quantity: trade.quantity.toString(),
        buyerUserId: trade.buyerUserId,
        sellerUserId: trade.sellerUserId,
        timestamp: new Date(trade.timestamp)
    };
}

export function toTickerCreateInput(ticker: PersistedTickerInput) {
    return {
        market: ticker.market,
        lastPrice: ticker.lastPrice.toString(),
        high: ticker.high.toString(),
        low: ticker.low.toString(),
        volume: ticker.volume.toString(),
        quoteVolume: ticker.quoteVolume.toString(),
        firstPrice: ticker.firstPrice.toString(),
        priceChange: ticker.priceChange.toString(),
        priceChangePercent: ticker.priceChangePercent.toString(),
        trades: ticker.trades,
        timestamp: new Date(ticker.timestamp)
    };
}