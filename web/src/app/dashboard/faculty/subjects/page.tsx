"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FacultySubjectsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/faculty/classes");
  }, [router]);

  return (
    <div className="py-24 text-center text-slate-400 text-sm">
      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mb-3" />
      <p>Redirecting to My Classes...</p>
    </div>
  );
}
