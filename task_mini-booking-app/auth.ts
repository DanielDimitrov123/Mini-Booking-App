import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { pool } from "./lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    }, 
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials.password === "string" ? credentials.password : "";

        if (!email || !password) return null;

        const result = await pool.query<{
          id: number;
          full_name: string;
          email: string;
          password_hash: string;
        }>(
          `SELECT id, full_name, email, password_hash
           FROM users
           WHERE email = $1`,
          [email]
        );

        const user = result.rows[0];
        if (!user) return null;

        const passwordMatches = await compare(password, user.password_hash);
        if (!passwordMatches) return null;

        return {
          id: String(user.id),
          name: user.full_name,
          email: user.email,
        };
      },
    }),
  ],
});