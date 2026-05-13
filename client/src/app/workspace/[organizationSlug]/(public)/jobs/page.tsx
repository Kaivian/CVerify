"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Typography, Chip, toast } from "@heroui/react";
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
  Upload
} from "lucide-react";

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
    // Fallback logic for managers
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
        <Card className="bg-surface border border-border rounded-xl overflow-hidden font-outfit select-none">
          {/* Header Bar */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-card/10">
            <button
              onClick={() => setActiveJob(null)}
              className="font-semibold text-xs border border-border text-muted hover:text-foreground cursor-pointer bg-transparent rounded-lg px-4 py-1.5 flex items-center gap-1 transition-colors"
            >
              ← Back to list
            </button>
            <span className="text-xs text-muted-foreground font-normal">Job Details</span>
          </div>

          {/* 1. Large Cover Banner Image */}
          <div className="w-full h-48 md:h-64 relative shrink-0 bg-surface-secondary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activeJob.coverUrl} alt={activeJob.title} className="w-full h-full object-cover" />
          </div>

          {/* 2. Overlapping circular company Logo */}
          <div className="px-6 flex gap-4 items-end shrink-0 relative z-10">
            <div className="w-20 h-20 rounded-full border-4 border-surface bg-surface -mt-10 shadow-md overflow-hidden flex items-center justify-center text-accent font-semibold text-xl">
              {orgLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={orgLogo} alt={`${orgName} Logo`} className="w-full h-full object-cover" />
              ) : (
                orgName.substring(0, 1).toUpperCase()
              )}
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-foreground">{orgName}</span>
                <span className="inline-flex items-center justify-center bg-blue-500 rounded-full p-0.5 text-white size-3">
                  <Check className="size-1.5" strokeWidth={5} />
                </span>
              </div>
            </div>
          </div>

          {/* 3. Job details Body Header */}
          <div className="px-6 pt-4 pb-2 shrink-0">
            <Typography type="h3" className="font-semibold text-foreground text-xl leading-tight">
              {activeJob.title}
            </Typography>
            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-normal">
              <span className="text-accent font-semibold text-sm">
                {activeJob.salary} ({activeJob.salaryMinMax})
              </span>
              <span className="text-muted">·</span>
              <Chip size="sm" variant="soft" color="accent" className="text-[9px] font-medium h-5 px-1.5">
                {activeJob.department}
              </Chip>
              <Chip size="sm" variant="soft" color="warning" className="text-[9px] font-medium h-5 px-1.5">
                {activeJob.type}
              </Chip>
            </div>
          </div>

          {/* 4. Split Two Column Detail Layout */}
          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Column (Job Specifications & Lists) */}
            <div className="lg:col-span-2 space-y-6">

              {/* -- Recruitment Information (Grid Card) -- */}
              <div className="p-4 rounded-xl border border-border bg-card/10 space-y-3 font-normal">
                <span className="text-[10px] text-foreground uppercase tracking-wider block font-semibold border-b border-border/40 pb-1.5">
                  Recruitment Information
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Briefcase className="size-3.5 text-accent shrink-0" />
                    <div>
                      <span className="block text-[9px] text-muted uppercase">Position</span>
                      <span className="font-medium text-foreground">Staff ({activeJob.department})</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="size-3.5 text-accent shrink-0" />
                    <div>
                      <span className="block text-[9px] text-muted uppercase">Deadline</span>
                      <span className="font-medium text-foreground">{activeJob.deadline}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Users className="size-3.5 text-accent shrink-0" />
                    <div>
                      <span className="block text-[9px] text-muted uppercase">Headcount</span>
                      <span className="font-medium text-foreground">{activeJob.headcount} people</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Users className="size-3.5 text-accent shrink-0" />
                    <div>
                      <span className="block text-[9px] text-muted uppercase">Gender</span>
                      <span className="font-medium text-foreground">{activeJob.gender}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Award className="size-3.5 text-accent shrink-0" />
                    <div>
                      <span className="block text-[9px] text-muted uppercase">Experience</span>
                      <span className="font-medium text-foreground">{activeJob.experience}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <GraduationCap className="size-3.5 text-accent shrink-0" />
                    <div>
                      <span className="block text-[9px] text-muted uppercase">Degree</span>
                      <span className="font-medium text-foreground">{activeJob.degree}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin className="size-3.5 text-accent shrink-0" />
                    <div>
                      <span className="block text-[9px] text-muted uppercase">Workplace</span>
                      <span className="font-medium text-foreground">{activeJob.workplaceType} job in {activeJob.city}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <BookOpen className="size-3.5 text-accent shrink-0" />
                    <div>
                      <span className="block text-[9px] text-muted uppercase">Category</span>
                      <span className="font-medium text-foreground truncate max-w-[200px]" title={activeJob.category}>
                        {activeJob.category}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* -- Job Description -- */}
              <div className="space-y-2 font-normal text-foreground">
                <span className="text-[10px] text-foreground uppercase tracking-wider block font-semibold border-b border-border/40 pb-1">
                  Job Description
                </span>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-foreground font-normal">
                  {activeJob.description.map((desc, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {desc}
                    </li>
                  ))}
                </ul>
              </div>

              {/* ── Job Requirements ── */}
              <div className="space-y-2 font-normal text-foreground">
                <span className="text-[10px] text-foreground uppercase tracking-wider block font-semibold border-b border-border/40 pb-1">
                  Job Requirements
                </span>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-foreground font-normal">
                  {activeJob.requirements.map((req, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {req}
                    </li>
                  ))}
                </ul>
              </div>

              {/* ── Perks & Benefits ── */}
              <div className="space-y-2 font-normal text-foreground">
                <span className="text-[10px] text-foreground uppercase tracking-wider block font-semibold border-b border-border/40 pb-1">
                  Perks & Benefits
                </span>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-foreground font-normal">
                  {activeJob.benefits.map((ben, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {ben}
                    </li>
                  ))}
                </ul>
              </div>

              {/* ── Recruitment Tags & Required Skills ── */}
              <div className="space-y-3 font-normal">
                <div>
                  <span className="text-[10px] text-foreground uppercase tracking-wider block font-semibold border-b border-border/40 pb-1 mb-2">
                    Recruitment Tags
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeJob.tags.map((t) => (
                      <span key={t} className="text-[10px] bg-card border border-border/60 text-muted px-2 py-0.5 rounded-md font-medium">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-foreground uppercase tracking-wider block font-semibold border-b border-border/40 pb-1 mb-2">
                    Required Skills
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeJob.skills.map((s) => (
                      <span key={s} className="text-[10px] bg-accent/10 border border-accent/20 text-accent px-2 py-0.5 rounded-md font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* -- Workplace & Team Images -- */}
              {activeJob.images && activeJob.images.length > 1 && (
                <div className="space-y-2 font-normal">
                  <span className="text-[10px] text-foreground uppercase tracking-wider block font-semibold border-b border-border/40 pb-1 mb-2">
                    Workplace & Team Images ({activeJob.images.length} images)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {activeJob.images.map((img, idx) => (
                      <div key={idx} className="h-28 rounded-lg overflow-hidden border border-border/80 bg-card/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt={`Job detail image ${idx + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-200" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column (Widget cards & actions) */}
            <div className="space-y-5">

              {/* Apply card box */}
              <Card className="p-4 bg-amber-500/5 border border-accent/30 rounded-xl text-center space-y-3 font-normal">
                <Typography type="body-xs" className="text-muted leading-relaxed text-[11px] font-normal">
                  Are you interested in this position? There is still time to apply directly!
                </Typography>
                <Button
                  onClick={() => handleApply(activeJob.id)}
                  disabled={appliedJobs.includes(activeJob.id)}
                  variant="solid"
                  size="sm"
                  className={`w-full font-semibold text-xs py-2 h-9 rounded-lg cursor-pointer border-none transition-colors ${appliedJobs.includes(activeJob.id)
                    ? "bg-success/20 text-success cursor-default"
                    : "bg-accent text-background hover:bg-accent/90"
                    }`}
                >
                  {appliedJobs.includes(activeJob.id) ? "Applied" : "Apply Now"}
                </Button>
              </Card>

              {/* Company summary info widget */}
              <Card className="p-4 bg-surface border border-border rounded-xl space-y-3 font-normal">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                  <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center overflow-hidden shrink-0">
                    {orgLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={orgLogo} alt={orgName} className="w-full h-full object-cover" />
                    ) : (
                      orgName.substring(0, 1).toUpperCase()
                    )}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground text-xs block truncate max-w-[170px]">
                      {orgName}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-[10px] text-muted-foreground">
                  {workspaceDetails.companySize && (
                    <div>
                      <span className="block text-[8px] text-muted uppercase">Company Size</span>
                      <span className="font-medium text-foreground">{workspaceDetails.companySize}</span>
                    </div>
                  )}

                  <div>
                    <span className="block text-[8px] text-muted uppercase">Location</span>
                    <span className="font-medium text-foreground">{workspaceDetails.city || workspaceDetails.location || "Not updated"}</span>
                  </div>

                  {workspaceDetails.website && (
                    <div>
                      <span className="block text-[8px] text-muted uppercase">Website</span>
                      <a
                        href={workspaceDetails.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-accent hover:underline break-all"
                      >
                        {workspaceDetails.website.replace("https://", "").replace("http://", "")}
                      </a>
                    </div>
                  )}
                </div>
              </Card>

              {/* Google Map location widget */}
              {workspaceDetails.googleMapsEmbedUrl && (
                <Card className="p-4 bg-surface border border-border rounded-xl space-y-2 font-normal">
                  <span className="text-[10px] text-foreground uppercase tracking-wider block font-semibold pb-1 border-b border-border/40">
                    Map
                  </span>
                  <div className="h-40 rounded-lg overflow-hidden border border-border/80">
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

          {/* Footer actions */}
          <div className="p-4 border-t border-border flex justify-end gap-2 shrink-0 bg-card/10">
            <button
              onClick={() => setActiveJob(null)}
              className="font-semibold text-xs border border-border text-muted hover:text-foreground cursor-pointer bg-transparent rounded-lg px-4 py-1.5 transition-colors"
            >
              Back to list
            </button>
          </div>
        </Card>
      ) : (
        <>
          {/* Create Job Button - Scoped Permission Matrix Check */}
          {hasPermission("organization:jobs:write") && (
            <div className="flex justify-end select-none">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-[#8A532B] hover:bg-[#724320] text-white font-semibold text-xs px-4 py-2.5 rounded-lg cursor-pointer flex items-center gap-1.5 transition-all shadow-md active:scale-95 border-none"
              >
                <Plus className="size-4" />
                <span>Post Job</span>
              </button>
            </div>
          )}

          {/* Search and Filter Panel */}
          <Card className="p-5 bg-surface border border-border rounded-xl space-y-4 select-none">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search jobs by title, skills or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2 text-xs focus:outline-hidden focus:border-accent text-foreground font-outfit font-normal"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted" />
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-normal">
              <div className="space-y-1">
                <span className="text-[10px] text-muted uppercase tracking-wider block font-semibold">Department</span>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent font-outfit font-normal cursor-pointer"
                >
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept === "All" ? "All Departments" : dept}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-muted uppercase tracking-wider block font-semibold">Location</span>
                <select
                  value={selectedLoc}
                  onChange={(e) => setSelectedLoc(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent font-outfit font-normal cursor-pointer"
                >
                  {locations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc === "All" ? "All Locations" : loc}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-muted uppercase tracking-wider block font-semibold">Workplace Type</span>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent font-outfit font-normal cursor-pointer"
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
              <Card className="border border-dashed border-border/80 rounded-xl p-12 text-center select-none bg-surface">
                <Typography type="h4" className="font-semibold text-foreground mb-1">
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
                    className="p-4 md:p-5 bg-surface border border-border rounded-xl hover:border-accent/40 hover:shadow-xs transition-all cursor-pointer select-none relative"
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
                      <div className="w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden shrink-0 border border-border bg-card/20 select-none">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={job.coverUrl} alt={job.title} className="w-full h-full object-cover" />
                      </div>

                      {/* Right content area: info and actions */}
                      <div className="flex-1 min-w-0 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                        {/* Job main metadata */}
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Typography type="body-sm" className="font-semibold text-foreground text-sm hover:text-accent transition-colors truncate">
                              {job.title}
                            </Typography>
                          </div>

                          {/* Company Name & Verified Checkmark */}
                          <div className="flex items-center gap-1 text-[11px] text-muted leading-tight font-normal">
                            <span className="truncate">{orgName}</span>
                            <span className="inline-flex items-center justify-center bg-blue-500 rounded-full p-0.5 text-white size-3 select-none">
                              <Check className="size-1.5" strokeWidth={5} />
                            </span>
                          </div>

                          {/* Salary, Location, Date line with Icons */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-normal text-muted-foreground pt-0.5">
                            <span className="flex items-center gap-1 text-accent font-semibold font-outfit">
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
                                className="text-[9px] bg-card border border-border/80 text-muted px-1.5 py-0.5 rounded-md font-medium"
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
                            className={`text-xs font-semibold px-6 py-2 rounded-lg cursor-pointer transition-colors border-none whitespace-nowrap min-w-[120px] md:min-w-[140px] text-center ${isApplied
                              ? "bg-success/20 text-success cursor-default"
                              : "bg-accent text-background hover:bg-accent/90"
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
        </>
      )}

      {/* -- Scoped Form Drawer Modal Dialog for Job Creation -- */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border w-full max-w-xl rounded-xl shadow-2xl overflow-hidden font-outfit select-none flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-card/10">
              <span className="font-semibold text-sm text-foreground">Post New Job</span>
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
                <label className="text-[10px] text-muted uppercase font-semibold">Job Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior React Developer..."
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Department */}
                <div className="space-y-1">
                  <label className="text-[10px] text-muted uppercase font-semibold">Department</label>
                  <select
                    value={newJobDept}
                    onChange={(e) => setNewJobDept(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent cursor-pointer"
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
                  <label className="text-[10px] text-muted uppercase font-semibold">Workplace Type</label>
                  <select
                    value={newJobWorkplace}
                    onChange={(e) => setNewJobWorkplace(e.target.value as "Hybrid" | "Remote" | "On-site")}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent cursor-pointer"
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
                  <label className="text-[10px] text-muted uppercase font-semibold">City</label>
                  <select
                    value={newJobCity}
                    onChange={(e) => setNewJobCity(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent cursor-pointer"
                  >
                    <option value="Hanoi">Hanoi</option>
                    <option value="Da Nang">Da Nang</option>
                    <option value="TPHCM">Ho Chi Minh City</option>
                  </select>
                </div>

                {/* Employment Type */}
                <div className="space-y-1">
                  <label className="text-[10px] text-muted uppercase font-semibold">Job Type</label>
                  <select
                    value={newJobType}
                    onChange={(e) => setNewJobType(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent cursor-pointer"
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
                  <label className="text-[10px] text-muted uppercase font-semibold">Salary (USD)</label>
                  <input
                    type="text"
                    placeholder="e.g. $1,500 - $3,000 USD"
                    value={newJobSalary}
                    onChange={(e) => setNewJobSalary(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent"
                  />
                </div>

                {/* Salary Min Max VND */}
                <div className="space-y-1">
                  <label className="text-[10px] text-muted uppercase font-semibold">Salary range / details (VND/Negotiable)</label>
                  <input
                    type="text"
                    placeholder="e.g. Negotiable or 30-50M VND"
                    value={newJobSalaryMinMax}
                    onChange={(e) => setNewJobSalaryMinMax(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent"
                  />
                </div>
              </div>

              {/* Deadline & Detailed location */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted uppercase font-semibold">Application Deadline</label>
                  <input
                    type="text"
                    placeholder="e.g. 30/09/2026"
                    value={newJobDeadline}
                    onChange={(e) => setNewJobDeadline(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted uppercase font-semibold">Detailed Address</label>
                  <input
                    type="text"
                    placeholder="e.g. FPT Tower, Cau Giay"
                    value={newJobLoc}
                    onChange={(e) => setNewJobLoc(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent"
                  />
                </div>
              </div>

              {/* Skills & Tags */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted uppercase font-semibold">Skills (separated by commas)</label>
                  <input
                    type="text"
                    placeholder="e.g. React, TypeScript, Tailwind"
                    value={newJobSkills}
                    onChange={(e) => setNewJobSkills(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted uppercase font-semibold">Tags (separated by commas)</label>
                  <input
                    type="text"
                    placeholder="e.g. React, Frontend, UI/UX"
                    value={newJobTags}
                    onChange={(e) => setNewJobTags(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent"
                  />
                </div>
              </div>

              {/* Job Description */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted uppercase font-semibold">Job Description (One item per line)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Develop new frontend features&#10;Optimize application performance"
                  value={newJobDesc}
                  onChange={(e) => setNewJobDesc(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent font-outfit"
                />
              </div>

              {/* Job Requirements */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted uppercase font-semibold">Job Requirements (One item per line)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. At least 3 years of experience with React&#10;Proficient in TypeScript"
                  value={newJobReq}
                  onChange={(e) => setNewJobReq(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent font-outfit"
                />
              </div>

              {/* Perks & Benefits */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted uppercase font-semibold">Perks & Benefits (One item per line)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Competitive salary and 13th-month bonus&#10;Premium health insurance"
                  value={newJobBen}
                  onChange={(e) => setNewJobBen(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent font-outfit"
                />
              </div>

              {/* Recruitment Images */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-muted uppercase font-semibold">
                    Recruitment Images * (Min 1, Max 5 images)
                  </label>
                  {selectedFiles.length < 5 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[10px] text-accent font-semibold flex items-center gap-0.5 hover:underline cursor-pointer border-none bg-transparent"
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
                    className="border border-dashed border-border hover:border-accent/40 rounded-lg p-6 flex flex-col items-center justify-center bg-card/10 text-muted transition-colors cursor-pointer select-none text-center"
                  >
                    <Upload className="size-5 text-muted-foreground mb-1" />
                    <span className="text-[11px] font-semibold text-foreground">
                      Upload recruitment images
                    </span>
                    <span className="text-[9px] text-muted-foreground mt-0.5">
                      Select 1 to 5 images (JPEG, PNG, WebP, GIF)
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-5 gap-2">
                    {selectedFiles.map((file, index) => {
                      const objectUrl = URL.createObjectURL(file);
                      return (
                        <div key={index} className="relative aspect-square rounded-md overflow-hidden border border-border/80 group bg-card/20 select-none">
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
                  className="font-semibold text-xs border border-border text-muted hover:text-foreground cursor-pointer bg-transparent rounded-lg px-4 py-2 transition-colors disabled:opacity-55 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#8A532B] hover:bg-[#724320] text-white font-semibold text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors border-none disabled:opacity-55 disabled:cursor-not-allowed"
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
