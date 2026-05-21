import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { persistApiError } from "@/lib/error-logger";

const resendApiKey = process.env.RESEND_API_KEY;
const contactToEmail = process.env.CONTACT_TO_EMAIL;
const contactFromEmail = process.env.CONTACT_FROM_EMAIL;

const resend = resendApiKey ? new Resend(resendApiKey) : null;

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, businessName, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!resend) {
      console.error("Missing RESEND_API_KEY in environment.");
      await persistApiError({
        route: "/api/contact",
        method: "POST",
        statusCode: 500,
        error: new Error("Missing RESEND_API_KEY in environment."),
      });
      return NextResponse.json(
        { error: "Contact form email is not configured" },
        { status: 500 }
      );
    }

    if (!contactToEmail || !contactFromEmail) {
      console.error("Missing CONTACT_TO_EMAIL or CONTACT_FROM_EMAIL in environment.");
      await persistApiError({
        route: "/api/contact",
        method: "POST",
        statusCode: 500,
        error: new Error("Missing CONTACT_TO_EMAIL or CONTACT_FROM_EMAIL in environment."),
      });
      return NextResponse.json(
        { error: "Contact form email is not fully configured" },
        { status: 500 }
      );
    }

    const toEmail = contactToEmail;
    const fromEmail = contactFromEmail;

    const safeName = escapeHtml(String(name).trim());
    const safeEmail = escapeHtml(String(email).trim());
    const safeBusinessName = escapeHtml(String(businessName || "").trim());
    const safeMessage = escapeHtml(String(message).trim()).replaceAll("\n", "<br>");

    const subject = `New contact form message from ${safeName}`;
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      replyTo: safeEmail,
      subject,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Business Name:</strong> ${safeBusinessName || "Not provided"}</p>
        <p><strong>Message:</strong></p>
        <p>${safeMessage}</p>
      `,
    });

    if (error) {
      const errorName = typeof error.name === "string" ? error.name : "UnknownResendError";
      const errorMessage = typeof error.message === "string" ? error.message : "No message returned by Resend";
      console.error(`Resend error: ${errorName}: ${errorMessage}`);
      await persistApiError({
        route: "/api/contact",
        method: "POST",
        statusCode: 502,
        error: new Error(`${errorName}: ${errorMessage}`),
      });
      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 502 }
      );
    }

    console.log("Contact form submission:", {
      name,
      email,
      businessName,
      message,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      { message: "Message received successfully" },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Contact form error:", error);
    await persistApiError({
      route: "/api/contact",
      method: "POST",
      statusCode: 500,
      error,
    });
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
