"use client";

import { authClient } from "@workspace/auth/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    setIsLoading(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/sign-in");
          router.refresh(); // clear any RSC cache
        },
      },
    });
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={isLoading}
      className="rounded-lg border border-white/20 bg-transparent px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:border-rose-400/50 hover:bg-rose-500/10 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isLoading ? "Signing out..." : "Sign out"}
    </button>
  );
}
