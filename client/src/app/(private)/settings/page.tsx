"use client";

import React, { useState, useEffect } from "react";
import {
  Typography,
  Tabs,
  Separator,
  Button,
  AlertDialog,
  toast,
} from "@heroui/react";
import {
  User,
  Briefcase,
  Settings,
  AlertTriangle,
  BookOpen,
} from "lucide-react";
import { ProfileTab } from "./components/ProfileTab";
import { PersonalInfoTab } from "./components/PersonalInfoTab";
import { CareerTab } from "./components/CareerTab";
import { AccountTab } from "./components/AccountTab";

type TabId = "profile" | "personal-info" | "career" | "account";

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

  const tabs: TabItem[] = [
    { id: "profile", label: "Profile Settings", icon: User },
    { id: "personal-info", label: "Personal Information", icon: BookOpen },
    { id: "career", label: "Career Preferences", icon: Briefcase },
    { id: "account", label: "Account & Security", icon: Settings },
  ];

  // 1. Browser reload/exit warning when forms are dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isFormDirty) {
        e.preventDefault();
        // Bypass deprecation warning while maintaining legacy browser compatibility
        const legacyEvent = e as unknown as { returnValue: string };
        legacyEvent.returnValue = "";
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
    toast.success("Settings updated successfully.", {
      description: "Your account and profile configurations have been updated.",
    });
  };

  return (
    <div className="flex flex-col h-full w-full text-left relative overflow-hidden">
      {/* Header and Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-1">
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
        <div className="flex flex-col items-end text-right max-w-sm rounded-2xl transition-all duration-300">
          <Typography
            type="body-xs"
            className="text-accent font-extrabold uppercase tracking-widest"
          >
            {activeTab === "profile" && "Profile Information"}
            {activeTab === "personal-info" && "Personal Information"}
            {activeTab === "career" && "Career Preferences"}
            {activeTab === "account" && "Account & Security"}
          </Typography>
          <Typography
            type="body-xs"
            className="text-muted leading-relaxed text-[11px] text-right"
          >
            {activeTab === "profile" && (
              <span>
                Update your name, public contact email, location,
                <br /> and write a small bio detailing your work.
              </span>
            )}
            {activeTab === "personal-info" && (
              <span>
                Manage your academic credentials, education history,
                <br /> and degrees verified by CVerify.
              </span>
            )}
            {activeTab === "career" && (
              <span>
                Signal to companies, recruiters, and the CVerify network
                <br />
                if you are currently open to new job contracts.
              </span>
            )}
            {activeTab === "account" && (
              <span>
                Customize your public username, manage connected auth accounts,
                security credentials, sessions, and privacy settings.
              </span>
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
        <main className="w-full flex-1 min-h-0 overflow-y-auto flex flex-col">
          <Tabs.Panel id="profile" className="p-0">
            {activeTab === "profile" && (
              <ProfileTab
                onDirtyChange={setIsFormDirty}
                onSaveSuccess={triggerSaveNotification}
              />
            )}
          </Tabs.Panel>
          <Tabs.Panel id="personal-info" className="p-0">
            {activeTab === "personal-info" && (
              <PersonalInfoTab
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
      <AlertDialog.Backdrop
        isOpen={isConfirmModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsConfirmModalOpen(false);
            setPendingTab(null);
          }
        }}
      >
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-[400px]">
            {(renderProps) => (
              <>
                <AlertDialog.CloseTrigger />
                <AlertDialog.Header>
                  <AlertDialog.Icon status="warning">
                    <AlertTriangle className="size-5" />
                  </AlertDialog.Icon>
                  <AlertDialog.Heading>
                    Discard Unsaved Changes?
                  </AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p>
                    Switching tabs will discard all changes made to your active
                    forms. Are you sure you want to proceed and lose these
                    edits?
                  </p>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button
                    variant="tertiary"
                    onPress={() => {
                      setPendingTab(null);
                      renderProps.close();
                    }}
                    className="rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    onPress={() => {
                      confirmTabSwitch();
                      renderProps.close();
                    }}
                    className="bg-warning-soft text-warning rounded-xl"
                  >
                    Discard modifications
                  </Button>
                </AlertDialog.Footer>
              </>
            )}
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
}
