import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    hasAuthSecret: Boolean(process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET),
    hasAuthUrl: Boolean(process.env.NEXTAUTH_URL),
    databaseReachable: false,
  };

  try {
    await sql`SELECT 1`;
    checks.databaseReachable = true;
  } catch (error) {
    console.error("Auth health DB check failed", error);
  }

  const ok = checks.hasAuthSecret && checks.hasAuthUrl && checks.databaseReachable;

  return NextResponse.json(
    {
      ok,
      checks,
      service: "auth",
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
