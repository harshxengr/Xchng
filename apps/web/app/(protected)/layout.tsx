import { requireSession } from "@/lib/auth-session";
import { AppTopNav } from "@/components/AppTopNav";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Full DB session validation. Redirects to /sign-in if invalid.
  const session = await requireSession();

  return (
    <>
      <AppTopNav
        user={{
          name: session.user.name ?? null,
          email: session.user.email,
        }}
      />
      {children}
    </>
  );
}
