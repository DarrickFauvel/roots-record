import { betterAuth } from "better-auth";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const auth = betterAuth({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: { dialect: new LibsqlDialect({ client: client as any }), type: "sqlite" },
  emailAndPassword: { enabled: true },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
