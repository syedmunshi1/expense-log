import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  callbacks: {
    signIn({ user }) {
      const allowed = (process.env.ALLOWED_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      // Empty allowlist rejects everyone — fail-safe
      if (allowed.length === 0) return false;
      return allowed.includes(user.email?.toLowerCase() ?? "");
    },
  },
});
