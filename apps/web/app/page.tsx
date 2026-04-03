import { prisma } from "@workspace/database";
import { Button } from "@workspace/ui/components/button";

export default async function HomePage() {
  const user = await prisma.user.findFirst();

  return (
    <main className="flex min-h-svh items-center justify-center px-6">
      <section className="flex max-w-md flex-col items-center gap-4 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
          Xchng
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          Simple trading app
        </h1>
        <p className="text-sm text-muted-foreground">
          {user?.name
            ? `Connected user: ${user.name}`
            : "No user has been created in the database yet."}
        </p>
        <Button>Open app</Button>
      </section>
    </main>
  );
}
