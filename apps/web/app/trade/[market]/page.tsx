import { TradeScreen } from "@/components/TradeScreen";

export default async function TradePage({
  params,
}: {
  params: Promise<{ market: string }>;
}) {
  const { market } = await params;

  return <TradeScreen market={market} />;
}
