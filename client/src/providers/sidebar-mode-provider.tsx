"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { resolveNavigationContext, type SidebarMode } from "../lib/navigation-utils";
import { useSidebarStore } from "../stores/use-sidebar-store";
import { useAuth } from "@/features/auth/hooks/use-auth";

export type { SidebarMode };

interface SidebarModeContextProps {
  sidebarMode: SidebarMode;
  setSidebarMode: (mode: SidebarMode) => void;
}

const SidebarModeContext = createContext<SidebarModeContextProps | undefined>(undefined);

export const SidebarModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const { user } = useAuth();
  
  // Resolve navigation context synchronously on initial render
  const context = resolveNavigationContext(pathname || "");
  const initialMode = user?.role === "USER" ? "CANDIDATE" : context.sidebarMode;
  const [sidebarMode, setSidebarModeState] = useState<SidebarMode>(initialMode);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [prevUserRole, setPrevUserRole] = useState<string | undefined>(user?.role);

  // Sync state synchronously during render if pathname or user role changes
  if (pathname !== prevPathname || user?.role !== prevUserRole) {
    setPrevPathname(pathname);
    setPrevUserRole(user?.role);
    const resolvedMode = user?.role === "USER" ? "CANDIDATE" : context.sidebarMode;
    setSidebarModeState(resolvedMode);
  }

  const switchPortal = useSidebarStore((s) => s.switchPortal);

  const setSidebarMode = (mode: SidebarMode) => {
    setSidebarModeState(mode);
  };

  // Perform portal state transition/restore in-memory inside an effect
  useEffect(() => {
    if (pathname) {
      const currentContext = resolveNavigationContext(pathname);
      const portal = user?.role === "USER" ? "candidate" : currentContext.portal;
      switchPortal(portal);
    }
  }, [pathname, switchPortal, user?.role]);

  return (
    <SidebarModeContext.Provider value={{ sidebarMode, setSidebarMode }}>
      {children}
    </SidebarModeContext.Provider>
  );
};

export const useSidebarMode = () => {
  const context = useContext(SidebarModeContext);
  if (!context) {
    throw new Error("useSidebarMode must be used within a SidebarModeProvider");
  }
  return context;
};
