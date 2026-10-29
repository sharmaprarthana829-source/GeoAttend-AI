"use client";

import React from "react";
import { Card } from "@/components/ui/Card";
import {
  CalendarDays,
  UserX,
  DoorClosed,
  Users,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { TimetableConflictSummary } from "@/lib/api";

interface ConflictSummaryPanelProps {
  summary: TimetableConflictSummary;
  activeConflictFilter: string;
  onSelectFilter: (filter: string) => void;
}

export function ConflictSummaryPanel({
  summary,
  activeConflictFilter,
  onSelectFilter,
}: ConflictSummaryPanelProps) {
  const cards = [
    {
      id: "all",
      label: "Total Schedule Entries",
      count: summary.total_entries,
      subtext: summary.has_any_conflict ? "Conflicts detected" : "All scheduled",
      icon: CalendarDays,
      color: "text-slate-300",
      activeBg: "bg-surface-800 border-emerald-500/50 shadow-emerald-500/10",
      iconBg: "bg-surface-700/60 text-emerald-400",
    },
    {
      id: "faculty",
      label: "Faculty Overlaps",
      count: summary.faculty_conflicts,
      subtext: "Instructor double-booked",
      icon: UserX,
      color: "text-amber-400",
      activeBg: "bg-amber-950/40 border-amber-500/60 shadow-amber-500/10",
      iconBg: "bg-amber-500/20 text-amber-400",
    },
    {
      id: "room",
      label: "Room Collisions",
      count: summary.room_conflicts,
      subtext: "Same room occupied",
      icon: DoorClosed,
      color: "text-rose-400",
      activeBg: "bg-rose-950/40 border-rose-500/60 shadow-rose-500/10",
      iconBg: "bg-rose-500/20 text-rose-400",
    },
    {
      id: "student_group",
      label: "Group Collisions",
      count: summary.student_group_conflicts,
      subtext: "Cohort/section overlap",
      icon: Users,
      color: "text-purple-400",
      activeBg: "bg-purple-950/40 border-purple-500/60 shadow-purple-500/10",
      iconBg: "bg-purple-500/20 text-purple-400",
    },
    {
      id: "conflict_free",
      label: "Conflict-Free Entries",
      count: summary.conflict_free,
      subtext: "Clean valid schedule",
      icon: CheckCircle2,
      color: "text-emerald-400",
      activeBg: "bg-emerald-950/40 border-emerald-500/60 shadow-emerald-500/10",
      iconBg: "bg-emerald-500/20 text-emerald-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = activeConflictFilter === card.id;

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelectFilter(activeConflictFilter === card.id && card.id !== "all" ? "all" : card.id)}
            className={`text-left rounded-2xl border p-4 transition-all duration-200 cursor-pointer ${
              isActive
                ? `${card.activeBg} shadow-lg ring-1 ring-inset ring-white/10`
                : "border-slate-800/80 bg-surface-900/60 hover:bg-surface-850 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400 truncate pr-2">
                {card.label}
              </span>
              <div className={`p-2 rounded-xl ${card.iconBg}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold font-mono tracking-tight ${card.color}`}>
                {card.count}
              </span>
              {card.id !== "all" && card.id !== "conflict_free" && card.count > 0 && (
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300">
                  Clash
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 truncate">
              {card.subtext}
            </p>
          </button>
        );
      })}
    </div>
  );
}
