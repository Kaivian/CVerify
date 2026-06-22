"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Typography, Chip, toast } from "@heroui/react";
import { BusinessVerificationBadge } from "@/components/ui/cverify/verification-badges";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/features/workspace/store/use-workspace-store";
import { workspaceService } from "@/features/workspace/services/workspace.service";
import { type Job } from "@/features/workspace/types/workspace.types";
import {
  Briefcase,
  MapPin,
  Calendar,
  Users,
  Award,
  Bookmark,
  DollarSign,
  Clock,
  Check,
  GraduationCap,
  BookOpen,
  Search,
  Plus,
  X,
  Upload,
  Globe,
  ArrowLeft,
  Building
} from "lucide-react";

// Helper parsers for markdown content
const getSectionId = (title: string) => {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
};

const parseInlineMarkdown = (text: string) => {
  if (!text) return "";
  const parts = text.split(/(\*\*[^*]+\*\*|\+\+[^+]+\+\+)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("++") && part.endsWith("++")) {
      return <strong key={index} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

const renderMarkdown = (text: string) => {
  if (!text) return null;
  return text.split("\n").map((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      const title = trimmed.substring(2).trim();
      return (
        <h1 key={idx} id={getSectionId(title)} className="text-sm font-bold text-foreground mt-5 mb-2 border-b border-border/40 pb-1">
          {parseInlineMarkdown(title)}
        </h1>
      );
    }
    if (trimmed.startsWith("## ")) {
      const title = trimmed.substring(3).trim();
      return (
        <h2 key={idx} id={getSectionId(title)} className="text-xs font-bold text-accent mt-4 mb-1.5">
          {parseInlineMarkdown(title)}
        </h2>
      );
    }
    if (trimmed.startsWith("### ")) {
      const title = trimmed.substring(4).trim();
      return (
        <h3 key={idx} id={getSectionId(title)} className="text-[11px] font-semibold text-foreground mt-3 mb-1">
          {parseInlineMarkdown(title)}
        </h3>
      );
    }
    if (trimmed.startsWith("- ")) {
      return (
        <li key={idx} className="text-xs text-foreground/80 list-disc ml-5 mb-1.5 leading-relaxed">
          {parseInlineMarkdown(trimmed.substring(2))}
        </li>
      );
    }
    if (trimmed.startsWith("* ")) {
      return (
        <li key={idx} className="text-xs text-foreground/80 list-disc ml-5 mb-1.5 leading-relaxed">
          {parseInlineMarkdown(trimmed.substring(2))}
        </li>
      );
    }
    if (!trimmed) {
      return <div key={idx} className="h-2" />;
    }
    return (
      <p key={idx} className="text-xs text-foreground/80 mb-2.5 leading-relaxed">
        {parseInlineMarkdown(trimmed)}
      </p>
    );
  });
};

const renderSectionContent = (items: string[]) => {
  if (!items || items.length === 0) return null;
  const joinedText = items.join("\n");
  const hasMarkdown = joinedText.includes("#") || joinedText.includes("**") || joinedText.includes("- ") || joinedText.includes("* ");
  
  if (hasMarkdown) {
    return <div className="space-y-1 select-text font-outfit">{renderMarkdown(joinedText)}</div>;
  }
  
  return (
    <ul className="list-disc pl-5 space-y-1.5 text-xs text-foreground font-normal font-outfit">
      {items.map((item, idx) => (
        <li key={idx} className="leading-relaxed text-foreground/80">
          {parseInlineMarkdown(item)}
        </li>
      ))}
    </ul>
  );
};

export default function WorkspaceJobsTab() {
  const params = useParams();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  const workspaceDetails = useWorkspaceStore((s) => s.workspaces[organizationSlug]);

  const allJobs = useWorkspaceStore((s) => s.jobs);
  const allJobsLoading = useWorkspaceStore((s) => s.jobsLoading);
  const allJobsErrors = useWorkspaceStore((s) => s.jobsErrors);
  const fetchJobs = useWorkspaceStore((s) => s.fetchJobs);
  const createJobAction = useWorkspaceStore((s) => s.createJobAction);

  const jobsFromStore = useMemo(() => allJobs[organizationSlug] ?? [], [allJobs, organizationSlug]);
  const loadingJobs = allJobsLoading[organizationSlug] ?? false;
  const jobsError = allJobsErrors[organizationSlug];

  useEffect(() => {
    if (organizationSlug) {
      fetchJobs(organizationSlug);
    }
  }, [organizationSlug, fetchJobs]);

  const jobsList = jobsFromStore;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedLoc, setSelectedLoc] = useState("All");
  const [selectedType, setSelectedType] = useState("All");

  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [appliedJobs, setAppliedJobs] = useState<string[]>([]);
  const [savedJobs, setSavedJobs] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form fields for creating a job
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newJobDept, setNewJobDept] = useState("Engineering");
  const [newJobCity, setNewJobCity] = useState("Hanoi");
  const [newJobLoc, setNewJobLoc] = useState("");
  const [newJobType, setNewJobType] = useState("Full-Time");
  const [newJobWorkplace, setNewJobWorkplace] = useState<"Hybrid" | "Remote" | "On-site">("Hybrid");
  const [newJobSalary, setNewJobSalary] = useState("");
  const [newJobSalaryMinMax, setNewJobSalaryMinMax] = useState("");
  const [newJobDeadline, setNewJobDeadline] = useState("");
  const [newJobSkills, setNewJobSkills] = useState("");
  const [newJobTags, setNewJobTags] = useState("");
  const [newJobDesc, setNewJobDesc] = useState("");
  const [newJobReq, setNewJobReq] = useState("");
  const [newJobBen, setNewJobBen] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!workspaceDetails) return null;

  const orgName = workspaceDetails.organizationName || "Partner Enterprise";
  const orgLogo = workspaceDetails.logoUrl;

  // Reactive Permission helper key check
  const hasPermission = (permissionKey: string): boolean => {
    if (!workspaceDetails) return false;
    if (
      workspaceDetails.userRole === "OWNER" ||
      workspaceDetails.userRole === "REPRESENTATIVE" ||
      workspaceDetails.userRole === "HR"
    ) {
      return true;
    }
    return workspaceDetails.permissions?.includes(permissionKey) || false;
  };

  // Handle form submission for job creation
  const handleCreateJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobTitle.trim()) {
      toast.danger("Please enter a job title!");
      return;
    }

    if (selectedFiles.length < 1) {
      toast.danger("Please add at least 1 recruitment image!");
      return;
    }
    if (selectedFiles.length > 5) {
      toast.danger("You can upload a maximum of 5 recruitment images!");
      return;
    }

    setIsSubmitting(true);
    try {
      const uploadedUrls = await workspaceService.uploadWorkspaceMedia(organizationSlug, selectedFiles);

      const jobPayload: Partial<Job> = {
        title: newJobTitle.trim(),
        department: newJobDept,
        location: newJobLoc.trim() || `${newJobCity}, Vietnam (${newJobWorkplace})`,
        workplaceType: newJobWorkplace,
        city: newJobCity,
        type: newJobType,
        deadline: newJobDeadline.trim() || "30/09/2026",
        salary: newJobSalary.trim() || "Negotiable",
        salaryMinMax: newJobSalaryMinMax.trim() || "Negotiable",
        headcount: 1,
        gender: "No requirement",
        experience: "Relevant experience required",
        degree: "Bachelor's Degree",
        category: "Software Development, IT",
        description: newJobDesc.trim() ? newJobDesc.split("\n").filter(Boolean) : ["Perform tasks according to professional requirements."],
        requirements: newJobReq.trim() ? newJobReq.split("\n").filter(Boolean) : ["Have experience working in a similar position."],
        benefits: newJobBen.trim() ? newJobBen.split("\n").filter(Boolean) : ["Fully enjoy insurance and company benefits."],
        tags: newJobTags.trim() ? newJobTags.split(",").map(s => s.trim()).filter(Boolean) : [newJobDept],
        skills: newJobSkills.trim() ? newJobSkills.split(",").map(s => s.trim()).filter(Boolean) : [newJobDept],
        coverUrl: uploadedUrls[0],
        images: uploadedUrls
      };

      const created = await createJobAction(organizationSlug, jobPayload);

      if (created) {
        toast.success("Job posted successfully!");
        // Reset Form
        setNewJobTitle("");
        setNewJobLoc("");
        setNewJobSalary("");
        setNewJobSalaryMinMax("");
        setNewJobDeadline("");
        setNewJobSkills("");
        setNewJobTags("");
        setNewJobDesc("");
        setNewJobReq("");
        setNewJobBen("");
        setSelectedFiles([]);
        setShowCreateModal(false);
      } else {
        toast.danger("Failed to post job!");
      }
    } catch (error) {
      console.error(error);
      toast.danger("An error occurred while uploading recruitment images!");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter unique lists
  const departments = ["All", ...Array.from(new Set(jobsList.map((j) => j.department)))];
  const locations = ["All", ...Array.from(new Set(jobsList.map((j) => j.city)))];
  const types = ["All", ...Array.from(new Set(jobsList.map((j) => j.type)))];

  // Filtering Logic
  const filteredJobs = jobsList.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
      job.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesDept = selectedDept === "All" || job.department === selectedDept;
    const matchesLoc = selectedLoc === "All" || job.city === selectedLoc;
    const matchesType = selectedType === "All" || job.type === selectedType;

    return matchesSearch && matchesDept && matchesLoc && matchesType;
  });

  const handleApply = (jobId: string) => {
    if (!appliedJobs.includes(jobId)) {
      setAppliedJobs([...appliedJobs, jobId]);
      toast.success("Applied successfully!");
    }
  };

  const handleSaveToggle = (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    if (savedJobs.includes(jobId)) {
      setSavedJobs(savedJobs.filter((id) => id !== jobId));
      toast.success("Job removed from saved list.");
    } else {
      setSavedJobs([...savedJobs, jobId]);
      toast.success("Job saved successfully!");
    }
  };

  return (
    <div className="space-y-6 relative">
      {activeJob ? (
        <div className="space-y-6 animate-fade-in font-outfit select-text">
          {/* Back Button and Quick Info Header */}
          <div className="flex items-center justify-between py-2 border-b border-border/40 select-none">
            <button
              onClick={() => setActiveJob(null)}
              className="text-xs font-bold text-muted hover:text-foreground cursor-pointer flex items-center gap-1.5 transition-colors border border-border/85 rounded-xl px-3.5 py-1.5 bg-surface hover:bg-surface-secondary"
            >
              <ArrowLeft size={14} />
              <span>Back to Job Listings</span>
            </button>
            <span className="text-[10px] uppercase tracking-wider font-bold text-accent bg-accent/10 px-2.5 py-0.5 rounded-full">
              Job Vacancy Detail
            </span>
          </div>

          {/* Job Details Main Premium Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left 8-col Layout */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Cover Card with Overlapping Logo & Main Info */}
              <Card className="bg-surface border border-border rounded-2xl overflow-hidden shadow-xs relative">
                {/* Cover Image Banner */}
                <div className="w-full h-44 md:h-60 relative bg-surface-secondary overflow-hidden">
                  <div className="absolute inset-0 bg-black/15 z-10" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activeJob.coverUrl} alt={activeJob.title} className="w-full h-full object-cover" />
                </div>

                {/* Content Overlay & Logo Wrap */}
                <div className="px-6 pb-6 relative">
                  
                  {/* Circular overlapping Logo */}
                  <div className="flex gap-4 items-end relative z-20">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl border-4 border-surface bg-surface -mt-10 md:-mt-12 shadow-sm overflow-hidden flex items-center justify-center text-accent font-bold text-2xl select-none shrink-0">
                      {orgLogo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={orgLogo} alt={`${orgName} Logo`} className="w-full h-full object-cover" />
                      ) : (
                        orgName.substring(0, 1).toUpperCase()
                      )}
                    </div>
                    <div className="pb-1 min-w-0 flex flex-col gap-1 items-start">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground truncate max-w-[200px]">{orgName}</span>
                      </div>
                      <BusinessVerificationBadge level={workspaceDetails.verificationLevel} />
                    </div>
                  </div>

                  {/* Title & Headline Specs */}
                  <div className="mt-5 space-y-3">
                    <Typography type="h3" className="font-extrabold text-foreground text-xl md:text-2xl leading-snug">
                      {activeJob.title}
                    </Typography>
                    
                    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                      <span className="text-accent font-bold text-sm bg-accent/5 px-2.5 py-1 rounded-lg">
                        {activeJob.salary} ({activeJob.salaryMinMax})
                      </span>
                      <span className="text-separator">|</span>
                      <Chip size="sm" variant="soft" color="accent" className="text-[9px] font-bold h-5.5 px-2.5 rounded-lg">
                        {activeJob.department}
                      </Chip>
                      <Chip size="sm" variant="soft" color="warning" className="text-[9px] font-bold h-5.5 px-2.5 rounded-lg">
                        {activeJob.type}
                      </Chip>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Specs Grid Card (Recruitment Specifications) */}
              <Card className="p-5 md:p-6 bg-surface border border-border rounded-2xl space-y-4">
                <span className="border-l-3 border-accent pl-3 text-xs uppercase font-bold text-foreground block tracking-wider select-none">
                  Recruitment Specifications
                </span>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-outfit select-text">
                  <div className="p-3 bg-surface-secondary/35 border border-border/50 rounded-xl space-y-1">
                    <span className="block text-[9px] text-muted font-bold uppercase tracking-wider">Position</span>
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <Briefcase size={13} className="text-accent shrink-0" />
                      <span className="truncate">Staff</span>
                    </div>
                  </div>

                  <div className="p-3 bg-surface-secondary/35 border border-border/50 rounded-xl space-y-1">
                    <span className="block text-[9px] text-muted font-bold uppercase tracking-wider">Experience</span>
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <Award size={13} className="text-accent shrink-0" />
                      <span className="truncate">{activeJob.experience}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-surface-secondary/35 border border-border/50 rounded-xl space-y-1">
                    <span className="block text-[9px] text-muted font-bold uppercase tracking-wider">Application Deadline</span>
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <Calendar size={13} className="text-accent shrink-0" />
                      <span className="truncate">{activeJob.deadline}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-surface-secondary/35 border border-border/50 rounded-xl space-y-1">
                    <span className="block text-[9px] text-muted font-bold uppercase tracking-wider">Degree</span>
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <GraduationCap size={13} className="text-accent shrink-0" />
                      <span className="truncate">{activeJob.degree}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-surface-secondary/35 border border-border/50 rounded-xl space-y-1">
                    <span className="block text-[9px] text-muted font-bold uppercase tracking-wider">Headcount</span>
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <Users size={13} className="text-accent shrink-0" />
                      <span>{activeJob.headcount} target</span>
                    </div>
                  </div>

                  <div className="p-3 bg-surface-secondary/35 border border-border/50 rounded-xl space-y-1">
                    <span className="block text-[9px] text-muted font-bold uppercase tracking-wider">Gender Requirement</span>
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <Users size={13} className="text-accent shrink-0" />
                      <span className="truncate">{activeJob.gender}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-surface-secondary/35 border border-border/50 rounded-xl space-y-1">
                    <span className="block text-[9px] text-muted font-bold uppercase tracking-wider">Workplace Mode</span>
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <MapPin size={13} className="text-accent shrink-0" />
                      <span className="truncate">{activeJob.workplaceType} ({activeJob.city})</span>
                    </div>
                  </div>

                  <div className="p-3 bg-surface-secondary/35 border border-border/50 rounded-xl space-y-1">
                    <span className="block text-[9px] text-muted font-bold uppercase tracking-wider">Category</span>
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <BookOpen size={13} className="text-accent shrink-0" />
                      <span className="truncate">{activeJob.category}</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Main Content Sections (parsed as markdown or lists) */}
              <div className="space-y-6 select-text">
                {/* Description */}
                <Card className="p-5 md:p-6 bg-surface border border-border rounded-2xl space-y-4">
                  <span className="border-l-3 border-accent pl-3 text-xs uppercase font-bold text-foreground block tracking-wider select-none">
                    Job Description
                  </span>
                  <div className="pt-1">
                    {renderSectionContent(activeJob.description)}
                  </div>
                </Card>

                {/* Requirements */}
                <Card className="p-5 md:p-6 bg-surface border border-border rounded-2xl space-y-4">
                  <span className="border-l-3 border-accent pl-3 text-xs uppercase font-bold text-foreground block tracking-wider select-none">
                    Job Requirements
                  </span>
                  <div className="pt-1">
                    {renderSectionContent(activeJob.requirements)}
                  </div>
                </Card>

                {/* Benefits */}
                <Card className="p-5 md:p-6 bg-surface border border-border rounded-2xl space-y-4">
                  <span className="border-l-3 border-accent pl-3 text-xs uppercase font-bold text-foreground block tracking-wider select-none">
                    Perks & Benefits
                  </span>
                  <div className="pt-1">
                    {renderSectionContent(activeJob.benefits)}
                  </div>
                </Card>
              </div>

              {/* Skill Tags & Target Tags */}
              <Card className="p-5 md:p-6 bg-surface border border-border rounded-2xl space-y-5">
                <div className="space-y-3.5">
                  <span className="border-l-3 border-accent pl-3 text-xs uppercase font-bold text-foreground block tracking-wider select-none">
                    Required Skills
                  </span>
                  <div className="flex flex-wrap gap-2 pt-1.5">
                    {activeJob.skills.map((skill) => (
                      <span key={skill} className="text-[10px] bg-accent/10 border border-accent/25 text-accent px-3 py-1 rounded-lg font-bold">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-3.5 pt-4 border-t border-border/50">
                  <span className="border-l-3 border-accent pl-3 text-xs uppercase font-bold text-foreground block tracking-wider select-none">
                    Recruitment Tags
                  </span>
                  <div className="flex flex-wrap gap-2 pt-1.5">
                    {activeJob.tags.map((tag) => (
                      <span key={tag} className="text-[10px] bg-surface-secondary border border-border text-foreground/80 px-3 py-1 rounded-lg font-bold">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Workplace & Team Gallery */}
              {activeJob.images && activeJob.images.length > 0 && (
                <Card className="p-5 md:p-6 bg-surface border border-border rounded-2xl space-y-4">
                  <span className="border-l-3 border-accent pl-3 text-xs uppercase font-bold text-foreground block tracking-wider select-none">
                    Workplace & Team Images
                  </span>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                    {activeJob.images.map((img, idx) => (
                      <div key={idx} className="aspect-video sm:h-28 rounded-xl overflow-hidden border border-border bg-surface-secondary select-none relative group cursor-zoom-in">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={img} 
                          alt={`Gallery image ${idx + 1}`} 
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                        />
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            {/* Right 4-col Sidebar */}
            <div className="lg:col-span-4 space-y-6 select-none">
              
              {/* Apply Action Card */}
              <Card className="p-5 bg-accent/5 border border-accent/25 rounded-2xl text-center space-y-4 relative">
                <span className="text-[10px] uppercase font-bold tracking-wider text-accent bg-accent/10 px-3 py-0.5 rounded-full inline-block">
                  Direct Apply
                </span>
                <Typography type="body-xs" className="text-muted leading-relaxed font-semibold">
                  Are you interested in this position? Submit your profile to apply immediately.
                </Typography>
                
                <Button
                  onClick={() => handleApply(activeJob.id)}
                  disabled={appliedJobs.includes(activeJob.id)}
                  className={`w-full font-bold text-xs py-5 rounded-xl cursor-pointer border-none transition-all shadow-xs ${
                    appliedJobs.includes(activeJob.id)
                      ? "bg-success/20 text-success cursor-default"
                      : "bg-accent text-accent-foreground hover:bg-accent/90 hover:shadow-sm"
                  }`}
                >
                  {appliedJobs.includes(activeJob.id) ? "Applied Successfully" : "Apply Now"}
                </Button>
              </Card>

              {/* Company Info Box */}
              <Card className="p-5 bg-surface border border-border rounded-2xl space-y-4">
                <span className="text-[10px] text-muted font-bold block uppercase tracking-wider border-b border-border/40 pb-2">
                  Company Profile
                </span>
                
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl border border-border flex items-center justify-center overflow-hidden shrink-0 bg-surface shadow-xs">
                    {orgLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={orgLogo} alt={orgName} className="w-full h-full object-cover" />
                    ) : (
                      orgName.substring(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="font-extrabold text-foreground text-xs block truncate leading-snug">
                      {orgName}
                    </span>
                    <span className="text-[9px] text-muted font-semibold block mt-0.5">
                      Verified Organization
                    </span>
                  </div>
                </div>

                <div className="space-y-3 text-[10px] text-muted font-semibold pt-2">
                  {workspaceDetails.companySize && (
                    <div className="flex items-start gap-2">
                      <Users size={12} className="text-accent shrink-0 mt-0.5" />
                      <div>
                        <span className="block text-[8px] text-muted-foreground uppercase font-bold tracking-wider">Company Size</span>
                        <span className="text-foreground">{workspaceDetails.companySize}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2">
                    <Building size={12} className="text-accent shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-[8px] text-muted-foreground uppercase font-bold tracking-wider">Location</span>
                      <span className="text-foreground">{workspaceDetails.city || workspaceDetails.location || "Not updated"}</span>
                    </div>
                  </div>

                  {workspaceDetails.website && (
                    <div className="flex items-start gap-2">
                      <Globe size={12} className="text-accent shrink-0 mt-0.5" />
                      <div>
                        <span className="block text-[8px] text-muted-foreground uppercase font-bold tracking-wider">Website</span>
                        <a
                          href={workspaceDetails.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline break-all"
                        >
                          {workspaceDetails.website.replace("https://", "").replace("http://", "")}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Map Location box */}
              {workspaceDetails.googleMapsEmbedUrl && (
                <Card className="p-5 bg-surface border border-border rounded-2xl space-y-3.5">
                  <span className="text-[10px] text-muted font-bold block uppercase tracking-wider border-b border-border/40 pb-2">
                    Office Location Map
                  </span>
                  
                  <div className="h-44 rounded-xl overflow-hidden border border-border">
                    <iframe
                      src={workspaceDetails.googleMapsEmbedUrl}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen={false}
                      loading="lazy"
                      title="Google Maps Location"
                    />
                  </div>
                </Card>
              )}
            </div>
          </div>

          {/* Bottom Footer Actions */}
          <div className="flex justify-end pt-4 select-none">
            <button
              onClick={() => setActiveJob(null)}
              className="text-xs font-bold text-muted hover:text-foreground cursor-pointer transition-colors border border-border/80 bg-surface rounded-xl px-5 py-2.5"
            >
              Back to Job Listings
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Brand Subtitle Section */}
          <div className="space-y-1.5 py-4 border-b border-border/40 select-none">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <Typography type="h2" className="font-extrabold text-foreground text-xl md:text-2xl leading-snug">
                  Open Positions
                </Typography>
                <Typography type="body-xs" className="text-muted font-semibold mt-0.5">
                  Explore job vacancies and career opportunities at {orgName}
                </Typography>
              </div>
              
              {/* Create Job Button */}
              {hasPermission("organization:jobs:write") && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-xs px-4.5 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5 transition-all shadow-xs active:scale-95 border-none shrink-0"
                >
                  <Plus className="size-4" />
                  <span>Post New Job</span>
                </button>
              )}
            </div>
          </div>

          {/* Search and Filter Panel */}
          <Card className="p-5 bg-surface border border-border rounded-2xl space-y-4 select-none shadow-xs">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search jobs by title, skills or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-hidden focus:border-accent text-foreground font-outfit font-normal"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted" />
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-normal">
              <div className="space-y-1.5">
                <span className="text-[10px] text-muted uppercase tracking-wider block font-bold">Department</span>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent font-outfit font-normal cursor-pointer"
                >
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept === "All" ? "All Departments" : dept}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-muted uppercase tracking-wider block font-bold">Location</span>
                <select
                  value={selectedLoc}
                  onChange={(e) => setSelectedLoc(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent font-outfit font-normal cursor-pointer"
                >
                  {locations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc === "All" ? "All Locations" : loc}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-muted uppercase tracking-wider block font-bold">Workplace Type</span>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent font-outfit font-normal cursor-pointer"
                >
                  {types.map((type) => (
                    <option key={type} value={type}>
                      {type === "All" ? "All Types" : type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Jobs Listing */}
          <div className="space-y-4">
            {loadingJobs && (
              <div className="space-y-4">
                {[1, 2, 3].map((n) => (
                  <Card key={n} className="p-5 bg-surface border border-border rounded-xl space-y-4 animate-pulse">
                    <div className="flex gap-4 items-start w-full pr-8">
                      <div className="w-20 h-20 md:w-24 md:h-24 rounded-lg bg-accent/10 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-accent/10 rounded w-1/3" />
                        <div className="h-3 bg-accent/10 rounded w-1/4" />
                        <div className="h-3 bg-accent/10 rounded w-1/2" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {jobsError && !loadingJobs && (
              <Card className="p-6 bg-surface border border-border rounded-xl flex flex-col items-center justify-center text-muted select-none text-center">
                <span className="text-xs font-medium italic text-danger">An error occurred while loading jobs. Please try again later.</span>
              </Card>
            )}

            {!loadingJobs && !jobsError && filteredJobs.length === 0 && (
              <Card className="border border-dashed border-border/80 rounded-2xl p-12 text-center select-none bg-surface">
                <Typography type="h4" className="font-bold text-foreground mb-1">
                  No matching positions found
                </Typography>
                <Typography type="body-xs" className="text-muted max-w-md mx-auto font-normal">
                  Try changing your keywords or adjusting the filters to find other opportunities.
                </Typography>
              </Card>
            )}

            {!loadingJobs && !jobsError && filteredJobs.length > 0 && (
              filteredJobs.map((job) => {
                const isApplied = appliedJobs.includes(job.id);
                const isSaved = savedJobs.includes(job.id);

                return (
                  <Card
                    key={job.id}
                    onClick={() => setActiveJob(job)}
                    className="p-4 md:p-5 bg-surface border border-border rounded-2xl hover:border-accent/40 hover:shadow-xs transition-all duration-200 cursor-pointer select-none relative"
                  >
                    {/* Bookmark Button - Absolute Top Right Corner */}
                    <button
                      onClick={(e) => handleSaveToggle(e, job.id)}
                      aria-label="Save job"
                      className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-card/50 border-none transition-colors text-muted hover:text-foreground cursor-pointer z-20"
                    >
                      <Bookmark className={`size-4 ${isSaved ? "fill-amber-500 text-amber-500" : ""}`} />
                    </button>

                    {/* Horizontal side-by-side flex layout */}
                    <div className="flex flex-row gap-4 items-start w-full pr-8">
                      {/* Left: Cover/Image Frame */}
                      <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden shrink-0 border border-border bg-card/20 select-none">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={job.coverUrl} alt={job.title} className="w-full h-full object-cover" />
                      </div>

                      {/* Right content area: info and actions */}
                      <div className="flex-1 min-w-0 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                        {/* Job main metadata */}
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Typography type="body-sm" className="font-bold text-foreground text-sm hover:text-accent transition-colors truncate">
                              {job.title}
                            </Typography>
                          </div>

                          {/* Company Name & Verified Checkmark */}
                          <div className="flex items-center gap-1 text-[11px] text-muted leading-tight font-semibold">
                            <span className="truncate">{orgName}</span>
                            <span className="inline-flex items-center justify-center bg-blue-500 rounded-full p-0.5 text-white size-3 select-none shrink-0">
                              <Check className="size-1.5" strokeWidth={5} />
                            </span>
                          </div>

                          {/* Salary, Location, Date line with Icons */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-muted-foreground pt-0.5">
                            <span className="flex items-center gap-1 text-accent font-bold font-outfit">
                              <DollarSign className="size-3" />
                              <span>{job.salary}</span>
                            </span>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3 text-muted-foreground" />
                              <span>{job.location}</span>
                            </span>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Clock className="size-3 text-muted-foreground" />
                              <span>Deadline: {job.deadline}</span>
                            </span>
                          </div>

                          {/* Tag chips */}
                          <div className="flex flex-wrap gap-1.5 pt-1.5 select-none">
                            {job.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[9px] bg-card border border-border/80 text-muted px-1.5 py-0.5 rounded-md font-bold"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Actions: Apply button */}
                        <div className="shrink-0 pt-2 md:pt-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApply(job.id);
                            }}
                            className={`text-xs font-bold px-6 py-2 rounded-xl cursor-pointer transition-colors border-none whitespace-nowrap min-w-[120px] md:min-w-[140px] text-center ${isApplied
                              ? "bg-success/20 text-success cursor-default"
                              : "bg-accent text-accent-foreground hover:bg-accent/90"
                              }`}
                          >
                            {isApplied ? "Applied" : "Apply Now"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* -- Scoped Form Drawer Modal Dialog for Job Creation -- */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden font-outfit select-none flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-card/10">
              <span className="font-extrabold text-sm text-foreground">Post New Job</span>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-full hover:bg-card/50 text-muted hover:text-foreground cursor-pointer border-none"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body (Scrollable form) */}
            <form onSubmit={handleCreateJobSubmit} className="p-6 overflow-y-auto space-y-4 text-xs font-normal">
              {/* Job Title */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted uppercase font-bold">Job Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior React Developer..."
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Department */}
                <div className="space-y-1">
                  <label className="text-[10px] text-muted uppercase font-bold">Department</label>
                  <select
                    value={newJobDept}
                    onChange={(e) => setNewJobDept(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-hidden focus:border-accent cursor-pointer"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Quality Assurance">Quality Assurance</option>
                    <option value="Design">Design</option>
                    <option value="Platform">Platform</option>
                    <option value="Product">Product</option>
                  </select>
                </div>

                {/* Workplace Type */}
                <div className="space-y-1">
                  <label className="text-[10px] text-muted uppercase font-bold">Workplace Type</label>
                  <select
                    value={newJobWorkplace}
                    onChange={(e) => setNewJobWorkplace(e.target.value as "Hybrid" | "Remote" | "On-site")}
                    className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-hidden focus:border-accent cursor-pointer"
                  >
                    <option value="Hybrid">Hybrid</option>
                    <option value="Remote">Remote</option>
                    <option value="On-site">On-site</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* City */}
                <div className="space-y-1">
                  <label className="text-[10px] text-muted uppercase font-bold">City</label>
                  <select
                    value={newJobCity}
                    onChange={(e) => setNewJobCity(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-hidden focus:border-accent cursor-pointer"
                  >
                    <option value="Hanoi">Hanoi</option>
                    <option value="Da Nang">Da Nang</option>
                    <option value="TPHCM">Ho Chi Minh City</option>
                  </select>
                </div>

                {/* Employment Type */}
                <div className="space-y-1">
                  <label className="text-[10px] text-muted uppercase font-bold">Job Type</label>
                  <select
                    value={newJobType}
                    onChange={(e) => setNewJobType(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-hidden focus:border-accent cursor-pointer"
                  >
                    <option value="Full-Time">Full-Time</option>
                    <option value="Contract">Contract</option>
                    <option value="Part-Time">Part-Time</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Salary USD */}
                <div className="space-y-1">
                  <label className="text-[10px] text-muted uppercase font-bold">Salary (USD)</label>
                  <input
                    type="text"
                    placeholder="e.g. $1,500 - $3,000 USD"
                    value={newJobSalary}
                    onChange={(e) => setNewJobSalary(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent"
                  />
                </div>

                {/* Salary Min Max VND */}
                <div className="space-y-1">
                  <label className="text-[10px] text-muted uppercase font-bold">Salary range (VND)</label>
                  <input
                    type="text"
                    placeholder="e.g. Negotiable or 30-50M VND"
                    value={newJobSalaryMinMax}
                    onChange={(e) => setNewJobSalaryMinMax(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent"
                  />
                </div>
              </div>

              {/* Deadline & Detailed location */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted uppercase font-bold">Application Deadline</label>
                  <input
                    type="text"
                    placeholder="e.g. 30/09/2026"
                    value={newJobDeadline}
                    onChange={(e) => setNewJobDeadline(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted uppercase font-bold">Detailed Address</label>
                  <input
                    type="text"
                    placeholder="e.g. FPT Tower, Cau Giay"
                    value={newJobLoc}
                    onChange={(e) => setNewJobLoc(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent"
                  />
                </div>
              </div>

              {/* Skills & Tags */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted uppercase font-bold">Skills (comma separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. React, TypeScript, Tailwind"
                    value={newJobSkills}
                    onChange={(e) => setNewJobSkills(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted uppercase font-bold">Tags (comma separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. React, Frontend, UI/UX"
                    value={newJobTags}
                    onChange={(e) => setNewJobTags(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent"
                  />
                </div>
              </div>

              {/* Job Description */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted uppercase font-bold">Job Description (One item per line)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Develop new frontend features&#10;Optimize application performance"
                  value={newJobDesc}
                  onChange={(e) => setNewJobDesc(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent font-outfit"
                />
              </div>

              {/* Job Requirements */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted uppercase font-bold">Job Requirements (One item per line)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. At least 3 years of experience with React&#10;Proficient in TypeScript"
                  value={newJobReq}
                  onChange={(e) => setNewJobReq(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent font-outfit"
                />
              </div>

              {/* Perks & Benefits */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted uppercase font-bold">Perks & Benefits (One item per line)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Competitive salary and 13th-month bonus&#10;Premium health insurance"
                  value={newJobBen}
                  onChange={(e) => setNewJobBen(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent font-outfit"
                />
              </div>

              {/* Recruitment Images */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-muted uppercase font-bold">
                    Recruitment Images * (Min 1, Max 5 images)
                  </label>
                  {selectedFiles.length < 5 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[10px] text-accent font-bold flex items-center gap-0.5 hover:underline cursor-pointer border-none bg-transparent"
                    >
                      <Plus className="size-3" /> Add Image
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        const filesArray = Array.from(e.target.files);
                        setSelectedFiles(prev => [...prev, ...filesArray].slice(0, 5));
                      }
                    }}
                  />
                </div>

                {selectedFiles.length === 0 ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-dashed border-border hover:border-accent/40 rounded-xl p-6 flex flex-col items-center justify-center bg-card/10 text-muted transition-colors cursor-pointer select-none text-center"
                  >
                    <Upload className="size-5 text-muted mb-1" />
                    <span className="text-[11px] font-bold text-foreground">
                      Upload recruitment images
                    </span>
                    <span className="text-[9px] text-muted mt-0.5">
                      Select 1 to 5 images (JPEG, PNG, WebP, GIF)
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-5 gap-2">
                    {selectedFiles.map((file, index) => {
                      const objectUrl = URL.createObjectURL(file);
                      return (
                        <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-border/80 group bg-card/20 select-none">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={objectUrl}
                            alt={`selected-job-${index}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                            }}
                            className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-black text-white rounded-full transition-colors cursor-pointer border-none"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <span className="text-[10px] text-muted-foreground block">
                  Provide at least 1 image as the main cover (and up to 5 images) to increase credibility for the job posting.
                </span>
              </div>

              {/* Modal Footer actions */}
              <div className="pt-2 border-t border-border flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowCreateModal(false)}
                  className="font-bold text-xs border border-border text-muted hover:text-foreground cursor-pointer bg-transparent rounded-xl px-4 py-2 transition-colors disabled:opacity-55 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-xs px-4.5 py-2.5 rounded-xl cursor-pointer transition-colors border-none disabled:opacity-55 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Posting..." : "Post Job"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
