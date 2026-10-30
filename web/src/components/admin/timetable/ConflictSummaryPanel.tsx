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
  const totalConflicts = summary.faculty_conflicts + summary.room_conflicts + summary.student_group_conflicts;

  const cards = [
    {
      id: "all",
      label: "Total Classes",
      count: summary.total_entries,
      subtext: "Scheduled this week",
      icon: CalendarDays,
      color: "text-white",
      activeBg: "bg-surface-800 border-emerald-500/50 shadow-emerald-500/10",
      iconBg: "bg-surface-700/60 text-emerald-400",
    },
    {
      id: "conflict_free",
      label: "Valid & Conflict-Free",
      count: summary.conflict_free,
      subtext: "Ready for attendance",
      icon: CheckCircle2,
      color: "text-emerald-400",
      activeBg: "bg-emerald-950/40 border-emerald-500/60 shadow-emerald-500/10",
      iconBg: "bg-emerald-500/20 text-emerald-400",
    },
    {
      id: "conflict",
      label: "Room / Time Conflicts",
      count: totalConflicts,
      subtext: totalConflicts > 0 ? `${totalConflicts} overlap clashes` : "No clashes detected",
      icon: AlertTriangle,
      color: totalConflicts > 0 ? "text-amber-400" : "text-slate-400",
      activeBg: "bg-amber-950/40 border-amber-500/60 shadow-amber-500/10",
      iconBg: totalConflicts > 0 ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
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
              <span className="text-xs text-slate-500 font-medium">
                {card.subtext}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
