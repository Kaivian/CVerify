"use client";

import React from "react";
import { useAuth } from "../../features/auth/hooks/use-auth";
import { useRouter } from "next/navigation";
import {
  Dropdown,
  Avatar,
  Label,
  Separator,
  Chip,
  Kbd,
} from "@heroui/react";
import {
  LogOut,
  Settings,
  Sun,
  Moon,
  LaptopMinimal,
  User,
  CreditCard,
  Palette,
  Globe,
  Headset,
} from "lucide-react";
import { setCookie } from "../../services/axios-client";
import { useThemeStore } from "../../stores/use-theme-store";

export function AuthAvatar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useThemeStore();

  React.useEffect(() => {
    console.log("[Navbar Avatar Render Diagnostics] user.avatarUrl:", user?.avatarUrl);
  }, [user?.avatarUrl]);

  React.useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        await logout(true);
        router.push("/login");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [logout, router]);

  if (!user) return null;

  const isBusiness = user.role === "BUSINESS";

  const initials = user.fullName
    ? user.fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
    : "U";

  const handleAction = async (key: React.Key) => {
    switch (key) {
      case "dashboard":
        const role = user.role?.toLowerCase() || "user";
        router.push(`/${role}`);
        break;
      case "settings":
        router.push("/settings");
        break;
      case "lang-vi":
        setCookie("i18next", "vi");
        if (typeof window !== "undefined") {
          localStorage.setItem("i18nextLng", "vi");
        }
        break;
      case "lang-en":
        setCookie("i18next", "en");
        if (typeof window !== "undefined") {
          localStorage.setItem("i18nextLng", "en");
        }
        break;
      case "theme-light":
        setTheme("light");
        break;
      case "theme-dark":
        setTheme("dark");
        break;
      case "theme-ocean":
        setTheme("ocean");
        break;
      case "logout":
        await logout(true);
        router.push("/login");
        break;
      default:
        break;
    }
  };

  return (
    <Dropdown>
      <Dropdown.Trigger className="w-full flex gap-2 items-center bg-transparent hover:bg-transparent border-none p-0 cursor-pointer outline-hidden">
        <>
          <Avatar key={user.avatarUrl || "default"}>
            {user.avatarUrl && (
              <Avatar.Image src={user.avatarUrl} alt={user.fullName} referrerPolicy="no-referrer" />
            )}
            <Avatar.Fallback className="font-bold text-xs">
              {initials}
            </Avatar.Fallback>
          </Avatar>
          <div className="hidden sm:flex flex-col items-start text-left">
            <span className="text-xs font-bold text-foreground">
              {user.fullName}
            </span>
            <span className="text-[10px] text-muted">{user.email}</span>
          </div>
          <Chip className="-mr-2 text-[10px]" color="accent" variant="soft">
            {user.role}
          </Chip>
        </>
      </Dropdown.Trigger>
      <Dropdown.Popover className="min-w-[240px] rounded-xl p-1 z-9999 bg-background border-2">
        <Dropdown.Menu onAction={handleAction} className="outline-hidden">
          <Dropdown.Section className="gap-1">
            {!isBusiness && (
              <>
                <Dropdown.Item
                  id="profile"
                  textValue="View Profile"
                  className="rounded-lg"
                >
                  <div className="flex items-center gap-2.5 w-full">
                    <User className="size-4 shrink-0 text-muted" />
                    <Label className="cursor-pointer font-semibold text-foreground">
                      View Profile
                    </Label>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item
                  id="settings"
                  textValue="Profile Settings"
                  className="rounded-lg"
                >
                  <div className="flex items-center gap-2.5 w-full">
                    <Settings className="size-4 shrink-0 text-muted" />
                    <Label className="cursor-pointer font-semibold text-foreground">
                      Profile Settings
                    </Label>
                  </div>
                </Dropdown.Item>
              </>
            )}
            <Dropdown.Item
              id="balance"
              textValue="Remain Credit"
              className="rounded-lg"
            >
              <div className="flex items-center justify-between w-full gap-2">
                <div className="flex items-center gap-2.5">
                  <CreditCard className="size-4 shrink-0 text-muted" />
                  <Label className="cursor-pointer font-semibold text-foreground">
                    Remain Credit
                  </Label>
                </div>
                <Chip
                  color="accent"
                  variant="soft"
                  size="sm"
                  className="h-5 text-[10px]"
                >
                  123
                </Chip>
              </div>
            </Dropdown.Item>
          </Dropdown.Section>
          <Separator variant="tertiary" className="my-2" />
          <Dropdown.Section className="gap-1">
            <Dropdown.SubmenuTrigger>
              <Dropdown.Item
                id="theme-selector"
                textValue="Themes"
                className="rounded-lg cursor-pointer"
              >
                <div className="flex items-center justify-between w-full gap-2">
                  <div className="flex items-center gap-2.5">
                    <Palette className="size-4 shrink-0 text-muted" />
                    <Label className="cursor-pointer font-semibold text-foreground">
                      Themes
                    </Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const isSystem =
                        typeof window !== "undefined" &&
                        localStorage.getItem("theme") === "system";
                      if (isSystem) {
                        return (
                          <div className="flex items-center gap-1 text-muted">
                            <LaptopMinimal className="size-3" />
                            <span className="text-[10px]">
                              System
                            </span>
                          </div>
                        );
                      }
                      if (theme === "dark") {
                        return (
                          <div className="flex items-center gap-1 text-muted">
                            <Moon className="size-3" />
                            <span className="text-[10px]">
                              Dark
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div className="flex items-center gap-1 text-muted">
                          <Sun className="size-3" />
                          <span className="text-[10px]">
                            Light
                          </span>
                        </div>
                      );
                    })()}
                    <Dropdown.SubmenuIndicator />
                  </div>
                </div>
              </Dropdown.Item>
              <Dropdown.Popover className="min-w-[110px] bg-background border-2 rounded-xl p-1 z-9999 shadow-overlay">
                <Dropdown.Menu
                  onAction={(key) => {
                    const targetTheme = String(key);
                    if (targetTheme === "system") {
                      const systemTheme = window.matchMedia(
                        "(prefers-color-scheme: dark)",
                      ).matches
                        ? "dark"
                        : "light";
                      setTheme(systemTheme);
                      localStorage.setItem("theme", "system");
                    } else {
                      setTheme(targetTheme);
                    }
                  }}
                  className="outline-hidden"
                >
                  <Dropdown.Item
                    id="light"
                    textValue="Light"
                    className="rounded-lg"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Sun className="size-4 shrink-0 text-muted" />
                      <Label className="cursor-pointer font-semibold text-foreground">
                        Light
                      </Label>
                    </div>
                  </Dropdown.Item>
                  <Dropdown.Item
                    id="dark"
                    textValue="Dark"
                    className="rounded-lg"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Moon className="size-4 shrink-0 text-muted" />
                      <Label className="cursor-pointer font-semibold text-foreground">
                        Dark
                      </Label>
                    </div>
                  </Dropdown.Item>
                  <Dropdown.Item
                    id="system"
                    textValue="System"
                    className="rounded-lg"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <LaptopMinimal className="size-4 shrink-0 text-muted" />
                      <Label className="cursor-pointer font-semibold text-foreground">
                        System
                      </Label>
                    </div>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.SubmenuTrigger>
            <Dropdown.SubmenuTrigger>
              <Dropdown.Item
                id="language-selector"
                textValue="Languages"
                className="rounded-lg"
              >
                <div className="flex items-center justify-between w-full gap-2">
                  <div className="flex items-center gap-2.5">
                    <Globe className="size-4 shrink-0 text-muted" />
                    <Label className="cursor-pointer font-semibold text-foreground">
                      Languages
                    </Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 text-muted">
                      <Globe className="size-3" />
                      <span className="text-[10px]">
                        EN
                      </span>
                    </div>
                    <Dropdown.SubmenuIndicator />
                  </div>
                </div>
              </Dropdown.Item>
              <Dropdown.Popover className="min-w-[90px] bg-background border-2 rounded-xl p-1 z-9999 shadow-overlay">
                <Dropdown.Menu
                  onAction={(key) => {
                    const lang = String(key);
                    setCookie("i18next", lang);
                    if (typeof window !== "undefined") {
                      localStorage.setItem("i18nextLng", lang);
                    }
                  }}
                  className="outline-hidden"
                >
                  <Dropdown.Item
                    id="vi"
                    textValue="VN"
                    className="rounded-lg"
                  >
                    <div className="flex items-center gap-2 w-full justify-center">
                      <Label className="cursor-pointer font-semibold text-foreground">
                        VN
                      </Label>
                    </div>
                  </Dropdown.Item>
                  <Dropdown.Item
                    id="en"
                    textValue="EN"
                    className="rounded-lg"
                  >
                    <div className="flex items-center gap-2 w-full justify-center">
                      <Label className="cursor-pointer font-semibold text-foreground">
                        EN
                      </Label>
                    </div>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.SubmenuTrigger>
            <Dropdown.Item
              id="support"
              textValue="Support"
              className="rounded-lg"
            >
              <div className="flex items-center gap-2.5 w-full">
                <Headset className="size-4 shrink-0 text-muted" />
                <Label className="cursor-pointer font-semibold text-foreground">
                  Support
                </Label>
              </div>
            </Dropdown.Item>
          </Dropdown.Section>
          <Separator variant="tertiary" className="my-2" />
          <Dropdown.Section className="gap-1">
            <Dropdown.Item
              id="logout"
              textValue="Logout"
              className="rounded-lg hover:bg-danger-soft"
            >
              <div className="flex items-center justify-between w-full gap-2">
                <div className="flex items-center gap-2.5">
                  <LogOut className="size-4 shrink-0 rotate-180 text-danger" />
                  <Label className="text-danger cursor-pointer font-bold">
                    Logout
                  </Label>
                </div>
                <Kbd slot="keyboard" variant="light">
                  <Kbd.Abbr keyValue="command" />
                  <Kbd.Content>L</Kbd.Content>
                </Kbd>
              </div>
            </Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
export default AuthAvatar;
