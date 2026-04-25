import { TradeScreen } from "@/components/TradeScreen";
import { getSession } from "@/lib/auth-session";

export default async function TradePage({
  params,
}: {
  params: Promise<{ market: string }>;
}) {
  const { market } = await params;
  const session = await getSession();

  return (
    <TradeScreen
      market={market}
      sessionUser={
        session
          ? {
              id: session.user.id,
              name: session.user.name ?? null,
              email: session.user.email ?? null
            }
          : null
      }
    />
  );
}
