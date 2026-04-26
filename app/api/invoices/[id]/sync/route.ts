import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { syncInvoiceToQuickBooks } from "@/lib/quickbooks-sync";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_: NextRequest, { params }: Params) {
  const session = await auth();
  const userType = (session?.user as { user_type?: string } | undefined)?.user_type;
  if (!session?.user?.id || userType !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing invoice id" }, { status: 400 });
  }

  try {
    const invoice = await syncInvoiceToQuickBooks(id);
    return NextResponse.json(invoice);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "QuickBooks sync failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
