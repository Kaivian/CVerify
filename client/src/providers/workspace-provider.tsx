"use client";

import React, { createContext, useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { resolveNavigationContext, type WorkspaceType } from "../lib/navigation-utils";

export type { WorkspaceType };

interface WorkspaceContextProps {
  activeWorkspace: WorkspaceType;
  setActiveWorkspace: (workspace: WorkspaceType) => void;
}

const WorkspaceContext = createContext<WorkspaceContextProps | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  
  // Resolve navigation context synchronously on initial render
  const context = resolveNavigationContext(pathname || "");
  const [activeWorkspace, setActiveWorkspaceState] = useState<WorkspaceType>(context.workspaceType);
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Sync state synchronously during render if pathname changes
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setActiveWorkspaceState(context.workspaceType);
  }

  const setActiveWorkspace = (workspace: WorkspaceType) => {
    setActiveWorkspaceState(workspace);
  };

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
