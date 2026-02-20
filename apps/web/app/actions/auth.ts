"use server";
import { auth } from "@workspace/auth";

export async function signInAction(email: string, password: string) {
    const result = await auth.api.signInEmail({
        body: { email, password },
    });
    return result;
}