"use client";

import React from "react";
import { Card } from "./Card";
import { cn } from "@/lib/utils";

export default function KpiCard({
  label,
  value,
  delta,
  className,
}: {
  label: string;
  value: string | number;
  delta?: string | number | null;
  className?: string;
}) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
        </div>
        {delta ? (
          <div className="text-right">
            <p className="text-sm font-medium text-emerald-300">{delta}</p>
            <p className="text-xs text-slate-400">vs last week</p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
