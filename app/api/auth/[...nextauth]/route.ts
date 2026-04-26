import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          const email = credentials.email as string;
          const password = credentials.password as string;

          // Check users table first so existing portal users always resolve as admins.
          const userResult = await sql`
            SELECT id, email, name, password_hash
            FROM users
            WHERE email = ${email}
          `;

          if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            const passwordValid = await bcrypt.compare(password, user.password_hash);
            if (passwordValid) {
              return {
                id: `user:${user.id}`,
                email: user.email,
                name: user.name ?? user.email,
                user_type: "admin",
              };
            }
          }

          // Fall back to clients table (sign-up accounts → client portal)
          const clientResult = await sql`
            SELECT id, email, password_hash, company_name
            FROM clients
            WHERE email = ${email}
          `;

          if (clientResult.rows.length === 0) return null;

          const client = clientResult.rows[0];
          const passwordValid = await bcrypt.compare(password, client.password_hash);
          if (!passwordValid) return null;
          return {
            id: `client:${client.id}`,
            email: client.email,
            name: client.company_name,
            user_type: "client",
          };
        } catch (error) {
          console.error("Credentials authorize failed", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.user_type = (user as { user_type?: string }).user_type || "client";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { user_type?: string }).user_type =
          typeof token.user_type === "string" ? token.user_type : "client";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  logger: {
    error(code, ...message) {
      console.error("NextAuth error", code, ...message);
    },
    warn(code) {
      console.warn("NextAuth warning", code);
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
});

export const { GET, POST } = handlers;