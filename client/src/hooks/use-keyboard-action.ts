"use client";

import { useCallback } from "react";

/**
 * Hook to standardize keyboard action triggers (Enter and Space) on custom focusable components.
 * Automatically handles preventDefault() for Space key to prevent unexpected document scrolling.
 *
 * @param callback Action to trigger
 * @param keys Array of keys to listen for (defaults to Enter and Space)
 */
export function useKeyboardAction(
  callback: () => void | Promise<void>,
  keys: string[] = ["Enter", " "]
) {
  return useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (keys.includes(event.key)) {
        if (event.key === " ") {
          event.preventDefault();
        }
        callback();
      }
    },
    [callback, keys]
  );
}

/**
 * Pure utility function to bind keyboard actions in non-functional components or outside React lifecycle context.
 */
export function handleKeyboardAction(
  callback: () => void | Promise<void>,
  keys: string[] = ["Enter", " "]
) {
  return (event: React.KeyboardEvent<HTMLElement>) => {
    if (keys.includes(event.key)) {
      if (event.key === " ") {
        event.preventDefault();
      }
      callback();
    }
  };
}
