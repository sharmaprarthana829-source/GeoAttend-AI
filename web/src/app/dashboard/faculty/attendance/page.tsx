"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FacultyAttendanceHistoryRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const search = window.location.search;
      const params = new URLSearchParams(search);
      const sub = params.get("subject") || params.get("q");
      if (sub) {
        router.replace(`/dashboard/attendance-sessions?tab=history&subject=${encodeURIComponent(sub)}`);
      } else {
        router.replace("/dashboard/attendance-sessions?tab=history");
      }
    } else {
      router.replace("/dashboard/attendance-sessions?tab=history");
    }
  }, [router]);

  return (
    <div className="py-24 text-center text-slate-400 text-sm">
      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mb-3" />
      <p>Redirecting to Attendance Management...</p>
    </div>
  );
}
