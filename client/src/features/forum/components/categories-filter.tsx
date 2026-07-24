"use client";

import React, { useState, useMemo, memo } from "react";
import { type CategoryResponse } from "@/services/forum.service";
import {
  MessageSquare,
  Code,
  Layout,
  Server,
  Cloud,
  Shield,
  TrendingUp,
  Briefcase,
  Folder,
  Megaphone,
  ChevronDown,
  ChevronRight,
  Layers,
  Sparkles,
  Lock,
  Grid,
} from "lucide-react";
import { trackForumEvent } from "../services/forum-telemetry";

// Dynamic Icon Map
const IconMap: { [key: string]: React.ComponentType<any> } = {
  MessageSquare,
  Code,
  Layout,
  Server,
  Cloud,
  Shield,
  TrendingUp,
  Briefcase,
  Folder,
  Megaphone,
  Layers,
  Sparkles,
  Grid,
};

interface CategoriesFilterProps {
  categories: CategoryResponse[];
  selectedCategoryId: string;
  loading?: boolean;
  onSelectCategory: (categoryId: string) => void;
}

interface CategoryGroup {
  name: string;
  icon: React.ComponentType<any>;
  categories: CategoryResponse[];
}

export const CategoriesFilter = memo(function CategoriesFilter({
  categories,
  selectedCategoryId,
  loading = false,
  onSelectCategory,
}: CategoriesFilterProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<{ [key: string]: boolean }>({});

  // Group categories into semantic buckets
  const groupedCategories = useMemo<CategoryGroup[]>(() => {
    const groups: { [key: string]: CategoryResponse[] } = {
      General: [],
      Development: [],
      Career: [],
      Business: [],
      Administration: [],
    };

    categories.forEach((cat) => {
      const icon = (cat.iconName || "").toLowerCase();
      const name = cat.name.toLowerCase();

      if (
        icon.includes("code") ||
        icon.includes("server") ||
        icon.includes("cloud") ||
        name.includes("dev") ||
        name.includes("tech")
      ) {
        groups.Development.push(cat);
      } else if (
        icon.includes("briefcase") ||
        name.includes("career") ||
        name.includes("job") ||
        name.includes("interview")
      ) {
        groups.Career.push(cat);
      } else if (
        icon.includes("shield") ||
        icon.includes("megaphone") ||
        name.includes("business") ||
        name.includes("hiring")
      ) {
        groups.Business.push(cat);
      } else if (cat.requiredRole || name.includes("admin") || name.includes("policy")) {
        groups.Administration.push(cat);
      } else {
        groups.General.push(cat);
      }
    });

    return [
      { name: "General", icon: MessageSquare, categories: groups.General },
      { name: "Development", icon: Code, categories: groups.Development },
      { name: "Career & Roles", icon: Briefcase, categories: groups.Career },
      { name: "Business & Hiring", icon: Shield, categories: groups.Business },
      { name: "Governance", icon: Lock, categories: groups.Administration },
    ].filter((g) => g.categories.length > 0);
  }, [categories]);

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const handleSelect = (id: string, name: string) => {
    trackForumEvent("forum_category_selected", {
      categoryId: id,
      categoryName: name,
      source: "sidebar",
    });
    onSelectCategory(id);
  };

  if (loading) {
    return null;
  }

  return (
    <nav className="sticky top-20 flex flex-col gap-1" aria-label="Forum categories">

      {/* Section Label */}
      <h3 className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase px-2 pb-2 flex items-center gap-1.5">
        <Layers className="w-3.5 h-3.5 text-primary" />
        <span>Categories</span>
      </h3>

      {/* All Discussions */}
      <button
        type="button"
        onClick={() => handleSelect("", "All Discussions")}
        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium text-left ${
          !selectedCategoryId
            ? "text-primary font-semibold bg-primary/5"
            : "text-foreground/80 hover:text-foreground hover:bg-surface-secondary/50"
        }`}
      >
        <div className="flex items-center gap-2">
          <Grid className={`w-3.5 h-3.5 ${!selectedCategoryId ? "text-primary" : "text-muted-foreground"}`} />
          <span>All Discussions</span>
        </div>
      </button>

      {/* Category Groups */}
      {groupedCategories.map((group) => {
        const GroupIcon = group.icon;
        const isCollapsed = collapsedGroups[group.name];

        return (
          <div key={group.name} className="flex flex-col pt-2">

            {/* Group Header */}
            <button
              type="button"
              onClick={() => toggleGroup(group.name)}
              className="flex items-center justify-between px-2 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider text-left"
            >
              <div className="flex items-center gap-1.5">
                <GroupIcon className="w-3 h-3 text-muted-foreground/70" />
                <span>{group.name}</span>
              </div>
              {isCollapsed ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>

            {/* Group Items */}
            {!isCollapsed && (
              <div className="flex flex-col gap-0.5 pl-2 mt-0.5">
                {group.categories.map((cat) => {
                  const CategoryIcon = IconMap[cat.iconName || "MessageSquare"] || MessageSquare;
                  const isSelected = selectedCategoryId === cat.id;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleSelect(cat.id, cat.name)}
                      title={cat.description || cat.name}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-left ${
                        isSelected
                          ? "text-primary font-semibold bg-primary/5"
                          : "text-foreground/70 hover:text-foreground hover:bg-surface-secondary/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 truncate">
                        <CategoryIcon
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected ? "text-primary" : "text-muted-foreground"
                          }`}
                        />
                        <span className="truncate">{cat.name}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {cat.requiredRole && (
                          <span className="text-[9px] font-bold text-warning uppercase">
                            {cat.requiredRole}
                          </span>
                        )}
                        {cat.topicCount !== undefined && cat.topicCount > 0 && (
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {cat.topicCount}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
});
