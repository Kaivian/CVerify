"use client";

import React from "react";
import { useParams } from "next/navigation";
import { WorkspaceMembersView } from "@/features/workspace/views/workspace-members-view";

export default function WorkspaceMembersPage() {
  const params = useParams();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  return <WorkspaceMembersView organizationSlug={organizationSlug} />;
}
