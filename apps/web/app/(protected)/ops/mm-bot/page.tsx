import { MmBotAdminScreen } from "@/components/MmBotAdminScreen";
import { requireOperatorSession } from "@/lib/auth-session";

export default async function MmBotAdminPage() {
  await requireOperatorSession();
  return <MmBotAdminScreen />;
}
