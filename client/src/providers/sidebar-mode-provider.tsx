"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export type SidebarMode = "COMPANY" | "WORKSPACE" | "CANDIDATE" | "SYSTEM_ADMIN" | "COMPONENTS";

interface SidebarModeContextProps {
  sidebarMode: SidebarMode;
  setSidebarMode: (mode: SidebarMode) => void;
}

const SidebarModeContext = createContext<SidebarModeContextProps | undefined>(undefined);

export const SidebarModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarMode, setSidebarModeState] = useState<SidebarMode>("COMPANY");
  const pathname = usePathname();

  const setSidebarMode = (mode: SidebarMode) => {
    setSidebarModeState(mode);
  };

  // Synchronize based on global route sections outside /workspace/
  useEffect(() => {
    if (!pathname) return;

    if (pathname.startsWith("/admin/components")) {
      setSidebarModeState("COMPONENTS");
    } else if (pathname.startsWith("/admin")) {
      setSidebarModeState("SYSTEM_ADMIN");
    } else if (pathname === "/user" || pathname.startsWith("/user/") || pathname.startsWith("/cv")) {
      setSidebarModeState("CANDIDATE");
    }
  }, [pathname]);

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
