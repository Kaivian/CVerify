"use client";

import React, { useState, useEffect } from "react";
import { useNotificationStore } from "../../stores/use-notification-store";
import { notificationsService } from "../../services/notifications.service";
import { type NotificationPreference } from "../../types/notifications.types";
import { DialogModal } from "./dialog-modal";
import {
  Popover,
  Tabs,
  Badge,
  ScrollShadow,
  Button,
  Separator,
  Switch,
  Spinner,
  Typography
} from "@heroui/react";
import {
  Bell,
  Settings,
  Inbox,
  Check,
  Trash2,
  UserPlus,
  UserMinus,
  UserCheck,
  Shield,
  GitFork,
  CheckCircle2,
  XCircle,
  Key,
  Globe,
  Info,
  FolderDot
} from "lucide-react";

// Notification type to icon mapping
const getNotificationIcon = (type: string) => {
  const iconClass = "w-4 h-4";
  switch (type) {
    case "MEMBER_INVITED":
      return <UserPlus className={`${iconClass} text-primary`} />;
    case "MEMBER_JOINED":
    case "MEMBER_ACTIVATED":
      return <UserCheck className={`${iconClass} text-success`} />;
    case "MEMBER_LEFT":
    case "MEMBER_REMOVED":
    case "MEMBER_SUSPENDED":
      return <UserMinus className={`${iconClass} text-danger`} />;
    case "ROLE_ASSIGNED":
    case "ROLE_UPDATED":
      return <Shield className={`${iconClass} text-accent`} />;
    case "PROJECT_CREATED":
      return <FolderDot className={`${iconClass} text-primary`} />;
    case "REPOSITORY_CONNECTED":
    case "REPOSITORY_ANALYZED":
      return <GitFork className={`${iconClass} text-accent`} />;
    case "VERIFICATION_COMPLETED":
      return <CheckCircle2 className={`${iconClass} text-success`} />;
    case "VERIFICATION_FAILED":
      return <XCircle className={`${iconClass} text-danger`} />;
    case "PASSWORD_CHANGED":
      return <Key className={`${iconClass} text-warning`} />;
    case "IP_VERIFIED":
      return <Globe className={`${iconClass} text-warning`} />;
    default:
      return <Info className={`${iconClass} text-muted`} />;
  }
};

// Vanilla JS localized time-ago formatter
const formatTimeAgo = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSeconds < 60) {
    return "Just now";
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString();
};

const NOTIFICATION_TYPES: Record<string, string> = {
  MEMBER_INVITED: "New Member Invited",
  MEMBER_JOINED: "Member Joined",
  MEMBER_LEFT: "Member Left",
  MEMBER_REMOVED: "Member Removed",
  MEMBER_SUSPENDED: "Member Suspended",
  MEMBER_ACTIVATED: "Member Activated",
  ROLE_ASSIGNED: "Role Assigned",
  ROLE_UPDATED: "Role Updated",
  PROJECT_CREATED: "Project Created",
  REPOSITORY_CONNECTED: "Repository Connected",
  REPOSITORY_ANALYZED: "Repository Analysis Completed",
  VERIFICATION_COMPLETED: "Verification Completed",
  VERIFICATION_FAILED: "Verification Failed",
  PASSWORD_CHANGED: "Security Alert: Password Changed",
  IP_VERIFIED: "Security Alert: New IP Verified"
};

