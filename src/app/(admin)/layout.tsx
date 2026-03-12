import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "لوحة التحكم" },
  { href: "/orders",    label: "الطلبيات"     },
  { href: "/customers", label: "العملاء"      },
  { href: "/agents",    label: "المندوبين"    },
  { href: "/products",  label: "المنتجات"     },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-l border-gray-200 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100">
          <span className="text-xl font-bold text-blue-600">EBDA3</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
