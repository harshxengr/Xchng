"use server";

import { auth } from "@workspace/auth";

export async function signInAction(email: string, password: string) {
  return auth.api.signInEmail({
    body: { email, password },
  });
}
