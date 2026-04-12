"use client";

import { createAuthClient } from "better-auth/react";
import { env } from "@workspace/env";

export const authClient = createAuthClient({
  baseURL:
    env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"),
});

export const { signIn, signOut, signUp, useSession, getSession } = authClient;
