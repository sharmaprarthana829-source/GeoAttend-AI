"use client";

import React, { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api, setTokens } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/ToastProvider";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Building2,
  CheckCircle2,
  Cpu,
  QrCode,
  MapPin,
  Sparkles,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();

  const [email, setEmail] = useState("admin@geoattend.ai");
  const [password, setPassword] = useState("Admin@12345");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState("");
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [capsLockActive, setCapsLockActive] = useState(false);

  // Active Role State driving Canvas Morphing
  const [activeRole, setActiveRole] = useState<"admin" | "faculty" | "student">("admin");

  // Typing Signal Ripple Effect
  const [isTyping, setIsTyping] = useState(false);

  // Live OS Clock & Date Ticker
  const [timeString, setTimeString] = useState("");
  const [dateString, setDateString] = useState("");

  const demoAccounts = [
    {
      role: "admin",
      label: "Admin",
      badge: "Campus Oversight",
      description: "Full system governance & multi-college oversight",
      email: "admin@geoattend.ai",
      pass: "Admin@12345",
    },
    {
      role: "faculty",
      label: "Faculty",
      badge: "Session QR & Roster",
      description: "Class attendance, dynamic QR & student records",
      email: "faculty@geoattend.ai",
      pass: "Faculty@12345",
    },
    {
      role: "student",
      label: "Student",
      badge: "Geofence Check-in",
      description: "Real-time location verification & attendance logs",
      email: "student@geoattend.ai",
      pass: "Student@12345",
    },
  ] as const;

  // Restore saved session preferences on mount
  useEffect(() => {
    try {
      const savedRemember = localStorage.getItem("geoattend_remember_session");
      const savedRole = localStorage.getItem("geoattend_saved_role") as "admin" | "faculty" | "student" | null;
      const savedEmail = localStorage.getItem("geoattend_saved_email");

      if (savedRemember === "false") {
        setRememberMe(false);
      } else {
        setRememberMe(true);
        if (savedRole && (savedRole === "admin" || savedRole === "faculty" || savedRole === "student")) {
          setActiveRole(savedRole);
          const match = demoAccounts.find((d) => d.role === savedRole);
          if (match) {
            setEmail(savedEmail || match.email);
            setPassword(match.pass);
          }
        }
      }
    } catch {
      // Storage restricted
    }
  }, []);

  // Multi-phase progress indicator during authentication
  useEffect(() => {
    let t1: NodeJS.Timeout;
    let t2: NodeJS.Timeout;
    if (loading) {
      setLoadingStep(0);
      t1 = setTimeout(() => setLoadingStep(1), 2200);
      t2 = setTimeout(() => setLoadingStep(2), 5200);
    } else {
      setLoadingStep(0);
    }
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [loading]);

  // Modal ESC handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && forgotModalOpen) {
        setForgotModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [forgotModalOpen]);

  // Clock tick
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
      setDateString(
        now.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 3D Parallax Mouse Tracking
  const [parallax, setParallax] = useState({ rotateX: 0, rotateY: 0, mouseX: 50, mouseY: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    const xPct = (clientX / innerWidth) * 100;
    const yPct = (clientY / innerHeight) * 100;

    // Calculate subtle 3D tilt angles (-6deg to +6deg)
    const rotateY = ((clientX - innerWidth / 2) / (innerWidth / 2)) * 6;
    const rotateX = -((clientY - innerHeight / 2) / (innerHeight / 2)) * 6;

    setParallax({ rotateX, rotateY, mouseX: xPct, mouseY: yPct });
  };

  async function executeLogin(targetEmail: string, targetPass: string, targetRole: "admin" | "faculty" | "student") {
    setLoading(true);
    setError("");

    try {
      const tokens = await api.login(targetEmail, targetPass);
      setTokens(tokens.access_token, tokens.refresh_token);

      try {
        if (rememberMe) {
          localStorage.setItem("geoattend_remember_session", "true");
          localStorage.setItem("geoattend_saved_role", targetRole);
          localStorage.setItem("geoattend_saved_email", targetEmail);
        } else {
          localStorage.setItem("geoattend_remember_session", "false");
          localStorage.removeItem("geoattend_saved_role");
          localStorage.removeItem("geoattend_saved_email");
        }
      } catch {
        // Storage restricted
      }

      toast.success("Location Lock Verified", `Accessing ${targetRole.toUpperCase()} workspace.`);
      
      const targetPath =
        tokens.role === "faculty"
          ? "/dashboard/faculty"
          : tokens.role === "student"
          ? "/dashboard/student"
          : "/dashboard";
      
      router.push(targetPath);
    } catch (err) {
      const isNetworkError =
        err instanceof TypeError ||
        (err instanceof Error &&
          (err.message.includes("Failed to fetch") ||
            err.message.includes("NetworkError") ||
            err.message.includes("Load failed")));

      const msg = isNetworkError
        ? "Campus mesh gateway is connecting. Please retry in a few moments."
        : err instanceof Error
        ? err.message
        : "Invalid credentials";

      setError(msg);
      toast.error("Authentication Error", msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await executeLogin(email, password, activeRole);
  }

  const selectDemoAccount = (roleKey: "admin" | "faculty" | "student", demoEmail: string, demoPass: string) => {
    setActiveRole(roleKey);
    setEmail(demoEmail);
    setPassword(demoPass);
    setError("");
  };

  const handleRoleDoubleClick = (acc: (typeof demoAccounts)[number]) => {
    selectDemoAccount(acc.role, acc.email, acc.pass);
    executeLogin(acc.email, acc.pass, acc.role);
  };

  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    setter(value);
    setIsTyping(true);
    setTimeout(() => setIsTyping(false), 800);
  };

  const handlePasswordKeyAction = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setCapsLockActive(e.getModifierState("CapsLock"));
    }
  };

  const springTransition = { type: "spring" as const, stiffness: 280, damping: 25 };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="relative h-screen w-screen bg-[#06080d] bg-noise text-slate-100 flex flex-col justify-between p-6 md:p-10 overflow-hidden select-none selection:bg-emerald-500 selection:text-white perspective-container"
    >
      {/* Dynamic Cursor-Reactive Soft Radial Glow */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-700 opacity-60"
        style={{
          background: `radial-gradient(850px circle at ${parallax.mouseX}% ${parallax.mouseY}%, rgba(16, 185, 129, 0.08), transparent 65%)`,
        }}
      />

      {/* TOP FLOATING PREMIUM GLASS HEADER */}
      <motion.header
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
        className="relative z-30 flex items-center justify-between w-full max-w-7xl mx-auto px-5 py-3 rounded-2xl border border-slate-800/80 bg-surface-950/70 backdrop-blur-2xl shadow-xl text-xs"
      >
        <div className="flex items-center gap-3">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-md shadow-emerald-950">
            <Sparkles className="h-4 w-4" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 border border-surface-950 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white tracking-tight">GeoAttend</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/30">
              AI
            </span>
          </div>
          <span className="hidden sm:inline text-slate-700">|</span>
          <span className="hidden sm:inline text-slate-400 font-medium text-xs">Spatial Verification Gateway</span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface-900/80 border border-slate-800/80 text-slate-300 text-[11px]">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>256-Bit Encrypted</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-surface-900/80 border border-slate-800/80 text-[11px] font-mono text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span suppressHydrationWarning className="font-semibold text-white">
              {dateString && timeString ? `${dateString} · ${timeString}` : "Syncing Clock..."}
            </span>
          </div>
        </div>
      </motion.header>

      {/* MAIN ASYMMETRICAL CANVAS WORKSPACE */}
      <main className="relative z-20 w-full max-w-7xl mx-auto my-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        
        {/* ASYMMETRICAL CANVAS LEFT (75% Perspective Interactive Geofence Topology) */}
        <motion.div
          style={{
            transform: `perspective(1000px) rotateX(${parallax.rotateX}deg) rotateY(${parallax.rotateY}deg)`,
          }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="lg:col-span-7 relative h-[420px] sm:h-[480px] w-full rounded-3xl border border-white/5 bg-obsidian-900/30 backdrop-blur-2xl overflow-hidden p-8 flex flex-col justify-between shadow-2xl transition-transform duration-200"
        >
          {/* TOP CANVAS TELEMETRY HEADER */}
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 z-10">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-400" />
              <span className="text-slate-200 font-semibold">CAMPUS RADAR SENTINEL</span>
            </div>
            <div className="flex items-center gap-2 bg-obsidian-950/80 px-3 py-1 rounded-full border border-white/5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px]">GEOFENCE RADIUS: ±100M</span>
            </div>
          </div>

          {/* DYNAMIC SVG INTERACTIVE RADAR & ROLE-REACTIVE TOPOLOGY */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Background Concentric Radar Waves */}
            <svg className="w-full h-full text-emerald-500/10" viewBox="0 0 600 400" fill="none">
              <circle cx="300" cy="200" r="160" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
              <circle cx="300" cy="200" r="110" stroke="currentColor" strokeWidth="1" />
              <circle cx="300" cy="200" r="60" stroke="currentColor" strokeWidth="1" />
              
              {/* Interactive Radar Sweep Beam */}
              <motion.g
                animate={{ rotate: 360 }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: "300px 200px" }}
              >
                <line x1="300" y1="200" x2="300" y2="40" stroke="#10b981" strokeWidth="2" strokeOpacity="0.8" />
                <polygon points="300,200 300,40 380,80" fill="url(#radarGradient)" opacity="0.3" />
              </motion.g>

              {/* Typing Ripple Wave Effect */}
              {isTyping && (
                <motion.circle
                  cx="300"
                  cy="200"
                  initial={{ r: 10, opacity: 0.9 }}
                  animate={{ r: 180, opacity: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  stroke="#10b981"
                  strokeWidth="2"
                />
              )}

              <defs>
                <radialGradient id="radarGradient" cx="0%" cy="0%" r="100%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </radialGradient>
              </defs>
            </svg>

            {/* ROLE-DEPENDENT DYNAMIC NODE GRAPH MORPHING */}
            <AnimatePresence mode="wait">
              {activeRole === "admin" && (
                <motion.div
                  key="admin-mesh"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={springTransition}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className="relative w-full max-w-sm h-48 flex items-center justify-center pointer-events-auto">
                    <div className="absolute top-4 left-6 p-2.5 rounded-xl border border-emerald-500/30 bg-obsidian-950/80 text-[11px] font-mono text-emerald-300 backdrop-blur-md shadow-lg transition-transform hover:scale-105 cursor-default">
                      📍 Campus Alpha • Core
                    </div>
                    <div className="absolute bottom-6 right-8 p-2.5 rounded-xl border border-cyan-500/30 bg-obsidian-950/80 text-[11px] font-mono text-cyan-300 backdrop-blur-md shadow-lg transition-transform hover:scale-105 cursor-default">
                      🏛️ Campus Beta • Connected
                    </div>
                    <div className="absolute top-10 right-10 p-2.5 rounded-xl border border-indigo-500/30 bg-obsidian-950/80 text-[11px] font-mono text-indigo-300 backdrop-blur-md shadow-lg transition-transform hover:scale-105 cursor-default">
                      🛡️ AI Sentinel: 0.00% Risk
                    </div>
                  </div>
                </motion.div>
              )}

              {activeRole === "faculty" && (
                <motion.div
                  key="faculty-qr"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={springTransition}
                  className="absolute inset-0 flex flex-col items-center justify-center"
                >
                  <div className="p-4 rounded-2xl border border-emerald-500/40 bg-obsidian-950/90 backdrop-blur-xl shadow-2xl flex items-center gap-3">
                    <QrCode className="h-10 w-10 text-emerald-400 animate-pulse" />
                    <div>
                      <p className="text-xs font-bold text-white">Dynamic Session QR Active</p>
                      <p className="text-[11px] text-emerald-400 font-mono">Rotating Every 15s</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeRole === "student" && (
                <motion.div
                  key="student-gps"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={springTransition}
                  className="absolute inset-0 flex flex-col items-center justify-center"
                >
                  <div className="p-4 rounded-2xl border border-emerald-500/40 bg-obsidian-950/90 backdrop-blur-xl shadow-2xl flex items-center gap-3">
                    <MapPin className="h-10 w-10 text-emerald-400" />
                    <div>
                      <p className="text-xs font-bold text-white">GPS Geofence Locked</p>
                      <p className="text-[11px] text-emerald-400 font-mono">Latitude & Longitude Verified</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* BOTTOM CANVAS FOOTER STATEMENT */}
          <div className="relative z-10 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white font-mono">
                GEOATTEND OS
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Zero-proxy multi-tenant attendance ecosystem for higher education.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-500 border border-white/5 bg-obsidian-950/60 px-3 py-1.5 rounded-xl">
              <Cpu className="h-4 w-4 text-emerald-400" />
              <span>AI Fraud Guard Active</span>
            </div>
          </div>
        </motion.div>

        {/* ASYMMETRICAL AUTHENTICATION PANEL RIGHT (Integrated Layer, No Boxed Container) */}
        <motion.div
          initial={{ opacity: 0, x: 25 }}
          animate={{ opacity: 1, x: 0 }}
          transition={springTransition}
          className="lg:col-span-5 w-full max-w-md justify-self-center lg:justify-self-end space-y-7"
        >
          {/* Header */}
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-mono text-emerald-300">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span>AUTHENTICATION GATEWAY</span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white">Enter Workspace</h2>
            <p className="text-xs text-slate-400">
              Sign in with institutional credentials to access your session.
            </p>
          </div>

          {/* Role Preset Tabs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                Role Scope (Demo):
              </span>
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {demoAccounts.find((a) => a.role === activeRole)?.badge}
              </span>
            </div>
            <div className="relative grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-obsidian-900/80 border border-white/5 backdrop-blur-xl">
              {demoAccounts.map((acc) => {
                const isSelected = activeRole === acc.role;
                return (
                  <button
                    key={acc.role}
                    type="button"
                    onClick={() => selectDemoAccount(acc.role, acc.email, acc.pass)}
                    onDoubleClick={() => handleRoleDoubleClick(acc)}
                    title="Click to select · Double-click to launch directly"
                    className={`relative z-10 py-2 px-2 rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer ${
                      isSelected
                        ? "text-white"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="activeRoleIndicator"
                        transition={{ type: "spring", stiffness: 450, damping: 32 }}
                        className="absolute inset-0 rounded-xl bg-emerald-600 shadow-lg shadow-emerald-600/30 -z-10"
                      />
                    )}
                    <span>{acc.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 font-mono px-1">
              {demoAccounts.find((a) => a.role === activeRole)?.description}
            </p>
          </div>

          {/* Integrated Inputs Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Institutional Email"
              type="email"
              placeholder="user@university.edu"
              value={email}
              onChange={(e) => handleInputChange(setEmail, e.target.value)}
              leftIcon={<Mail className="h-4 w-4 text-slate-400" />}
              className="cinematic-input"
              required
              aria-label="Institutional Email"
            />

            <div className="space-y-1">
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => handleInputChange(setPassword, e.target.value)}
                onKeyDown={handlePasswordKeyAction}
                onKeyUp={handlePasswordKeyAction}
                leftIcon={<Lock className="h-4 w-4 text-slate-400" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="hover:text-emerald-400 text-slate-400 transition-colors p-1 focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                }
                className="cinematic-input"
                required
                aria-label="Password"
              />
              {capsLockActive && (
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-amber-400 pl-1 pt-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span>Caps Lock is ON</span>
                </div>
              )}
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-obsidian-900 text-emerald-500 focus:ring-emerald-500/20"
                />
                <span>Remember session</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setResetEmail(email);
                  setForgotModalOpen(true);
                }}
                className="font-medium text-slate-400 hover:text-white transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-medium text-rose-300">
                {error}
              </div>
            )}

            {/* Submit Action Button */}
            <Button
              type="submit"
              variant="emerald"
              size="lg"
              className="w-full mt-2 shadow-xl shadow-emerald-600/20 group cursor-pointer"
              isLoading={loading}
              rightIcon={<ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />}
            >
              {loading
                ? loadingStep === 0
                  ? "Verifying Geofence..."
                  : loadingStep === 1
                  ? "Connecting to Gateway..."
                  : "Syncing Mesh Security..."
                : `Authenticate & Launch ${
                    activeRole === "admin"
                      ? "Admin"
                      : activeRole === "faculty"
                      ? "Faculty"
                      : "Student"
                  } Workspace`}
            </Button>
          </form>

          {/* Footer Security Badges */}
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              256-bit TLS Encrypted
            </span>
            <span className="font-mono text-slate-600">GeoAttend OS v2.4</span>
          </div>
        </motion.div>

      </main>

      {/* BOTTOM FOOTER TELEMETRY STATUS BAR */}
      <motion.footer
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
        className="relative z-30 flex flex-wrap items-center justify-between gap-4 w-full max-w-7xl mx-auto px-5 py-2.5 rounded-xl border border-slate-800/80 bg-surface-950/60 backdrop-blur-xl text-xs text-slate-400 shadow-lg"
      >
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            GPS Geofence (100m) Active
          </span>
          <span className="hidden md:inline text-slate-700">|</span>
          <span className="hidden md:inline text-slate-400 font-mono text-[11px]">AI Sentinel: Real-time Anti-Proxy</span>
        </div>

        <div className="flex items-center gap-3 text-slate-400 text-xs">
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>Campus Mesh Online</span>
          </div>
          <span className="text-slate-700">|</span>
          <span className="font-mono text-[11px] text-slate-500">v2.4.0</span>
        </div>
      </motion.footer>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {forgotModalOpen && (
          <div
            onClick={() => setForgotModalOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#06080d]/80 backdrop-blur-md"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={springTransition}
              className="relative w-full max-w-md rounded-2xl border border-white/10 bg-obsidian-900 p-6 shadow-2xl space-y-4"
            >
              <h3 className="text-lg font-semibold text-white">Reset Password</h3>
              <p className="text-xs text-slate-400">
                Enter your institutional email address and we will send a password reset token.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  toast.info("Reset email sent", "Check your institutional inbox.");
                  setForgotModalOpen(false);
                }}
                className="space-y-4"
              >
                <Input
                  type="email"
                  placeholder="user@university.edu"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  leftIcon={<Mail className="h-4 w-4 text-slate-400" />}
                  className="cinematic-input"
                  required
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setForgotModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="emerald"
                    size="sm"
                  >
                    Send Reset Link
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
