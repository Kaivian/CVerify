"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export type WorkspaceType = "ADMIN" | "COMPONENTS" | "AUDIT" | "AI" | "ORGANIZATION";

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

    let target: WorkspaceType = "ADMIN";
    if (pathname.startsWith("/admin/components")) {
      target = "COMPONENTS";
    } else if (pathname.startsWith("/admin/audit-logs")) {
      target = "AUDIT";
    } else if (pathname.startsWith("/business/")) {
      target = "ORGANIZATION";
    }

    // Set state asynchronously to avoid cascading synchronous renders warning
    Promise.resolve().then(() => {
      setActiveWorkspaceState(target);
    });
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
