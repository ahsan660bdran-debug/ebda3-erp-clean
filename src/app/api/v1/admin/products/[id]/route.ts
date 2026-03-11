type ProductCategory = "HANGER" | "IRONING_TABLE";
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

const PatchProductSchema = z
  .object({
    name:      z.string().min(2).max(120).optional(),
    basePrice: z.number().gt(0, { message: "basePrice يجب أن يكون أكبر من 0" }).optional(),
    isActive:  z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "يجب إرسال حقل واحد على الأقل" });

export async function PATCH(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  try {
    let body: unknown;
    try { body = await req.json(); } catch {
      return errorResponse({ error: "INVALID_JSON", message: "Request body غير صالح" }, 400);
    }

    const parsed = PatchProductSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return errorResponse({ error: "VALIDATION_ERROR", message: firstError.message, field: firstError.path.join(".") }, 400);
    }

    const existing = await prisma.product.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!existing) return errorResponse({ error: "PRODUCT_NOT_FOUND", message: "المنتج غير موجود" }, 404);

    const updateData: Record<string, unknown> = {};
    const { name, basePrice, isActive } = parsed.data;
    if (name      !== undefined) updateData.name      = name;
    if (basePrice !== undefined) updateData.basePrice = new Decimal(basePrice);
    if (isActive  !== undefined) updateData.isActive  = isActive;

    const product = await prisma.product.update({
      where: { id: params.id },
      data:  updateData,
      select: { id: true, name: true, category: true, basePrice: true, isActive: true, createdAt: true, updatedAt: true },
    });

    return successResponse(product);
  } catch (err: unknown) {
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2025") {
      return errorResponse({ error: "PRODUCT_NOT_FOUND", message: "المنتج غير موجود" }, 404);
    }
    console.error("[PATCH /products/:id]", err);
    return errorResponse({ error: "INTERNAL_ERROR", message: "حدث خطأ داخلي في السيرفر" }, 500);
  }
}
