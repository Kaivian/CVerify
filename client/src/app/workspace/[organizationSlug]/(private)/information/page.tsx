"use client";

import React from "react";
import { useParams } from "next/navigation";
import { WorkspaceInformationView } from "@/features/workspace/views/workspace-information-view";

export default function WorkspaceInformationPage() {
  const params = useParams();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  return <WorkspaceInformationView organizationSlug={organizationSlug} />;
}
