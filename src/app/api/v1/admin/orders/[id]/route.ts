type DiscountType = "FIXED" | "PERCENT";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

import { Decimal } from "@prisma/client/runtime/library";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { successResponse, errorResponse } from "@/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext { params: { id: string } }

const ORDER_INCLUDE = {
  customer: { select: { id: true, fullName: true, phone: true, emirate: true, area: true } },
  agent:    { select: { id: true, fullName: true, phone: true, emirate: true } },
  items: {
    include: {
      product: { select: { id: true, name: true, category: true, basePrice: true } },
    },
  },
} as const;

function calculateAmounts(
  subtotal: Decimal,
  discountType?: DiscountType | null,
  discountValue?: Decimal | null
): { discountAmount: Decimal; total: Decimal } {
  const ZERO = new Decimal(0);
  if (!discountType || !discountValue || discountValue.lte(ZERO)) {
    return { discountAmount: ZERO, total: subtotal };
  }
  const isFixed = discountType === "FIXED";
  let discountAmount: Decimal;
  if (isFixed) {
    discountAmount = Decimal.min(discountValue, subtotal);
  } else {
    const calc = subtotal.mul(discountValue.div(new Decimal(100)));
    discountAmount = Decimal.min(calc, subtotal);
  }
  return { discountAmount, total: subtotal.sub(discountAmount) };
}

const PatchOrderSchema = z
  .object({
    scheduledAt:   z.string().nullable().optional(),
    discountType:  z.enum(["FIXED", "PERCENT"]).nullable().optional(),
    discountValue: z.number().positive().nullable().optional(),
    notes:         z.string().max(1000).nullable().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "يجب إرسال حقل واحد على الأقل",
  });

export async function GET(_req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  try {
    const order = await prisma.order.findUnique({ where: { id: params.id }, include: ORDER_INCLUDE });
    if (!order) return errorResponse({ error: "ORDER_NOT_FOUND", message: "الطلبية غير موجودة" }, 404);
    return successResponse(order);
  } catch (err) {
    console.error("[GET /orders/:id]", err);
    return errorResponse({ error: "INTERNAL_ERROR", message: "حدث خطأ داخلي في السيرفر" }, 500);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  try {
    let body: unknown;
    try { body = await req.json(); } catch {
      return errorResponse({ error: "INVALID_JSON", message: "Request body غير صالح" }, 400);
    }

    const parsed = PatchOrderSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return errorResponse({ error: "VALIDATION_ERROR", message: firstError.message, field: firstError.path.join(".") }, 400);
    }

    const existing = await prisma.order.findUnique({
      where:  { id: params.id },
      select: { subtotal: true, discountType: true, discountValue: true },
    });
    if (!existing) return errorResponse({ error: "ORDER_NOT_FOUND", message: "الطلبية غير موجودة" }, 404);

    const { scheduledAt, discountType, discountValue, notes } = parsed.data;

    const newDiscountType = discountType !== undefined
      ? (discountType as DiscountType | null)
      : (existing.discountType as DiscountType | null);

    const newDiscountValue = discountValue !== undefined
      ? (discountValue ? new Decimal(discountValue) : null)
      : (existing.discountValue as Decimal | null);

    const subtotal = existing.subtotal as Decimal;
    const { discountAmount, total } = calculateAmounts(subtotal, newDiscountType, newDiscountValue);

    const updateData: Record<string, unknown> = {
      discountType:  newDiscountType,
      discountValue: newDiscountValue,
      discountAmount,
      total,
    };
    if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (notes       !== undefined) updateData.notes       = notes;

    const order = await prisma.order.update({
      where: { id: params.id },
      data:  updateData,
      include: ORDER_INCLUDE,
    });

    return successResponse(order);
  } catch (err: unknown) {
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2025") {
      return errorResponse({ error: "ORDER_NOT_FOUND", message: "الطلبية غير موجودة" }, 404);
    }
    console.error("[PATCH /orders/:id]", err);
    return errorResponse({ error: "INTERNAL_ERROR", message: "حدث خطأ داخلي في السيرفر" }, 500);
  }
}
