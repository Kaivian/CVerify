"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Typography } from "@heroui/react";
import { useThemeStore } from "../../../stores/use-theme-store";

interface SidebarBrandProps {
  collapsed: boolean;
}

export const SidebarBrand: React.FC<SidebarBrandProps> = ({ collapsed }) => {
  const { t } = useTranslation(["common"]);
  const theme = useThemeStore((state) => state.theme);

  // SSR hydration safeguard: only render theme-dependent assets after client mount
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const isLightTheme = theme === "light";
  const logoSrc = isMounted
    ? isLightTheme
      ? "/brand/logo.png"
      : "/brand/logo-white.png"
    : "/brand/logo-white.png";

  return (
    <div className="flex h-16 items-center px-3 select-none border-b border-separator gap-2 overflow-hidden transition-all duration-300">
      {/* Brand Logo Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoSrc} alt="CVerify Logo" className="w-9 h-auto" />

      {/* Brand Name Text */}
      <div
        className={[
          "flex flex-col min-w-0 transition-all duration-300 ease-in-out",
          collapsed ? "w-0 opacity-0" : "w-auto opacity-100",
        ].join(" ")}
      >
        <Typography
          type="body-sm"
          className="font-bold font-lato text-xl truncate"
        >
          {t("common:branding.title", { defaultValue: "CVerify" })}
        </Typography>
      </div>
    </div>
  );
};

export default SidebarBrand;
