import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@workspace/database";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),

    // Email + Password auth
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
    },

    // OAuth Social providers — add what you need
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }
    },

    // Email verification config
    emailVerification: {
        sendVerificationEmail: async ({ user, url }) => {
            // plug in your email sender here (Resend, Nodemailer, etc.)
            console.log(`Send verification email to ${user.email}: ${url}`);
        },
    },

    // Session config
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24,     // refresh if older than 1 day
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60,            // cache session in cookie for 5 min
        },
    },

    // Trusted origins — add all your app origins
    trustedOrigins: [
        process.env.NEXT_PUBLIC_APP_URL!,
        "http://localhost:3000",
        "http://localhost:4000", // express
    ],

    // IMPORTANT: nextCookies must be last in plugins array
    plugins: [nextCookies()],
});

// Export inferred types — used everywhere in your apps
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;