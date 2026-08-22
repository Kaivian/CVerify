"use client";

import React, { useState } from "react";
import { type CategoryResponse } from "@/services/forum.service";
import { Button, Input, Chip } from "@heroui/react";
import { Filter, X, Search, Layers, Check } from "lucide-react";
import { trackForumEvent } from "../services/forum-telemetry";

interface CategoriesDrawerMobileProps {
  categories: CategoryResponse[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
}

export function CategoriesDrawerMobile({
  categories,
  selectedCategoryId,
  onSelectCategory,
}: CategoriesDrawerMobileProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedCategoryName =
    categories.find((c) => c.id === selectedCategoryId)?.name || "All Categories";

  const handleSelect = (id: string, name: string) => {
    trackForumEvent("forum_category_selected", {
      categoryId: id,
      categoryName: name,
      source: "mobile_drawer",
    });
    onSelectCategory(id);
    setIsOpen(false);
  };

  return (
    <div className="block lg:hidden w-full">
      {/* Mobile Drawer Trigger Button */}
      <Button
        variant="secondary"
        onPress={() => setIsOpen(true)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-border/60 bg-surface text-sm font-medium"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" />
          <span className="text-muted-foreground">Category:</span>
          <span className="font-bold text-foreground">{selectedCategoryName}</span>
        </div>
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
          Change
        </span>
      </Button>

      {/* Modal / Sheet Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full sm:max-w-lg bg-surface border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-300"
            role="dialog"
            aria-modal="true"
            aria-label="Filter Categories"
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-border/40 flex items-center justify-between bg-surface-secondary/40">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold">Select Category</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full hover:bg-muted/30 text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-border/40">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-surface"
                />
              </div>
            </div>

            {/* Category Option List */}
            <div className="p-4 overflow-y-auto flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleSelect("", "All Categories")}
                className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-semibold text-left transition-all ${
                  !selectedCategoryId
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "hover:bg-surface-secondary text-foreground"
                }`}
              >
                <span>All Categories</span>
                {!selectedCategoryId && <Check className="w-4 h-4 text-primary" />}
              </button>

              {filteredCategories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelect(cat.id, cat.name)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-medium text-left transition-all ${
                      isSelected
                        ? "bg-primary/10 text-primary border border-primary/30 font-bold"
                        : "hover:bg-surface-secondary text-foreground"
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span>{cat.name}</span>
                      {cat.description && (
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {cat.description}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </button>
                );
              })}

              {filteredCategories.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No matching categories found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
