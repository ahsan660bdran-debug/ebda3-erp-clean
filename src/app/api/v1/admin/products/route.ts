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

const GetProductsQuerySchema = z.object({
  category: z.enum(["HANGER", "IRONING_TABLE"]).optional(),
  isActive: z.enum(["true", "false"]).optional().transform((v) => (v === undefined ? undefined : v === "true")),
});

const CreateProductSchema = z.object({
  name:      z.string().min(2).max(120),
  category:  z.enum(["HANGER", "IRONING_TABLE"]),
  basePrice: z.number().gt(0),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = GetProductsQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return errorResponse({ error: "INVALID_QUERY_PARAMS", message: firstError.message, field: firstError.path.join(".") }, 400);
    }

    const where: Record<string, unknown> = {};
    if (parsed.data.category !== undefined) where.category = parsed.data.category as ProductCategory;
    if (parsed.data.isActive !== undefined) where.isActive = parsed.data.isActive;

    const products = await prisma.product.findMany({
      where, orderBy: { createdAt: "asc" },
      select: { id: true, name: true, category: true, basePrice: true, isActive: true, createdAt: true, updatedAt: true },
    });

    return successResponse(products);
  } catch (err) {
    console.error("[GET /products]", err);
    return errorResponse({ error: "INTERNAL_ERROR", message: "حدث خطأ داخلي في السيرفر" }, 500);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown;
    try { body = await req.json(); } catch {
      return errorResponse({ error: "INVALID_JSON", message: "Request body غير صالح" }, 400);
    }

    const parsed = CreateProductSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return errorResponse({ error: "VALIDATION_ERROR", message: firstError.message, field: firstError.path.join(".") }, 400);
    }

    const { name, category, basePrice } = parsed.data;
    const product = await prisma.product.create({
      data: { name, category: category as ProductCategory, basePrice: new Decimal(basePrice), isActive: true },
      select: { id: true, name: true, category: true, basePrice: true, isActive: true, createdAt: true, updatedAt: true },
    });

    return successResponse(product, 201);
  } catch (err: unknown) {
    console.error("[POST /products]", err);
    return errorResponse({ error: "INTERNAL_ERROR", message: "حدث خطأ داخلي في السيرفر" }, 500);
  }
}
