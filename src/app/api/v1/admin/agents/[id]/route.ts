import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { successResponse, errorResponse } from "@/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext { params: { id: string } }

const PatchAgentSchema = z
  .object({
    fullName: z.string().min(2).max(100).optional(),
    phone:    z.string().min(1).max(20).optional(),
    email:    z.string().email().nullable().optional(),
    emirate:  z.string().max(50).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "يجب إرسال حقل واحد على الأقل" });

export async function GET(_req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: params.id },
      select: {
        id: true, fullName: true, phone: true, email: true, emirate: true, isActive: true,
        createdAt: true, updatedAt: true,
        orders: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, orderNumber: true, status: true, scheduledAt: true, total: true, customer: { select: { fullName: true, phone: true } } },
        },
        _count: { select: { orders: true } },
      },
    });
    if (!agent) return errorResponse({ error: "AGENT_NOT_FOUND", message: "المندوب غير موجود" }, 404);
    return successResponse(agent);
  } catch (err) {
    console.error("[GET /agents/:id]", err);
    return errorResponse({ error: "INTERNAL_ERROR", message: "حدث خطأ داخلي في السيرفر" }, 500);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  try {
    let body: unknown;
    try { body = await req.json(); } catch {
      return errorResponse({ error: "INVALID_JSON", message: "Request body غير صالح" }, 400);
    }

    const parsed = PatchAgentSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return errorResponse({ error: "VALIDATION_ERROR", message: firstError.message, field: firstError.path.join(".") }, 400);
    }

    const existing = await prisma.agent.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!existing) return errorResponse({ error: "AGENT_NOT_FOUND", message: "المندوب غير موجود" }, 404);

    const updateData: Record<string, unknown> = {};
    const { fullName, phone, email, emirate, isActive } = parsed.data;
    if (fullName !== undefined) updateData.fullName = fullName;
    if (phone    !== undefined) updateData.phone    = phone;
    if (email    !== undefined) updateData.email    = email;
    if (emirate  !== undefined) updateData.emirate  = emirate;
    if (isActive !== undefined) updateData.isActive = isActive;

    const agent = await prisma.agent.update({
      where: { id: params.id },
      data:  updateData,
      select: { id: true, fullName: true, phone: true, email: true, emirate: true, isActive: true, updatedAt: true },
    });

    return successResponse(agent);
  } catch (err: unknown) {
    if (err instanceof PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        const field = (err.meta?.target as string[] | undefined)?.[0];
        const msg   = field === "email" ? "البريد الإلكتروني مسجل مسبقاً" : "رقم الهاتف مسجل مسبقاً";
        return errorResponse({ error: "DUPLICATE_FIELD", message: msg, field: field ?? "phone" }, 409);
      }
      if (err.code === "P2025") return errorResponse({ error: "AGENT_NOT_FOUND", message: "المندوب غير موجود" }, 404);
    }
    console.error("[PATCH /agents/:id]", err);
    return errorResponse({ error: "INTERNAL_ERROR", message: "حدث خطأ داخلي في السيرفر" }, 500);
  }
}
