"use client";

import React, { useState, useEffect } from "react";
import { Typography, Tabs, Separator } from "@heroui/react";
import {
  User,
  Briefcase,
  Settings,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { ProfileTab } from "./components/ProfileTab";
import { CareerTab } from "./components/CareerTab";
import { AccountTab } from "./components/AccountTab";
import { DialogModal } from "@/components/ui/dialog-modal";
import { Button } from "@/components/ui/button";

type TabId = "profile" | "career" | "account";

interface TabItem {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [isFormDirty, setIsFormDirty] = useState(false);

  // Tab switching confirm dialog state
  const [pendingTab, setPendingTab] = useState<TabId | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Success toast state
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const tabs: TabItem[] = [
    { id: "profile", label: "Public Profile", icon: User },
    { id: "career", label: "Career Preferences", icon: Briefcase },
    { id: "account", label: "Account & Security", icon: Settings },
  ];

  // 1. Browser reload/exit warning when forms are dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isFormDirty) {
        e.preventDefault();
        e.returnValue =
          "You have unsaved settings modifications. Are you sure you want to exit?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isFormDirty]);

  // 2. Tab switching guard logic
  const handleTabClick = (tabId: TabId) => {
    if (tabId === activeTab) return;

    if (isFormDirty) {
      setPendingTab(tabId);
      setIsConfirmModalOpen(true);
    } else {
      setActiveTab(tabId);
    }
  };

  const confirmTabSwitch = () => {
    if (pendingTab) {
      setIsFormDirty(false); // Reset dirty flag before switching
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
    setIsConfirmModalOpen(false);
  };

  const triggerSaveNotification = () => {
    setShowSuccessToast(true);
    setTimeout(() => {
      setShowSuccessToast(false);
    }, 3000);
  };

  return (
    <div className="flex flex-col h-full w-full text-left relative overflow-hidden">
      {/* Header and Title */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div className="flex flex-col text-left">
          <Typography.Heading level={2} className="font-extrabold">
            Account Settings
          </Typography.Heading>
          <Typography
            type="body-sm"
            className="text-muted mt-1 max-w-xl whitespace-nowrap"
          >
            Manage your developer credential verification identity profile, job
            availability, and SSO access.
          </Typography>
        </div>

        {/* Right column: Dynamic active tab description */}
        <div className="flex flex-col items-end text-right max-w-sm p-4 rounded-2xl transition-all duration-300">
          <Typography
            type="body-xs"
            className="text-accent font-extrabold uppercase tracking-widest"
          >
            {activeTab === "profile" && "Profile Information"}
            {activeTab === "career" && "Career Preferences"}
            {activeTab === "account" && "Account & Security"}
          </Typography>
          <Typography
            type="body-xs"
            className="text-muted leading-relaxed text-[11px] text-right"
          >
            {activeTab === "profile" && (
              <div>
                Update your name, public contact email, location,
                <br /> and write a small bio detailing your work.
              </div>
            )}
            {activeTab === "career" && (
              <div>
                Signal to companies, recruiters, and the CVerify network
                <br />
                if you are currently open to new job contracts.
              </div>
            )}
            {activeTab === "account" && (
              <div>
                Customize your public username, manage connected auth accounts,
                security credentials, sessions, and privacy settings.
              </div>
            )}
          </Typography>
        </div>
      </div>

      <Separator variant="tertiary" className="mb-6" />

      {/* Main Settings Grid Layout */}
      <Tabs
        orientation="vertical"
        selectedKey={activeTab}
        onSelectionChange={(key) => handleTabClick(key as TabId)}
        variant="secondary"
        className="overflow-hidden w-full gap-6"
      >
        <Tabs.ListContainer>
          <Tabs.List
            aria-label="Settings navigation sections"
            className="flex flex-col items-start gap-2"
          >
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <Tabs.Tab
                  key={tab.id}
                  id={tab.id}
                  className="w-full flex items-center justify-start gap-2 whitespace-nowrap text-left"
                >
                  <TabIcon size={15} />

                  <span className="whitespace-nowrap">{tab.label}</span>

                  <Tabs.Indicator />
                </Tabs.Tab>
              );
            })}
          </Tabs.List>
        </Tabs.ListContainer>
        <main className="w-full flex-1 min-h-0 overflow-y-auto pr-2 pb-6 flex flex-col">
          <Tabs.Panel id="profile" className="p-0">
            {activeTab === "profile" && (
              <ProfileTab
                onDirtyChange={setIsFormDirty}
                onSaveSuccess={triggerSaveNotification}
              />
            )}
          </Tabs.Panel>
          <Tabs.Panel id="career" className="p-0">
            {activeTab === "career" && (
              <CareerTab
                onDirtyChange={setIsFormDirty}
                onSaveSuccess={triggerSaveNotification}
              />
            )}
          </Tabs.Panel>
          <Tabs.Panel id="account" className="p-0">
            {activeTab === "account" && (
              <AccountTab
                onDirtyChange={setIsFormDirty}
                onSaveSuccess={triggerSaveNotification}
              />
            )}
          </Tabs.Panel>
        </main>
      </Tabs>

      {/* 1. Tab Switching Danger Warning Modal */}
      <DialogModal
        isOpen={isConfirmModalOpen}
        onOpenChange={setIsConfirmModalOpen}
        title="Discard Unsaved Changes?"
        footer={
          <div className="flex items-center gap-2.5 w-full justify-end select-none">
            <Button
              variant="bordered"
              onClick={() => {
                setIsConfirmModalOpen(false);
                setPendingTab(null);
              }}
              className="rounded-xl font-bold text-xs h-9 px-4 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              onClick={confirmTabSwitch}
              className="rounded-xl font-bold bg-danger border border-danger text-danger-foreground text-xs h-9 px-4 cursor-pointer hover:opacity-90"
            >
              Discard modifications
            </Button>
          </div>
        }
      >
        <div className="flex items-start gap-3.5 py-1 text-left select-none">
          <div className="w-10 h-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center shrink-0 border border-danger/25">
            <AlertTriangle size={18} />
          </div>
          <div className="flex flex-col gap-1">
            <Typography
              type="body-sm"
              className="font-bold text-foreground font-outfit"
            >
              You have unsaved changes.
            </Typography>
            <Typography
              type="body-xs"
              className="text-muted leading-relaxed font-medium"
            >
              Switching tabs will discard all changes made to your active forms.
              Are you sure you want to proceed and lose these edits?
            </Typography>
          </div>
        </div>
      </DialogModal>

      {/* 2. Success Toast Alert Banner */}
      {showSuccessToast && (
        <div className="fixed top-6 right-6 z-9999 flex items-center gap-2.5 px-4.5 py-3 rounded-xl border border-success/30 bg-success text-success-foreground shadow-modal animate-slide-in select-none">
          <CheckCircle size={16} className="shrink-0" />
          <div className="flex flex-col text-left">
            <Typography
              type="body-xs"
              className="font-extrabold font-outfit uppercase tracking-wider text-[9px] text-success-foreground/90 leading-none"
            >
              Success
            </Typography>
            <Typography
              type="body-xs"
              className="font-bold text-[10.5px] mt-0.5"
            >
              Settings updated successfully.
            </Typography>
          </div>
        </div>
      )}
    </div>
  );
}
