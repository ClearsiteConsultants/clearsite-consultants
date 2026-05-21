import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { deleteErrorLogsByIds, deleteErrorLogsOlderThanDays, listErrorLogs } from "@/lib/db";

function isAdmin(userType: string | undefined) {
  return userType === "admin";
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userType = (session?.user as { user_type?: string } | undefined)?.user_type;

    if (!session?.user?.id || !isAdmin(userType)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "50");
    const level = searchParams.get("level") || undefined;
    const query = searchParams.get("query") || undefined;

    const result = await listErrorLogs({ page, pageSize, level, query });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    const userType = (session?.user as { user_type?: string } | undefined)?.user_type;

    if (!session?.user?.id || !isAdmin(userType)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json() as {
      ids?: unknown;
      deleteOlderThanDays?: unknown;
    };

    const ids = Array.isArray(body.ids)
      ? body.ids.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
      : [];

    const deleteOlderThanDays =
      typeof body.deleteOlderThanDays === "number" && Number.isFinite(body.deleteOlderThanDays)
        ? Math.floor(body.deleteOlderThanDays)
        : null;

    if (ids.length === 0 && !deleteOlderThanDays) {
      return NextResponse.json(
        { error: "Provide ids or deleteOlderThanDays." },
        { status: 400 }
      );
    }

    const deletedByIds = ids.length ? await deleteErrorLogsByIds(ids) : 0;
    const deletedOlderThanDays = deleteOlderThanDays
      ? await deleteErrorLogsOlderThanDays(deleteOlderThanDays)
      : 0;

    return NextResponse.json({
      deletedByIds,
      deletedOlderThanDays,
      totalDeleted: deletedByIds + deletedOlderThanDays,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
