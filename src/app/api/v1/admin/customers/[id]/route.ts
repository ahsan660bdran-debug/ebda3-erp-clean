import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { successResponse, errorResponse } from "@/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext { params: { id: string } }

const PatchCustomerSchema = z
  .object({
    fullName: z.string().min(2).max(100).optional(),
    phone:    z.string().min(1).max(20).optional(),
    emirate:  z.string().min(1).max(50).optional(),
    area:     z.string().max(100).nullable().optional(),
    zoneId:   z.string().nullable().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "يجب إرسال حقل واحد على الأقل" });

export async function GET(_req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
      select: {
        id: true, fullName: true, phone: true, emirate: true, area: true, zoneId: true, createdAt: true, updatedAt: true,
        orders: { orderBy: { createdAt: "desc" }, take: 20, select: { id: true, orderNumber: true, status: true, scheduledAt: true, total: true } },
        _count: { select: { orders: true } },
      },
    });
    if (!customer) return errorResponse({ error: "CUSTOMER_NOT_FOUND", message: "العميل غير موجود" }, 404);
    return successResponse(customer);
  } catch (err) {
    console.error("[GET /customers/:id]", err);
    return errorResponse({ error: "INTERNAL_ERROR", message: "حدث خطأ داخلي في السيرفر" }, 500);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  try {
    let body: unknown;
    try { body = await req.json(); } catch {
      return errorResponse({ error: "INVALID_JSON", message: "Request body غير صالح" }, 400);
    }

    const parsed = PatchCustomerSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return errorResponse({ error: "VALIDATION_ERROR", message: firstError.message, field: firstError.path.join(".") }, 400);
    }

    const existing = await prisma.customer.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!existing) return errorResponse({ error: "CUSTOMER_NOT_FOUND", message: "العميل غير موجود" }, 404);

    const updateData: Record<string, unknown> = {};
    const { fullName, phone, emirate, area, zoneId } = parsed.data;
    if (fullName !== undefined) updateData.fullName = fullName;
    if (phone    !== undefined) updateData.phone    = phone;
    if (emirate  !== undefined) updateData.emirate  = emirate;
    if (area     !== undefined) updateData.area     = area;
    if (zoneId   !== undefined) updateData.zone     = zoneId ? { connect: { id: zoneId } } : { disconnect: true };

    const customer = await prisma.customer.update({
      where: { id: params.id },
      data:  updateData,
      select: { id: true, fullName: true, phone: true, emirate: true, area: true, zoneId: true, updatedAt: true },
    });

    return successResponse(customer);
  } catch (err: unknown) {
    if (err instanceof PrismaClientKnownRequestError) {
      if (err.code === "P2002") return errorResponse({ error: "PHONE_DUPLICATE", message: "رقم الهاتف مسجل مسبقاً", field: "phone" }, 409);
      if (err.code === "P2025") return errorResponse({ error: "CUSTOMER_NOT_FOUND", message: "العميل غير موجود" }, 404);
    }
    console.error("[PATCH /customers/:id]", err);
    return errorResponse({ error: "INTERNAL_ERROR", message: "حدث خطأ داخلي في السيرفر" }, 500);
  }
}
