type OrderStatus = "SCHEDULED" | "INSTALLED" | "UNINSTALLED";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { successResponse, errorResponse } from "@/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext { params: { id: string } }

const PatchStatusSchema = z.object({
  status:      z.enum(["SCHEDULED", "INSTALLED", "UNINSTALLED"], { required_error: "status مطلوب" }),
  scheduledAt: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  try {
    let body: unknown;
    try { body = await req.json(); } catch {
      return errorResponse({ error: "INVALID_JSON", message: "Request body غير صالح" }, 400);
    }

    const parsed = PatchStatusSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return errorResponse({ error: "VALIDATION_ERROR", message: firstError.message, field: firstError.path.join(".") }, 400);
    }

    const { status, scheduledAt } = parsed.data;
    const orderStatus = status as OrderStatus;

    const existing = await prisma.order.findUnique({
      where:  { id: params.id },
      select: { scheduledAt: true },
    });
    if (!existing) return errorResponse({ error: "ORDER_NOT_FOUND", message: "الطلبية غير موجودة" }, 404);

    const updateData: Record<string, unknown> = { status: orderStatus };

    if (status === "SCHEDULED") {
      if (scheduledAt) {
        updateData.scheduledAt = new Date(scheduledAt);
      } else if (!existing.scheduledAt) {
        return errorResponse(
          { error: "SCHEDULED_AT_REQUIRED", message: "scheduledAt مطلوب عند تحديد الموعد", field: "scheduledAt" },
          400
        );
      }
      updateData.installedAt = null;
    } else if (status === "INSTALLED") {
      updateData.installedAt = new Date();
    } else if (status === "UNINSTALLED") {
      updateData.installedAt = null;
    }

    const order = await prisma.order.update({
      where:  { id: params.id },
      data:   updateData,
      select: { id: true, status: true, scheduledAt: true, installedAt: true, updatedAt: true },
    });

    return successResponse(order);
  } catch (err: unknown) {
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2025") {
      return errorResponse({ error: "ORDER_NOT_FOUND", message: "الطلبية غير موجودة" }, 404);
    }
    console.error("[PATCH /orders/:id/status]", err);
    return errorResponse({ error: "INTERNAL_ERROR", message: "حدث خطأ داخلي في السيرفر" }, 500);
  }
}
