import React, { useState, useEffect } from "react";
import { Typography, Link } from "@heroui/react";
import { useThemeStore } from "@/stores/use-theme-store";

export const AuthShowcase: React.FC = () => {
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
    <div className="hidden xl:flex flex-col justify-center pl-12">
      <div className="absolute top-12 left-12">
        <Link href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt="CVerify Logo"
            className="h-10 w-auto"
          />
        </Link>
      </div>

      <Typography.Prose>
        <h2 className="text-[55px] font-bold mb-6 text-foreground">
          Access Technical Truth
        </h2>
        <p className="text-2xl font-light tracking-tight mb-8 mr-24 text-muted">
          Secure infrastructure for verifying professional identity and
          engineering excellence through cryptographically-backed contribution
          analysis.
        </p>
      </Typography.Prose>
    </div>
  );
};

export default AuthShowcase;
