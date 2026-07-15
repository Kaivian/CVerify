"use client";

import React, { useState } from "react";
import { Tabs, Typography } from "@heroui/react";
import { Shield, LayoutDashboard, ShieldAlert, Sliders, FileText } from "lucide-react";
import { SecurityDashboardView } from "@/modules/admin/security/security-dashboard-view";
import { SecurityEventsView } from "@/modules/admin/security/security-events-view";
import { SecurityRulesView } from "@/modules/admin/security/security-rules-view";
import { AuditLogsView } from "@/modules/admin/security/audit-logs-view";

export default function SecurityCenterPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "events" | "rules" | "audit">("dashboard");

  return (
    <div className="space-y-6 text-foreground font-outfit max-w-7xl mx-auto p-4 md:p-6">
      {/* Upper Dashboard Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-accent/15 text-accent border border-accent/10">
          <Shield size={28} />
        </div>
        <div>
          <Typography
            type="h2"
            className="text-2xl font-extrabold tracking-tight text-foreground font-display"
          >
            Security Center
          </Typography>
          <Typography type="body-sm" className="text-muted mt-0.5">
            Monitor streaming platform-wide threats, trigger manual containments, configure engine heuristics, and inspect audit trails.
          </Typography>
        </div>
      </div>

      {/* Tabs Layout */}
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(val) => setActiveTab(val as any)}
        className="w-full flex flex-col gap-6"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Security Center Tabs">

            <Tabs.Tab
              id="dashboard"
              className="gap-2"
            >
              <LayoutDashboard size={14} />
              Overview
              <Tabs.Indicator />
            </Tabs.Tab>

            <Tabs.Tab
              id="events"
              className="gap-2"
            >
              <ShieldAlert size={14} />
              Security Events
              <Tabs.Indicator />
            </Tabs.Tab>

            <Tabs.Tab
              id="rules"
              className="gap-2"
            >
              <Sliders size={14} />
              Detection Rules
              <Tabs.Indicator />
            </Tabs.Tab>

            <Tabs.Tab
              id="audit"
              className="gap-2"
            >
              <FileText size={14} />
              Audit Logs
              <Tabs.Indicator />
            </Tabs.Tab>

          </Tabs.List>
        </Tabs.ListContainer>

        {/* Tab Panels */}
        <Tabs.Panel id="dashboard" className="w-full">
          <SecurityDashboardView />
        </Tabs.Panel>

        <Tabs.Panel id="events" className="w-full">
          <SecurityEventsView />
        </Tabs.Panel>

        <Tabs.Panel id="rules" className="w-full">
          <SecurityRulesView />
        </Tabs.Panel>

        <Tabs.Panel id="audit" className="w-full">
          <AuditLogsView />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
