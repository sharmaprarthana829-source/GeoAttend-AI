import React from "react";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Grid,
  BarChart3,
  Clock,
  CalendarDays,
  Bell,
  Settings,
  CheckCircle2,
  UserPlus,
  FileText,
  ShieldAlert,
  Building2,
  FileSpreadsheet,
  Award,
  Megaphone,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { User, UserRole } from "@/lib/api";

export type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[];
};

const adminRoles: UserRole[] = ["admin"];
const facultyRoles: UserRole[] = ["faculty"];
const studentRoles: UserRole[] = ["student"];

const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5" />, roles: ["admin", "faculty", "student"] },
  { label: "Academic Structure", href: "/dashboard/academic", icon: <Grid className="h-5 w-5" />, roles: adminRoles },
  { label: "Students & Devices", href: "/dashboard/students", icon: <Users className="h-5 w-5" />, roles: adminRoles },
  { label: "Faculty & Roles", href: "/dashboard/faculty", icon: <Building2 className="h-5 w-5" />, roles: ["admin", "faculty"] },
  { label: "Subjects & Offerings", href: "/dashboard/subjects", icon: <BookOpen className="h-5 w-5" />, roles: adminRoles },
  { label: "Timetable & Rooms", href: "/dashboard/timetable", icon: <CalendarDays className="h-5 w-5" />, roles: adminRoles },
  { label: "Attendance Monitor", href: "/dashboard/attendance", icon: <Clock className="h-5 w-5" />, roles: ["admin", "faculty"] },
  { label: "Applications Desk", href: "/dashboard/applications", icon: <FileText className="h-5 w-5" />, roles: ["admin", "faculty", "student"] },
  { label: "Notice Board", href: "/dashboard/notices", icon: <Megaphone className="h-5 w-5" />, roles: ["admin", "faculty", "student"] },
  { label: "Notifications", href: "/dashboard/notifications", icon: <Bell className="h-5 w-5" />, roles: ["admin", "faculty", "student"] },
  { label: "Reports & Analytics", href: "/dashboard/reports", icon: <BarChart3 className="h-5 w-5" />, roles: adminRoles },
  { label: "System Settings", href: "/dashboard/settings", icon: <Settings className="h-5 w-5" />, roles: adminRoles },
  { label: "Audit Log Desk", href: "/dashboard/audit", icon: <FileSpreadsheet className="h-5 w-5" />, roles: adminRoles },
];

const facultyBaseNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard/faculty", icon: <LayoutDashboard className="h-5 w-5" />, roles: ["faculty", "admin"] },
  { label: "My Timetable", href: "/dashboard/faculty/timetable", icon: <CalendarDays className="h-5 w-5" />, roles: ["faculty", "admin"] },
  { label: "My Classes", href: "/dashboard/faculty/classes", icon: <BookOpen className="h-5 w-5" />, roles: ["faculty", "admin"] },
  { label: "Attendance Management", href: "/dashboard/attendance-sessions", icon: <Clock className="h-5 w-5" />, roles: ["faculty", "admin"] },
  { label: "Attendance Monitor", href: "/dashboard/attendance", icon: <Clock className="h-5 w-5" />, roles: ["faculty", "admin"] },
  { label: "Applications Review", href: "/dashboard/applications", icon: <FileText className="h-5 w-5" />, roles: ["faculty", "admin"] },
  { label: "Notice Board", href: "/dashboard/notices", icon: <Megaphone className="h-5 w-5" />, roles: ["faculty", "admin", "student"] },
  { label: "Notifications", href: "/dashboard/notifications", icon: <Bell className="h-5 w-5" />, roles: ["faculty", "admin", "student"] },
];

const studentNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard/student", icon: <LayoutDashboard className="h-5 w-5" />, roles: ["student", "admin"] },
  { label: "My Attendance", href: "/dashboard/my-attendance", icon: <CheckCircle2 className="h-5 w-5" />, roles: studentRoles },
  { label: "My Applications", href: "/dashboard/applications", icon: <FileText className="h-5 w-5" />, roles: studentRoles },
  { label: "Notice Board", href: "/dashboard/notices", icon: <Megaphone className="h-5 w-5" />, roles: studentRoles },
  { label: "Notifications", href: "/dashboard/notifications", icon: <Bell className="h-5 w-5" />, roles: studentRoles },
];

export function getNavigationForRole(user: User | null) {
  if (!user) return [];
  if (user.role === "faculty") {
    const nav = [...facultyBaseNav];

    const isCoordinator = user.faculty_profile?.responsibilities?.some(
      (r) => r.responsibility_type === "coordinator" && r.is_active
    );
    if (isCoordinator) {
      // Insert Coordinator Desk right after My Classes
      nav.splice(3, 0, {
        label: "Coordinator Desk",
        href: "/dashboard/faculty/coordinator",
        icon: <GraduationCap className="h-5 w-5 text-amber-500" />,
        roles: ["faculty", "admin"],
      });
    }

    const hasHod = user.faculty_profile?.responsibilities?.some(
      (r) => r.responsibility_type === "hod" && r.is_active
    );
    if (hasHod) {
      nav.push({
        label: "HOD Decisions",
        href: "/dashboard/hod",
        icon: <Award className="h-5 w-5 text-indigo-500" />,
        roles: ["faculty", "admin"],
      });
    }

    return nav;
  }
  if (user.role === "student") return studentNav;
  return adminNav;
}

export function getNavItemForPath(path: string, user?: User | null) {
  const normalized = path.replace(/\/+$/, "");
  const allItems = [
    { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5" />, roles: ["admin", "faculty", "student"] },
    { label: "Dashboard", href: "/dashboard/faculty", icon: <LayoutDashboard className="h-5 w-5" />, roles: ["faculty", "admin"] },
    { label: "Dashboard", href: "/dashboard/student", icon: <LayoutDashboard className="h-5 w-5" />, roles: ["student", "admin"] },
    { label: "Coordinator Desk", href: "/dashboard/faculty/coordinator", icon: <GraduationCap className="h-5 w-5" />, roles: ["faculty", "admin"] },
    { label: "My Timetable", href: "/dashboard/faculty/timetable", icon: <CalendarDays className="h-5 w-5" />, roles: ["faculty", "admin"] },
    { label: "My Classes", href: "/dashboard/faculty/classes", icon: <BookOpen className="h-5 w-5" />, roles: ["faculty", "admin"] },
    { label: "Attendance Management", href: "/dashboard/attendance-sessions", icon: <Clock className="h-5 w-5" />, roles: ["faculty", "admin"] },
    { label: "Attendance History", href: "/dashboard/faculty/attendance", icon: <Clock className="h-5 w-5" />, roles: ["faculty", "admin"] },
    { label: "HOD Decisions", href: "/dashboard/hod", icon: <Award className="h-5 w-5" />, roles: ["faculty", "admin"] },
    ...adminNav,
    ...facultyBaseNav,
    ...studentNav,
  ];
  if (user?.role) {
    const roleMatch = allItems.find((item) => item.href === normalized && item.roles.includes(user.role));
    if (roleMatch) return roleMatch;
  }
  return allItems.find((item) => item.href === normalized);
}

export function isPathAllowedForRole(role: UserRole | null, path: string) {
  if (!role) return false;
  const item = getNavItemForPath(path);
  return Boolean(item && item.roles.includes(role));
}

export const adminOnlyRoles = adminRoles;
export const facultyOnlyRoles = facultyRoles;
export const studentOnlyRoles = studentRoles;
