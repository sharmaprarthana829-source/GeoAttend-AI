"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  FacultyAssignment,
  TimetableEntry,
  AttendanceSession,
  AttendanceRecord,
  FacultyClassRead,
} from "@/lib/api";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import FacultySummary from "@/components/admin/faculty/FacultySummary";
import FacultyTable from "@/components/admin/faculty/FacultyTable";
import {
  CalendarDays,
  Clock,
  BookOpen,
  CheckCircle2,
  Sparkles,
  Award,
  Play,
  ArrowRight,
  ShieldCheck,
  QrCode,
  Users,
  AlertCircle,
  X,
  RefreshCw,
  GraduationCap,
  ChevronRight,
  Radio,
} from "lucide-react";

export default function FacultyPage() {
  const { user } = useDashboard();
  const router = useRouter();

  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [classes, setClasses] = useState<FacultyClassRead[]>([]);
  const [activeSessions, setActiveSessions] = useState<AttendanceSession[]>([]);
  const [currentSession, setCurrentSession] = useState<AttendanceSession | null>(null);
  const [sessionRecords, setSessionRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingEntryId, setStartingEntryId] = useState<number | null>(null);
  const [endingSessionId, setEndingSessionId] = useState<number | null>(null);
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [qrCountdown, setQrCountdown] = useState(30);

  const [error, setError] = useState<string | null>(null);

  const isCoordinator = useMemo(() => {
    return (
      user?.faculty_profile?.responsibilities?.some(
        (r) => r.responsibility_type === "coordinator" && r.is_active
      ) || false
    );
  }, [user]);

  const loadData = React.useCallback(async () => {
    if (user?.role !== "faculty") return;
    setLoading(true);
    setError(null);
    try {
      const [tt, cls, sess] = await Promise.all([
        api.timetable.getFacultyToday().catch((e) => {
          console.error("Failed to load today's timetable:", e);
          return [];
        }),
        api.faculty.getMyClasses().catch((e) => {
          console.error("Failed to load faculty classes:", e);
          return [];
        }),
        api.attendance.getFacultySessions().catch((e) => {
          console.error("Failed to load attendance sessions:", e);
          return [];
        }),
      ]);
      setTimetable(tt);
      setClasses(cls);
      const activeSess = sess.filter((s) => s.status === "active");
      setActiveSessions(activeSess);
      if (activeSess.length > 0) {
        setCurrentSession(activeSess[0]);
        loadSessionRecords(activeSess[0].id);
        if (typeof window !== "undefined" && window.location.search.includes("live=1")) {
          setShowLiveModal(true);
        }
      } else {
        setCurrentSession(null);
        setSessionRecords([]);
      }
    } catch (err: any) {
      console.error("Error loading faculty data:", err);
      setError(err?.message || "Failed to load faculty dashboard data");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling for live session records and QR timer
  useEffect(() => {
    if (!currentSession || currentSession.status !== "active") return;
    const recordInterval = setInterval(() => {
      loadSessionRecords(currentSession.id);
    }, 4000);

    const timer = setInterval(() => {
      setQrCountdown((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);

    return () => {
      clearInterval(recordInterval);
      clearInterval(timer);
    };
  }, [currentSession]);

  async function loadSessionRecords(sessionId: number) {
    try {
      const recs = await api.attendance.getSessionRecords(sessionId);
      setSessionRecords(recs);
    } catch (err) {
      console.error("Error polling session records:", err);
    }
  }

  async function handleStartSession(timetableEntryId: number) {
    if (startingEntryId !== null || currentSession !== null) return;
    setStartingEntryId(timetableEntryId);
    try {
      const sess = await api.attendance.startSession({ timetable_entry_id: timetableEntryId });
      setCurrentSession(sess);
      setActiveSessions([sess]);
      setShowLiveModal(true);
      await loadSessionRecords(sess.id);
      // Reload today's timetable to refresh status
      const tt = await api.timetable.getFacultyToday().catch(() => []);
      setTimetable(tt);
    } catch (err: any) {
      alert(err.message || "Failed to start attendance session");
    } finally {
      setStartingEntryId(null);
    }
  }

  async function handleEndSession(sessionId: number) {
    if (!confirm("Are you sure you want to end this attendance session? Students will no longer be able to check in.")) return;
    setEndingSessionId(sessionId);
    try {
      await api.attendance.closeSession(sessionId);
      setCurrentSession(null);
      setActiveSessions([]);
      setShowLiveModal(false);
      // Reload data
      const [tt, sess] = await Promise.all([
        api.timetable.getFacultyToday().catch(() => []),
        api.attendance.getFacultySessions().catch(() => []),
      ]);
      setTimetable(tt);
      setActiveSessions(sess.filter((s) => s.status === "active"));
    } catch (err: any) {
      alert(err.message || "Failed to end session");
    } finally {
      setEndingSessionId(null);
    }
  }

  // Next upcoming or current class calculation based on campus time
  const nextClass = useMemo(() => {
    if (timetable.length === 0) return null;

    // 1. If an active session is in progress, match its timetable entry
    if (currentSession) {
      const activeEntry = timetable.find((t) => t.id === currentSession.timetable_entry_id);
      if (activeEntry) return { entry: activeEntry, isActive: true, isCurrentWindow: true };
    }

    // 2. Format current campus-local time "HH:MM:SS"
    const now = new Date();
    const curH = String(now.getHours()).padStart(2, "0");
    const curM = String(now.getMinutes()).padStart(2, "0");
    const curS = String(now.getSeconds()).padStart(2, "0");
    const currentTimeStr = `${curH}:${curM}:${curS}`;

    // 3. Sort entries chronologically by start_time
    const sorted = [...timetable].sort((a, b) => a.start_time.localeCompare(b.start_time));

    // 4. Find the first class whose end_time has not yet elapsed today
    const upcomingOrCurrent = sorted.find((t) => {
      const endTime = t.end_time.length === 5 ? `${t.end_time}:00` : t.end_time;
      return endTime >= currentTimeStr;
    });

    if (upcomingOrCurrent) {
      const startTime =
        upcomingOrCurrent.start_time.length === 5
          ? `${upcomingOrCurrent.start_time}:00`
          : upcomingOrCurrent.start_time;
      const isCurrentWindow = startTime <= currentTimeStr;
      return { entry: upcomingOrCurrent, isActive: false, isCurrentWindow };
    }

    // All scheduled classes for today have completed; do not show past classes as upcoming
    return null;
  }, [timetable, currentSession]);

  // Distinct subjects count from authenticated faculty assignments
  const distinctSubjectsCount = useMemo(() => {
    const ids = new Set(classes.map((c) => c.subject_id).filter(Boolean));
    return ids.size;
  }, [classes]);

  // If Admin is viewing /dashboard/faculty, show Admin Faculty Management view
  if (user?.role === "admin") {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <nav className="text-xs text-slate-400 mb-2">Dashboard / Faculty</nav>
            <h1 className="text-2xl font-semibold text-white">Faculty Management</h1>
            <p className="text-sm text-slate-400 mt-1">Manage faculty records, responsibilities, and assignments.</p>
          </div>
        </div>
        <FacultySummary />
        <FacultyTable />
      </div>
    );
  }

  // Active verified administrative responsibilities (excluding redundant professor designation)
  const responsibilities = useMemo(() => {
    const list = user?.faculty_profile?.responsibilities || [];
    const seen = new Set<string>();
    return list.filter((r) => {
      if (!r.is_active) return false;
      // Professor is an academic designation, displayed in the designation field
      if (r.responsibility_type === "professor") return false;
      const key = `${r.responsibility_type}-${r.section_id || "none"}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [user]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Teacher Welcome Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-950/60 via-surface-900 to-surface-900 border border-emerald-800/30 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <Sparkles className="h-4 w-4" /> Faculty Workspace
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              Welcome back, {user?.full_name}
            </h1>
            <p className="text-sm text-slate-300 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Department: <strong className="text-white">{user?.faculty_profile?.department_name || "Computer Science"}</strong></span>
              <span>•</span>
              <span>Designation: <strong className="text-white">{user?.faculty_profile?.designation || "Faculty Member"}</strong></span>
              <span>•</span>
              <span>ID: <strong className="text-emerald-300 font-mono">{user?.faculty_profile?.employee_id || "FAC001"}</strong></span>
            </p>
          </div>

          {/* Verified Responsibility Badges Only */}
          {responsibilities.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {responsibilities.map((r) => {
                if (r.responsibility_type === "coordinator") {
                  return (
                    <button
                      key={r.id}
                      onClick={() => router.push("/dashboard/faculty/coordinator")}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm bg-amber-950/60 text-amber-300 border border-amber-500/40 hover:bg-amber-900/50 transition-colors cursor-pointer"
                      title="Open Coordinator Desk"
                    >
                      <GraduationCap className="h-3.5 w-3.5 text-amber-400" />
                      COORDINATOR{r.section_name ? ` (${r.section_name})` : ""}
                    </button>
                  );
                }
                if (r.responsibility_type === "hod") {
                  return (
                    <span
                      key={r.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm bg-indigo-950/60 text-indigo-300 border border-indigo-500/40"
                    >
                      <Award className="h-3.5 w-3.5 text-indigo-400" />
                      HOD
                    </span>
                  );
                }
                if (r.responsibility_type === "dean") {
                  return (
                    <span
                      key={r.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm bg-purple-950/60 text-purple-300 border border-purple-500/40"
                    >
                      <Award className="h-3.5 w-3.5 text-purple-400" />
                      DEAN
                    </span>
                  );
                }
                return (
                  <span
                    key={r.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm bg-surface-800 text-slate-300 border border-slate-700"
                  >
                    <Award className="h-3.5 w-3.5" />
                    {r.responsibility_type.toUpperCase()}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Error State Banner with Retry */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-800/50 bg-rose-950/30 text-rose-300 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="outline" onClick={loadData} className="text-xs border-rose-700/50 hover:bg-rose-900/40">
            <RefreshCw className="h-3 w-3 mr-1" /> Retry
          </Button>
        </div>
      )}

      {/* Hero: Current / Next Class Card */}
      {nextClass ? (
        <Card className={`p-6 border transition-all ${
          nextClass.isActive
            ? "bg-gradient-to-br from-emerald-950/70 via-surface-900 to-surface-900 border-emerald-500/50 shadow-emerald-950/30 shadow-2xl"
            : "bg-surface-900/90 border-slate-800"
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                {nextClass.isActive ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                    <Radio className="h-3.5 w-3.5" /> LIVE SESSION IN PROGRESS
                  </span>
                ) : nextClass.isCurrentWindow ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    IN SESSION WINDOW
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    NEXT CLASS TODAY
                  </span>
                )}
                <span className="text-xs font-mono text-slate-400">
                  {nextClass.entry.start_time} - {nextClass.entry.end_time}
                </span>
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                  {nextClass.entry.subject_name}
                  <span className="text-xs px-2 py-0.5 rounded bg-surface-800 text-slate-300 font-mono font-normal">
                    {nextClass.entry.subject_code}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded uppercase font-semibold bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-normal">
                    {nextClass.entry.class_type}
                  </span>
                </h2>
                <p className="text-sm text-slate-300 mt-1">
                  Section: <strong className="text-white">{nextClass.entry.section_name}</strong>
                  {nextClass.entry.student_group_name && (
                    <> • Group: <strong className="text-emerald-400">{nextClass.entry.student_group_name}</strong></>
                  )}
                  {" "}• Room: <strong className="text-white">{nextClass.entry.room_number}</strong>
                </p>
              </div>
            </div>

            {/* Action Buttons for Hero */}
            <div className="flex items-center gap-3">
              {nextClass.isActive ? (
                <>
                  <Button
                    onClick={() => setShowLiveModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-2.5 flex items-center gap-2 shadow-lg shadow-emerald-950"
                  >
                    <QrCode className="h-4 w-4" /> Open Live QR & Attendance ({sessionRecords.length} Present)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleEndSession(currentSession!.id)}
                    disabled={endingSessionId === currentSession?.id}
                    className="border-rose-700/50 text-rose-400 hover:bg-rose-950/40 text-xs"
                  >
                    End Session
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => handleStartSession(nextClass.entry.id)}
                  disabled={startingEntryId === nextClass.entry.id || currentSession !== null}
                  title={currentSession !== null ? "An attendance session is already active" : undefined}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-3 flex items-center gap-2 text-sm shadow-lg shadow-emerald-950/50 disabled:opacity-50"
                >
                  <Play className="h-4 w-4 fill-white" />
                  {startingEntryId === nextClass.entry.id
                    ? "Starting Session..."
                    : currentSession !== null
                    ? "Session Active Elsewhere"
                    : "Start Today's Attendance"}
                </Button>
              )}
            </div>
          </div>
        </Card>
      ) : timetable.length > 0 ? (
        <Card className="p-5 border-slate-800 bg-surface-900/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">All Scheduled Classes Completed</h3>
              <p className="text-xs text-slate-400">All lectures and lab sessions on your timetable for today have ended.</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/attendance-sessions?tab=history")}
            className="text-xs shrink-0"
          >
            View Attendance History
          </Button>
        </Card>
      ) : null}

      {/* Main Grid: Today's Schedule & Quick Links */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Today's Class List */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-6 border-slate-800 bg-surface-900/80">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-emerald-400" /> Today's Scheduled Lectures & Labs
                </h3>
                <p className="text-xs text-slate-400">1-Click start attendance for any of your classes</p>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard/faculty/timetable")}
                className="text-xs flex items-center gap-1"
              >
                View Full Timetable <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-500 text-sm">Loading schedule...</div>
            ) : timetable.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                No classes scheduled for today. Enjoy your day!
              </div>
            ) : (
              <div className="space-y-3">
                {timetable.map((t) => {
                  const isActive = currentSession?.timetable_entry_id === t.id;
                  return (
                    <div
                      key={t.id}
                      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border transition-all ${
                        isActive
                          ? "bg-emerald-950/30 border-emerald-500/50"
                          : "bg-surface-950/50 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-white">{t.subject_name}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-surface-800 text-slate-300 font-mono">
                            {t.subject_code}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded uppercase font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                            {t.class_type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          <span className="text-slate-200 font-medium">Sec {t.section_name}</span>
                          {t.student_group_name ? ` (Grp ${t.student_group_name})` : " (All)"}
                          {" • "}
                          Room: <span className="text-slate-200">{t.room_number}</span>
                          {" • "}
                          Time: <span className="text-emerald-400 font-mono">{t.start_time} - {t.end_time}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isActive ? (
                          <Button
                            size="sm"
                            onClick={() => setShowLiveModal(true)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-xs flex items-center gap-1.5"
                          >
                            <QrCode className="h-3.5 w-3.5" /> Live Monitor
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartSession(t.id)}
                            disabled={startingEntryId === t.id || currentSession !== null}
                            title={currentSession !== null ? "An attendance session is already active" : undefined}
                            className="text-xs flex items-center gap-1.5 border-emerald-700/50 text-emerald-300 hover:bg-emerald-950/40 disabled:opacity-50"
                          >
                            <Play className="h-3.5 w-3.5" />
                            {startingEntryId === t.id ? "Starting..." : "Start Attendance"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right 1 Col: Quick Navigation & Stats */}
        <div className="space-y-4">
          {/* Quick Metrics */}
          <Card className="p-5 border-slate-800 bg-surface-900/80 space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Teaching Snapshot</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-surface-950/60 border border-slate-800">
                <p className="text-xs text-slate-400">Today's Classes</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {loading ? (
                    <span className="text-slate-500 text-lg animate-pulse">...</span>
                  ) : (
                    timetable.length
                  )}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-surface-950/60 border border-slate-800">
                <p className="text-xs text-slate-400">My Subjects</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">
                  {loading ? (
                    <span className="text-slate-500 text-lg animate-pulse">...</span>
                  ) : (
                    distinctSubjectsCount
                  )}
                </p>
              </div>
            </div>
          </Card>


          {/* Quick Nav Cards */}
          <div className="space-y-2.5">
            <div
              onClick={() => router.push("/dashboard/faculty/classes")}
              className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-surface-900/60 hover:bg-surface-800/60 hover:border-slate-700 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">My Classes</h4>
                  <p className="text-xs text-slate-400">View student rosters & subject stats</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </div>

            <div
              onClick={() => router.push("/dashboard/faculty/timetable")}
              className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-surface-900/60 hover:bg-surface-800/60 hover:border-slate-700 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">My Weekly Timetable</h4>
                  <p className="text-xs text-slate-400">Full Monday–Saturday schedule</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </div>

            <div
              onClick={() => router.push("/dashboard/attendance-sessions?tab=history")}
              className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-surface-900/60 hover:bg-surface-800/60 hover:border-slate-700 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Attendance Management</h4>
                  <p className="text-xs text-slate-400">Past lectures and check-in logs</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </div>

            {isCoordinator && (
              <div
                onClick={() => router.push("/dashboard/faculty/coordinator")}
                className="flex items-center justify-between p-4 rounded-xl border border-amber-800/40 bg-amber-950/20 hover:bg-amber-950/40 cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-amber-300">Coordinator Desk</h4>
                    <p className="text-xs text-amber-200/70">Section student matrix & short attendance</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-amber-400" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Attendance Modal */}
      {showLiveModal && currentSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-surface-950">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                    <Radio className="h-3 w-3" /> LIVE CHECK-IN
                  </span>
                  <h3 className="text-lg font-bold text-white">{currentSession.subject_name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-surface-800 text-slate-300 font-mono">
                    Sec {currentSession.section_name}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Room {currentSession.room_number || "TBD"} • Rotating QR token updates every 30s
                </p>
              </div>
              <button
                onClick={() => setShowLiveModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-surface-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* QR Code & Token Area */}
              <div className="grid md:grid-cols-2 gap-6 items-center">
                <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-surface-950 border border-slate-800 text-center">
                  <div className="p-4 bg-white rounded-2xl shadow-xl">
                    <QrCode className="h-44 w-44 text-slate-900" />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-slate-400">Token expires in:</span>
                    <span className="text-xs font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/30">
                      {qrCountdown}s
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Students scan this QR via GeoAttend AI Mobile</p>
                </div>

                {/* Live Stats */}
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-surface-950 border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Total Checked In</span>
                      <Users className="h-4 w-4 text-emerald-400" />
                    </div>
                    <p className="text-3xl font-bold text-white mt-1">{sessionRecords.length}</p>
                    <p className="text-xs text-emerald-400 mt-0.5">Students marked present</p>
                  </div>

                  <div className="p-4 rounded-xl bg-surface-950 border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Geofence Status</span>
                      <ShieldCheck className="h-4 w-4 text-blue-400" />
                    </div>
                    <p className="text-sm font-semibold text-white mt-1">Classroom Geofence Active</p>
                    <p className="text-xs text-slate-400 mt-0.5">Mock location & multi-device spoofing protected</p>
                  </div>

                  <Button
                    onClick={() => handleEndSession(currentSession.id)}
                    disabled={endingSessionId === currentSession.id}
                    className="w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold py-2.5 text-sm"
                  >
                    {endingSessionId === currentSession.id ? "Ending Session..." : "End Attendance Session"}
                  </Button>
                </div>
              </div>

              {/* Live Checked-In Roster Feed */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Live Check-in Feed ({sessionRecords.length})
                </h4>
                {sessionRecords.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                    Waiting for students to check in...
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {sessionRecords.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-surface-950/80 border border-slate-800/80 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="h-2 w-2 rounded-full bg-emerald-400" />
                          <div>
                            <span className="font-semibold text-white">{r.student_name || "Student"}</span>
                            <span className="text-slate-400 ml-2 font-mono">({r.roll_number || "N/A"})</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 font-mono">
                            {new Date(r.check_in_time).toLocaleTimeString()}
                          </span>
                          <span className="px-2 py-0.5 rounded uppercase font-bold text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                            {r.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
