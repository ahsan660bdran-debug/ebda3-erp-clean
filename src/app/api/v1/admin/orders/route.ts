// Local string literal types — compatible with generated Prisma enums
type OrderStatus = "SCHEDULED" | "INSTALLED" | "UNINSTALLED";
type DiscountType = "FIXED" | "PERCENT";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

import { Decimal } from "@prisma/client/runtime/library";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import type { PrismaClient } from "@prisma/client";
import { resolveAgentForZone } from "@/lib/zone-assignment";
import { successResponse, errorResponse } from "@/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

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

async function generateOrderNumber(): Promise<string> {
  const year  = new Date().getFullYear();
  const count = await prisma.order.count();
  return `EB-${year}-${String(count + 1).padStart(4, "0")}`;
}

// Use z.enum to avoid depending on generated Prisma types
const GetOrdersQuerySchema = z.object({
  status:     z.enum(["SCHEDULED", "INSTALLED", "UNINSTALLED"]).optional(),
  agentId:    z.string().optional(),
  customerId: z.string().optional(),
  zoneId:     z.string().optional(),
  dateFrom:   z.string().optional(),
  dateTo:     z.string().optional(),
  page:       z.coerce.number().int().positive().default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
});

const OrderItemInputSchema = z.object({
  productId: z.string(),
  qty:       z.number().int().positive(),
});

const CreateOrderSchema = z.object({
  customerId:    z.string(),
  agentId:       z.string().optional().nullable(),
  zoneId:        z.string().optional().nullable(),
  scheduledAt:   z.string().optional().nullable(),
  discountType:  z.enum(["FIXED", "PERCENT"]).optional().nullable(),
  discountValue: z.number().positive().optional().nullable(),
  notes:         z.string().max(1000).optional().nullable(),
  items:         z.array(OrderItemInputSchema).min(1),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = GetOrdersQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return errorResponse({ error: "INVALID_QUERY_PARAMS", message: firstError.message, field: firstError.path.join(".") }, 400);
    }

    const { status, agentId, customerId, zoneId, dateFrom, dateTo, page, limit } = parsed.data;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status)     where.status     = status as OrderStatus;
    if (agentId)    where.agentId    = agentId;
    if (customerId) where.customerId = customerId;
    if (zoneId)     where.zoneId     = zoneId;
    if (dateFrom || dateTo) {
      where.scheduledAt = {};
      if (dateFrom) (where.scheduledAt as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo)   (where.scheduledAt as Record<string, unknown>).lte = new Date(dateTo);
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" }, include: ORDER_INCLUDE }),
      prisma.order.count({ where }),
    ]);

    return successResponse({ orders, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("[GET /orders]", err);
    return errorResponse({ error: "INTERNAL_ERROR", message: "حدث خطأ داخلي في السيرفر" }, 500);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown;
    try { body = await req.json(); } catch {
      return errorResponse({ error: "INVALID_JSON", message: "Request body غير صالح" }, 400);
    }

    const parsed = CreateOrderSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return errorResponse({ error: "VALIDATION_ERROR", message: firstError.message, field: firstError.path.join(".") }, 400);
    }

    const {
      customerId,
      agentId,
      zoneId,
      scheduledAt,
      discountType,
      discountValue,
      notes,
      items,
    } = parsed.data;

    const order = await prisma.$transaction(async (tx: TransactionClient) => {
      const customer = await tx.customer.findUnique({
        where:  { id: customerId },
        select: { id: true, zoneId: true },
      });
      if (!customer) throw { error: "CUSTOMER_NOT_FOUND", message: "العميل غير موجود", status: 404 };

      const resolvedZoneId: string | null = (zoneId ?? (customer.zoneId as string | null) ?? null);

      let resolvedAgentId: string | null = agentId ?? null;
      if (!resolvedAgentId && resolvedZoneId) {
        resolvedAgentId = await resolveAgentForZone(tx, resolvedZoneId);
      }

      const productIds = items.map((i) => i.productId);
      const products   = await tx.product.findMany({
        where:  { id: { in: productIds }, isActive: true },
        select: { id: true, basePrice: true },
      });

      if (products.length !== productIds.length) {
        throw { error: "PRODUCT_NOT_FOUND", message: "أحد المنتجات غير موجود أو غير نشط", status: 422 };
      }

      const productMap = new Map<string, { id: string; basePrice: Decimal }>(
        products.map((p: { id: string; basePrice: Decimal }) => [p.id, p])
      );

      const itemsData = items.map((item) => {
        const product   = productMap.get(item.productId)!;
        const unitPrice = product.basePrice;
        const lineTotal = unitPrice.mul(new Decimal(item.qty));
        return { productId: item.productId, qty: item.qty, unitPrice, lineTotal };
      });

      const subtotal = itemsData.reduce(
        (acc: Decimal, i) => acc.add(i.lineTotal),
        new Decimal(0)
      );

      const dvDecimal = discountValue ? new Decimal(discountValue) : null;
      const { discountAmount, total } = calculateAmounts(subtotal, discountType as DiscountType | null, dvDecimal);

      const orderNumber = await generateOrderNumber();

      return tx.order.create({
        data: {
          orderNumber,
          customerId,
          agentId:       resolvedAgentId,
          zoneId:        resolvedZoneId,
          scheduledAt:   scheduledAt ? new Date(scheduledAt) : null,
          discountType:  discountType as DiscountType | null ?? null,
          discountValue: dvDecimal,
          subtotal,
          discountAmount,
          total,
          notes:  notes ?? null,
          items:  { create: itemsData },
        },
        include: ORDER_INCLUDE,
      });
    });

    return successResponse(order, 201);
  } catch (err: unknown) {
    if (
      typeof err === "object" && err !== null &&
      "error" in err && "message" in err && "status" in err
    ) {
      const e = err as { error: string; message: string; status: number };
      return errorResponse({ error: e.error, message: e.message }, e.status);
    }
    if (err instanceof PrismaClientKnownRequestError) {
      console.error("[POST /orders] Prisma:", err.code, err.message);
    }
    console.error("[POST /orders]", err);
    return errorResponse({ error: "INTERNAL_ERROR", message: "حدث خطأ داخلي في السيرفر" }, 500);
  }
}
