"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export type WorkspaceType = "ADMIN" | "COMPONENTS" | "AUDIT" | "AI";

interface WorkspaceContextProps {
  activeWorkspace: WorkspaceType;
  setActiveWorkspace: (workspace: WorkspaceType) => void;
}

const WorkspaceContext = createContext<WorkspaceContextProps | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const [activeWorkspace, setActiveWorkspaceState] = useState<WorkspaceType>("ADMIN");

  const setActiveWorkspace = (workspace: WorkspaceType) => {
    setActiveWorkspaceState(workspace);
  };

  useEffect(() => {
    if (!pathname) return;

    if (pathname.startsWith("/admin/components")) {
      setActiveWorkspaceState("COMPONENTS");
    } else if (pathname.startsWith("/admin/audit-logs")) {
      setActiveWorkspaceState("AUDIT");
    } else if (pathname.startsWith("/admin")) {
      setActiveWorkspaceState("ADMIN");
    } else {
      setActiveWorkspaceState("ADMIN");
    }
  }, [pathname]);

  return (
    <WorkspaceContext.Provider value={{ activeWorkspace, setActiveWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
};