const getNotificationDescription = (type: string, actor: string, count: number): string => {
  if (count > 1) {
    switch (type) {
      case 'MEMBER_JOINED':
        return `${actor} and ${count - 1} others joined.`;
      case 'MEMBER_LEFT':
        return `${actor} and ${count - 1} others left.`;
      default:
        return `${actor} and ${count - 1} others performed this action.`;
    }
  } else {
    switch (type) {
      case 'MEMBER_JOINED':
        return `${actor} joined the organization.`;
      case 'MEMBER_LEFT':
        return `${actor} left the organization.`;
      case 'MEMBER_INVITED':
        return `${actor} invited a new member.`;
      case 'ROLE_ASSIGNED':
        return `Role was assigned to ${actor}.`;
      case 'VERIFICATION_COMPLETED':
        return "Verification for organization completed successfully.";
      case 'VERIFICATION_FAILED':
        return "Verification for organization failed.";
      case 'PASSWORD_CHANGED':
        return "Your password was recently changed. If this wasn't you, please secure your account.";
      case 'IP_VERIFIED':
        return "A new IP address was successfully verified for your account.";
      default:
        return `${actor} performed this action.`;
    }
  }
};

// Customizable notification categories for settings page
const PREFERENCE_CATEGORIES = [
  {
    key: "member",
    defaultTitle: "Members & Roles",
    types: [
      { type: "MEMBER_INVITED" },
      { type: "MEMBER_JOINED" },
      { type: "MEMBER_LEFT" },
      { type: "MEMBER_REMOVED" },
      { type: "MEMBER_SUSPENDED" },
      { type: "MEMBER_ACTIVATED" },
      { type: "ROLE_ASSIGNED" },
      { type: "ROLE_UPDATED" }
    ]
  },
  {
    key: "project",
    defaultTitle: "Projects & Repositories",
    types: [
      { type: "PROJECT_CREATED" },
      { type: "REPOSITORY_CONNECTED" },
      { type: "REPOSITORY_ANALYZED" }
    ]
  },
  {
    key: "verification",
    defaultTitle: "Verification & Compliance",
    types: [
      { type: "VERIFICATION_COMPLETED" },
      { type: "VERIFICATION_FAILED" }
    ]
  },
  {
    key: "security",
    defaultTitle: "Security Alerts",
    types: [
      { type: "PASSWORD_CHANGED" },
      { type: "IP_VERIFIED" }
    ]
  }
];

