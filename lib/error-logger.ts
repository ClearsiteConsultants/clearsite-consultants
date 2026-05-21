import { createErrorLog } from "@/lib/db";

type Serializable = string | number | boolean | null | Serializable[] | { [key: string]: Serializable };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeValue(value: unknown, depth = 0): Serializable {
  if (depth > 4) return "[truncated]";
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  }
  if (isRecord(value)) {
    const output: { [key: string]: Serializable } = {};
    for (const [key, raw] of Object.entries(value)) {
      if (/password|token|secret|authorization|cookie|api[-_]?key/i.test(key)) {
        output[key] = "[redacted]";
        continue;
      }
      output[key] = sanitizeValue(raw, depth + 1);
    }
    return output;
  }
  return String(value);
}

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || "Unknown error",
      stack: error.stack || null,
    };
  }

  return {
    name: "UnknownError",
    message: typeof error === "string" ? error : "Unknown error",
    stack: null,
  };
}

export async function persistApiError(input: {
  route: string;
  method: string;
  statusCode?: number;
  userId?: string | null;
  userType?: string | null;
  error: unknown;
  metadata?: Record<string, unknown>;
}) {
  const details = errorDetails(input.error);

  try {
    await createErrorLog({
      level: "error",
      route: input.route,
      method: input.method,
      statusCode: input.statusCode ?? 500,
      errorName: details.name,
      errorMessage: details.message,
      errorStack: details.stack,
      userId: input.userId ?? null,
      userType: input.userType ?? null,
      metadata: input.metadata ? sanitizeValue(input.metadata) : null,
    });
  } catch (loggingError) {
    // Avoid throwing from the logger because route handlers must still return responses.
    console.error("Failed to persist API error log", loggingError);
  }
}
