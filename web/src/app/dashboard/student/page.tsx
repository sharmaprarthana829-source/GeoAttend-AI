"use client";

import React, { useEffect, useState } from "react";
import {
  api,
  AttendanceSession,
  StudentSummaryItem,
  TimetableEntry,
  User,
  AcademicEnrollment,
} from "@/lib/api";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  CheckCircle2,
  Clock,
  CalendarDays,
  AlertCircle,
  MapPin,
  QrCode,
  BookOpen,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export default function StudentDashboardPage() {
  const { user } = useDashboard();
  const [summary, setSummary] = useState<StudentSummaryItem[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [activeSessions, setActiveSessions] = useState<AttendanceSession[]>([]);
  const [enrollment, setEnrollment] = useState<AcademicEnrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkinLoading, setCheckinLoading] = useState<number | null>(null);
  const [checkinMessage, setCheckinMessage] = useState<{ id: number; text: string; error?: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    async function loadData() {
      setLoading(true);
      try {
        const [sum, tt, sessions] = await Promise.all([
          api.attendance.getStudentSummary().catch(() => []),
          api.timetable.getStudentToday().catch(() => []),
          api.attendance.getStudentActiveSessions().catch(() => []),
        ]);
        if (!active) return;
        setSummary(sum);
        setTimetable(tt);
        setActiveSessions(sessions);

        if (user?.student_profile?.id) {
          const enr = await api.academic.getCurrentEnrollment(user.student_profile.id).catch(() => null);
          if (active) setEnrollment(enr);
        }
      } catch (err) {
        console.error("Error loading student dashboard:", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => {
      active = false;
    };
  }, [user]);

  async function handleCheckIn(session: AttendanceSession) {
    setCheckinLoading(session.id);
    setCheckinMessage(null);

    // Capture device & geolocation if available
    let latitude = 28.6139; // default campus test coordinates
    let longitude = 77.209;

    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
        });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch {
        // Fallback to default campus test coordinates
      }
    }

    try {
      await api.attendance.checkIn({
        session_id: session.id,
        latitude,
        longitude,
        accuracy_meters: 10,
        device_id: "browser-client-" + (user?.id || "1"),
        device_model: navigator.userAgent.slice(0, 50),
      });
      setCheckinMessage({ id: session.id, text: "Check-in successful! Attendance marked." });
      // Refresh summary & active sessions
      const [sum, sessions] = await Promise.all([
        api.attendance.getStudentSummary().catch(() => []),
        api.attendance.getStudentActiveSessions().catch(() => []),
      ]);
      setSummary(sum);
      setActiveSessions(sessions);
    } catch (err: any) {
      setCheckinMessage({ id: session.id, text: err.message || "Check-in failed", error: true });
    } finally {
      setCheckinLoading(null);
    }
  }

  // Calculate overall metrics
  const totalClasses = summary.reduce((acc, s) => acc + (s.total_classes ?? s.total_sessions ?? 0), 0);
  const attendedClasses = summary.reduce((acc, s) => acc + (s.attended_classes ?? s.attended ?? 0), 0);
  const overallPercentage = totalClasses > 0 ? ((attendedClasses / totalClasses) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      {/* Welcome & Profile Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-emerald-950/40 via-surface-900 to-surface-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <Sparkles className="h-4 w-4" /> Student Portal
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mt-1">Welcome back, {user?.full_name}</h1>
          <p className="text-sm text-slate-400 mt-1">
            Roll: <span className="text-slate-200 font-mono">{user?.student_profile?.roll_number || "CS24A001"}</span>
            {enrollment?.section_name && <> · Section: <span className="text-slate-200">{enrollment.section_name}</span></>}
            {enrollment?.student_group_name && <> · Group: <span className="text-emerald-400 font-semibold">{enrollment.student_group_name}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/30 px-4 py-2 text-right">
            <span className="text-xs text-slate-400">Overall Attendance</span>
            <p className="text-2xl font-bold text-emerald-400">{overallPercentage}%</p>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 border-slate-800/60 bg-surface-900/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Attendance %</span>
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-white mt-2">{overallPercentage}%</p>
          <p className="text-xs text-slate-400 mt-1">{attendedClasses} of {totalClasses} classes attended</p>
        </Card>

        <Card className="p-5 border-slate-800/60 bg-surface-900/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Classes</span>
            <BookOpen className="h-5 w-5 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-white mt-2">{totalClasses}</p>
          <p className="text-xs text-slate-400 mt-1">Scheduled across enrolled subjects</p>
        </Card>

        <Card className="p-5 border-slate-800/60 bg-surface-900/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Classes Attended</span>
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-emerald-400 mt-2">{attendedClasses}</p>
          <p className="text-xs text-slate-400 mt-1">Verified check-ins</p>
        </Card>

        <Card className="p-5 border-slate-800/60 bg-surface-900/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Sessions</span>
            <Clock className="h-5 w-5 text-amber-400" />
          </div>
          <p className="text-3xl font-bold text-amber-400 mt-2">{activeSessions.length}</p>
          <p className="text-xs text-slate-400 mt-1">Ready for check-in right now</p>
        </Card>
      </div>

      {/* Active Attendance Sessions Alert / Action Card */}
      {activeSessions.length > 0 && (
        <Card className="p-6 border-emerald-500/30 bg-emerald-950/20 shadow-xl">
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
            Live Attendance Sessions ({activeSessions.length})
          </div>
          <div className="mt-4 space-y-3">
            {activeSessions.map((s) => (
              <div
                key={s.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border border-emerald-500/20 bg-surface-900/80"
              >
                <div>
                  <h4 className="font-semibold text-white">{s.subject_name || "Scheduled Class"}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Faculty: <span className="text-slate-200">{s.faculty_name}</span> · Room:{" "}
                    <span className="text-slate-200">{s.room_number || "Standard Classroom"}</span> · Class:{" "}
                    <span className="uppercase text-emerald-400 font-semibold">{s.class_type || "Theory"}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {checkinMessage?.id === s.id && (
                    <span className={`text-xs ${checkinMessage.error ? "text-rose-400" : "text-emerald-400"}`}>
                      {checkinMessage.text}
                    </span>
                  )}
                  <Button
                    onClick={() => handleCheckIn(s)}
                    disabled={checkinLoading === s.id}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg"
                  >
                    {checkinLoading === s.id ? "Verifying GPS..." : "Check In Now"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Today's Timetable & Subject Attendance Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Classes */}
        <Card className="p-6 border-slate-800/60 bg-surface-900/70">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-emerald-400" /> Today's Schedule
              </h3>
              <p className="text-xs text-slate-400">Timetable classes matching your section and group</p>
            </div>
            <span className="text-xs text-slate-400">{timetable.length} classes</span>
          </div>

          {timetable.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-sm">No classes scheduled for today.</div>
          ) : (
            <div className="space-y-3">
              {timetable.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800/60 bg-surface-950/60 hover:border-slate-700/60 transition-colors">
                  <div>
                    <span className="font-semibold text-slate-100">{t.subject_name}</span>
                    <span className="ml-2 text-xs px-2 py-0.5 rounded bg-surface-800 text-slate-300 uppercase">{t.class_type}</span>
                    <p className="text-xs text-slate-400 mt-1">
                      {t.faculty_name} · Room: {t.room_number} {t.student_group_name ? `· Group ${t.student_group_name}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-medium text-emerald-400">{t.start_time ? t.start_time.slice(0, 5) : "—"} - {t.end_time ? t.end_time.slice(0, 5) : "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Subject-Wise Breakdown */}
        <Card className="p-6 border-slate-800/60 bg-surface-900/70">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-emerald-400" /> Subject-wise Attendance
              </h3>
              <p className="text-xs text-slate-400">Summary percentage across current subjects</p>
            </div>
          </div>

          {summary.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-sm">No subject records available yet.</div>
          ) : (
            <div className="space-y-4">
              {summary.map((s) => {
                const pct = s.percentage;
                const isShort = pct < 75;
                return (
                  <div key={s.subject_id + s.class_type} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-200">
                        {s.subject_name} ({s.class_type})
                      </span>
                      <span className={`font-bold ${isShort ? "text-rose-400" : "text-emerald-400"}`}>
                        {pct.toFixed(1)}% ({s.attended_classes ?? s.attended ?? 0}/{s.total_classes ?? s.total_sessions ?? 0})
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-surface-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isShort ? "bg-rose-500" : "bg-emerald-500"}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
