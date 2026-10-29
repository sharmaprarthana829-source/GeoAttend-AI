"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  Notification,
  NotificationCounts,
  NotificationType,
} from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  Bell,
  CheckCheck,
  Check,
  Clock,
  RefreshCw,
  Search,
  X,
  ExternalLink,
  Trash2,
  Filter,
  AlertTriangle,
  Radio,
  Megaphone,
  ClipboardList,
  ShieldAlert,
  Info,
  Calendar,
} from "lucide-react";

export default function NotificationsPage() {
  const router = useRouter();

  // ── State ────────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [counts, setCounts] = useState<NotificationCounts>({ all: 0, unread: 0, read: 0 });
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "read">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal for delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Notification | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Debounce Search Query ────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Load Counts & Notifications ──────────────────────────────────────
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      // 1. Fetch accurate counts independently
      const countsPromise = api.notifications.getCounts().catch(() => ({ all: 0, unread: 0, read: 0 }));

      // 2. Determine read filter based on active tab
      let isReadParam: boolean | undefined = undefined;
      if (activeTab === "unread") isReadParam = false;
      if (activeTab === "read") isReadParam = true;

      const notifsPromise = api.notifications.getMyNotifications({
        is_read: isReadParam,
        notification_type: selectedType !== "all" ? selectedType : undefined,
        search: debouncedSearch.trim() || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        limit: 100,
      });

      const [countsData, notifsData] = await Promise.all([countsPromise, notifsPromise]);
      setCounts(countsData);
      setNotifications(notifsData);
    } catch (err: any) {
      console.error("Failed to fetch notifications:", err);
      setError(err?.message || "Failed to load notifications. Please check your connection.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, debouncedSearch, selectedType, startDate, endDate]);

  // ── Controlled Polling every 30 seconds ──────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        loadData(true);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [activeTab, debouncedSearch, selectedType, startDate, endDate]);

  // ── Actions ──────────────────────────────────────────────────────────
  const handleMarkRead = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.notifications.markAsRead(id);
      // Optimistically update local state
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
      setCounts((prev) => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1),
        read: prev.read + 1,
      }));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
      loadData(true);
    }
  };

  const handleMarkAllRead = async () => {
    setActionLoading(true);
    try {
      await api.notifications.markAllAsRead();
      await loadData();
    } catch (err) {
      console.error("Failed to mark all notifications read:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.notifications.deleteNotification(deleteTarget.id);
      setNotifications((prev) => prev.filter((n) => n.id !== deleteTarget.id));
      setCounts((prev) => ({
        ...prev,
        all: Math.max(0, prev.all - 1),
        unread: !deleteTarget.is_read ? Math.max(0, prev.unread - 1) : prev.unread,
        read: deleteTarget.is_read ? Math.max(0, prev.read - 1) : prev.read,
      }));
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete notification:", err);
      loadData(true);
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenRelatedItem = async (n: Notification) => {
    if (!n.is_read) {
      await handleMarkRead(n.id);
    }
    const destination = n.link_url || "/dashboard";
    router.push(destination);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setSelectedType("all");
    setStartDate("");
    setEndDate("");
  };

  const hasActiveFilters = Boolean(
    debouncedSearch || selectedType !== "all" || startDate || endDate
  );

  // ── Helper to format relative and localized time ─────────────────────
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    } catch {
      return isoString;
    }
  };

  // ── Helper for Type Badges & Icons ───────────────────────────────────
  const getTypeMeta = (type: NotificationType) => {
    switch (type) {
      case "notice":
        return {
          icon: <Megaphone className="h-4 w-4 text-sky-400" />,
          bg: "bg-sky-500/10 text-sky-400 border-sky-500/20",
          label: "NOTICE",
        };
      case "attendance":
        return {
          icon: <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />,
          bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          label: "ATTENDANCE",
        };
      case "application":
        return {
          icon: <ClipboardList className="h-4 w-4 text-amber-400" />,
          bg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
          label: "APPLICATION",
        };
      case "system":
      default:
        return {
          icon: <ShieldAlert className="h-4 w-4 text-rose-400" />,
          bg: "bg-rose-500/10 text-rose-400 border-rose-500/20",
          label: "SYSTEM / SECURITY",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav className="text-xs text-slate-400 mb-1">Dashboard / Notifications</nav>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Bell className="h-6 w-6 text-emerald-400" />
            Your Notifications
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time notifications for institutional notices, attendance alerts, applications, and system telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {counts.unread > 0 && (
            <Button
              onClick={handleMarkAllRead}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 text-xs shadow-lg shadow-emerald-950 font-medium"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {actionLoading ? "Processing..." : "Mark All as Read"}
            </Button>
          )}

          <Button
            onClick={() => loadData()}
            variant="outline"
            disabled={loading}
            className="border-slate-800 bg-surface-900/60 hover:bg-surface-800 text-slate-300 flex items-center gap-2 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Search Bar & Filter Controls ── */}
      <Card className="p-4 border-slate-800/80 bg-surface-900/70 shadow-xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Prominent Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, subject, session, reason or message..."
              className="w-full pl-9 pr-9 py-2 bg-surface-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 transition-all font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-950 border border-slate-800 text-xs text-slate-300">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer pr-1"
              >
                <option value="all" className="bg-slate-900 text-white">All Types</option>
                <option value="notice" className="bg-slate-900 text-white">Notices</option>
                <option value="attendance" className="bg-slate-900 text-white">Attendance</option>
                <option value="application" className="bg-slate-900 text-white">Applications</option>
                <option value="system" className="bg-slate-900 text-white">System & Security</option>
              </select>
            </div>

            {/* Date Pickers */}
            <div className="flex items-center gap-1 bg-surface-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-slate-300">
              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
                title="From Date"
              />
              <span className="text-slate-600">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
                title="To Date"
              />
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="h-8 text-xs text-slate-400 hover:text-white border-slate-800 hover:bg-surface-800 flex items-center gap-1.5"
              >
                <X className="h-3 w-3" /> Clear Filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* ── Filter Tabs with Accurate Backend Counts ── */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
              activeTab === "all"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-surface-800/60"
            }`}
          >
            All Notifications
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === "all" ? "bg-emerald-500/20 text-emerald-300" : "bg-surface-800 text-slate-400"
              }`}
            >
              {counts.all}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("unread")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
              activeTab === "unread"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-surface-800/60"
            }`}
          >
            Unread Only
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                counts.unread > 0
                  ? "bg-emerald-500 text-slate-950 font-semibold"
                  : activeTab === "unread"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-surface-800 text-slate-400"
              }`}
            >
              {counts.unread}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("read")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
              activeTab === "read"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-surface-800/60"
            }`}
          >
            Read
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === "read" ? "bg-emerald-500/20 text-emerald-300" : "bg-surface-800 text-slate-400"
              }`}
            >
              {counts.read}
            </span>
          </button>
        </div>

        <p className="text-xs text-slate-400 font-mono hidden sm:block">
          Showing {notifications.length} item{notifications.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* ── Error State ── */}
      {error && (
        <Card className="p-4 border-rose-500/40 bg-rose-950/20 text-rose-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <Button
            size="sm"
            onClick={() => loadData()}
            className="bg-rose-600 hover:bg-rose-500 text-white text-xs shrink-0"
          >
            Retry Connection
          </Button>
        </Card>
      )}

      {/* ── Loading Skeleton ── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 border-slate-800/60 bg-surface-900/40 animate-pulse">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 w-full">
                  <div className="h-9 w-9 rounded-xl bg-surface-800 shrink-0" />
                  <div className="space-y-2 w-full max-w-xl">
                    <div className="h-4 bg-surface-800 rounded w-1/3" />
                    <div className="h-3 bg-surface-800/70 rounded w-4/5" />
                    <div className="h-3 bg-surface-800/40 rounded w-1/4" />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        /* ── Empty State ── */
        <Card className="p-12 text-center border-slate-800/80 bg-surface-900/50">
          <div className="h-12 w-12 rounded-2xl bg-surface-800 border border-slate-700/80 flex items-center justify-center text-slate-400 mx-auto mb-3 shadow-inner">
            <Bell className="h-6 w-6 text-slate-500" />
          </div>

          <h3 className="text-base font-semibold text-white">
            {hasActiveFilters ? "No matching notifications found" : "No notifications yet"}
          </h3>

          <p className="text-xs text-slate-400 mt-1.5 max-w-md mx-auto leading-relaxed">
            {hasActiveFilters
              ? "None of your notifications match the selected search keywords or filter criteria. Try clearing filters to see all messages."
              : "You are completely caught up! Genuine notifications will appear here in real-time when institutional notices are published, attendance sessions start, or applications are reviewed."}
          </p>

          {hasActiveFilters && (
            <Button
              onClick={handleClearFilters}
              variant="outline"
              size="sm"
              className="mt-4 border-slate-700 text-slate-300 hover:text-white"
            >
              Clear Search & Filters
            </Button>
          )}
        </Card>
      ) : (
        /* ── Notifications List ── */
        <div className="space-y-3">
          {notifications.map((n) => {
            const meta = getTypeMeta(n.notification_type);
            return (
              <Card
                key={n.id}
                onClick={() => !n.is_read && handleMarkRead(n.id)}
                className={`p-4 border transition-all duration-200 cursor-pointer ${
                  !n.is_read
                    ? "border-emerald-500/40 bg-surface-900/95 shadow-lg shadow-emerald-950/20 hover:border-emerald-500/70"
                    : "border-slate-800/60 bg-surface-950/70 hover:border-slate-700/80 opacity-85 hover:opacity-100"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Left: Type Icon + Title + Message */}
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${meta.bg}`}
                    >
                      {meta.icon}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border ${meta.bg}`}
                        >
                          {meta.label}
                        </span>

                        <h4 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                          {n.title}
                          {!n.is_read && (
                            <span
                              className="h-2 w-2 rounded-full bg-emerald-400 ring-4 ring-emerald-500/20 inline-block"
                              title="Unread"
                            />
                          )}
                        </h4>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                        {n.message}
                      </p>

                      <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-500" />
                          {formatTime(n.created_at)}
                        </span>
                        <span>•</span>
                        <span title={new Date(n.created_at).toLocaleString()}>
                          {new Date(n.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pt-2 sm:pt-0">
                    {/* Open Related Item Action */}
                    {n.link_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenRelatedItem(n);
                        }}
                        className="text-xs h-8 border-slate-800 bg-surface-900/60 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30 flex items-center gap-1.5 transition-colors font-medium"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {n.action_label || "Open"}
                      </Button>
                    )}

                    {/* Mark as Read Toggle */}
                    {!n.is_read ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleMarkRead(n.id, e)}
                        className="text-xs h-8 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 flex items-center gap-1.5"
                        title="Mark as Read"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">Mark read</span>
                      </Button>
                    ) : (
                      <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1 px-2 py-1">
                        <CheckCheck className="h-3.5 w-3.5 text-slate-400" />
                        Read
                      </span>
                    )}

                    {/* Dismiss / Delete Notification */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(n);
                      }}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Dismiss notification"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Delete / Dismiss Confirmation Modal ── */}
      {deleteTarget && (
        <Modal
          isOpen={Boolean(deleteTarget)}
          onClose={() => !deleting && setDeleteTarget(null)}
          title="Dismiss Notification"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-300 leading-relaxed">
              Are you sure you want to dismiss this notification?
            </p>

            <div className="p-3 rounded-xl bg-surface-950 border border-slate-800 text-xs">
              <p className="font-semibold text-white">{deleteTarget.title}</p>
              <p className="text-slate-400 mt-1">{deleteTarget.message}</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? "Dismissing..." : "Dismiss"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
