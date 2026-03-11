import { NextResponse } from "next/server";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export interface AppError {
  error: string;
  message: string;
  field?: string;
  status: number;
}

// ─────────────────────────────────────────
// TYPE GUARD
// ─────────────────────────────────────────

export function isAppError(err: unknown): err is AppError {
  return (
    typeof err === "object" &&
    err !== null &&
    "error" in err &&
    "message" in err &&
    "status" in err &&
    typeof (err as AppError).error === "string" &&
    typeof (err as AppError).message === "string" &&
    typeof (err as AppError).status === "number"
  );
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function errorResponse(
  body: { error: string; message: string; field?: string },
  status: number
): NextResponse {
  return NextResponse.json(body, { status });
}
