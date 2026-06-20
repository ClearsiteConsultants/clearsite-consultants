import { NextRequest, NextResponse } from "next/server";
import { createClient, isEmailInUse } from "@/lib/db";
import { hashPassword } from "@/lib/password-utils";
import { validatePasswordPolicy } from "@/lib/password-policy";
import { ACCOUNT_INFO_FIELD_LIMITS } from "@/lib/field-limits";

export async function POST(req: NextRequest) {
  try {
    const { email, password, company_name, first_name, last_name, phone, domain_name } =
      await req.json();

    if (!email || !password || !company_name || !first_name || !last_name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Character limit checks
    if (email.length > ACCOUNT_INFO_FIELD_LIMITS.email) {
      return NextResponse.json({ error: "Email exceeds character limit." }, { status: 400 });
    }
    if (company_name.length > ACCOUNT_INFO_FIELD_LIMITS.company_name) {
      return NextResponse.json({ error: "Company Name exceeds character limit." }, { status: 400 });
    }
    if (phone && phone.length > ACCOUNT_INFO_FIELD_LIMITS.phone) {
      return NextResponse.json({ error: "Phone Number exceeds character limit." }, { status: 400 });
    }

    const policyCheck = validatePasswordPolicy(password);
    if (!policyCheck.valid) {
      return NextResponse.json(
        { error: policyCheck.message },
        { status: 400 }
      );
    }

    // New check: check if email is already in use by a client or admin
    const emailTaken = await isEmailInUse(email);
    if (emailTaken) {
      return NextResponse.json(
        { error: "This email address is already in use." },
        { status: 400 }
      );
    }

    const password_hash = await hashPassword(password);

    const client = await createClient({
      email,
      password_hash,
      company_name,
      first_name,
      last_name,
      phone,
      domain_name,
    });

    return NextResponse.json(
      { message: "Client created successfully", client },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
