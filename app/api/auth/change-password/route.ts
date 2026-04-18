import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getClientById, updateClientPasswordById } from "@/lib/db";
import { validatePasswordPolicy } from "@/lib/password-policy";

type AttemptState = {
  count: number;
  windowStart: number;
};

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, AttemptState>();

function isRateLimited(userId: string) {
  const now = Date.now();
  const existing = attempts.get(userId);

  if (!existing) {
    return false;
  }

  if (now - existing.windowStart >= WINDOW_MS) {
    attempts.delete(userId);
    return false;
  }

  return existing.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(userId: string) {
  const now = Date.now();
  const existing = attempts.get(userId);

  if (!existing || now - existing.windowStart >= WINDOW_MS) {
    attempts.set(userId, { count: 1, windowStart: now });
    return;
  }

  attempts.set(userId, { count: existing.count + 1, windowStart: existing.windowStart });
}

function clearAttempts(userId: string) {
  attempts.delete(userId);
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (isRateLimited(userId)) {
      return NextResponse.json(
        { error: "Too many failed attempts. Try again later." },
        { status: 429 }
      );
    }

    const { currentPassword, newPassword, confirmPassword } = await req.json();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "New password and confirmation do not match" }, { status: 400 });
    }

    const policyCheck = validatePasswordPolicy(newPassword);
    if (!policyCheck.valid) {
      return NextResponse.json({ error: policyCheck.message }, { status: 400 });
    }

    const client = await getClientById(userId);
    if (!client?.password_hash) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentPasswordValid = await bcrypt.compare(currentPassword, client.password_hash);
    if (!currentPasswordValid) {
      recordFailedAttempt(userId);
      return NextResponse.json({ error: "Invalid current password" }, { status: 401 });
    }

    const isSamePassword = await bcrypt.compare(newPassword, client.password_hash);
    if (isSamePassword) {
      return NextResponse.json(
        { error: "New password must be different from current password" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updated = await updateClientPasswordById(userId, passwordHash);

    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    clearAttempts(userId);
    console.info("Password changed", {
      actorId: userId,
      targetId: userId,
      flow: "self-service",
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ message: "Password updated successfully" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
