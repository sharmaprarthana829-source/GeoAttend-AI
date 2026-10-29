"use client";

import React, { useState } from "react";
import { Search, Command, X } from "lucide-react";

export default function SearchInput({
  placeholder = "Search subjects, students, timetable, sessions...",
  value,
  onChange,
}: {
  placeholder?: string;
  value?: string;
  onChange?: (val: string) => void;
}) {
  const [internalVal, setInternalVal] = useState("");
  const isControlled = value !== undefined;
  const currentVal = isControlled ? value : internalVal;

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) setInternalVal(e.target.value);
    onChange?.(e.target.value);
  };

  const handleClear = () => {
    if (!isControlled) setInternalVal("");
    onChange?.("");
  };

  return (
    <div className="relative w-full max-w-xl group">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-400 transition-colors">
        <Search className="h-4 w-4" />
      </span>
      <input
        aria-label="Search"
        type="search"
        value={currentVal}
        onChange={handleInput}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-800/80 bg-surface-950/60 py-2 pl-10 pr-16 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner"
      />
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {currentVal ? (
          <button
            onClick={handleClear}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-surface-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-800 bg-surface-900 text-[10px] font-mono text-slate-400">
            <Command className="h-2.5 w-2.5" /> K
          </kbd>
        )}
      </div>
    </div>
  );
}
