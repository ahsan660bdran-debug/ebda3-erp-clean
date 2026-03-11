import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const [total, scheduled, installed, uninstalled, recentOrders] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: "SCHEDULED" } }),
      prisma.order.count({ where: { status: "INSTALLED" } }),
      prisma.order.count({ where: { status: "UNINSTALLED" } }),
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, orderNumber: true, status: true, scheduledAt: true, total: true,
          customer: { select: { fullName: true, phone: true } },
          agent:    { select: { fullName: true } },
        },
      }),
    ]);
    return successResponse({ total, scheduled, installed, uninstalled, recentOrders });
  } catch (err) {
    console.error("[GET /dashboard]", err);
    return errorResponse({ error: "INTERNAL_ERROR", message: "حدث خطأ داخلي في السيرفر" }, 500);
  }
}
