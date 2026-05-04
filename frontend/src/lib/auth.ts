import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { API_BASE_URL } from "@/lib/api";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
    user: {
      id?: string;
      username?: string;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    username?: string;
  }
}

type BackendUser = {
  id: number;
  username: string;
  email: string;
};

type BackendTokens = {
  access_token: string;
  refresh_token: string;
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "KCPEC",
      credentials: {
        username: { label: "아이디", type: "text" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const tokenRes = await fetch(`${API_BASE_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: credentials.username,
            password: credentials.password,
          }),
        });
        if (!tokenRes.ok) return null;
        const tokens = (await tokenRes.json()) as BackendTokens;

        const meRes = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (!meRes.ok) return null;
        const me = (await meRes.json()) as BackendUser;

        return {
          id: String(me.id),
          name: me.username,
          email: me.email,
          username: me.username,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        };
      },
    }),
    // TODO: 카카오/네이버 OAuth Provider — 클라이언트 ID/Secret 발급 후 활성화
    // KakaoProvider({ clientId: process.env.KAKAO_CLIENT_ID!, clientSecret: process.env.KAKAO_CLIENT_SECRET! }),
    // NaverProvider({ clientId: process.env.NAVER_CLIENT_ID!, clientSecret: process.env.NAVER_CLIENT_SECRET! }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as typeof user & {
          accessToken?: string;
          refreshToken?: string;
          username?: string;
        };
        token.accessToken = u.accessToken;
        token.refreshToken = u.refreshToken;
        token.username = u.username;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.refreshToken = token.refreshToken;
      if (session.user) {
        if (token.sub) session.user.id = token.sub;
        session.user.username = token.username;
      }
      return session;
    },
  },
});
