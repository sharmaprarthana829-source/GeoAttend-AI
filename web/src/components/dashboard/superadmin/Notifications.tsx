"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { motion } from "framer-motion";
import { api, Notification } from "@/lib/api";
import { Bell, CheckCheck } from "lucide-react";

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const list = await api.notifications.getMyNotifications().catch(() => []);
        if (active) setNotifications(list);
      } catch (err) {
        console.error("Failed to load notifications:", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card className="p-5 border-slate-800/80 bg-surface-900/60">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-emerald-400" />
            <h3 className="text-base font-semibold text-white">Recent Notifications</h3>
          </div>
          <p className="text-xs text-slate-400 font-mono">Latest</p>
        </div>

        {loading ? (
          <div className="py-6 text-center text-xs text-slate-500">Checking notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="py-6 flex flex-col items-center text-center">
            <div className="h-8 w-8 rounded-full bg-surface-800 border border-slate-700 flex items-center justify-center text-slate-400 mb-2">
              <CheckCheck className="h-4 w-4" />
            </div>
            <p className="text-xs font-medium text-slate-300">All caught up!</p>
            <p className="text-[11px] text-slate-500 mt-0.5">No unread alerts or notifications.</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {notifications.slice(0, 5).map((n) => (
              <li
                key={n.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-surface-950/60 border border-slate-800/60"
              >
                <div>
                  <p className="text-xs font-medium text-white">{n.title}</p>
                  <p className="text-[11px] text-slate-400">{n.message}</p>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </motion.div>
  );
}
