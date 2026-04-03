import { betterAuth } from "better-auth";
import { getSessionCookie } from "better-auth/cookies";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@workspace/database";
import { env } from "@workspace/env";

export { getSessionCookie };

const googleSocialProvider =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {};

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  socialProviders: googleSocialProvider,

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      if (env.NODE_ENV === "development") {
        console.info(`[auth] verification link for ${user.email}: ${url}`);
      }
    },
    autoSignInAfterVerification: true,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  trustedOrigins: [
    env.NEXT_PUBLIC_APP_URL,
    "http://localhost:3000",
    "http://localhost:4000",
  ],

  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
