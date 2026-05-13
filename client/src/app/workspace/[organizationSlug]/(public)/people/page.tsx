"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Typography } from "@heroui/react";
import Link from "next/link";
import { workspaceService } from "@/features/workspace/services/workspace.service";
import { WorkspaceMember } from "@/features/workspace/types/workspace.types";

export default function WorkspaceMembersTab() {
  const params = useParams();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const fetchMembers = useCallback(async () => {
    if (!organizationSlug) return;
    try {
      await Promise.resolve();
      setLoading(true);
      const response = await workspaceService.getWorkspaceMembers(organizationSlug, {
        page: 1,
        pageSize: 100,
        search: searchQuery,
        publicOnly: true,
      });
      setMembers(response.items || []);
    } catch (err) {
      console.error("Failed to fetch public members:", err);
    } finally {
      setLoading(false);
    }
  }, [organizationSlug, searchQuery]);

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      await Promise.resolve();
      if (!ignore) {
        fetchMembers();
      }
    };
    run();
    return () => {
      ignore = true;
    };
  }, [fetchMembers]);

  const getMemberCategory = (member: WorkspaceMember): "Leadership" | "Recruitment" | "Staff" => {
    if (member.role === "OWNER" || member.role === "REPRESENTATIVE") {
      return "Leadership";
    }
    const headlineLower = member.headline?.toLowerCase() || "";
    if (
      member.role === "HR" ||
      headlineLower.includes("hr") ||
      headlineLower.includes("recruiter") ||
      headlineLower.includes("talent") ||
      headlineLower.includes("people")
    ) {
      return "Recruitment";
    }
    return "Staff";
  };

  const filteredMembers = members.filter((member) => {
    if (selectedCategory === "All") return true;
    const cat = getMemberCategory(member);
    return cat === selectedCategory;
  });

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card className="p-5 bg-surface border border-border rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between select-none">
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <input
            type="text"
            placeholder="Search company members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border rounded-lg px-4 py-2 text-xs focus:outline-hidden focus:border-accent text-foreground font-outfit font-normal"
          />
        </div>

        {/* Filter categories */}
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 font-normal">
          {["All", "Leadership", "Recruitment", "Staff"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border cursor-pointer whitespace-nowrap ${selectedCategory === cat
                ? "bg-accent border-accent text-background"
                : "bg-card border-border text-muted hover:text-foreground"
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </Card>

      {/* Grid listing */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-2 select-none">
          <span className="text-xs text-muted font-medium animate-pulse">Loading members directory...</span>
        </div>
      ) : filteredMembers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMembers.map((member) => {
            const category = getMemberCategory(member);
            const initials = member.name
              ? member.name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()
              : "?";

            return (
              <Card
                key={member.userId}
                className="bg-surface border border-border rounded-xl flex flex-col items-center text-center overflow-hidden"
              >
                {/* Cover strip */}
                <div className="w-full h-16 bg-linear-to-r from-accent/30 to-indigo-500/20 shrink-0" />

                {/* Avatar â€” overlaps cover strip via negative margin */}
                <div className="w-20 h-20 rounded-full border-2 border-surface bg-card flex items-center justify-center text-accent font-semibold text-base select-none -mt-10 overflow-hidden shadow-sm shrink-0">
                  {member.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.avatarUrl}
                      alt={`${member.name} Avatar`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>

                {/* Info block */}
                <div className="px-5 pt-3 pb-5 w-full flex flex-col items-center gap-1">
                  {/* Name */}
                  <Typography type="body-sm" className="font-semibold text-foreground text-sm leading-tight">
                    {member.name}
                  </Typography>

                  {/* Category label */}
                  <span className="text-[10px] text-accent font-medium">{category}</span>

                  {/* Headline */}
                  <Typography type="body-xs" className="text-muted text-xs font-normal leading-normal text-center max-w-[220px]">
                    {member.headline || "Enterprise Contributor"}
                  </Typography>

                  {/* Divider + email + profile link */}
                  <div className="w-full border-t border-border/40 mt-3 pt-3 flex flex-col items-center gap-1">
                    <a
                      href={`mailto:${member.email}`}
                      className="text-[11px] text-muted hover:text-accent font-normal break-all"
                      title={member.email}
                    >
                      {member.email}
                    </a>
                    {member.username ? (
                      <Link href={`/${member.username}`} className="text-xs font-medium text-accent hover:underline mt-1">
                        View Profile
                      </Link>
                    ) : (
                      <span className="text-[10px] text-muted italic font-normal mt-1">Private Profile</span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-10 border border-dashed border-border rounded-xl text-center bg-surface-secondary/10 select-none">
          <Typography type="body-xs" className="text-muted italic text-xs font-normal">
            No public workspace members found matching the criteria.
          </Typography>
        </Card>
      )}
    </div>
  );
}
