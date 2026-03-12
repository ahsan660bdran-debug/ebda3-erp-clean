import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  SCHEDULED:   "تم تحديد الموعد",
  INSTALLED:   "تم التركيب",
  UNINSTALLED: "غير مركبة",
};

const statusColor: Record<string, string> = {
  SCHEDULED:   "bg-yellow-100 text-yellow-800",
  INSTALLED:   "bg-green-100 text-green-800",
  UNINSTALLED: "bg-red-100 text-red-800",
};

export default async function DashboardPage() {
  const [total, scheduled, installed, uninstalled, recentOrders] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: "SCHEDULED" } }),
    prisma.order.count({ where: { status: "INSTALLED" } }),
    prisma.order.count({ where: { status: "UNINSTALLED" } }),
    prisma.order.findMany({
      take: 10,
router.push("/dashboard");
      select: {
        id:          true,
        orderNumber: true,
        status:      true,
        scheduledAt: true,
        total:       true,
        customer: { select: { fullName: true, phone: true } },
        agent:    { select: { fullName: true } },
      },
    }),
  ]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">لوحة التحكم</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "إجمالي الطلبيات", value: total,       color: "bg-blue-50   text-blue-700"   },
          { label: "تم تحديد الموعد", value: scheduled,   color: "bg-yellow-50 text-yellow-700" },
          { label: "تم التركيب",       value: installed,   color: "bg-green-50  text-green-700"  },
          { label: "غير مركبة",        value: uninstalled, color: "bg-red-50    text-red-700"    },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-xl p-4 ${stat.color}`}>
            <p className="text-sm font-medium">{stat.label}</p>
            <p className="text-3xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700">آخر الطلبيات</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-right">رقم الطلبية</th>
              <th className="px-4 py-3 text-right">العميل</th>
              <th className="px-4 py-3 text-right">المندوب</th>
              <th className="px-4 py-3 text-right">الحالة</th>
              <th className="px-4 py-3 text-right">المجموع</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recentOrders.map((order: { id: string; orderNumber: string; status: string; scheduledAt: Date | null; total: unknown; customer: { fullName: string }; agent: { fullName: string } | null }) => (
              <tr key={order.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{order.orderNumber}</td>
                <td className="px-4 py-3">{order.customer.fullName}</td>
                <td className="px-4 py-3 text-gray-500">{order.agent?.fullName ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[order.status] ?? ""}`}>
                    {statusLabel[order.status] ?? order.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">{Number(order.total).toFixed(2)} د.إ</td>
              </tr>
            ))}
            {recentOrders.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400">لا توجد طلبيات</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
