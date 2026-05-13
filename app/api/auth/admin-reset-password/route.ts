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

    return NextResponse.json({ message: "Password reset successfully" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
