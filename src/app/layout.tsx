import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EBDA3 ERP",
  description: "نظام إدارة طلبيات EBDA3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
