"use client";

import React from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Button, Typography } from "@heroui/react";

/**
 * Robust deep comparison function specifically tailored for form inputs.
 * Normalizes empty values (null, undefined, empty string) to prevent false-dirty flags.
 * Also handles nested structures, arrays, and custom classes (like CalendarDate).
 */
export function isDeepEqual(val1: unknown, val2: unknown): boolean {
  if (val1 === val2) return true;

  // Treat undefined, null, and empty string as equivalent for form inputs
  const isEmpty1 = val1 === undefined || val1 === null || val1 === "";
  const isEmpty2 = val2 === undefined || val2 === null || val2 === "";
  if (isEmpty1 && isEmpty2) return true;
  if (isEmpty1 !== isEmpty2) return false;

  if (typeof val1 !== typeof val2) return false;

  if (Array.isArray(val1)) {
    if (!Array.isArray(val2) || val1.length !== val2.length) return false;
    for (let i = 0; i < val1.length; i++) {
      if (!isDeepEqual(val1[i], val2[i])) return false;
    }
    return true;
  }

  if (typeof val1 === "object" && val1 !== null && val2 !== null) {
    const obj1 = val1 as Record<string, unknown>;
    const obj2 = val2 as Record<string, unknown>;

    // Handle special objects (e.g. CalendarDate or custom classes)
    const isVal1Special = typeof obj1.toString === "function" && obj1.toString() !== "[object Object]";
    const isVal2Special = typeof obj2.toString === "function" && obj2.toString() !== "[object Object]";
    if (isVal1Special || isVal2Special) {
      return obj1.toString() === obj2.toString();
    }

    const keys1 = Object.keys(obj1).filter(k => obj1[k] !== undefined && obj1[k] !== null && obj1[k] !== "");
    const keys2 = Object.keys(obj2).filter(k => obj2[k] !== undefined && obj2[k] !== null && obj2[k] !== "");

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
      if (!isDeepEqual(obj1[key], obj2[key])) return false;
    }
    return true;
  }

  return false;
}

interface UnsavedChangesBarProps {
  /** Text message to display on the left side of the bar */
  message: string;
  /** Custom handler for reset action. If omitted, resets form to default values. */
  onReset: () => void;
  /** Custom handler for save action. If omitted, button is type="submit" and triggers form onSubmit. */
  onSave?: () => void;
  /** Manually indicate submission state. Falls back to formState.isSubmitting. */
  isSubmitting?: boolean;
}

export const UnsavedChangesBar: React.FC<UnsavedChangesBarProps> = ({
  message,
  onReset,
  onSave,
  isSubmitting,
}) => {
  const {
    control,
    formState: { defaultValues, isSubmitting: formIsSubmitting, isDirty: nativeIsDirty },
  } = useFormContext();

  const currentValues = useWatch({ control });

  // Compute dirty state through deep equality check (derived state during render)
  const hasChanges = !isDeepEqual(currentValues, defaultValues);

  // Combine deep changes with native formState.isDirty as a fallback
  const isFormDirty = hasChanges || nativeIsDirty;
  const activeSubmitting = isSubmitting !== undefined ? isSubmitting : formIsSubmitting;

  if (!isFormDirty) return null;

  return (
    <div className="sticky bottom-4 w-full bg-overlay/95 backdrop-blur-md border border-border shadow-modal rounded-2xl p-4 flex items-center justify-between gap-4 z-40 animate-fade-in select-none">
      <Typography
        type="body-xs"
        className="text-foreground font-bold font-outfit select-none pl-2 text-left"
      >
        {message}
      </Typography>
      <div className="flex items-center gap-2.5 shrink-0">
        <Button
          variant="outline"
          onClick={onReset}
          isDisabled={activeSubmitting}
          className="rounded-xl font-bold h-9 px-4 text-xs select-none"
        >
          Reset
        </Button>
        <Button
          variant="primary"
          type={onSave ? "button" : "submit"}
          onClick={onSave}
          isPending={activeSubmitting}
          className="rounded-xl font-bold h-9 px-4 text-xs select-none"
        >
          Save changes
        </Button>
      </div>
    </div>
  );
};

export default UnsavedChangesBar;
