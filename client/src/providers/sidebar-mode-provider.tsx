"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { resolveNavigationContext, type SidebarMode } from "../lib/navigation-utils";
import { useSidebarStore } from "../stores/use-sidebar-store";

export type { SidebarMode };

interface SidebarModeContextProps {
  sidebarMode: SidebarMode;
  setSidebarMode: (mode: SidebarMode) => void;
}

const SidebarModeContext = createContext<SidebarModeContextProps | undefined>(undefined);

export const SidebarModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  
  // Resolve navigation context synchronously on initial render
  const context = resolveNavigationContext(pathname || "");
  const [sidebarMode, setSidebarModeState] = useState<SidebarMode>(context.sidebarMode);
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Sync state synchronously during render if pathname changes
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setSidebarModeState(context.sidebarMode);
  }

  const switchPortal = useSidebarStore((s) => s.switchPortal);

  const setSidebarMode = (mode: SidebarMode) => {
    setSidebarModeState(mode);
  };

  // Perform portal state transition/restore in-memory inside an effect
  useEffect(() => {
    if (pathname) {
      const currentContext = resolveNavigationContext(pathname);
      switchPortal(currentContext.portal);
    }
  }, [pathname, switchPortal]);

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
