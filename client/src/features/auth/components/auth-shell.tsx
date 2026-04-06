"use client";

import React from 'react';
import { GuestGuard } from '../guards/guest-guard';
import { AuthBackground } from './auth-background';
import { AuthShowcase } from './auth-showcase';
import { AuthContent } from './auth-content';
import { AuthFooter } from './auth-footer';

interface AuthShellProps {
  children: React.ReactNode;
}

export const AuthShell: React.FC<AuthShellProps> = ({ children }) => {
  return (
    <GuestGuard>
      <div className="flex flex-col min-h-screen w-screen bg-[#f5f5f5] overflow-x-hidden font-outfit relative">
        {/* Dynamic Canvas Background Layer */}
        <AuthBackground />

        {/* Proportional Grid Layer */}
        <div className="relative z-10 flex-1 w-full flex flex-col">
          <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] flex-1 w-full h-full">
            {/* Left Column Showcase */}
            <AuthShowcase />

            {/* Right Column Content */}
            <AuthContent>
              {children}
            </AuthContent>
          </div>
        </div>

        {/* Responsive Footer Layer */}
        <AuthFooter />
      </div>
    </GuestGuard>
  );
};

export default AuthShell;
