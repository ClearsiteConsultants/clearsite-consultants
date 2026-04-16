import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, password, company_name, contact_name, phone, domain_name } =
      await req.json();

    if (!email || !password || !company_name || !contact_name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create client
    const client = await createClient({
      email,
      password_hash,
      company_name,
      contact_name,
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
