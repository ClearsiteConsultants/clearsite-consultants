import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getClientById, updateClientPasswordById, getUserById, updateAdminPasswordById } from "@/lib/db";
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

function parseSessionUserId(sessionUserId: string): { type: "client" | "admin"; id: string } | null {
  if (sessionUserId.startsWith("client:")) {
    const id = sessionUserId.slice("client:".length);
    if (!id) return null;
    return { type: "client", id };
  }
  if (sessionUserId.startsWith("user:")) {
    const id = sessionUserId.slice("user:".length);
    if (!id) return null;
    return { type: "admin", id };
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const rawUserId = session?.user?.id;

    if (!rawUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (isRateLimited(rawUserId)) {
      return NextResponse.json(
        { error: "Too many failed attempts. Try again later." },
        { status: 429 }
      );
    }

    const parsed = parseSessionUserId(rawUserId as string);
    if (!parsed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Fetch user record and verify current password against the correct table.
    let passwordHash: string;
    if (parsed.type === "client") {
      const client = await getClientById(parsed.id);
      if (!client?.password_hash) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      passwordHash = client.password_hash as string;
    } else {
      const adminUser = await getUserById(parsed.id);
      if (!adminUser?.password_hash) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      passwordHash = adminUser.password_hash as string;
    }

    const currentPasswordValid = await bcrypt.compare(currentPassword, passwordHash);
    if (!currentPasswordValid) {
      recordFailedAttempt(rawUserId as string);
      return NextResponse.json({ error: "Invalid current password" }, { status: 401 });
    }

    const isSamePassword = await bcrypt.compare(newPassword, passwordHash);
    if (isSamePassword) {
      return NextResponse.json(
        { error: "New password must be different from current password" },
        { status: 400 }
      );
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    let updated;
    if (parsed.type === "client") {
      updated = await updateClientPasswordById(parsed.id, newPasswordHash);
    } else {
      updated = await updateAdminPasswordById(parsed.id, newPasswordHash);
    }

    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    clearAttempts(rawUserId as string);
    console.info("Password changed", {
      actorId: rawUserId,
      targetId: rawUserId,
      flow: "self-service",
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ message: "Password updated successfully" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
