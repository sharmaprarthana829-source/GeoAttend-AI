"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  CoordinatorDeskSummary,
  CoordinatorMatrixResponse,
  StudentDetail,
} from "@/lib/api";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  GraduationCap,
  Users,
  AlertTriangle,
  Percent,
  Search,
  Download,
  ArrowLeft,
  Smartphone,
  RefreshCw,
  Info,
} from "lucide-react";

export default function FacultyCoordinatorDeskPage() {
  const { user } = useDashboard();
  const router = useRouter();

  const [summary, setSummary] = useState<CoordinatorDeskSummary | null>(null);
  const [matrix, setMatrix] = useState<CoordinatorMatrixResponse | null>(null);
  const [students, setStudents] = useState<StudentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"matrix" | "roster">("matrix");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterShortOnly, setFilterShortOnly] = useState(false);

  useEffect(() => {
    loadCoordinatorData();
  }, [user]);

  async function loadCoordinatorData() {
    if (user?.role !== "faculty") return;
    setLoading(true);
    try {
      const [sum, mat, studs] = await Promise.all([
        api.faculty.coordinator.getDesk().catch(() => null),
        api.faculty.coordinator.getMatrix().catch(() => null),
        api.faculty.coordinator.getStudents().catch(() => []),
      ]);
      setSummary(sum);
      setMatrix(mat);
      setStudents(studs);
    } catch (err) {
      console.error("Error loading coordinator desk:", err);
    } finally {
      setLoading(false);
    }
  }

  // Dynamic configured threshold from backend settings (e.g. 78.5% or 75%)
  const threshold = summary?.attendance_threshold || matrix?.attendance_threshold || 75;

  // Filtered matrix rows
  const filteredMatrixStudents = useMemo(() => {
    if (!matrix?.students) return [];
    return matrix.students.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.full_name.toLowerCase().includes(q) ||
        s.roll_number.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (filterShortOnly && !s.is_short_attendance) return false;
      return true;
    });
  }, [matrix, searchQuery, filterShortOnly]);

  // Filtered roster students
  const filteredRoster = useMemo(() => {
    return students.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const text = `${s.full_name} ${s.roll_number} ${s.email}`.toLowerCase();
      return text.includes(q);
    });
  }, [students, searchQuery]);

  function exportMatrixCSV() {
    if (!matrix || !matrix.students.length) return;
    const thresh = threshold;

    const metaRows = [
      `"# GeoAttend AI - Section Attendance Matrix Export"`,
      `"# Section: ${matrix.section_name}", "Section ID: ${matrix.section_id}"`,
      `"# Attendance Threshold: ${thresh}%", "Export Date: ${new Date().toISOString()}"`,
      "",
    ];

    const headers = [
      "Roll Number",
      "Student Name",
      "Email",
      "Overall Attendance %",
      `Short Attendance (<${thresh}%)`,
      ...matrix.subjects_header.flatMap((sh) => {
        const code = sh.subject_code || sh.code || "";
        const name = sh.subject_name || sh.name || "";
        const typeStr = sh.class_type ? ` [${sh.class_type}]` : "";
        return [
          `"${code} - ${name}${typeStr} (%)"`,
          `"${code} Attended / Eligible"`,
        ];
      }),
    ];

    const rows = matrix.students.map((s) => {
      const overallStr = s.overall_percentage != null ? `${s.overall_percentage}%` : "N/A";
      const shortStr =
        s.overall_percentage == null
          ? "NO SESSIONS"
          : s.is_short_attendance
          ? "YES"
          : "NO";

      const subjectCols = matrix.subjects_header.flatMap((sh) => {
        const code = sh.subject_code || sh.code;
        const sub = s.subjects.find((sub) => sub.subject_code === code);
        if (!sub || sub.total === 0 || sub.percentage == null) {
          return ['"N/A"', '"0/0"'];
        }
        return [`"${sub.percentage}%"`, `"${sub.attended}/${sub.total}"`];
      });

      return [
        `"${s.roll_number}"`,
        `"${s.full_name}"`,
        `"${s.email}"`,
        `"${overallStr}"`,
        `"${shortStr}"`,
        ...subjectCols,
      ].join(",");
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      encodeURIComponent([...metaRows, headers.join(","), ...rows].join("\n"));
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute(
      "download",
      `section_${summary?.section_name || "coordinator"}_attendance_matrix_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // If user does not have coordinator role
  if (!loading && (!summary || !summary.has_coordinator_role)) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-12">
        <Card className="p-8 text-center border-slate-800 bg-surface-900">
          <GraduationCap className="h-16 w-16 text-amber-500/50 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white">Coordinator Desk Access Required</h2>
          <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
            You do not currently have an active Section Coordinator responsibility assigned to your faculty profile.
          </p>
          <div className="mt-6">
            <Button onClick={() => router.push("/dashboard/faculty")} variant="outline" className="text-xs">
              Return to Faculty Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => router.push("/dashboard/faculty")}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 mb-2 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Faculty Dashboard
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <GraduationCap className="h-6 w-6 text-amber-400" /> Section Coordinator Desk
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-500/30">
              Section {summary?.section_name}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Section monitoring, comprehensive multi-subject attendance matrix, and short-attendance alerts.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            onClick={loadCoordinatorData}
            variant="outline"
            className="text-xs flex items-center gap-1.5 border-slate-700 hover:bg-surface-800"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button
            onClick={exportMatrixCSV}
            variant="outline"
            disabled={!matrix || matrix.students.length === 0}
            className="text-xs flex items-center gap-1.5 border-slate-700 hover:bg-surface-800"
          >
            <Download className="h-3.5 w-3.5" /> Export Matrix CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Enrolled Students */}
        <Card className="p-5 border-slate-800 bg-surface-900/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Section Students</span>
            <Users className="h-5 w-5 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-white mt-2">{summary?.total_students || 0}</p>
          <p className="text-xs text-slate-400 mt-1">
            {summary?.course_name} • {summary?.branch_name} • Sem {summary?.semester}
          </p>
        </Card>

        {/* Average Attendance */}
        <Card className="p-5 border-slate-800 bg-surface-900/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Section Average</span>
            <Percent className="h-5 w-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-emerald-400 mt-2">
            {summary?.average_section_attendance != null ? `${summary.average_section_attendance}%` : "N/A"}
          </p>
          <p className="text-xs text-slate-400 mt-1">Aggregate across all eligible sessions</p>
        </Card>

        {/* Short Attendance Alert */}
        <Card className="p-5 border-slate-800 bg-surface-900/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Short Attendance</span>
            <AlertTriangle className="h-5 w-5 text-rose-400" />
          </div>
          <p className="text-3xl font-bold text-rose-400 mt-2">{summary?.short_attendance_count || 0}</p>
          <p className="text-xs text-rose-300/80 mt-1">Students below {threshold}% threshold</p>
        </Card>
      </div>

      {/* Tabs & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("matrix")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === "matrix"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Multi-Subject Matrix ({filteredMatrixStudents.length})
          </button>
          <button
            onClick={() => setActiveTab("roster")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === "roster"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Students Roster ({filteredRoster.length})
          </button>
        </div>

        {/* Search & Short-Attendance Toggle */}
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search roll, name, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-surface-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {activeTab === "matrix" && (
            <button
              onClick={() => setFilterShortOnly(!filterShortOnly)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                filterShortOnly
                  ? "bg-rose-950 text-rose-300 border border-rose-500/50"
                  : "bg-surface-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Short Attendance Only (&lt;{threshold}%)
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Content */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 text-sm">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mb-3" />
          <p>Loading Coordinator Data...</p>
        </div>
      ) : activeTab === "matrix" ? (
        /* Matrix View */
        <Card className="border-slate-800 bg-surface-900/80 overflow-hidden shadow-xl">
          {!matrix || matrix.students.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-sm">
              No matrix data available for Section {summary?.section_name}.
            </div>
          ) : filteredMatrixStudents.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-sm">
              No students found matching your search or filter criteria.
            </div>
          ) : (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-950 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="py-3 px-4 sticky left-0 bg-surface-950 z-20 whitespace-nowrap">Roll No</th>
                      <th className="py-3 px-4 sticky left-24 bg-surface-950 z-20 whitespace-nowrap min-w-[150px]">Student Name</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap min-w-[100px]">Overall %</th>
                      {matrix.subjects_header.map((sh) => {
                        const code = sh.subject_code || sh.code || "";
                        const name = sh.subject_name || sh.name || "";
                        return (
                          <th
                            key={code}
                            className="py-3 px-3 text-center whitespace-nowrap min-w-[120px]"
                            title={`${name} (${sh.class_type || "Theory"}) • ${sh.total_conducted || 0} sessions conducted`}
                          >
                            <div className="font-bold text-slate-200">{code}</div>
                            <div className="text-[10px] text-slate-400 font-normal truncate max-w-[110px] mx-auto">{name}</div>
                            {sh.class_type && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-surface-800 text-slate-400 uppercase font-mono">
                                {sh.class_type}
                              </span>
                            )}
                          </th>
                        );
                      })}
                      <th className="py-3 px-4 text-center whitespace-nowrap min-w-[110px]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredMatrixStudents.map((st) => (
                      <tr
                        key={st.student_id}
                        className={`hover:bg-surface-800/40 transition-colors ${
                          st.is_short_attendance ? "bg-rose-950/10" : ""
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-medium text-white sticky left-0 bg-surface-900/95 z-10 whitespace-nowrap">
                          {st.roll_number}
                        </td>
                        <td className="py-3 px-4 font-semibold text-white sticky left-24 bg-surface-900/95 z-10 whitespace-nowrap">
                          {st.full_name}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {st.overall_percentage != null ? (
                            <span
                              className={`font-bold font-mono px-2 py-0.5 rounded ${
                                st.overall_percentage < threshold
                                  ? "bg-rose-950 text-rose-300 border border-rose-500/30"
                                  : "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                              }`}
                            >
                              {st.overall_percentage}%
                            </span>
                          ) : (
                            <span className="text-slate-500 font-mono text-xs">N/A</span>
                          )}
                          {st.total_eligible != null && st.total_eligible > 0 && (
                            <span className="text-[10px] text-slate-500 block mt-0.5">
                              ({st.total_attended || 0}/{st.total_eligible})
                            </span>
                          )}
                        </td>

                        {/* Subject Columns */}
                        {matrix.subjects_header.map((sh) => {
                          const code = sh.subject_code || sh.code;
                          const sub = st.subjects.find((s) => s.subject_code === code);
                          if (!sub || sub.total === 0 || sub.percentage == null) {
                            return (
                              <td key={code} className="py-3 px-3 text-center text-slate-500 font-mono">
                                <span className="text-xs text-slate-500 font-medium">N/A</span>
                                <span className="text-[10px] text-slate-600 block">0 sessions</span>
                              </td>
                            );
                          }
                          const isLow = sub.percentage < threshold;
                          return (
                            <td key={code} className="py-3 px-3 text-center">
                              <span
                                className={`font-mono font-medium ${
                                  isLow ? "text-rose-400 font-bold" : "text-emerald-400"
                                }`}
                              >
                                {sub.percentage}%
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                ({sub.attended}/{sub.total})
                              </span>
                            </td>
                          );
                        })}

                        {/* Status Badge */}
                        <td className="py-3 px-4 text-center">
                          {st.overall_percentage == null ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-800 text-slate-400 border border-slate-700">
                              NO SESSIONS
                            </span>
                          ) : st.is_short_attendance ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-500/40">
                              SHORT (&lt;{threshold}%)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                              REGULAR
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Attendance Status Legend */}
              <div className="p-3 bg-surface-950/70 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-medium text-slate-300 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-slate-400" /> Legend:
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" /> Regular (&ge;{threshold}%)
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-400">
                    <span className="h-2 w-2 rounded-full bg-rose-400" /> Short Attendance (&lt;{threshold}%)
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <span className="h-2 w-2 rounded-full bg-slate-500" /> N/A: No conducted sessions
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Overall percentage is aggregated across all eligible conducted sessions.
                </span>
              </div>
            </div>
          )}
        </Card>
      ) : (
        /* Roster View */
        <Card className="border-slate-800 bg-surface-900/80 overflow-hidden shadow-xl">
          {filteredRoster.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-sm">No students found matching your search.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-950 border-b border-slate-800 text-xs uppercase text-slate-400 font-semibold">
                  <tr>
                    <th className="py-3.5 px-4">Roll Number</th>
                    <th className="py-3.5 px-4">Student Name</th>
                    <th className="py-3.5 px-4">Email</th>
                    <th className="py-3.5 px-4">Group</th>
                    <th className="py-3.5 px-4">Device Status</th>
                    <th className="py-3.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredRoster.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-white">{s.roll_number}</td>
                      <td className="py-3.5 px-4 font-semibold text-white">{s.full_name}</td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-xs">{s.email}</td>
                      <td className="py-3.5 px-4 text-xs font-mono text-slate-300">
                        {s.current_group_name ? `Group ${s.current_group_name}` : "Whole Section"}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        {s.device_id ? (
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            <Smartphone className="h-3.5 w-3.5" /> Bound
                          </span>
                        ) : (
                          <span className="text-slate-500">Unbound</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.is_active
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                              : "bg-rose-950 text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          {s.is_active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
