"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useThemeStore } from '@/stores/use-theme-store';

// Dynamically import ShapeGrid with SSR disabled to prevent hydration/SSR mismatches
const ShapeGrid = dynamic(() => import('../../../components/reactbits/ShapeGrid'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#f5f5f5]" />
});

export const AuthBackground: React.FC = () => {
  const theme = useThemeStore(state => state.theme);

  // Set initial default theme-based colors for hydration safety
  const [colors, setColors] = useState({
    borderColor: '#e6e6e6ff',
    hoverFillColor: '#f0f0f0ff',
  });

  useEffect(() => {
    // Resolve CSS variables dynamically from document.documentElement
    const root = document.documentElement;
    const style = getComputedStyle(root);

    // Read the semantic CSS variables defined in globals.css
    const border = style.getPropertyValue('--border').trim();
    const hover = style.getPropertyValue('--default').trim(); // Maps to --default in globals.css

    setColors({
      borderColor: border || (theme === 'dark' ? '#2d2d2dff' : '#e6e6e6ff'),
      hoverFillColor: hover || (theme === 'dark' ? '#3d3d3dff' : '#f0f0f0ff'),
    });
  }, [theme]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-background">
      <ShapeGrid
        speed={0.1}
        squareSize={40}
        direction="diagonal"
        borderColor={colors.borderColor}
        hoverFillColor={colors.hoverFillColor}
        shape="square"
        hoverTrailAmount={5}
      />
    </div>
  );
};

export default AuthBackground;
