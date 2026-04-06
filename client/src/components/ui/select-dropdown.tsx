"use client";

import React, { useEffect, useState } from 'react';
import { Select, Label, ListBox } from '@heroui/react';

interface Option {
  value: string;
  label: string;
}

interface SelectDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  label?: string;
  className?: string;
  isDisabled?: boolean;
}

export const SelectDropdown: React.FC<SelectDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = "Select option...",
  label,
  className = "w-full",
  isDisabled = false,
}) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        setIsMounted(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (!isMounted) return null;

  return (
    <Select
      value={value}
      onChange={(val) => onChange(val as string)}
      isDisabled={isDisabled}
      className={className}
      placeholder={placeholder}
      variant="secondary"
      aria-label={label || placeholder || "Select dropdown"}
    >
      {label && <Label className="text-xs font-bold text-muted mb-1.5 block">{label}</Label>}
      <Select.Trigger className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-field-border bg-field text-foreground text-xs font-semibold focus:outline-hidden cursor-pointer hover:border-border transition-all select-none focus-visible:ring-2 focus-visible:ring-focus">
        <Select.Value />
        <Select.Indicator className="size-4 text-muted" />
      </Select.Trigger>
      <Select.Popover className="border border-border rounded-xl bg-overlay shadow-overlay overflow-hidden min-w-[200px] z-50">
        <ListBox 
          aria-label={label || placeholder || "Options"}
          className="p-1 max-h-60 overflow-y-auto outline-hidden focus:outline-hidden"
        >
          {options.map((option) => (
            <ListBox.Item
              key={option.value}
              id={option.value}
              textValue={option.label}
              className="flex items-center justify-between px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-secondary rounded-lg cursor-pointer transition-colors outline-hidden focus:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-focus"
            >
              <span>{option.label}</span>
              <ListBox.ItemIndicator className="size-3 text-accent" />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
};

export default SelectDropdown;
