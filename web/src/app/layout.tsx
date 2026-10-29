import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/ToastProvider";

export const metadata: Metadata = {
  title: "GeoAttend AI | Smart Enterprise Campus Attendance System",
  description:
    "Multi-tenant SaaS Smart Attendance Platform for Colleges & Universities with Geofencing, AI Fraud Detection & Real-time Live Monitoring.",
};

export const viewport: Viewport = {
  themeColor: "#090d16",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-surface-950 text-slate-100 min-h-screen relative overflow-x-hidden selection:bg-brand-500 selection:text-white">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
