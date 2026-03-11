import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { successResponse, errorResponse } from "@/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GetCustomersQuerySchema = z.object({
  search:  z.string().max(100).optional(),
  emirate: z.string().max(50).optional(),
  zoneId:  z.string().optional(),
  page:    z.coerce.number().int().positive().default(1),
  limit:   z.coerce.number().int().min(1).max(100).default(20),
});

const CreateCustomerSchema = z.object({
  fullName: z.string({ required_error: "fullName مطلوب" }).min(2).max(100),
  phone:    z.string({ required_error: "phone مطلوب" }).min(1).max(20),
  emirate:  z.string({ required_error: "emirate مطلوب" }).min(1).max(50),
  area:     z.string().max(100).optional().nullable(),
  zoneId:   z.string().optional().nullable(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = GetCustomersQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return errorResponse({ error: "INVALID_QUERY_PARAMS", message: firstError.message, field: firstError.path.join(".") }, 400);
    }

    const { search, emirate, zoneId, page, limit } = parsed.data;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (emirate) where.emirate = { contains: emirate, mode: "insensitive" };
    if (zoneId)  where.zoneId  = zoneId;
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { phone:    { contains: search } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where, skip, take: limit, orderBy: { createdAt: "desc" },
        select: {
          id: true, fullName: true, phone: true, emirate: true, area: true,
          zoneId: true, createdAt: true, updatedAt: true,
          _count: { select: { orders: true } },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    return successResponse({ customers, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("[GET /customers]", err);
    return errorResponse({ error: "INTERNAL_ERROR", message: "حدث خطأ داخلي في السيرفر" }, 500);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown;
    try { body = await req.json(); } catch {
      return errorResponse({ error: "INVALID_JSON", message: "Request body غير صالح" }, 400);
    }

    const parsed = CreateCustomerSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return errorResponse({ error: "VALIDATION_ERROR", message: firstError.message, field: firstError.path.join(".") }, 400);
    }

    const { fullName, phone, emirate, area, zoneId } = parsed.data;
    const customer = await prisma.customer.create({
      data: { fullName, phone, emirate, area: area ?? null, zoneId: zoneId ?? null },
      select: { id: true, fullName: true, phone: true, emirate: true, area: true, zoneId: true, createdAt: true, updatedAt: true },
    });

    return successResponse(customer, 201);
  } catch (err: unknown) {
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
      return errorResponse({ error: "PHONE_DUPLICATE", message: "رقم الهاتف مسجل مسبقاً", field: "phone" }, 409);
    }
    console.error("[POST /customers]", err);
    return errorResponse({ error: "INTERNAL_ERROR", message: "حدث خطأ داخلي في السيرفر" }, 500);
  }
}
