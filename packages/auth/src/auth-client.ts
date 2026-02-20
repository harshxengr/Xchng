import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_APP_URL!, // must be set
});

// Export useful hooks and methods directly
export const {
    signIn,
    signOut,
    signUp,
    useSession,
    getSession,
} = authClient;