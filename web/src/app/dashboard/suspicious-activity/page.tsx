"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SuspiciousActivityRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/attendance?tab=records&filter=suspicious");
  }, [router]);

  return (
    <div className="py-24 text-center text-slate-400 text-sm">
      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mb-3" />
      <p>Redirecting to Unified Attendance & AI Sentinel Monitor...</p>
    </div>
  );
}
