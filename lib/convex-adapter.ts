import { Adapter } from "next-auth/adapters";
import { fetchMutation, fetchQuery } from "convex/nextjs";

export function ConvexAdapter(): Adapter {
  return {
    async createUser(user: any) {
      const id = await fetchMutation("users:upsertUser" as any, {
        name: user.name ?? "",
        email: user.email,
        image: user.image ?? "",
        googleId: "",
      });
      return { ...user, id };
    },
    async getUser(id: string) {
      return await fetchQuery("users:getUserNextAuth" as any, { id });
    },
    async getUserByEmail(email: string) {
      return await fetchQuery("users:getUserByEmail" as any, { email });
    },
    async getUserByAccount({ providerAccountId, provider }: any) {
      return null;
    },
    async updateUser(user: any) {
      return user as any;
    },
    async linkAccount(account: any) {
      return account as any;
    },
    async createSession(session: any) {
      return session;
    },
    async getSessionAndUser(sessionToken: string) {
      return null;
    },
    async updateSession(session: any) {
      return session as any;
    },
    async deleteSession(sessionToken: string) {
      return null;
    },
    async createVerificationToken(verificationToken: any) {
      await fetchMutation("users:createVerificationToken" as any, {
        identifier: verificationToken.identifier,
        token: verificationToken.token,
        expires: verificationToken.expires.getTime(),
      });
      return verificationToken;
    },
    async useVerificationToken({ identifier, token }: any) {
      const vt: any = await fetchMutation("users:useVerificationToken" as any, { identifier, token });
      if (!vt) return null;
      return {
        identifier: vt.identifier,
        token: vt.token,
        expires: new Date(vt.expires),
      };
    },
  };
}
