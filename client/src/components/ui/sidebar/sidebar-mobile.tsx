"use client";

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Drawer, ScrollShadow } from '@heroui/react';
import { X } from 'lucide-react';
import { useSidebarStore } from '../../../stores/use-sidebar-store';
import SidebarBrand from './sidebar-brand';
import SidebarContent from './sidebar-content';

export const SidebarMobile: React.FC = () => {
  const pathname = usePathname();
  const { isMobileOpen, setMobileOpen } = useSidebarStore();

  // Automatically close the mobile drawer when the page/route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  return (
    <Drawer>
      <Drawer.Backdrop
        isOpen={isMobileOpen}
        onOpenChange={setMobileOpen}
        variant="blur"
      >
        <Drawer.Content placement="left" className="h-screen max-w-[280px] w-[280px] bg-background">
          <Drawer.Dialog className="h-full bg-background flex flex-col outline-hidden border-e border-border pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)]">

            {/* Absolute close trigger on mobile drawer */}
            <Drawer.CloseTrigger
              aria-label="Close menu"
              className="absolute top-4 right-4 z-50 rounded-full bg-surface-secondary text-muted hover:text-foreground hover:bg-surface-tertiary transition-colors flex items-center justify-center h-8 w-8 outline-hidden cursor-pointer"
            >
              <X size={15} />
            </Drawer.CloseTrigger>

            {/* 1. Header Branding - always expanded on mobile */}
            <SidebarBrand collapsed={false} />

            {/* 2. Scrollable Menu Area wrapped in HeroUI ScrollShadow */}
            <ScrollShadow className="flex-1 px-2.5 py-4 flex flex-col gap-4 overflow-y-auto min-h-0">
              <SidebarContent collapsed={false} isMobile={true} />
            </ScrollShadow>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
};

export default SidebarMobile;
