import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import {
  getClientById,
  getClientByEmail,
  updateClientPasswordById,
  updateClientPasswordByEmail,
} from "@/lib/db";
import { isAdminSession } from "@/lib/admin-auth";
import { validatePasswordPolicy } from "@/lib/password-policy";
import { hashPassword, verifyPassword } from "@/lib/password-utils";
import { Resend } from "resend";
import { encryptToken } from "@/lib/crypto";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const contactFromEmail = process.env.CONTACT_FROM_EMAIL;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdminSession(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { client_id, email, newPassword } = await req.json();

    if ((!client_id && !email) || !newPassword) {
      return NextResponse.json(
        { error: "Missing required fields (client_id or email, and newPassword)" },
        { status: 400 }
      );
    }

    const policyCheck = validatePasswordPolicy(newPassword);
    if (!policyCheck.valid) {
      return NextResponse.json({ error: policyCheck.message }, { status: 400 });
    }

    let targetCurrentHash: string | undefined;
    if (client_id) {
      const client = await getClientById(String(client_id));
      if (!client) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      targetCurrentHash = client.password_hash;
    } else if (email) {
      const client = await getClientByEmail(String(email));
      if (!client) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      targetCurrentHash = client.password_hash;
    }

    if (targetCurrentHash) {
      const { valid: isSamePassword } = await verifyPassword(newPassword, targetCurrentHash);
      if (isSamePassword) {
        return NextResponse.json(
          { error: "New password must be different from current password" },
          { status: 400 }
        );
      }
    }

    const passwordHash = await hashPassword(newPassword);
    const updated = client_id
      ? await updateClientPasswordById(String(client_id), passwordHash)
      : await updateClientPasswordByEmail(String(email), passwordHash);

    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.info("Password reset", {
      actorId: session.user.id,
      actorEmail: session.user.email,
      targetId: updated.id,
      targetEmail: updated.email,
      flow: "admin-reset",
      timestamp: new Date().toISOString(),
    });

    // Send security notification email to the client
    if (resend && contactFromEmail && updated.email) {
      try {
        const origin = req.nextUrl.origin;
        const targetUserId = `client:${updated.id}`;
        const secToken = encryptToken(JSON.stringify({ userId: targetUserId, timestamp: Date.now() }));
        const settingsUrl = `${origin}/account-settings?sec_token=${encodeURIComponent(secToken)}`;
        
        await resend.emails.send({
          from: contactFromEmail,
          to: updated.email,
          subject: "Security Alert: Password Changed",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #1e293b;">Security Alert</h2>
              <p>Your password was recently changed by an administrator. If you did not request this, please visit your account settings to choose a new password immediately.</p>
              <div style="margin: 30px 0;">
                <a href="${settingsUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Account Settings</a>
              </div>
              <p style="color: #64748b; font-size: 14px;">This is an automated security notification.</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Failed to send security email in admin-reset:", emailError);
      }
    }

    return NextResponse.json({ message: "Password reset successfully" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
