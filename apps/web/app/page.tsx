import { TradeScreen } from "@/components/TradeScreen";
import { getSession } from "@/lib/auth-session";

export default async function HomePage() {
  const session = await getSession();
  return (
    <TradeScreen
      market="TATA_INR"
      sessionUser={
        session
          ? {
              name: session.user.name ?? null,
              email: session.user.email ?? null
            }
          : null
      }
    />
  );
}
