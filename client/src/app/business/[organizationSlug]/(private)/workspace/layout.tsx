"use client";

import React, { useEffect } from "react";
import { useSidebarMode } from "@/providers/sidebar-mode-provider";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { setSidebarMode } = useSidebarMode();

  useEffect(() => {
    setSidebarMode("WORKSPACE");
    return () => {
      setSidebarMode("COMPANY");
    };
  }, [setSidebarMode]);

  return <>{children}</>;
}
