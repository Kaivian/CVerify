"use client";

import React from "react";
import { useParams } from "next/navigation";
import { BusinessDashboardView } from "@/modules/business/views/business-dashboard-view";

export default function WorkspaceDashboardPage() {
  const params = useParams();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  return <BusinessDashboardView />;
}
