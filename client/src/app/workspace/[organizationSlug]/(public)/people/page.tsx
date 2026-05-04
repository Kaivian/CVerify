"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Typography, Chip } from "@heroui/react";
import { Search, ShieldCheck, Mail, ArrowRight, User } from "lucide-react";
import Link from "next/link";

interface Member {
  id: string;
  name: string;
  username: string;
  role: "OWNER" | "REPRESENTATIVE" | "HR" | "MEMBER";
  title: string;
  email: string;
  category: "Leadership" | "Recruitment" | "Staff";
}

export default function WorkspacePeopleTab() {
  const params = useParams();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  // Mock Members
  const mockMembers: Member[] = [
    {
      id: "mem-1",
      name: "Minh Le",
      username: "minhle",
      role: "OWNER",
      title: "Chief Executive Officer & Founder",
      email: "ceo@dreamhost.com",
      category: "Leadership",
    },
    {
      id: "mem-2",
      name: "Hoang Nguyen",
      username: "hoangn",
      role: "REPRESENTATIVE",
      title: "Tech Lead & Principal Architect",
      email: "hoang.nguyen@dreamhost.com",
      category: "Leadership",
    },
    {
      id: "mem-3",
      name: "Trang Pham",
      username: "trangp",
      role: "HR",
      title: "HR Director & Talent Acquisition",
      email: "recruitment@dreamhost.com",
      category: "Recruitment",
    },
    {
      id: "mem-4",
      name: "Dung Vu",
      username: "dungv",
      role: "MEMBER",
      title: "Senior Automated QA Architect",
      email: "dung.vu@dreamhost.com",
      category: "Staff",
    },
    {
      id: "mem-5",
      name: "Linh Tran",
      username: "linht",
      role: "MEMBER",
      title: "Senior Product UI/UX Designer",
      email: "linh.tran@dreamhost.com",
      category: "Staff",
    },
  ];

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Filter Logic
  const filteredMembers = mockMembers.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.title.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === "All" || m.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card className="p-6 bg-surface border border-border rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between select-none">
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <Search size={16} className="absolute left-4 top-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search company people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-hidden focus:border-accent text-foreground font-outfit"
          />
        </div>

        {/* Filter categories */}
        <div className="flex gap-2 w-full md:w-auto">
          {["All", "Leadership", "Recruitment", "Staff"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                selectedCategory === cat
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMembers.map((member) => (
          <Card
            key={member.id}
            className="p-6 bg-surface border border-border rounded-2xl flex flex-col items-center text-center relative overflow-hidden"
          >
            {/* Visual background details */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-linear-to-r from-accent/30 to-indigo-500/20" />

            {/* Avatar container */}
            <div className="w-20 h-20 rounded-full border border-border bg-card/40 flex items-center justify-center text-accent relative mb-4">
              <User size={32} />
              {member.role !== "MEMBER" && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent text-background border border-surface flex items-center justify-center" title="Company Authority">
                  <ShieldCheck size={14} className="stroke-[2.5]" />
                </div>
              )}
            </div>

            {/* Basic Info */}
            <div className="space-y-1">
              <Typography type="body-sm" className="font-extrabold text-foreground text-base leading-tight">
                {member.name}
              </Typography>
              <Typography type="body-xs" className="text-accent font-semibold text-xs">
                @{member.username}
              </Typography>
              <Typography type="body-xs" className="text-muted text-xs font-medium max-w-[180px] mx-auto leading-normal">
                {member.title}
              </Typography>
            </div>

            {/* Badges block */}
            <div className="flex gap-1.5 justify-center mt-3 select-none">
              <Chip size="sm" variant="soft" color="accent" className="text-[9px] font-bold">
                {member.role}
              </Chip>
              <Chip size="sm" variant="soft" color="default" className="text-[9px] font-bold">
                {member.category}
              </Chip>
            </div>

            {/* Footer action (Link to public talent profile board) */}
            <div className="w-full border-t border-border/60 mt-5 pt-4 flex items-center justify-between select-none">
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Mail size={12} />
                {member.email}
              </span>

              <Link href={`/${member.username}`} className="text-xs font-bold text-accent hover:underline flex items-center gap-0.5">
                Profile
                <ArrowRight size={12} />
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
