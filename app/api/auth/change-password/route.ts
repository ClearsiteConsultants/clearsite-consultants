import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getClientById, updateClientPasswordById, getUserById, updateAdminPasswordById } from "@/lib/db";
import { validatePasswordPolicy } from "@/lib/password-policy";
import { hashPassword, verifyPassword } from "@/lib/password-utils";
import { Resend } from "resend";
import { persistApiError } from "@/lib/error-logger";
import { encryptToken, decryptToken } from "@/lib/crypto";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const contactFromEmail = process.env.CONTACT_FROM_EMAIL;

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

    const { currentPassword, newPassword, confirmPassword, sec_token } = await req.json();

    if (!newPassword || !confirmPassword || (!currentPassword && !sec_token)) {
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

    let bypassAuth = false;
    if (sec_token) {
      try {
        const decrypted = decryptToken(sec_token);
        const tokenData = JSON.parse(decrypted);
        // Valid if userId matches and token is less than 24 hours old
        if (tokenData.userId === rawUserId && Date.now() - tokenData.timestamp < 24 * 60 * 60 * 1000) {
          bypassAuth = true;
        }
      } catch (e) {
        console.error("Invalid sec_token in change-password:", e);
      }
    }

    if (!bypassAuth) {
      if (!currentPassword) {
        return NextResponse.json({ error: "Current password is required" }, { status: 400 });
      }
      const { valid: currentPasswordValid } = await verifyPassword(currentPassword, passwordHash);
      if (!currentPasswordValid) {
        recordFailedAttempt(rawUserId as string);
        return NextResponse.json({ error: "Invalid current password" }, { status: 401 });
      }
    }

    const { valid: isSamePassword } = await verifyPassword(newPassword, passwordHash);
    if (isSamePassword) {
      return NextResponse.json(
        { error: "New password must be different from current password" },
        { status: 400 }
      );
    }

    const newPasswordHash = await hashPassword(newPassword);

    let updated;
    if (parsed.type === "client") {
      updated = await updateClientPasswordById(parsed.id, newPasswordHash);
    } else {
      updated = await updateAdminPasswordById(parsed.id, newPasswordHash);
    }

    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Send security notification email via Resend
    if (resend && contactFromEmail && session?.user?.email) {
      try {
        const origin = req.nextUrl.origin;
        const secToken = encryptToken(JSON.stringify({ userId: rawUserId, timestamp: Date.now() }));
        const settingsUrl = `${origin}/account-settings?sec_token=${encodeURIComponent(secToken)}`;
        
        await resend.emails.send({
          from: contactFromEmail,
          to: session.user.email,
          subject: "Security Alert: Password Changed",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #1e293b;">Security Alert</h2>
              <p>Your password was recently changed. If you did not perform this action, please visit your account settings to reset it again immediately.</p>
              <div style="margin: 30px 0;">
                <a href="${settingsUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Account Settings</a>
              </div>
              <p style="color: #64748b; font-size: 14px;">This is an automated security notification.</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Failed to send security email:", emailError);
        await persistApiError({
          route: "/api/auth/change-password",
          method: "POST",
          statusCode: 500,
          error: emailError instanceof Error ? emailError : new Error("Failed to send security email"),
        });
        // We don't fail the password change if the email fails, but we logged it.
      }
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
