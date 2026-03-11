import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { successResponse, errorResponse } from "@/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GetAgentsQuerySchema = z.object({
  isActive: z.enum(["true", "false"]).optional().transform((v) => (v === undefined ? undefined : v === "true")),
  emirate:  z.string().max(50).optional(),
  search:   z.string().max(100).optional(),
});

const CreateAgentSchema = z.object({
  fullName: z.string({ required_error: "fullName مطلوب" }).min(2).max(100),
  phone:    z.string({ required_error: "phone مطلوب" }).min(1).max(20),
  email:    z.string().email({ message: "البريد الإلكتروني غير صالح" }).optional().nullable(),
  emirate:  z.string().max(50).optional().nullable(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = GetAgentsQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return errorResponse({ error: "INVALID_QUERY_PARAMS", message: firstError.message, field: firstError.path.join(".") }, 400);
    }

    const where: Record<string, unknown> = {};
    if (parsed.data.isActive !== undefined) where.isActive = parsed.data.isActive;
    if (parsed.data.emirate)  where.emirate = { contains: parsed.data.emirate, mode: "insensitive" };
    if (parsed.data.search) {
      where.OR = [
        { fullName: { contains: parsed.data.search, mode: "insensitive" } },
        { phone:    { contains: parsed.data.search } },
      ];
    }

    const agents = await prisma.agent.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: {
        id: true, fullName: true, phone: true, email: true, emirate: true, isActive: true,
        createdAt: true, updatedAt: true,
        _count: { select: { orders: true } },
      },
    });

    return successResponse(agents);
  } catch (err) {
    console.error("[GET /agents]", err);
    return errorResponse({ error: "INTERNAL_ERROR", message: "حدث خطأ داخلي في السيرفر" }, 500);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown;
    try { body = await req.json(); } catch {
      return errorResponse({ error: "INVALID_JSON", message: "Request body غير صالح" }, 400);
    }

    const parsed = CreateAgentSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return errorResponse({ error: "VALIDATION_ERROR", message: firstError.message, field: firstError.path.join(".") }, 400);
    }

    const { fullName, phone, email, emirate } = parsed.data;
    const agent = await prisma.agent.create({
      data: { fullName, phone, email: email ?? null, emirate: emirate ?? null, isActive: true },
      select: { id: true, fullName: true, phone: true, email: true, emirate: true, isActive: true, createdAt: true, updatedAt: true },
    });

    return successResponse(agent, 201);
  } catch (err: unknown) {
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
      const field = (err.meta?.target as string[] | undefined)?.[0];
      const msg   = field === "email" ? "البريد الإلكتروني مسجل مسبقاً" : "رقم الهاتف مسجل مسبقاً";
      return errorResponse({ error: "DUPLICATE_FIELD", message: msg, field: field ?? "phone" }, 409);
    }
    console.error("[POST /agents]", err);
    return errorResponse({ error: "INTERNAL_ERROR", message: "حدث خطأ داخلي في السيرفر" }, 500);
  }
}
