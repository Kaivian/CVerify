"use client";

import React, { useState, useEffect } from "react";
import { useThemeStore } from "@/stores/use-theme-store";

interface AuthContentProps {
  children: React.ReactNode;
}

export const AuthContent: React.FC<AuthContentProps> = ({ children }) => {
  const theme = useThemeStore((state) => state.theme);

  // SSR hydration safeguard: only render theme-dependent assets after client mount
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const isDarkTheme = theme === "dark" || theme === "ocean";
  const logoSrc = isMounted
    ? (isDarkTheme ? "/brand/logo&name-white.png" : "/brand/logo&name-black.png")
    : "/brand/logo&name-white.png";

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 md:p-12 relative w-full h-full min-h-[80vh] md:min-h-0">
      {/* Mobile/Tablet Logo Header (Hidden on Desktop) */}
      <div className="xl:hidden absolute top-12 left-6 md:left-12 select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          alt="CVerify Logo"
          className="h-8 w-auto"
        />
      </div>

      {/* Shared Standardized Width Content Area */}
      <div className="w-full z-10 flex justify-center mt-8 xl:mt-0">
        {children}
      </div>
    </div>
  );
};

export default AuthContent;

