import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { fetchQuery } from "convex/nextjs";
import bcrypt from "bcryptjs";
import { api } from "@/convex/_generated/api";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await fetchQuery(api.users.getUserByEmail, { email: credentials.email });
        if (user) {
          if (!user.password) return null;
          const isValid = await bcrypt.compare(credentials.password, user.password);
          if (!isValid) return null;

          return {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
          };
        }

        // Check if there is an onboarding request for this email
        const joinRequest = await fetchQuery(api.joinRequests.getJoinRequestByEmail, { email: credentials.email });
        if (joinRequest) {
          if (joinRequest.status === "pending" || joinRequest.status === "changes_requested") {
            throw new Error("Your account is pending owner approval.");
          } else if (joinRequest.status === "rejected") {
            throw new Error("Your onboarding request has been rejected.");
          }
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
});

export { handler as GET, handler as POST };
