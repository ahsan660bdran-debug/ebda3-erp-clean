type AssignmentMode = "FIXED" | "ROTATION" | "MANUAL";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { successResponse, errorResponse } from "@/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateZoneSchema = z.object({
  name:              z.string().min(1).max(100),
  assignmentMode:    z.enum(["FIXED", "ROTATION", "MANUAL"]).optional().default("MANUAL"),
  autoAssignEnabled: z.boolean().optional().default(true),
  fixedAgentId:      z.string().optional().nullable(),
});

export async function GET(): Promise<NextResponse> {
  try {
    const zones = await prisma.zone.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, assignmentMode: true, autoAssignEnabled: true,
        fixedAgentId: true, createdAt: true, updatedAt: true,
        _count: { select: { customers: true, orders: true } },
        fixedAgent: { select: { id: true, fullName: true } },
        agents: {
          where: { isActive: true }, orderBy: { rotationOrder: "asc" },
          select: { agentId: true, rotationOrder: true, isActive: true, agent: { select: { fullName: true } } },
        },
      },
    });
    return successResponse(zones);
  } catch (err) {
    console.error("[GET /zones]", err);
    return errorResponse({ error: "INTERNAL_ERROR", message: "حدث خطأ داخلي في السيرفر" }, 500);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown;
    try { body = await req.json(); } catch {
      return errorResponse({ error: "INVALID_JSON", message: "Request body غير صالح" }, 400);
    }

    const parsed = CreateZoneSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return errorResponse({ error: "VALIDATION_ERROR", message: firstError.message, field: firstError.path.join(".") }, 400);
    }

    const { name, assignmentMode, autoAssignEnabled, fixedAgentId } = parsed.data;
    const zone = await prisma.zone.create({
      data: {
        name,
        assignmentMode: assignmentMode as AssignmentMode,
        autoAssignEnabled,
        fixedAgentId: fixedAgentId ?? null,
      },
      select: { id: true, name: true, assignmentMode: true, autoAssignEnabled: true, fixedAgentId: true, createdAt: true, updatedAt: true },
    });

    return successResponse(zone, 201);
  } catch (err: unknown) {
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
      return errorResponse({ error: "ZONE_DUPLICATE", message: "اسم المنطقة مسجل مسبقاً", field: "name" }, 409);
    }
    console.error("[POST /zones]", err);
    return errorResponse({ error: "INTERNAL_ERROR", message: "حدث خطأ داخلي في السيرفر" }, 500);
  }
}
