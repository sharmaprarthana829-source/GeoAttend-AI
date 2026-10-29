"use client";

import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { AttendanceSession } from "@/lib/attendance";

export default function SessionDrawer({ isOpen, onClose, session }: { isOpen: boolean; onClose: () => void; session?: AttendanceSession | null }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKey);
      requestAnimationFrame(() => {
        const btn = panelRef.current?.querySelector<HTMLElement>("button, [href], input, select, textarea");
        btn?.focus();
      });
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  if (typeof document === "undefined") return null;

  return ReactDOM.createPortal(
    <AnimatePresence>
      {isOpen && (
        <div ref={containerRef} className="fixed inset-0 z-40 flex">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            aria-hidden
          />

          <motion.aside
            ref={panelRef}
            initial={{ x: 480, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 480, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="ml-auto relative z-50 h-screen w-[460px] max-w-full bg-surface-900/95 border-l border-slate-800/60 p-6 shadow-2xl overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-label="Session details drawer"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{session?.title ?? "Session details"}</h3>
                <p className="text-xs text-slate-400">{session?.subject ?? "—"}</p>
              </div>
              <Button variant="ghost" onClick={onClose}>Close</Button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <h4 className="text-sm font-medium">Timing</h4>
                <p className="text-sm text-slate-300 mt-2">Start: {session?.start_time ?? "—"}</p>
                <p className="text-sm text-slate-300">End: {session?.end_time ?? "—"}</p>
              </div>

              <div>
                <h4 className="text-sm font-medium">Participants</h4>
                <div className="mt-2 space-y-2">
                  {session?.participants && session.participants.length > 0 ? (
                    session.participants.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">{p.name}</div>
                          <div className="text-xs text-slate-400">{p.student_id} — {new Date(p.time).toLocaleString()}</div>
                        </div>
                        <div className="text-sm text-slate-400">{p.marked ? "Present" : "—"}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-400">No participants yet.</div>
                  )}
                </div>
              </div>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
