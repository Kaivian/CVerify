"use client";

import { useRef, useState, useCallback } from "react";

interface RovingTabindexOptions {
  itemCount: number;
  orientation?: "vertical" | "horizontal";
  onSelect?: (index: number) => void;
}

/**
 * Hook implementing the Roving Tabindex accessibility pattern.
 * Groups list items into a single tab stop. Tab enters the currently active/focused item,
 * and Arrow keys move focus internally within the list.
 */
export function useRovingTabindex({
  itemCount,
  orientation = "vertical",
  onSelect,
}: RovingTabindexOptions) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const isVertical = orientation === "vertical";
      const prevKey = isVertical ? "ArrowUp" : "ArrowLeft";
      const nextKey = isVertical ? "ArrowDown" : "ArrowRight";

      let nextIndex = focusedIndex;

      if (event.key === prevKey) {
        event.preventDefault();
        nextIndex = focusedIndex > 0 ? focusedIndex - 1 : itemCount - 1;
      } else if (event.key === nextKey) {
        event.preventDefault();
        nextIndex = focusedIndex < itemCount - 1 ? focusedIndex + 1 : 0;
      } else if (event.key === "Home") {
        event.preventDefault();
        nextIndex = 0;
      } else if (event.key === "End") {
        event.preventDefault();
        nextIndex = itemCount - 1;
      } else if (event.key === "Enter" || event.key === " ") {
        if (event.key === " ") {
          event.preventDefault();
        }
        if (onSelect) {
          onSelect(focusedIndex);
        }
        return;
      } else {
        return; // Ignore other keys
      }

      setFocusedIndex(nextIndex);

      // Focus the new item DOM element after state updates asynchronously
      setTimeout(() => {
        const container = listRef.current;
        if (container) {
          const items = container.querySelectorAll("[data-roving-item]");
          const targetItem = items[nextIndex] as HTMLElement | undefined;
          targetItem?.focus();
        }
      }, 0);
    },
    [focusedIndex, itemCount, orientation, onSelect]
  );

  return {
    listRef,
    focusedIndex,
    setFocusedIndex,
    handleKeyDown,
    getTabindex: useCallback(
      (index: number) => (index === focusedIndex ? 0 : -1),
      [focusedIndex]
    ),
  };
}
