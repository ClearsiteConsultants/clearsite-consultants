import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { name, email, businessName, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Here you would integrate with your email service (SendGrid, Nodemailer, etc.)
    // For now, just log it
    console.log("Contact form submission:", {
      name,
      email,
      businessName,
      message,
      timestamp: new Date().toISOString(),
    });

    // In production, send email here
    // await sendEmail({...})

    return NextResponse.json(
      { message: "Message received successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
