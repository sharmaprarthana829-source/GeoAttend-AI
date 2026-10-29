"use client";

import React from "react";
import { UserX, DoorClosed, Users, CheckCircle2, AlertOctagon } from "lucide-react";

export function TimetableLegend() {
  const items = [
    {
      label: "Faculty Conflict",
      description: "Instructor assigned to multiple classes at overlapping times",
      icon: UserX,
      badgeClass: "bg-amber-950/60 border-amber-500/40 text-amber-300",
      dotClass: "bg-amber-400",
    },
    {
      label: "Room Conflict",
      description: "Same room booked for overlapping classes on the same day",
      icon: DoorClosed,
      badgeClass: "bg-rose-950/60 border-rose-500/40 text-rose-300",
      dotClass: "bg-rose-400",
    },
    {
      label: "Group Conflict",
      description: "Section or student group scheduled for 2 classes at once",
      icon: Users,
      badgeClass: "bg-purple-950/60 border-purple-500/40 text-purple-300",
      dotClass: "bg-purple-400",
    },
    {
      label: "Multiple Clashes",
      description: "Combination of room, faculty, or cohort collisions",
      icon: AlertOctagon,
      badgeClass: "bg-gradient-to-r from-rose-950/60 to-purple-950/60 border-rose-500/50 text-white",
      dotClass: "bg-gradient-to-r from-rose-400 to-purple-400",
    },
    {
      label: "Conflict-Free",
      description: "Clean verified schedule slot with no active clashes",
      icon: CheckCircle2,
      badgeClass: "bg-emerald-950/40 border-emerald-500/30 text-emerald-300",
      dotClass: "bg-emerald-400",
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-surface-900/50 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <span>Timetable Conflict Legend</span>
          <span className="text-[10px] lowercase text-slate-400">(Deterministic interval overlap validation)</span>
        </h4>
        <span className="text-[11px] text-slate-400 font-mono">
          Rule: existing_start &lt; new_end AND new_start &lt; existing_end
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className={`flex items-start gap-2.5 p-2.5 rounded-xl border ${item.badgeClass}`}
            >
              <div className="mt-0.5">
                <Icon className="h-4 w-4 shrink-0" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-tight">{item.label}</p>
                <p className="text-[10px] text-slate-300/80 leading-normal mt-0.5">
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
