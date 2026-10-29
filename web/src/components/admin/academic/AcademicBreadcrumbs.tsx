"use client";

import React from "react";
import { ChevronRight, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BreadcrumbNode } from "./types";

interface AcademicBreadcrumbsProps {
  breadcrumbs: BreadcrumbNode[];
  onBack?: () => void;
  backLabel?: string;
}

export function AcademicBreadcrumbs({
  breadcrumbs,
  onBack,
  backLabel,
}: AcademicBreadcrumbsProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-900/40 p-3 rounded-xl border border-slate-800/80">
      <nav aria-label="Academic Breadcrumbs" className="flex items-center flex-wrap gap-1 text-xs sm:text-sm">
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <React.Fragment key={`${item.level}-${index}`}>
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-slate-600 shrink-0 mx-0.5" />
              )}
              {isLast ? (
                <span
                  className="font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1.5 shadow-sm"
                  aria-current="page"
                >
                  {index === 0 && <Home className="h-3 w-3" />}
                  {item.label}
                  {item.sublabel && (
                    <span className="text-[10px] text-emerald-500/80 font-mono">
                      ({item.sublabel})
                    </span>
                  )}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="text-slate-400 hover:text-white transition-colors px-1.5 py-0.5 rounded hover:bg-slate-800/60 flex items-center gap-1"
                >
                  {index === 0 && <Home className="h-3 w-3" />}
                  {item.label}
                </button>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {onBack && (
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="border-slate-800 hover:border-slate-700 bg-surface-900/60 text-slate-300 hover:text-white text-xs flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel ?? "Back"}
        </Button>
      )}
    </div>
  );
}
