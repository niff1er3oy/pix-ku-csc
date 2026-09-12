import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { db } from "@/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
  type UserRole,
} from "@/db/schema";
import { ensureAdminPhotographerProfile } from "@/lib/photographers";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [Google],
  session: { strategy: "database" },
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  callbacks: {
    /**
     * Database sessions hand us the user row, so the role comes straight from
     * the source of truth on every request rather than from a token that can
     * go stale after an admin changes someone's role.
     */
    session({ session, user }) {
      session.user.id = user.id;
      session.user.role = (user as { role?: UserRole }).role ?? "user";
      return session;
    },
  },
  events: {
    /**
     * Bootstrap admins from the env var. Without this the very first deploy
     * would have nobody able to approve the first photographer.
     */
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email || !user.id) return;
      if (!adminEmails().includes(email)) return;

      await db
        .update(users)
        .set({ role: "admin" })
        .where(eq(users.id, user.id));

      // An admin gets full studio parity too — see the note on
      // `ensureAdminPhotographerProfile`.
      await ensureAdminPhotographerProfile(user.id, user.name ?? "Admin");
    },
  },
  trustHost: true,
});
