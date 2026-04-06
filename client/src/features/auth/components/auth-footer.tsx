import React from "react";
import { Link } from "@heroui/react";

export const AuthFooter: React.FC = () => {
  return (
    <footer
      className="w-full border-t border-divider flex flex-col md:flex-row items-center justify-between px-6 md:px-12 gap-4 md:gap-0 shrink-0 bg-surface py-4 md:py-0 select-none z-10"
      style={{ minHeight: "10vh" }}
    >
      <div className="text-foreground text-sm font-medium">
        <p>CVERIFY © 2026. REAL COMMITS. REAL CAREER</p>
      </div>
      <div className="flex flex-wrap justify-center gap-6 md:gap-8 text-sm">
        <Link className="text-foreground font-semibold" href="/privacy-policy">
          Privacy Policy
          <Link.Icon className="pt-0.5" />
        </Link>
        <Link
          className="text-foreground font-semibold"
          href="/terms-of-service"
        >
          Terms of Service
          <Link.Icon className="pt-0.5" />
        </Link>
        <Link className="text-foreground font-semibold" href="/contact">
          Contact
          <Link.Icon className="pt-0.5" />
        </Link>
        <Link className="text-foreground font-semibold" href="/system-status">
          System Status
          <Link.Icon className="pt-0.5" />
        </Link>
      </div>
    </footer>
  );
};

export default AuthFooter;
