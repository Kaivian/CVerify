"use client";

import React from 'react';
import { useAuth } from '../../../features/auth/hooks/use-auth';
import { AuthAvatar } from '../auth-avatar';
import { Typography } from '@heroui/react';

interface SidebarFooterProps {
  collapsed: boolean;
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({ collapsed }) => {
  const { user } = useAuth();
  const userRole = user?.role || 'USER';

  return (
    <div className="flex flex-col border-t border-separator shrink-0 select-none bg-background/50">
      {/* User profile row */}
      <div className="p-4 flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <AuthAvatar />
          <div
            className={[
              "flex flex-col min-w-0 transition-all duration-300 ease-in-out",
              collapsed ? "w-0 opacity-0 pointer-events-none" : "w-auto opacity-100"
            ].join(' ')}
          >
            <Typography type="body-sm" className="font-bold truncate text-foreground font-outfit">
              {user?.fullName}
            </Typography>
            <Typography type="body-xs" className="text-muted text-[10px] uppercase font-extrabold tracking-wider font-outfit">
              {userRole}
            </Typography>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SidebarFooter;
