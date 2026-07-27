"use client";

import React, { useState } from "react";
import { TagGroup, Tag, Label, Description, ErrorMessage, Input, Button } from "@heroui/react";

interface TagChipMultiSelectProps {
  label?: string;
  description?: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
  allowCustom?: boolean;
}

export const TagChipMultiSelect: React.FC<TagChipMultiSelectProps> = ({
  label,
  description,
  options,
  value = [],
  onChange,
  error,
  allowCustom = true,
}) => {
  const [inputValue, setInputValue] = useState("");

  const renderedOptions = Array.from(new Set([...options, ...value]));

  const handleSelectionChange = (keys: any) => {
    if (keys === "all") {
      onChange(renderedOptions);
    } else {
      onChange(Array.from(keys).map((k) => String(k)));
    }
  };

  const handleAddCustomTag = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (!value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCustomTag();
    }
  };

  return (
    <TagGroup
      selectedKeys={new Set(value)}
      selectionMode="multiple"
      onSelectionChange={handleSelectionChange}
      variant="default"
      size="md"
      className="w-full text-left"
    >
      {label && <Label className="font-bold text-foreground font-outfit">{label}</Label>}
      <TagGroup.List className="mt-1 flex flex-wrap gap-2">
        {renderedOptions.map((option) => (
          <Tag key={option} id={option} className="cursor-pointer select-none">
            {option}
          </Tag>
        ))}
      </TagGroup.List>
      {allowCustom && (
        <div className="mt-2.5 flex items-center gap-2 max-w-sm">
          <Input
            placeholder="Add custom option..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label={label ? `Add custom ${label}` : "Add custom option"}
          />
          <Button
            size="md"
            onPress={handleAddCustomTag}
            className={
              !inputValue.trim()
                ? "bg-field-background border border-field-border text-muted font-bold shrink-0 opacity-60 cursor-not-allowed disabled:bg-field-background data-[disabled=true]:bg-field-background data-[disabled=true]:text-muted data-[disabled=true]:border-field-border data-[disabled=true]:opacity-60"
                : "bg-accent text-accent-foreground font-bold shrink-0 hover:bg-accent/90 cursor-pointer"
            }
            isDisabled={!inputValue.trim()}
          >
            Add
          </Button>
        </div>
      )}
      {description && <Description className="text-muted max-w-xl text-xs mt-1.5">{description}</Description>}
      {error && (
        <ErrorMessage className="text-danger pl-1 font-semibold block text-xs mt-1" role="alert">
          {error}
        </ErrorMessage>
      )}
    </TagGroup>
  );
};

export default TagChipMultiSelect;
