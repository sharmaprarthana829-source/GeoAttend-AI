"use client";

import React from "react";
import { TimetableEntry, DayOfWeek } from "@/lib/api";
import {
  Clock,
  DoorClosed,
  UserCheck,
  AlertTriangle,
  Layers,
  Sparkles,
  Info,
} from "lucide-react";

interface TimetableGridViewProps {
  entries: TimetableEntry[];
  onSelectEntry: (entry: TimetableEntry) => void;
}

const DAYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export function TimetableGridView({ entries, onSelectEntry }: TimetableGridViewProps) {
  // Group entries by day
  const entriesByDay = DAYS.reduce((acc, day) => {
    acc[day] = entries
      .filter((e) => e.day_of_week === day)
      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
    return acc;
  }, {} as Record<DayOfWeek, TimetableEntry[]>);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
      {DAYS.map((day) => {
        const dayEntries = entriesByDay[day] || [];
        const hasConflicts = dayEntries.some((e) => e.has_conflict);

        return (
          <div
            key={day}
            className="flex flex-col rounded-2xl border border-slate-800/80 bg-surface-900/60 overflow-hidden"
          >
            {/* Day Header */}
            <div className="p-3 border-b border-slate-800 bg-surface-850 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                {day}
              </span>
              <div className="flex items-center gap-1.5">
                {hasConflicts && (
                  <span className="p-1 rounded-full bg-rose-500/20 text-rose-400">
                    <AlertTriangle className="h-3 w-3" />
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-surface-700 text-slate-300">
                  {dayEntries.length}
                </span>
              </div>
            </div>

            {/* Day Column Entries */}
            <div className="p-2 space-y-2.5 flex-1 min-h-[300px]">
              {dayEntries.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                  <p className="text-xs text-slate-400">No scheduled classes</p>
                </div>
              ) : (
                dayEntries.map((e) => {
                  const hasConflict = e.has_conflict;
                  const types = e.conflict_types || [];
                  const isFaculty = types.includes("faculty");
                  const isRoom = types.includes("room");
                  const isGroup = types.includes("student_group");

                  let cardBorder = "border-slate-800 hover:border-slate-700 bg-surface-800/50";
                  let cardGlow = "";
                  let timeColor = "text-emerald-400";

                  if (hasConflict) {
                    if (types.length > 1) {
                      cardBorder = "border-rose-500/70 bg-gradient-to-b from-rose-950/40 to-purple-950/40 shadow-rose-950/30";
                      cardGlow = "ring-1 ring-rose-500/30";
                      timeColor = "text-rose-400";
                    } else if (isFaculty) {
                      cardBorder = "border-amber-500/60 bg-amber-950/30 shadow-amber-950/20";
                      cardGlow = "ring-1 ring-amber-500/30";
                      timeColor = "text-amber-400";
                    } else if (isRoom) {
                      cardBorder = "border-rose-500/60 bg-rose-950/30 shadow-rose-950/20";
                      cardGlow = "ring-1 ring-rose-500/30";
                      timeColor = "text-rose-400";
                    } else if (isGroup) {
                      cardBorder = "border-purple-500/60 bg-purple-950/30 shadow-purple-950/20";
                      cardGlow = "ring-1 ring-purple-500/30";
                      timeColor = "text-purple-400";
                    }
                  }

                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => onSelectEntry(e)}
                      className={`w-full text-left rounded-xl border p-2.5 transition-all duration-200 cursor-pointer shadow-sm ${cardBorder} ${cardGlow} hover:-translate-y-0.5`}
                    >
                      {/* Card Top: Time & Type */}
                      <div className="flex items-center justify-between text-[11px] mb-1.5">
                        <span className={`font-mono font-bold ${timeColor}`}>
                          {e.start_time?.slice(0, 5)} - {e.end_time?.slice(0, 5)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase font-mono bg-surface-900/90 text-slate-300 border border-slate-700">
                          {e.class_type}
                        </span>
                      </div>

                      {/* Subject Name & Code */}
                      <p className="text-xs font-bold text-white leading-snug line-clamp-2">
                        {e.subject_name}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400 mb-2">
                        {e.subject_code}
                      </p>

                      {/* Room & Teacher */}
                      <div className="space-y-1 text-[11px] text-slate-300 pt-1.5 border-t border-slate-800/80">
                        <div className="flex items-center gap-1.5 font-mono text-slate-200">
                          <DoorClosed className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate">{e.room_number}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <UserCheck className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate">{e.faculty_name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <Layers className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {e.section_name} {e.student_group_name ? `(${e.student_group_name})` : ""}
                          </span>
                        </div>
                      </div>

                      {/* Conflict Indicators */}
                      {hasConflict && (
                        <div className="mt-2 pt-1.5 border-t border-rose-500/20 flex flex-wrap gap-1">
                          {isFaculty && (
                            <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Faculty
                            </span>
                          )}
                          {isRoom && (
                            <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Room
                            </span>
                          )}
                          {isGroup && (
                            <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              Cohort
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
