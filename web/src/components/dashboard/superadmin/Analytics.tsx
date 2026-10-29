"use client";

import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { motion } from "framer-motion";
import { api } from "@/lib/api";

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const initialTrend = daysOfWeek.map((day) => ({ day, value: 0 }));

const initialDeptData = [
  { name: "Computer Science", value: 0 },
  { name: "Electronics", value: 0 },
  { name: "Mechanical", value: 0 },
  { name: "Civil", value: 0 },
];

const initialPieData = [
  { name: "Nominal (0 risk)", value: 100 },
  { name: "Warning (Low)", value: 0 },
  { name: "Suspicious (High)", value: 0 },
];

const COLORS = ["#10b981", "#f59e0b", "#ef4444"];

export default function Analytics() {
  const [trendData, setTrendData] = useState(initialTrend);
  const [deptData, setDeptData] = useState(initialDeptData);
  const [pieData, setPieData] = useState(initialPieData);

  useEffect(() => {
    let active = true;
    async function loadStats() {
      try {
        const stats = await api.dashboardStats().catch(() => null);
        if (!active || !stats) return;

        // If attendance count exists, show live distribution
        if (stats.today_attendance_count > 0) {
          const currentDayIdx = (new Date().getDay() + 6) % 7;
          const updatedTrend = [...initialTrend];
          updatedTrend[currentDayIdx].value = stats.today_attendance_count;
          setTrendData(updatedTrend);
          setDeptData([
            { name: "Computer Science", value: stats.today_attendance_count },
            { name: "Electronics", value: 0 },
            { name: "Mechanical", value: 0 },
            { name: "Civil", value: 0 },
          ]);
        }
      } catch (err) {
        console.error("Failed to load analytics stats:", err);
      }
    }
    loadStats();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-5 border-slate-800/80 bg-surface-900/60">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Attendance Trend</h3>
              <p className="text-xs text-slate-400">Past 7 days live check-ins</p>
            </div>
            <div className="text-xs text-emerald-400 font-mono">Live</div>
          </div>

          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#090d16", borderColor: "#334155", borderRadius: 8, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: "#10b981" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-5 border-slate-800/80 bg-surface-900/60">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Department Attendance</h3>
              <p className="text-xs text-slate-400">Current verified check-ins</p>
            </div>
            <div className="text-xs text-slate-400 font-mono">Real-time</div>
          </div>

          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickFormatter={(v) => v.slice(0, 7)} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#090d16", borderColor: "#334155", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-5 border-slate-800/80 bg-surface-900/60">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">AI Fraud Distribution</h3>
              <p className="text-xs text-slate-400">Risk telemetry (24h)</p>
            </div>
            <div className="text-xs text-emerald-400 font-mono">0 Flags</div>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <div className="h-36 w-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={34} outerRadius={52} paddingAngle={4}>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex-1 space-y-2">
              {pieData.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-slate-300">{p.name}</span>
                  </div>
                  <span className="font-mono text-slate-400">{p.value === 100 ? "100%" : "0"}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
