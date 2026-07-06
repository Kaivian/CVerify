"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Typography } from "@heroui/react";

interface PreferenceCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}

export const PreferenceCard: React.FC<PreferenceCardProps> = ({
  title,
  description,
  children,
  className = "",
}) => {
  return (
    <Card className={`flex flex-col gap-4 text-left ${className}`}>
      <div className="flex flex-col gap-1 select-none">
        <Typography
          type="body-sm"
          className="font-bold text-foreground font-outfit"
        >
          {title}
        </Typography>
        {description && (
          <Typography
            type="body-xs"
            className="text-muted leading-relaxed font-medium"
          >
            {description}
          </Typography>
        )}
      </div>
      <div className="w-full mt-1">
        {children}
      </div>
    </Card>
  );
};

export default PreferenceCard;
