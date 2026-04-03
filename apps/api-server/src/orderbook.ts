interface Order {
  price: number;
  quantity: number;
  orderId: string;
}

interface Bid extends Order {
  side: "bid";
}

interface Ask extends Order {
  side: "ask";
}

interface Orderbook {
  bids: Bid[];
  asks: Ask[];
}

type QuantityByPrice = Record<number, number>;

export const orderbook: Orderbook = {
  bids: [],
  asks: [],
};

export const bookWithQuantity: {
  bids: QuantityByPrice;
  asks: QuantityByPrice;
} = {
  bids: {},
  asks: {},
};
