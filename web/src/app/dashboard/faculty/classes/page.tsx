"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api, FacultyClassRead, StudentDetail } from "@/lib/api";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  BookOpen,
  Users,
  GraduationCap,
  Clock,
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Layers,
  Sparkles,
  Search,
  X,
  CheckCircle2,
} from "lucide-react";

export default function FacultyClassesPage() {
  const { user } = useDashboard();
  const router = useRouter();

  const [classes, setClasses] = useState<FacultyClassRead[]>([]);
  const [loading, setLoading] = useState(true);

  // Roster Modal state
  const [selectedClass, setSelectedClass] = useState<FacultyClassRead | null>(null);
  const [roster, setRoster] = useState<StudentDetail[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterSearch, setRosterSearch] = useState("");

  useEffect(() => {
    async function loadMyClasses() {
      if (user?.role !== "faculty") return;
      setLoading(true);
      try {
        const data = await api.faculty.getMyClasses();
        setClasses(data);
      } catch (err) {
        console.error("Error loading faculty classes:", err);
      } finally {
        setLoading(false);
      }
    }
    loadMyClasses();
  }, [user]);

  const distinctSubjectsCount = useMemo(() => {
    return new Set(classes.map((c) => c.subject_id).filter(Boolean)).size;
  }, [classes]);

  async function handleOpenRoster(cls: FacultyClassRead) {
    setSelectedClass(cls);
    setLoadingRoster(true);
    setRosterSearch("");
    try {
      const studs = await api.students.getStudents({ section_id: cls.section_id, is_active: true });
      const filtered = cls.student_group_id
        ? studs.filter((s: StudentDetail) => s.current_group_id === cls.student_group_id)
        : studs;
      setRoster(filtered);
    } catch (err) {
      console.error("Error loading student roster:", err);
      setRoster([]);
    } finally {
      setLoadingRoster(false);
    }
  }

  const filteredRoster = useMemo(() => {
    if (!rosterSearch.trim()) return roster;
    const q = rosterSearch.toLowerCase();
    return roster.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.roll_number.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
    );
  }, [roster, rosterSearch]);

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
            <BookOpen className="h-6 w-6 text-emerald-400" /> My Assigned Subjects & Classes
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Subjects, course offerings, and section rosters assigned to you this academic term.
          </p>
        </div>

        {/* Distinct Subject & Offering Metrics */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3.5 py-1.5 rounded-xl bg-surface-900 border border-slate-800 text-xs text-slate-300">
            Distinct Subjects: <strong className="text-emerald-400 font-bold">{distinctSubjectsCount}</strong>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-surface-900 border border-slate-800 text-xs text-slate-300">
            Class Offerings: <strong className="text-white font-bold">{classes.length}</strong>
          </div>
        </div>
      </div>

      {/* Class Cards Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 text-sm">Loading your classes...</div>
      ) : classes.length === 0 ? (
        <Card className="p-12 text-center border-slate-800 bg-surface-900/60">
          <BookOpen className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No Assigned Classes Found</h3>
          <p className="text-sm text-slate-400 mt-1">
            You currently have no course offerings assigned by the academic administrator.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <Card
              key={cls.assignment_id}
              className="p-6 border-slate-800 bg-surface-900/80 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                {/* Header Tag */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono px-2.5 py-1 rounded bg-surface-800 text-slate-300 border border-slate-700 font-semibold">
                    {cls.subject_code}
                  </span>
                  <span className={`text-xs px-2.5 py-1 rounded uppercase font-bold ${
                    cls.class_type === "lab"
                      ? "bg-blue-950 text-blue-300 border border-blue-500/30"
                      : "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                  }`}>
                    {cls.class_type}
                  </span>
                </div>

                {/* Subject Title */}
                <div>
                  <h3 className="text-lg font-bold text-white leading-snug">{cls.subject_name}</h3>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-slate-500" />
                    {cls.course_name} • {cls.branch_name} • Sem {cls.semester}
                  </p>
                </div>

                {/* Section & Group Info */}
                <div className="p-3.5 rounded-xl bg-surface-950/70 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Section:</span>
                    <strong className="text-white font-medium">Section {cls.section_name}</strong>
                  </div>
                  {cls.student_group_name && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Lab Group:</span>
                      <strong className="text-emerald-400 font-medium">{cls.student_group_name}</strong>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Academic Credits:</span>
                    <strong className="text-slate-200">{cls.credits} Credits</strong>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 rounded-lg bg-surface-950/40 border border-slate-800/60 text-center">
                    <p className="text-[11px] text-slate-400">Enrolled</p>
                    <p className="text-lg font-bold text-white mt-0.5">{cls.total_enrolled}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface-950/40 border border-slate-800/60 text-center">
                    <p className="text-[11px] text-slate-400">Sessions</p>
                    <p className="text-lg font-bold text-emerald-400 mt-0.5">{cls.total_sessions_conducted}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 mt-4 border-t border-slate-800 space-y-2">
                <Button
                  size="sm"
                  onClick={() => handleOpenRoster(cls)}
                  className="w-full bg-surface-800 hover:bg-surface-700 text-slate-200 hover:text-white text-xs flex items-center justify-center gap-1.5 border border-slate-700"
                >
                  <Users className="h-3.5 w-3.5 text-emerald-400" /> View Student Roster ({cls.total_enrolled})
                </Button>
                <div className="flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push("/dashboard/faculty/timetable")}
                    className="flex-1 text-xs text-slate-300 hover:text-white"
                  >
                    <CalendarDays className="h-3 w-3 mr-1 text-blue-400" /> Timetable
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/dashboard/attendance-sessions?tab=history&subject=${encodeURIComponent(cls.subject_code)}`)}
                    className="flex-1 text-xs border-emerald-800/50 text-emerald-400 hover:bg-emerald-950/30"
                  >
                    <Clock className="h-3 w-3 mr-1 text-emerald-400" /> Logs
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Student Roster Modal */}
      {selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-surface-950">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{selectedClass.subject_name}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-surface-800 text-slate-300 font-mono">
                    Sec {selectedClass.section_name}
                  </span>
                  {selectedClass.student_group_name && (
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-semibold border border-emerald-500/30">
                      {selectedClass.student_group_name}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Enrolled Students: <strong className="text-white">{roster.length}</strong> • {selectedClass.course_name}
                </p>
              </div>
              <button
                onClick={() => setSelectedClass(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-surface-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-slate-800 bg-surface-900">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search students by name, roll number, or email..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-surface-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {loadingRoster ? (
                <div className="py-12 text-center text-slate-500 text-sm">Loading enrolled student roster...</div>
              ) : filteredRoster.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  {roster.length === 0
                    ? "No students currently enrolled in this section/group."
                    : "No students matching your search."}
                </div>
              ) : (
                filteredRoster.map((s, idx) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-950/70 border border-slate-800 text-xs hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-500 w-6 text-right">{idx + 1}.</span>
                      <div>
                        <p className="font-semibold text-white">{s.full_name}</p>
                        <p className="text-slate-400 font-mono text-[11px]">{s.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/20">
                        {s.roll_number}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                        s.is_active
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                          : "bg-surface-800 text-slate-400"
                      }`}>
                        {s.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
