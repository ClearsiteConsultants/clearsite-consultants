import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { sql } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/password-utils";

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
            const { valid, legacy } = await verifyPassword(password, user.password_hash);
            if (valid) {
              if (legacy) {
                // Upgrade legacy bcrypt hash to modern prehash+bcrypt in the background.
                const newHash = await hashPassword(password);
                await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${user.id}`;
              }
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
            SELECT id, email, password_hash, company_name, first_name, last_name
            FROM clients
            WHERE email = ${email}
          `;

          if (clientResult.rows.length === 0) return null;

          const client = clientResult.rows[0];
          const { valid, legacy } = await verifyPassword(password, client.password_hash);
          if (!valid) return null;

          if (legacy) {
            // Upgrade legacy bcrypt hash to modern prehash+bcrypt in the background.
            const newHash = await hashPassword(password);
            await sql`UPDATE clients SET password_hash = ${newHash} WHERE id = ${client.id}`;
          }

          return {
            id: `client:${client.id}`,
            email: client.email,
            name: client.company_name,
            first_name: client.first_name ?? "",
            last_name: client.last_name ?? "",
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
        token.first_name = (user as { first_name?: string }).first_name ?? "";
        token.last_name = (user as { last_name?: string }).last_name ?? "";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { user_type?: string }).user_type =
          typeof token.user_type === "string" ? token.user_type : "client";
        (session.user as { first_name?: string }).first_name =
          typeof token.first_name === "string" ? token.first_name : "";
        (session.user as { last_name?: string }).last_name =
          typeof token.last_name === "string" ? token.last_name : "";
      }
      return session;
    },
  },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        // Enable secure flag whenever the app is served over HTTPS (production and
        // any staging/preview environment) or when NODE_ENV is explicitly production.
        secure:
          process.env.NODE_ENV === "production" ||
          (process.env.NEXTAUTH_URL ?? "").startsWith("https://"),
        sameSite: "strict",
        path: "/",
      },
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