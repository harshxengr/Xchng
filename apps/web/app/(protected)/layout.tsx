import { requireSession } from "@/lib/auth-session";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Full DB session validation. Redirects to /sign-in if invalid.
  await requireSession();

  return <>{children}</>;
}