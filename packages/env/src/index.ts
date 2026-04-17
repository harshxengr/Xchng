import { clientEnvSchema, ClientEnv } from "@workspace/types";

const parsed = clientEnvSchema.partial().safeParse(process.env);

export const env = parsed.success ? parsed.data : ({} as ClientEnv);