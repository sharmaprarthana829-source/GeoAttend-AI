"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearTokens, getToken, User } from "@/lib/api";
import { getNavigationForRole } from "@/lib/navigation";

export interface DashboardContextValue {
  user: User | null;
  loading: boolean;
  navItems: Array<{ label: string; href: string; icon: React.ReactNode; roles: string[] }>;
  logout: () => void;
}

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadUser() {
      const token = getToken();
      if (!token) {
        clearTokens();
        router.replace("/login");
        return;
      }

      try {
        const me = await api.me();
        if (!active) return;
        setUser(me);
      } catch {
        clearTokens();
        router.replace("/login");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadUser();
    return () => {
      active = false;
    };
  }, [router]);

  const navItems = useMemo(() => getNavigationForRole(user), [user]);

  function logout() {
    clearTokens();
    router.push("/login");
  }

  return (
    <DashboardContext.Provider value={{ user, loading, navItems, logout }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within DashboardProvider");
  }
  return context;
}
