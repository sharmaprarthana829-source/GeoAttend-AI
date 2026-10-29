"use client";

import React from "react";
import { ShieldCheck, MapPin, Radio, Building2, Sparkles } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-800/60 bg-surface-950/60 backdrop-blur-md px-6 py-4 text-xs text-slate-400">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 max-w-7xl mx-auto">
        {/* Left: Branding & Compliance */}
        <div className="flex items-center gap-3 flex-wrap text-center sm:text-left">
          <span className="font-semibold text-white flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            GeoAttend AI
          </span>
          <span className="text-slate-600 hidden sm:inline">•</span>
          <span className="text-slate-400">Smart Campus Attendance & Anomaly Platform</span>
          <span className="text-slate-600 hidden md:inline">•</span>
          <span className="text-slate-500 font-mono hidden md:inline">v2.4.0</span>
        </div>

        {/* Right: Live Telemetry Status Pills */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/20 text-[11px] text-emerald-300 font-mono">
            <Radio className="h-3 w-3 text-emerald-400" /> GPS Geofence (100m) Active
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-900 border border-slate-800 text-[11px] text-slate-300 font-mono">
            <ShieldCheck className="h-3 w-3 text-blue-400" /> AI Sentinel Online
          </span>
        </div>
      </div>
    </footer>
  );
}
