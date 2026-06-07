"use client";

import React from "react";
import { useParams } from "next/navigation";
import { WorkspaceView } from "@/features/workspace/views/workspace-view";

export default function WorkspacePage() {
  const params = useParams();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  return <WorkspaceView organizationSlug={organizationSlug} />;
}
