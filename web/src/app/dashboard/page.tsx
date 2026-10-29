"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearTokens, DashboardStats, User } from "@/lib/api";
import SuperAdminDashboard from "@/components/dashboard/SuperAdminDashboard";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-6">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const me = await api.me();
        setUser(me);
        if (me.role === "faculty") {
          router.replace("/dashboard/faculty");
          return;
        }
        if (me.role === "student") {
          router.replace("/dashboard/student");
          return;
        }
        if (me.role === "admin") {
          const dashboard = await api.dashboardStats();
          setStats(dashboard);
        }
      } catch {
        clearTokens();
        router.replace("/login");
      }
    }
    load();
  }, [router]);

  function logout() {
    clearTokens();
    router.push("/login");
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-slate-400">Loading dashboard...</p>
      </main>
    );
  }

  // Render role-specific dashboards. Admin gets a dedicated enterprise layout.
  if (user.role === "admin") {
    return (
      <main className="min-h-screen p-6 md:p-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="mt-1 text-slate-400">Welcome back, {user.full_name}</p>
          </div>
          <button onClick={logout} className="rounded-xl border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800">
            Logout
          </button>
        </div>

        <SuperAdminDashboard />
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 md:p-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-slate-400">
            Welcome back, {user.full_name} · {user.role.replace("_", " ")}
          </p>
        </div>
        <button onClick={logout} className="rounded-xl border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800">
          Logout
        </button>
      </header>

      {error && <p className="mb-4 text-rose-400">{error}</p>}

      {stats && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Colleges" value={stats.total_colleges} />
          <StatCard label="Students" value={stats.total_students} />
          <StatCard label="Faculty" value={stats.total_faculty} />
          <StatCard label="Active Sessions" value={stats.active_sessions} />
          <StatCard label="Today's Attendance" value={stats.today_attendance_count} />
        </section>
      )}

      {user.role === "faculty" && (
        <section className="card mt-8 p-6">
          <h2 className="text-xl font-semibold">Faculty Panel</h2>
          <p className="mt-2 text-slate-400">
            Start attendance sessions, rotate QR codes, and monitor live check-ins via the API or mobile app.
          </p>
          <ul className="mt-4 list-inside list-disc text-sm text-slate-300">
            <li>POST /api/v1/attendance/sessions — start session</li>
            <li>POST /api/v1/attendance/sessions/:id/qr — refresh QR</li>
            <li>GET /api/v1/attendance/sessions/:id/records — live records</li>
          </ul>
        </section>
      )}

      {user.role === "student" && (
        <section className="card mt-8 p-6">
          <h2 className="text-xl font-semibold">Student Panel</h2>
          <p className="mt-2 text-slate-400">
            Scan the faculty QR code from the mobile app and check in with GPS verification.
          </p>
          <p className="mt-4 text-sm text-slate-300">POST /api/v1/attendance/check-in</p>
        </section>
      )}
    </main>
  );
}
