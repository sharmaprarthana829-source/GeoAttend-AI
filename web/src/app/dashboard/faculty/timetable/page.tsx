"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api, TimetableEntry, DayOfWeek, AttendanceSession } from "@/lib/api";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  CalendarDays,
  Clock,
  BookOpen,
  Play,
  ArrowLeft,
  MapPin,
  Users,
  CheckCircle2,
  QrCode,
  AlertTriangle,
  Radio,
} from "lucide-react";

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
];

export default function FacultyTimetablePage() {
  const { user } = useDashboard();
  const router = useRouter();

  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>("monday");
  const [startingEntryId, setStartingEntryId] = useState<number | null>(null);

  // Determine current day of week
  const todayKey: DayOfWeek = useMemo(() => {
    const dayIndex = new Date().getDay();
    const map: Record<number, DayOfWeek> = {
      1: "monday",
      2: "tuesday",
      3: "wednesday",
      4: "thursday",
      5: "friday",
      6: "saturday",
      0: "monday", // default Sunday to Monday view
    };
    return map[dayIndex] || "monday";
  }, []);

  useEffect(() => {
    setSelectedDay(todayKey);
  }, [todayKey]);

  useEffect(() => {
    async function loadTimetable() {
      if (!user?.faculty_profile?.id) return;
      setLoading(true);
      try {
        const [data, sess] = await Promise.all([
          api.timetable.getEntries({
            faculty_id: user.faculty_profile.id,
            is_active: true,
          }),
          api.attendance.getFacultySessions().catch(() => []),
        ]);
        setEntries(data);
        const active = sess.find((s) => s.status === "active") || null;
        setActiveSession(active);
      } catch (err) {
        console.error("Error loading faculty timetable:", err);
      } finally {
        setLoading(false);
      }
    }
    loadTimetable();
  }, [user]);

  const filteredEntries = useMemo(() => {
    return entries
      .filter((e) => e.day_of_week === selectedDay)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [entries, selectedDay]);

  const stats = useMemo(() => {
    const totalClasses = entries.length;
    const theoryCount = entries.filter((e) => e.class_type === "theory").length;
    const labCount = entries.filter((e) => e.class_type === "lab").length;
    const conflictCount = entries.filter((e) => e.has_conflict).length;
    return { totalClasses, theoryCount, labCount, conflictCount };
  }, [entries]);

  async function handleStartSession(timetableEntryId: number) {
    if (startingEntryId !== null || activeSession !== null) return;
    setStartingEntryId(timetableEntryId);
    try {
      await api.attendance.startSession({ timetable_entry_id: timetableEntryId });
      router.push("/dashboard/faculty?live=1");
    } catch (err: any) {
      alert(err.message || "Failed to start session");
    } finally {
      setStartingEntryId(null);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => router.push("/dashboard/faculty")}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <CalendarDays className="h-6 w-6 text-emerald-400" /> My Weekly Teaching Timetable
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Weekly class schedule with classroom allocation and instant attendance launcher.
          </p>
        </div>

        {/* Action Shortcuts & Stats */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push("/dashboard/faculty/classes")}
            className="text-xs flex items-center gap-1"
          >
            <BookOpen className="h-3.5 w-3.5 text-blue-400" /> My Classes
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push("/dashboard/attendance-sessions?tab=history")}
            className="text-xs flex items-center gap-1"
          >
            <Clock className="h-3.5 w-3.5 text-amber-400" /> Attendance Management
          </Button>
          <div className="px-3 py-1.5 rounded-lg bg-surface-900 border border-slate-800 text-xs text-slate-300">
            Total Slots: <strong className="text-white">{stats.totalClasses}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-surface-900 border border-slate-800 text-xs text-slate-300">
            Theory: <strong className="text-emerald-400">{stats.theoryCount}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-surface-900 border border-slate-800 text-xs text-slate-300">
            Labs: <strong className="text-blue-400">{stats.labCount}</strong>
          </div>
        </div>
      </div>

      {/* Day Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
        {DAYS.map((d) => {
          const isSelected = selectedDay === d.key;
          const isToday = todayKey === d.key;
          const count = entries.filter((e) => e.day_of_week === d.key).length;

          return (
            <button
              key={d.key}
              onClick={() => setSelectedDay(d.key)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all shrink-0 flex items-center gap-2 ${
                isSelected
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-950"
                  : "bg-surface-900/80 text-slate-400 hover:text-white hover:bg-surface-800 border border-slate-800"
              }`}
            >
              <span>{d.label}</span>
              {isToday && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                  isSelected ? "bg-white/20 text-white" : "bg-emerald-950 text-emerald-400 border border-emerald-500/30"
                }`}>
                  Today
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                isSelected ? "bg-black/20 text-white" : "bg-surface-950 text-slate-400"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Timetable List for Selected Day */}
      <Card className="p-6 border-slate-800 bg-surface-900/80">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white capitalize">
            {selectedDay}'s Classes ({filteredEntries.length})
          </h3>
          {selectedDay === todayKey && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
              <CheckCircle2 className="h-4 w-4" /> Live Attendance available for today's classes
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-500 text-sm">Loading timetable...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-2xl">
            No classes scheduled for {selectedDay}.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map((entry) => {
              const isActiveForThis = activeSession?.timetable_entry_id === entry.id;
              const hasActiveOther = activeSession !== null && !isActiveForThis;

              return (
                <div
                  key={entry.id}
                  className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-xl border transition-all ${
                    isActiveForThis
                      ? "bg-emerald-950/30 border-emerald-500/50"
                      : "bg-surface-950/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Time Badge */}
                    <div className="p-3 rounded-xl bg-surface-900 border border-slate-800 text-center shrink-0 min-w-[100px]">
                      <Clock className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
                      <p className="text-xs font-mono font-bold text-white">{entry.start_time}</p>
                      <p className="text-[10px] font-mono text-slate-400">to {entry.end_time}</p>
                    </div>

                    {/* Class Info */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-white text-base">{entry.subject_name}</h4>
                        <span className="text-xs px-2 py-0.5 rounded bg-surface-800 text-slate-300 font-mono">
                          {entry.subject_code}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded uppercase font-bold ${
                          entry.class_type === "lab"
                            ? "bg-blue-950 text-blue-300 border border-blue-500/30"
                            : "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                        }`}>
                          {entry.class_type}
                        </span>
                        {isActiveForThis && (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold animate-pulse">
                            <Radio className="h-3 w-3" /> LIVE
                          </span>
                        )}
                        {entry.has_conflict && (
                          <span
                            className="text-xs px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-500/30 flex items-center gap-1 font-semibold"
                            title={entry.conflict_types?.join(", ") || "Timetable conflict detected"}
                          >
                            <AlertTriangle className="h-3 w-3 text-rose-400" /> Conflict
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-slate-500" />
                          Section: <strong className="text-slate-200">{entry.section_name}</strong>
                          {entry.student_group_name && (
                            <span className="text-emerald-400 font-semibold ml-1">({entry.student_group_name})</span>
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-500" />
                          Room: <strong className="text-slate-200">{entry.room_number}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    {selectedDay === todayKey ? (
                      isActiveForThis ? (
                        <Button
                          onClick={() => router.push("/dashboard/faculty?live=1")}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950"
                        >
                          <QrCode className="h-3.5 w-3.5" /> Live Monitor
                        </Button>
                      ) : (
                        <Button
                          variant={hasActiveOther ? "outline" : "primary"}
                          onClick={() => handleStartSession(entry.id)}
                          disabled={startingEntryId === entry.id || hasActiveOther}
                          title={hasActiveOther ? "An attendance session is already active for another class" : undefined}
                          className={`text-xs flex items-center gap-1.5 ${
                            hasActiveOther
                              ? "border-slate-800 text-slate-500 cursor-not-allowed"
                              : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40"
                          }`}
                        >
                          <Play className="h-3.5 w-3.5" />
                          {startingEntryId === entry.id
                            ? "Starting..."
                            : hasActiveOther
                            ? "Session Active Elsewhere"
                            : "Start Attendance"}
                        </Button>
                      )
                    ) : (
                      <span className="text-xs text-slate-500 px-3 py-1 rounded bg-surface-900 border border-slate-800">
                        Scheduled
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
