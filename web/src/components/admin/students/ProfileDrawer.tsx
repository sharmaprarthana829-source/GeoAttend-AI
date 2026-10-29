"use client";

import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";

export default function ProfileDrawer({ isOpen, onClose, student }: { isOpen: boolean; onClose: () => void; student?: any }) {
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
      // focus inside
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
          {/* Overlay */}
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
            className="ml-auto relative z-50 h-screen w-[420px] max-w-full bg-surface-900/95 border-l border-slate-800/60 p-6 shadow-2xl overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-label="Student profile drawer"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{student?.full_name ?? "Student Profile"}</h3>
                <p className="text-xs text-slate-400">{student?.student_id ?? "—"}</p>
              </div>
              <Button variant="ghost" onClick={onClose}>Close</Button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <h4 className="text-sm font-medium">Personal</h4>
                <p className="text-sm text-slate-300 mt-2">Email: {student?.email}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium">Academic</h4>
                <p className="text-sm text-slate-300 mt-2">Department: {student?.department}</p>
              </div>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
