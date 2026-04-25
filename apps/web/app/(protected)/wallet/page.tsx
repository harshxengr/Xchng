import { requireSession } from "@/lib/auth-session";
import { getBalances, getTickers } from "@/app/lib/api";
import { WalletScreen } from "@/components/WalletScreen";

export default async function WalletPage() {
  const session = await requireSession();
  
  // Fetch initial data
  const [balances, tickers] = await Promise.all([
    getBalances(session.user.id),
    getTickers()
  ]);

  return (
    <WalletScreen 
      balances={balances} 
      tickers={tickers} 
      sessionUser={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email
      }} 
    />
  );
}
