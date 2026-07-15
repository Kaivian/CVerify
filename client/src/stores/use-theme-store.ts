"use client";

import { create } from 'zustand';
import { getCookie, setCookie } from '../services/axios-client';

export type ThemeType = 'light' | 'dark' | 'ocean' | 'emerald' | string;

interface ThemeState {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  toggleTheme: () => void;
  initializeTheme: () => void;
}

// Extensible list of theme class names to remove when switching themes
const KNOWN_THEMES = ['light', 'dark', 'ocean', 'emerald'];

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'light', // Default fallback is light

  setTheme: (newTheme: ThemeType) => {
    if (typeof window === 'undefined') return;

    const currentTheme = get().theme;
    if (currentTheme === newTheme) return;

    // 1. Update State
    set({ theme: newTheme });

    // 2. Synchronize to DOM Element
    const root = document.documentElement;
    
    // Remove all previous known theme classes to avoid conflict
    KNOWN_THEMES.forEach(t => root.classList.remove(t));
    if (!KNOWN_THEMES.includes(currentTheme)) {
      root.classList.remove(currentTheme);
    }

    // Add the new theme class
    root.classList.add(newTheme);
    root.setAttribute('data-theme', newTheme);

    // 3. Persist Theme in Storage & Cookie (1 year max-age)
    localStorage.setItem('theme', newTheme);
    setCookie('theme', newTheme, 31536000);
  },

  toggleTheme: () => {
    const currentTheme = get().theme;
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    get().setTheme(nextTheme);
  },

  initializeTheme: () => {
    if (typeof window === 'undefined') return;

    // 1. Read stored preferences and current OS preferences
    const cookieTheme = getCookie('theme');
    const localTheme = localStorage.getItem('theme');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    
    let activeTheme: ThemeType = 'light'; // Default first-time fallback is light

    if (cookieTheme && KNOWN_THEMES.includes(cookieTheme)) {
      activeTheme = cookieTheme;
    } else if (localTheme) {
      if (localTheme === 'system') {
        activeTheme = systemTheme;
      } else if (KNOWN_THEMES.includes(localTheme)) {
        activeTheme = localTheme;
      }
    }

    // 2. Apply theme to state and document element
    set({ theme: activeTheme });

    const root = document.documentElement;
    KNOWN_THEMES.forEach(t => root.classList.remove(t));
    root.classList.add(activeTheme);
    root.setAttribute('data-theme', activeTheme);
    
    // 3. Keep cookie synchronized to prevent subsequent SSR hydration flickers
    setCookie('theme', activeTheme, 31536000);
  }
}));
