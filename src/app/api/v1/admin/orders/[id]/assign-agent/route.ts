import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { successResponse, errorResponse } from "@/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext { params: { id: string } }

const AssignAgentSchema = z.object({
  agentId: z.string().cuid({ message: "agentId غير صالح" }).nullable(),
});

export async function PATCH(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  try {
    let body: unknown;
    try { body = await req.json(); } catch {
      return errorResponse({ error: "INVALID_JSON", message: "Request body غير صالح" }, 400);
    }

    const parsed = AssignAgentSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return errorResponse(
        { error: "VALIDATION_ERROR", message: firstError.message, field: firstError.path.join(".") },
        400
      );
    }

    const { agentId } = parsed.data;

    const existing = await prisma.order.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!existing) return errorResponse({ error: "ORDER_NOT_FOUND", message: "الطلبية غير موجودة" }, 404);

    if (agentId) {
      const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { isActive: true } });
      if (!agent)          return errorResponse({ error: "AGENT_NOT_FOUND",  message: "المندوب غير موجود", field: "agentId" }, 404);
      if (!agent.isActive) return errorResponse({ error: "AGENT_INACTIVE",   message: "المندوب غير نشط",  field: "agentId" }, 422);
    }

    const order = await prisma.order.update({
      where:  { id: params.id },
      data:   { agentId },
      select: { id: true, agentId: true, updatedAt: true },
    });

    return successResponse(order);
  } catch (err: unknown) {
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2025") {
      return errorResponse({ error: "ORDER_NOT_FOUND", message: "الطلبية غير موجودة" }, 404);
    }
    console.error("[PATCH /orders/:id/assign-agent]", err);
    return errorResponse({ error: "INTERNAL_ERROR", message: "حدث خطأ داخلي في السيرفر" }, 500);
  }
}
