import { createAuthClient } from "better-auth/react";
import { env } from "@workspace/env";

export const authClient = createAuthClient({
    baseURL: env.NEXT_PUBLIC_APP_URL!,
});

export const { signIn, signOut, signUp, useSession, getSession } = authClient;