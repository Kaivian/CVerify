"use client";

import React from 'react';
import SidebarDesktop from './sidebar-desktop';
import SidebarMobile from './sidebar-mobile';

export const Sidebar: React.FC = () => {
  return (
    <>
      <SidebarDesktop />
      <SidebarMobile />
    </>
  );
};

export default Sidebar;
export { SidebarDesktop } from './sidebar-desktop';
export { SidebarMobile } from './sidebar-mobile';
export { SidebarBrand } from './sidebar-brand';
export { SidebarFooter } from './sidebar-footer';
export { SidebarLink } from './sidebar-link';
export { SidebarGroup } from './sidebar-group';
export { SidebarSection } from './sidebar-section';
