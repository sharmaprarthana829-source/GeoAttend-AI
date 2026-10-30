"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  api,
  TimetableEntry,
  SubjectOffering,
  FacultyAssignment,
  DayOfWeek,
  ClassType,
  TimetableConflictSummary,
} from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  CalendarDays,
  Plus,
  Upload,
  RefreshCw,
  Search,
  Filter,
  X,
  LayoutGrid,
  Table as TableIcon,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Edit,
  Trash2,
  Clock,
  DoorClosed,
  UserCheck,
  Layers,
  Sparkles,
  Info,
} from "lucide-react";

import { ConflictSummaryPanel } from "@/components/admin/timetable/ConflictSummaryPanel";
import { TimetableLegend } from "@/components/admin/timetable/TimetableLegend";
import { AddEditTimetableModal } from "@/components/admin/timetable/AddEditTimetableModal";
import { ViewTimetableModal } from "@/components/admin/timetable/ViewTimetableModal";
import { DeleteTimetableModal } from "@/components/admin/timetable/DeleteTimetableModal";
import { CsvUploadModal } from "@/components/admin/timetable/CsvUploadModal";
import { TimetableGridView } from "@/components/admin/timetable/TimetableGridView";

export default function TimetablePage() {
  // Main state
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [offerings, setOfferings] = useState<SubjectOffering[]>([]);
  const [assignments, setAssignments] = useState<FacultyAssignment[]>([]);
  const [knownRooms, setKnownRooms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // View state: 'table' vs 'grid'
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [dayFilter, setDayFilter] = useState<DayOfWeek | "">("");
  const [facultyFilter, setFacultyFilter] = useState<string>("");
  const [subjectFilter, setSubjectFilter] = useState<string>("");
  const [roomFilter, setRoomFilter] = useState<string>("");
  const [classTypeFilter, setClassTypeFilter] = useState<ClassType | "">("");
  const [conflictFilter, setConflictFilter] = useState<string>("all");

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
  const [viewingEntry, setViewingEntry] = useState<TimetableEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<TimetableEntry | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  // Load backend data
  useEffect(() => {
    loadTimetableData();
  }, []);

  async function loadTimetableData() {
    setLoading(true);
    try {
      const [ttEntries, offs, asgns, roomsData] = await Promise.all([
        api.timetable.getEntries({ is_active: true }),
        api.subjects.getOfferings({ is_active: true }).catch(() => []),
        api.subjects.getAssignments({ is_active: true }).catch(() => []),
        api.rooms.getRooms().catch(() => []),
      ]);

      setEntries(ttEntries);
      setOfferings(offs);
      setAssignments(asgns);

      // Collect unique rooms from rooms API + existing timetable entries
      const roomNames = new Set<string>();
      roomsData.forEach((r) => r.name && roomNames.add(r.name));
      ttEntries.forEach((t) => t.room_number && roomNames.add(t.room_number));
      setKnownRooms(Array.from(roomNames).sort());
    } catch (err) {
      console.error("Error loading timetable data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Calculate dynamic conflict summary from loaded active entries
  const summary: TimetableConflictSummary = useMemo(() => {
    const total = entries.length;
    let facultyClashes = 0;
    let roomClashes = 0;
    let groupClashes = 0;
    let free = 0;

    entries.forEach((e) => {
      const types = e.conflict_types || [];
      if (types.includes("faculty")) facultyClashes++;
      if (types.includes("room")) roomClashes++;
      if (types.includes("student_group")) groupClashes++;
      if (!e.has_conflict) free++;
    });

    return {
      total_entries: total,
      faculty_conflicts: facultyClashes,
      room_conflicts: roomClashes,
      student_group_conflicts: groupClashes,
      conflict_free: free,
      has_any_conflict: facultyClashes > 0 || roomClashes > 0 || groupClashes > 0,
    };
  }, [entries]);

  // Compute counts per day
  const dayCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: entries.length,
      monday: 0,
      tuesday: 0,
      wednesday: 0,
      thursday: 0,
      friday: 0,
      saturday: 0,
    };
    entries.forEach((e) => {
      if (e.day_of_week && counts[e.day_of_week] !== undefined) {
        counts[e.day_of_week]++;
      }
    });
    return counts;
  }, [entries]);

  // Unique faculty and subjects for filter dropdowns
  const facultyOptions = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => e.faculty_name && set.add(e.faculty_name));
    return Array.from(set).sort();
  }, [entries]);

  const subjectOptions = useMemo(() => {
    const map = new Map<string, string>();
    entries.forEach((e) => {
      if (e.subject_code && e.subject_name) {
        map.set(e.subject_code, `${e.subject_code} - ${e.subject_name}`);
      }
    });
    return Array.from(map.entries());
  }, [entries]);

  // Filtered dataset
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      // Day filter
      if (dayFilter && e.day_of_week !== dayFilter) return false;

      // Class type filter
      if (classTypeFilter && e.class_type !== classTypeFilter) return false;

      // Faculty filter
      if (facultyFilter && e.faculty_name !== facultyFilter) return false;

      // Subject filter
      if (subjectFilter && e.subject_code !== subjectFilter) return false;

      // Room filter
      if (roomFilter && e.room_number?.toLowerCase() !== roomFilter.toLowerCase()) return false;

      // Conflict status filter
      if (conflictFilter === "conflict" && !e.has_conflict) return false;
      if (conflictFilter === "conflict_free" && e.has_conflict) return false;
      if (conflictFilter === "faculty" && !(e.conflict_types?.includes("faculty"))) return false;
      if (conflictFilter === "room" && !(e.conflict_types?.includes("room"))) return false;
      if (conflictFilter === "student_group" && !(e.conflict_types?.includes("student_group"))) return false;

      // Search query across all fields
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matches =
          (e.subject_name && e.subject_name.toLowerCase().includes(q)) ||
          (e.subject_code && e.subject_code.toLowerCase().includes(q)) ||
          (e.faculty_name && e.faculty_name.toLowerCase().includes(q)) ||
          (e.employee_id && e.employee_id.toLowerCase().includes(q)) ||
          (e.room_number && e.room_number.toLowerCase().includes(q)) ||
          (e.course_name && e.course_name.toLowerCase().includes(q)) ||
          (e.branch_name && e.branch_name.toLowerCase().includes(q)) ||
          (e.section_name && e.section_name.toLowerCase().includes(q)) ||
          (e.student_group_name && e.student_group_name.toLowerCase().includes(q)) ||
          (e.day_of_week && e.day_of_week.toLowerCase().includes(q)) ||
          (e.class_type && e.class_type.toLowerCase().includes(q)) ||
          (e.start_time && e.start_time.includes(q)) ||
          (e.end_time && e.end_time.includes(q));

        if (!matches) return false;
      }

      return true;
    });
  }, [
    entries,
    dayFilter,
    classTypeFilter,
    facultyFilter,
    subjectFilter,
    roomFilter,
    conflictFilter,
    searchQuery,
  ]);

  function handleClearFilters() {
    setSearchQuery("");
    setDayFilter("");
    setFacultyFilter("");
    setSubjectFilter("");
    setRoomFilter("");
    setClassTypeFilter("");
    setConflictFilter("all");
  }

  const hasActiveFilters = Boolean(
    searchQuery ||
      dayFilter ||
      facultyFilter ||
      subjectFilter ||
      roomFilter ||
      classTypeFilter ||
      conflictFilter !== "all"
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav className="text-xs text-slate-400 mb-1">Dashboard / Academic Schedule</nav>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Class Timetable &amp; Schedule
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Weekly class schedule, room allocations, and faculty lecture timings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Switcher */}
          <div className="flex items-center rounded-xl border border-slate-800 bg-surface-900 p-0.5">
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "table"
                  ? "bg-surface-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" /> Table
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "grid"
                  ? "bg-surface-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Weekly Grid
            </button>
          </div>

          <Button
            onClick={() => setIsCsvModalOpen(true)}
            variant="outline"
            className="flex items-center gap-2 text-xs"
          >
            <Upload className="h-3.5 w-3.5" /> CSV Upload
          </Button>

          <Button
            onClick={() => {
              setEditingEntry(null);
              setIsAddEditOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 text-xs shadow-lg shadow-emerald-950/40"
          >
            <Plus className="h-4 w-4" /> Add Schedule Entry
          </Button>

          <Button
            onClick={loadTimetableData}
            variant="outline"
            className="flex items-center gap-2 text-xs"
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Conflict Summary Cards Panel */}
      <ConflictSummaryPanel
        summary={summary}
        activeConflictFilter={conflictFilter}
        onSelectFilter={(f) => setConflictFilter(f)}
      />

      {/* Search Bar & Multi-Dimensional Filters Card */}
      <Card className="p-4 border-slate-800/80 bg-surface-900/80 space-y-3.5">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Prominent Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by subject name/code, faculty, room (e.g. C-204), branch, section, group B1/B2, or time..."
              className="pl-10 text-xs sm:text-sm bg-surface-950/80 border-slate-700/80 rounded-xl"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Faculty Dropdown */}
            <select
              value={facultyFilter}
              onChange={(e) => setFacultyFilter(e.target.value)}
              className="rounded-xl border border-slate-700 bg-surface-950 px-3 py-2 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none"
            >
              <option value="">All Faculty</option>
              {facultyOptions.map((fac) => (
                <option key={fac} value={fac}>
                  {fac}
                </option>
              ))}
            </select>

            {/* Subject Dropdown */}
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="rounded-xl border border-slate-700 bg-surface-950 px-3 py-2 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none"
            >
              <option value="">All Subjects</option>
              {subjectOptions.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>

            {/* Room Dropdown */}
            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="rounded-xl border border-slate-700 bg-surface-950 px-3 py-2 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none"
            >
              <option value="">All Rooms</option>
              {knownRooms.map((r) => (
                <option key={r} value={r}>
                  Room {r}
                </option>
              ))}
            </select>

            {/* Class Type */}
            <select
              value={classTypeFilter}
              onChange={(e) => setClassTypeFilter(e.target.value as ClassType | "")}
              className="rounded-xl border border-slate-700 bg-surface-950 px-3 py-2 text-xs text-slate-300 uppercase focus:border-emerald-500 focus:outline-none"
            >
              <option value="">All Types</option>
              <option value="theory">Theory</option>
              <option value="lab">Lab</option>
            </select>

            {/* Conflict Status */}
            <select
              value={conflictFilter}
              onChange={(e) => setConflictFilter(e.target.value)}
              className="rounded-xl border border-slate-700 bg-surface-950 px-3 py-2 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none"
            >
              <option value="all">All Conflict Statuses</option>
              <option value="conflict">Has Conflicts</option>
              <option value="conflict_free">Conflict-Free Only</option>
              <option value="faculty">Faculty Overlaps</option>
              <option value="room">Room Collisions</option>
              <option value="student_group">Group Collisions</option>
            </select>

            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="text-xs h-9 px-3 flex items-center gap-1.5 text-rose-400 hover:text-rose-300 border-rose-500/30"
              >
                <X className="h-3.5 w-3.5" /> Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Day Tabs with Live Counts */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={() => setDayFilter("")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              dayFilter === ""
                ? "bg-emerald-950 text-emerald-400 border border-emerald-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All Days ({dayCounts.all})
          </button>
          {(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDayFilter(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                dayFilter === d
                  ? "bg-emerald-950 text-emerald-400 border border-emerald-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {d} ({dayCounts[d] || 0})
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-400 font-mono">
            Showing <strong className="text-white">{filteredEntries.length}</strong> of {entries.length} records
          </span>
        </div>
      </Card>


      {/* Main Content: Table View OR Weekly Grid View */}
      {viewMode === "grid" ? (
        <TimetableGridView
          entries={filteredEntries}
          onSelectEntry={(entry) => setViewingEntry(entry)}
        />
      ) : (
        <Card className="p-0 border-slate-800/80 bg-surface-900/70 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-auto">
              <thead>
                <tr className="text-left text-xs text-slate-400 bg-surface-850/80 border-b border-slate-800">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Day</th>
                  <th className="py-3 px-4">Time Interval</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Section / Group</th>
                  <th className="py-3 px-4">Faculty</th>
                  <th className="py-3 px-4">Room</th>
                  <th className="py-3 px-4">Conflict Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs">Loading timetable entries and validating conflicts...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <CalendarDays className="h-8 w-8 text-slate-600 mb-1" />
                        <span className="text-sm font-semibold text-slate-300">
                          No schedule entries match the selected filters
                        </span>
                        {hasActiveFilters && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleClearFilters}
                            className="text-xs mt-2 text-emerald-400 border-emerald-500/30"
                          >
                            Reset All Filters
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((t) => {
                    const hasConflict = t.has_conflict;
                    const types = t.conflict_types || [];
                    const isFaculty = types.includes("faculty");
                    const isRoom = types.includes("room");
                    const isGroup = types.includes("student_group");

                    // Row highlight based on conflict category
                    let rowBg = "hover:bg-surface-800/40";
                    if (hasConflict) {
                      if (types.length > 1) {
                        rowBg = "bg-rose-950/20 hover:bg-rose-950/30 border-l-4 border-l-rose-500";
                      } else if (isFaculty) {
                        rowBg = "bg-amber-950/20 hover:bg-amber-950/30 border-l-4 border-l-amber-500";
                      } else if (isRoom) {
                        rowBg = "bg-rose-950/20 hover:bg-rose-950/30 border-l-4 border-l-rose-500";
                      } else if (isGroup) {
                        rowBg = "bg-purple-950/20 hover:bg-purple-950/30 border-l-4 border-l-purple-500";
                      }
                    }

                    return (
                      <tr key={t.id} className={`transition-colors ${rowBg}`}>
                        <td className="py-3 px-4 font-mono text-xs text-slate-400">#{t.id}</td>
                        <td className="py-3 px-4 font-semibold text-white uppercase text-xs tracking-wider">
                          {t.day_of_week}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-emerald-400 whitespace-nowrap">
                          {t.start_time?.slice(0, 5)} - {t.end_time?.slice(0, 5)}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-white leading-tight">{t.subject_name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{t.subject_code}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                              t.class_type === "lab"
                                ? "bg-purple-950/80 text-purple-300 border border-purple-500/30"
                                : "bg-surface-800 text-slate-300 border border-slate-700"
                            }`}
                          >
                            {t.class_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-300 whitespace-nowrap">
                          <p className="font-medium text-white">{t.section_name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            {t.student_group_name ? `Group ${t.student_group_name}` : "Whole Section"}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-200">
                          <p className="font-medium text-white">{t.faculty_name || "Unassigned"}</p>
                          {t.employee_id && (
                            <p className="text-[10px] font-mono text-slate-400">{t.employee_id}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-200 font-semibold whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <DoorClosed className="h-3 w-3 text-slate-400" />
                            {t.room_number}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {hasConflict ? (
                            <button
                              type="button"
                              onClick={() => setViewingEntry(t)}
                              className="flex items-center gap-1.5 cursor-pointer text-left group"
                              title="Click to view conflict diagnostics"
                            >
                              {isFaculty && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-amber-950 border border-amber-500/40 text-amber-300 group-hover:border-amber-400">
                                  <AlertTriangle className="h-2.5 w-2.5 text-amber-400" /> Faculty Clash
                                </span>
                              )}
                              {isRoom && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-rose-950 border border-rose-500/40 text-rose-300 group-hover:border-rose-400">
                                  <AlertTriangle className="h-2.5 w-2.5 text-rose-400" /> Room Clash
                                </span>
                              )}
                              {isGroup && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-purple-950 border border-purple-500/40 text-purple-300 group-hover:border-purple-400">
                                  <AlertTriangle className="h-2.5 w-2.5 text-purple-400" /> Cohort Clash
                                </span>
                              )}
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/40 border border-emerald-500/30 text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" /> Validated
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setViewingEntry(t)}
                              className="text-slate-300 hover:text-white text-xs h-7 w-7 p-0"
                              title="View details & diagnostics"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingEntry(t);
                                setIsAddEditOpen(true);
                              }}
                              className="text-slate-300 hover:text-emerald-300 text-xs h-7 w-7 p-0"
                              title="Edit schedule entry"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeletingEntry(t)}
                              className="text-rose-400 hover:text-rose-300 border-rose-500/20 text-xs h-7 w-7 p-0"
                              title="Deactivate entry"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add / Edit Timetable Modal */}
      <AddEditTimetableModal
        isOpen={isAddEditOpen}
        onClose={() => setIsAddEditOpen(false)}
        initialData={editingEntry}
        offerings={offerings}
        assignments={assignments}
        rooms={knownRooms}
        onSuccess={loadTimetableData}
      />

      {/* View Details Modal */}
      <ViewTimetableModal
        isOpen={Boolean(viewingEntry)}
        onClose={() => setViewingEntry(null)}
        entry={viewingEntry}
        onEdit={(e) => {
          setEditingEntry(e);
          setIsAddEditOpen(true);
        }}
        onDelete={(e) => {
          setDeletingEntry(e);
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteTimetableModal
        isOpen={Boolean(deletingEntry)}
        onClose={() => setDeletingEntry(null)}
        entry={deletingEntry}
        onSuccess={loadTimetableData}
      />

      {/* CSV Batch Upload Modal */}
      <CsvUploadModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onSuccess={loadTimetableData}
      />
    </div>
  );
}
