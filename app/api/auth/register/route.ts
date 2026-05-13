import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db";
import { hashPassword } from "@/lib/password-utils";
import { validatePasswordPolicy } from "@/lib/password-policy";

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

    const policyCheck = validatePasswordPolicy(password);
    if (!policyCheck.valid) {
      return NextResponse.json(
        { error: policyCheck.message },
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