export const NotificationDropdown: React.FC = () => {
  const {
    notifications,
    unreadCount,
    isLoading,
    unreadOnly,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    setUnreadOnly
  } = useNotificationStore();

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [prefLoading, setPrefLoading] = useState(false);

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const loadPreferences = async () => {
    setPrefLoading(true);
    try {
      const prefs = await notificationsService.getPreferences();
      setPreferences(prefs);
    } catch (err) {
      console.error("Failed to load preferences", err);
    } finally {
      setPrefLoading(false);
    }
  };

  const handleSettingsOpen = () => {
    setIsPopoverOpen(false);
    setIsSettingsOpen(true);
    loadPreferences();
  };

  const handleTogglePreference = async (notificationType: string, channel: string, isCurrentlyEnabled: boolean) => {
    try {
      const nextState = !isCurrentlyEnabled;
      await notificationsService.updatePreference({
        notificationType,
        channel,
        isEnabled: nextState
      });

      setPreferences((prev) => {
        const index = prev.findIndex(
          (p) => p.notificationType === notificationType && p.channel === channel
        );
        if (index !== -1) {
          return prev.map((p, idx) => (idx === index ? { ...p, isEnabled: nextState } : p));
        } else {
          return [
            ...prev,
            { id: "", notificationType, channel, isEnabled: nextState }
          ];
        }
      });
    } catch (err) {
      console.error("Failed to update preference", err);
    }
  };

  const getPrefState = (notificationType: string, channel: string): boolean => {
    const pref = preferences.find(
      (p) => p.notificationType === notificationType && p.channel === channel
    );
    // Defaults to true if no preference record is found in DB
    return pref ? pref.isEnabled : true;
  };

  return (
    <>
      <Popover isOpen={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <Popover.Trigger>
          <div className="relative inline-flex items-center cursor-pointer">
            <Badge.Anchor>
              <Button
                variant="ghost"
                isIconOnly
                aria-label="Notifications"
                className="rounded-lg hover:bg-surface-secondary text-muted hover:text-foreground transition-colors"
              >
                <Bell size={18} />
              </Button>
              {unreadCount > 0 && (
                <Badge color="danger" size="sm">
                  {unreadCount}
                </Badge>
              )}
            </Badge.Anchor>
          </div>
        </Popover.Trigger>

        <Popover.Content className="w-96 p-0 bg-background border border-border/80 rounded-2xl shadow-overlay z-50">
          <Popover.Dialog className="outline-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <Typography className="font-bold text-foreground font-outfit text-sm">
                Notifications
              </Typography>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => markAllAsRead()}
                    className="text-2xs text-primary font-bold hover:bg-primary/10 px-2 py-1 h-7 rounded-lg"
                  >
                    Mark all as read
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  onClick={handleSettingsOpen}
                  aria-label="Settings"
                  className="w-7 h-7 min-w-7 rounded-lg hover:bg-surface-secondary"
                >
                  <Settings size={15} className="text-muted hover:text-foreground" />
                </Button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="px-4 py-1.5 border-b border-border/30">
              <Tabs
                selectedKey={unreadOnly ? "unread" : "all"}
                onSelectionChange={(key) => setUnreadOnly(key === "unread")}
                variant="secondary"
                className="w-full"
              >
                <Tabs.ListContainer>
                  <Tabs.List className="w-full justify-start gap-4" aria-label="Notification filter">
                    <Tabs.Tab id="all" className="pb-1.5 text-xs font-semibold select-none cursor-pointer">
                      All
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab id="unread" className="pb-1.5 text-xs font-semibold select-none cursor-pointer">
                      <div className="flex items-center gap-1.5">
                        Unread
                        {unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] leading-none bg-danger/10 text-danger rounded-full font-bold">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  </Tabs.List>
                </Tabs.ListContainer>
              </Tabs>
            </div>

            {/* Notifications List */}
            <ScrollShadow className="max-h-[360px] overflow-y-auto">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted">
                  <Spinner size="md" color="accent" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <Inbox className="w-9 h-9 text-muted/40 mb-3" />
                  <Typography className="text-xs text-muted-secondary font-medium font-outfit">
                    No notifications yet
                  </Typography>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {notifications.map((item) => {
                    const title = NOTIFICATION_TYPES[item.notificationType] || item.notificationType.replace(/_/g, " ");

                    let description = "";
                    const actorName = item.payload?.actors?.[0]?.fullName || "";
                    const count = item.payload?.count || 1;

                    if (item.payload) {
                      description = getNotificationDescription(item.notificationType, actorName, count);
                    } else {
                      description = title;
                    }

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (!item.isRead) markAsRead(item.id);
                        }}
                        className={`flex gap-3 p-3.5 transition-colors cursor-pointer hover:bg-surface-secondary/40 group relative ${!item.isRead ? "bg-primary/5" : ""
                          }`}
                      >
                        {/* Unread circle badge */}
                        {!item.isRead && (
                          <div className="absolute top-4.5 right-4 w-1.5 h-1.5 rounded-full bg-primary" />
                        )}

                        {/* Icon */}
                        <div className="shrink-0 mt-0.5">
                          {getNotificationIcon(item.notificationType)}
                        </div>

                        {/* Details */}
                        <div className="grow pr-5 text-left">
                          <Typography className="font-bold text-[11px] text-foreground mb-0.5 leading-tight font-outfit">
                            {title}
                          </Typography>
                          <Typography className="text-[11px] text-muted-secondary leading-normal">
                            {description}
                          </Typography>
                          <Typography className="text-[9px] text-muted/60 mt-1 font-medium">
                            {formatTimeAgo(item.createdAt)}
                          </Typography>
                        </div>

                        {/* Actions on item hover */}
                        <div className="absolute right-2.5 bottom-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          {!item.isRead && (
                            <Button
                              size="sm"
                              variant="ghost"
                              isIconOnly
                              className="w-6 h-6 min-w-6 rounded-md hover:bg-surface-secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(item.id);
                              }}
                              aria-label="Mark as read"
                            >
                              <Check size={13} className="text-muted hover:text-foreground" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            isIconOnly
                            className="w-6 h-6 min-w-6 rounded-md hover:bg-danger/10 hover:text-danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(item.id);
                            }}
                            aria-label="Delete"
                          >
                            <Trash2 size={13} className="text-muted hover:text-danger" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollShadow>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>

      {/* Preferences Settings Modal */}
      <DialogModal
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        title="Notification Preferences"
        size="lg"
      >
        {prefLoading ? (
          <div className="flex justify-center items-center py-16">
            <Spinner size="md" color="accent" />
          </div>
        ) : (
          <ScrollShadow className="max-h-[50vh] overflow-y-auto pr-2 space-y-6">
            {PREFERENCE_CATEGORIES.map((category) => (
              <div key={category.key} className="space-y-3">
                <Typography className="text-xs font-bold uppercase tracking-wider text-primary font-outfit">
                  {category.defaultTitle}
                </Typography>

                <div className="border border-border/60 bg-surface-secondary/10 rounded-2xl divide-y divide-border/40 overflow-hidden">
                  {category.types.map((typeObj) => {
                    const inAppEnabled = getPrefState(typeObj.type, "in_app");
                    const emailEnabled = getPrefState(typeObj.type, "email");
                    const typeLabel = NOTIFICATION_TYPES[typeObj.type] || typeObj.type.replace(/_/g, " ");

                    return (
                      <div
                        key={typeObj.type}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4"
                      >
                        <div className="flex flex-col gap-0.5 text-left">
                          <Typography className="text-xs font-bold text-foreground font-outfit leading-tight">
                            {typeLabel}
                          </Typography>
                          <Typography className="text-[10px] text-muted-secondary leading-normal">
                            {getNotificationDescription(typeObj.type, "Someone", 1)}
                          </Typography>
                        </div>

                        <div className="flex items-center gap-6 select-none shrink-0 self-end sm:self-center">
                          {/* In App Switch */}
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-muted-secondary">
                              In-App
                            </span>
                            <Switch
                              isSelected={inAppEnabled}
                              onChange={() =>
                                handleTogglePreference(typeObj.type, "in_app", inAppEnabled)
                              }
                              aria-label={`Toggle In-App notifications for ${typeLabel}`}
                              className="cursor-pointer"
                            >
                              {({ isSelected }) => (
                                <Switch.Control
                                  className={`w-8 h-4.5 rounded-full relative flex items-center transition-colors duration-200 ${isSelected ? "bg-success" : "bg-separator"
                                    }`}
                                >
                                  <Switch.Thumb
                                    className={`w-3.5 h-3.5 bg-foreground rounded-full absolute transition-all duration-200 ${isSelected ? "left-[14px]" : "left-0.5"
                                      }`}
                                  />
                                </Switch.Control>
                              )}
                            </Switch>
                          </div>

                          {/* Email Switch */}
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-muted-secondary">
                              Email
                            </span>
                            <Switch
                              isSelected={emailEnabled}
                              onChange={() =>
                                handleTogglePreference(typeObj.type, "email", emailEnabled)
                              }
                              aria-label={`Toggle Email notifications for ${typeLabel}`}
                              className="cursor-pointer"
                            >
                              {({ isSelected }) => (
                                <Switch.Control
                                  className={`w-8 h-4.5 rounded-full relative flex items-center transition-colors duration-200 ${isSelected ? "bg-success" : "bg-separator"
                                    }`}
                                >
                                  <Switch.Thumb
                                    className={`w-3.5 h-3.5 bg-foreground rounded-full absolute transition-all duration-200 ${isSelected ? "left-[14px]" : "left-0.5"
                                      }`}
                                  />
                                </Switch.Control>
                              )}
                            </Switch>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </ScrollShadow>
        )}
      </DialogModal>
    </>
  );
};

export default NotificationDropdown;
