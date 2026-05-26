"use client";

import React from "react";
import { Typography } from "@heroui/react";

interface SettingsSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  children,
}) => {
  const hasHeader = !!(title || description);

  return (
    <div className="relative">
      {hasHeader && (
        <div className="bg-background z-30 flex flex-col text-left pl-4 py-2 rounded-b-2xl">
          {title && (
            <Typography type="body-sm" className="font-bold uppercase text-sm">
              {title}
            </Typography>
          )}
          {description && (
            <Typography
              type="body-xs"
              className="text-muted leading-relaxed font-medium"
            >
              {description}
            </Typography>
          )}
        </div>
      )}
      <div className="flex flex-col w-full min-w-0">{children}</div>
    </div>
  );
};

export default SettingsSection;
