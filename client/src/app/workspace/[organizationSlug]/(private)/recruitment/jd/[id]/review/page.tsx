"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import * as heroui from "@heroui/react";

const {
  Button,
  Input,
  Chip,
  Spinner,
  Typography,
  toast,
  Slider,
  Checkbox
} = heroui;
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  Sparkles,
  Plus,
  X,
  Save,
  Send,
  Info,
  HelpCircle,
  FileText,
  Briefcase,
  Target,
  Shield,
  Settings,
  AlertCircle,
  RotateCcw,
  Check
} from "lucide-react";
import {
  hiringRequirementService,
  type HiringRequirement,
  type JobVacancyDto,
  type UpdateJobVacancyDto,
  type AcquisitionStrategy,
  type CandidateDiscoveryProfile
} from "@/services/hiring-requirement.service";

interface SourcingFieldSchema {
  key: string;
  label: string;
  type: "number" | "slider" | "checkbox" | "tags";
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

const SOURCING_FIELDS: SourcingFieldSchema[] = [
  {
    key: "minimumYearsOfExperience",
    label: "Minimum Years of Experience",
    type: "number",
    min: 0,
    description: "Minimum professional work experience required for matching."
  },
  {
    key: "minimumTrustScore",
    label: "Minimum Trust Score",
    type: "slider",
    min: 0,
    max: 100,
    step: 1,
    description: "Minimum developer trust and verification score threshold."
  },
  {
    key: "requireVerifiedEmail",
    label: "Require Verified Email Check",
    type: "checkbox",
    description: "Only match candidates with verified email addresses."
  },
  {
    key: "keyKeywords",
    label: "Discovery Keywords",
    type: "tags",
    description: "Required keywords to match against developer portfolios."
  }
];

interface PreviewData {
  title: string;
  department: string;
  workplaceType: string;
  city: string;
  type: string;
  salary: string;
  salaryMinMax: string;
  headcount: number;
  experience: string;
  degree: string;
  category: string;
  coverUrl: string;
  tags: string[];
  skills: string[];
  description: string[];
  status: string;
}

export default function JobPostReviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : "";
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  // Page level state
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);

  // Entities
  const [requirement, setRequirement] = useState<HiringRequirement | null>(null);
  const [jobPosting, setJobPosting] = useState<JobVacancyDto | null>(null);

  // General Form States
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [workplaceType, setWorkplaceType] = useState("Hybrid");
  const [city, setCity] = useState("");
  const [type, setType] = useState("Full-Time");
  const [salary, setSalary] = useState("Negotiable");
  const [salaryMinMax, setSalaryMinMax] = useState("0-0");
  const [headcount, setHeadcount] = useState(1);
  const [gender, setGender] = useState("Khác");
  const [experience, setExperience] = useState("");
  const [degree, setDegree] = useState("");
  const [category, setCategory] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [acquisitionStrategy, setAcquisitionStrategy] = useState<AcquisitionStrategy>("Hybrid");

  // Collections (Tags and Skills)
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");

  // Schema-Driven AI Discovery Profile States
  const [discoveryValues, setDiscoveryValues] = useState<Record<string, any>>({
    minimumYearsOfExperience: 0,
    minimumTrustScore: 60,
    requireVerifiedEmail: true,
    keyKeywords: []
  });
  const [newKeyword, setNewKeyword] = useState("");
  const [priorityWeights, setPriorityWeights] = useState<Record<string, number>>({});

  // Debounced projection layer state
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  // Autosave and dirty states
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastAutosavedAt, setLastAutosavedAt] = useState<Date | null>(null);

  // Responsive / Mobile navigation state
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [editorTab, setEditorTab] = useState<"specs" | "sourcing">("specs");

  const initializeForm = (posting: JobVacancyDto) => {
    setTitle(posting.title || "");
    setDepartment(posting.department || "");
    setWorkplaceType(posting.workplaceType || "Hybrid");
    setCity(posting.city || "");
    setType(posting.type || "Full-Time");
    setSalary(posting.salary || "Negotiable");
    setSalaryMinMax(posting.salaryMinMax || "0-0");
    setHeadcount(posting.headcount || 1);
    setGender(posting.gender || "Khác");
    setExperience(posting.experience || "");
    setDegree(posting.degree || "");
    setCategory(posting.category || "");
    setCoverUrl(posting.coverUrl || "");
    setAcquisitionStrategy(posting.acquisitionStrategy || "Hybrid");
    setTags(posting.tags || []);
    setSkills(posting.skills || []);

    // Discovery Profile (Schema-driven values object)
    if (posting.discoveryProfileJson) {
      try {
        const profile: CandidateDiscoveryProfile = JSON.parse(posting.discoveryProfileJson);
        setDiscoveryValues({
          minimumYearsOfExperience: profile.minimumYearsOfExperience ?? 0,
          minimumTrustScore: profile.trustRequirements?.minimumTrustScore ?? 60,
          requireVerifiedEmail: !!profile.trustRequirements?.requireVerifiedEmail,
          keyKeywords: profile.keyKeywords || []
        });
        setPriorityWeights(profile.priorityWeights || {});
      } catch (e) {
        console.error("Failed to parse discoveryProfileJson", e);
      }
    } else {
      setDiscoveryValues({
        minimumYearsOfExperience: 0,
        minimumTrustScore: 60,
        requireVerifiedEmail: true,
        keyKeywords: []
      });
      setPriorityWeights({});
    }
    setAutosaveStatus("idle");
    setLastAutosavedAt(null);
  };

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const req = await hiringRequirementService.getById(id);
      setRequirement(req);
      try {
        const posting = await hiringRequirementService.getJobPosting(id);
        setJobPosting(posting);
        initializeForm(posting);
      } catch (postErr: any) {
        if (postErr.response?.status === 404) {
          setJobPosting(null);
        } else {
          setErrorMsg("Failed to load associated job vacancy details. Please try again.");
        }
      }
    } catch (err: any) {
      setErrorMsg("Failed to load hiring requirement details. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
  }, [id]);

  // Debounced preview projection
  useEffect(() => {
    const handler = setTimeout(() => {
      setPreviewData({
        title,
        department,
        workplaceType,
        city,
        type,
        salary,
        salaryMinMax,
        headcount,
        experience,
        degree,
        category,
        coverUrl,
        tags,
        skills,
        description: jobPosting?.description || [],
        status: jobPosting?.status || "Draft"
      });
    }, 300);

    return () => clearTimeout(handler);
  }, [
    title,
    department,
    workplaceType,
    city,
    type,
    salary,
    salaryMinMax,
    headcount,
    experience,
    degree,
    category,
    coverUrl,
    tags,
    skills,
    jobPosting?.description,
    jobPosting?.status
  ]);

  // Dirty State Checker
  const isFormDirty = () => {
    if (!jobPosting) return false;

    const basicDirty =
      title !== (jobPosting.title || "") ||
      department !== (jobPosting.department || "") ||
      workplaceType !== (jobPosting.workplaceType || "Hybrid") ||
      city !== (jobPosting.city || "") ||
      type !== (jobPosting.type || "Full-Time") ||
      salary !== (jobPosting.salary || "Negotiable") ||
      salaryMinMax !== (jobPosting.salaryMinMax || "0-0") ||
      headcount !== (jobPosting.headcount || 1) ||
      gender !== (jobPosting.gender || "Khác") ||
      experience !== (jobPosting.experience || "") ||
      degree !== (jobPosting.degree || "") ||
      category !== (jobPosting.category || "") ||
      coverUrl !== (jobPosting.coverUrl || "") ||
      acquisitionStrategy !== (jobPosting.acquisitionStrategy || "Hybrid") ||
      JSON.stringify(tags) !== JSON.stringify(jobPosting.tags || []) ||
      JSON.stringify(skills) !== JSON.stringify(jobPosting.skills || []);

    if (basicDirty) return true;

    if (jobPosting.discoveryProfileJson) {
      try {
        const origProfile: CandidateDiscoveryProfile = JSON.parse(jobPosting.discoveryProfileJson);
        const origMinExp = origProfile.minimumYearsOfExperience ?? 0;
        const origMinTrust = origProfile.trustRequirements?.minimumTrustScore ?? 60;
        const origRequireEmail = !!origProfile.trustRequirements?.requireVerifiedEmail;
        const origKeywords = origProfile.keyKeywords || [];

        return (
          discoveryValues.minimumYearsOfExperience !== origMinExp ||
          discoveryValues.minimumTrustScore !== origMinTrust ||
          discoveryValues.requireVerifiedEmail !== origRequireEmail ||
          JSON.stringify(discoveryValues.keyKeywords) !== JSON.stringify(origKeywords) ||
          JSON.stringify(priorityWeights) !== JSON.stringify(origProfile.priorityWeights || {})
        );
      } catch (e) {
        return true;
      }
    }

    return (
      discoveryValues.minimumYearsOfExperience !== 0 ||
      discoveryValues.minimumTrustScore !== 60 ||
      discoveryValues.requireVerifiedEmail !== true ||
      discoveryValues.keyKeywords.length > 0 ||
      Object.keys(priorityWeights).length > 0
    );
  };

  const buildUpdateDto = (): UpdateJobVacancyDto => {
    const updatedProfile: CandidateDiscoveryProfile = {
      keyKeywords: discoveryValues.keyKeywords || [],
      minimumYearsOfExperience: discoveryValues.minimumYearsOfExperience ?? 0,
      priorityWeights,
      trustRequirements: {
        minimumTrustScore: discoveryValues.minimumTrustScore ?? 60,
        requireVerifiedEmail: !!discoveryValues.requireVerifiedEmail
      }
    };

    return {
      title,
      department,
      workplaceType,
      city,
      type,
      salary,
      salaryMinMax,
      headcount,
      gender,
      experience,
      degree,
      category,
      description: jobPosting?.description || [],
      requirements: jobPosting?.requirements || [],
      benefits: jobPosting?.benefits || [],
      tags,
      skills,
      coverUrl,
      acquisitionStrategy,
      discoveryProfileJson: JSON.stringify(updatedProfile)
    };
  };

  const isDirty = isFormDirty();

  // Navigation intercept (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Background Autosave Mechanism
  useEffect(() => {
    if (!isDirty || isSaving || isPublishing || !jobPosting) return;

    const interval = setInterval(async () => {
      setAutosaveStatus("saving");
      try {
        const data = buildUpdateDto();
        const updated = await hiringRequirementService.updateJobPosting(jobPosting.id, data);
        setJobPosting(updated);
        setAutosaveStatus("saved");
        setLastAutosavedAt(new Date());
      } catch (err) {
        console.error("Autosave failed", err);
        setAutosaveStatus("error");
      }
    }, 15000); // Autosave every 15 seconds

    return () => clearInterval(interval);
  }, [
    title,
    department,
    workplaceType,
    city,
    type,
    salary,
    salaryMinMax,
    headcount,
    gender,
    experience,
    degree,
    category,
    coverUrl,
    acquisitionStrategy,
    tags,
    skills,
    discoveryValues,
    priorityWeights,
    isSaving,
    isPublishing,
    jobPosting
  ]);

  const updateDiscoveryValue = (key: string, val: any) => {
    setDiscoveryValues((prev) => ({
      ...prev,
      [key]: val
    }));
  };

  const handleCreateDraftDirectly = async () => {
    setIsCreatingDraft(true);
    setErrorMsg(null);
    try {
      const draft = await hiringRequirementService.createJobPostingDraft(id);
      toast.success("Job posting draft created successfully!");
      setJobPosting(draft);
      initializeForm(draft);
    } catch (err: any) {
      toast.danger(err.response?.data?.message || err.message || "Failed to create draft.");
    } finally {
      setIsCreatingDraft(false);
    }
  };

  const getCapabilityDisplayName = (capId: string) => {
    const cap = requirement?.capabilities?.find((c) => c.capabilityId === capId);
    return cap ? cap.name : capId;
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags((prev) => [...prev, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (t: string) => {
    setTags((prev) => prev.filter((tag) => tag !== t));
  };

  const handleAddSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills((prev) => [...prev, newSkill.trim()]);
      setNewSkill("");
    }
  };

  const handleRemoveSkill = (s: string) => {
    setSkills((prev) => prev.filter((sk) => sk !== s));
  };

  const handleAddKeyword = () => {
    const current = discoveryValues.keyKeywords || [];
    if (newKeyword.trim() && !current.includes(newKeyword.trim())) {
      updateDiscoveryValue("keyKeywords", [...current, newKeyword.trim()]);
      setNewKeyword("");
    }
  };

  const handleRemoveKeyword = (kw: string) => {
    const current = discoveryValues.keyKeywords || [];
    updateDiscoveryValue("keyKeywords", current.filter((k: string) => k !== kw));
  };

  const handleWeightChange = (capId: string, val: number) => {
    setPriorityWeights((prev) => ({
      ...prev,
      [capId]: val
    }));
  };

  const handleSaveDraft = async () => {
    if (!jobPosting) return;
    setIsSaving(true);
    try {
      const data = buildUpdateDto();
      const updated = await hiringRequirementService.updateJobPosting(jobPosting.id, data);
      setJobPosting(updated);
      setAutosaveStatus("saved");
      setLastAutosavedAt(new Date());
      toast.success("Job posting draft saved successfully!");
    } catch (err: any) {
      toast.danger(err.response?.data?.message || err.message || "Failed to save draft.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!jobPosting) return;
    setIsPublishing(true);
    try {
      const data = buildUpdateDto();
      await hiringRequirementService.updateJobPosting(jobPosting.id, data);
      await hiringRequirementService.publishJobPosting(jobPosting.id);
      toast.success("Job vacancy published successfully!");
      router.push(`/workspace/${organizationSlug}/recruitment/jd`);
    } catch (err: any) {
      toast.danger(err.response?.data?.message || err.message || "Failed to publish job posting.");
    } finally {
      setIsPublishing(false);
    }
  };

  const getSectionId = (titleText: string) => {
    return titleText.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
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
        const headerTitle = trimmed.substring(2).trim();
        return <h1 key={idx} id={getSectionId(headerTitle)} className="text-base font-bold text-foreground mt-5 mb-2 border-b border-border/40 pb-1">{parseInlineMarkdown(headerTitle)}</h1>;
      }
      if (trimmed.startsWith("## ")) {
        const headerTitle = trimmed.substring(3).trim();
        return <h2 key={idx} id={getSectionId(headerTitle)} className="text-xs font-bold text-accent mt-4 mb-2">{parseInlineMarkdown(headerTitle)}</h2>;
      }
      if (trimmed.startsWith("### ")) {
        const headerTitle = trimmed.substring(4).trim();
        return <h3 key={idx} id={getSectionId(headerTitle)} className="text-[10px] font-semibold text-foreground mt-3 mb-1">{parseInlineMarkdown(headerTitle)}</h3>;
      }
      if (trimmed.startsWith("- ")) {
        return <li key={idx} className="text-xs text-foreground/80 list-disc ml-5 mb-1">{parseInlineMarkdown(trimmed.substring(2))}</li>;
      }
      if (trimmed.startsWith("* ")) {
        return <li key={idx} className="text-xs text-foreground/80 list-disc ml-5 mb-1">{parseInlineMarkdown(trimmed.substring(2))}</li>;
      }
      if (!trimmed) {
        return <div key={idx} className="h-2" />;
      }
      return <p key={idx} className="text-xs text-foreground/80 mb-2 leading-relaxed">{parseInlineMarkdown(trimmed)}</p>;
    });
  };

  // Status Badge Helper
  const getStatusBadgeStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case "published":
        return "bg-success/15 border-success/30 text-success";
      case "closed":
        return "bg-danger/15 border-danger/30 text-danger";
      case "archived":
        return "bg-default/30 border-default/50 text-muted-foreground";
      default:
        return "bg-warning/15 border-warning/30 text-warning";
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-4 font-outfit">
        <Spinner size="md" color="warning" />
        <span className="text-xs font-bold text-muted animate-pulse">Loading job post review console...</span>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="max-w-xl mx-auto py-20 font-outfit">
        <Card className="p-8 border border-border text-center space-y-4 shadow-sm bg-surface">
          <div className="size-14 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger mx-auto">
            <AlertCircle size={28} />
          </div>
          <Typography.Heading level={4} className="font-bold text-foreground">Something Went Wrong</Typography.Heading>
          <Typography.Paragraph size="xs" className="text-muted leading-relaxed max-w-sm mx-auto">{errorMsg}</Typography.Paragraph>
          <Button onClick={loadData} className="mt-4 bg-default text-foreground text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 mx-auto">
            <RotateCcw size={14} /> Retry
          </Button>
        </Card>
      </div>
    );
  }

  if (!requirement) {
    return (
      <div className="max-w-xl mx-auto py-20 font-outfit">
        <Card className="p-8 border border-border text-center bg-surface shadow-sm">
          <Typography.Heading level={4} className="font-bold text-foreground mb-2">Requirement Package Not Found</Typography.Heading>
          <Button onClick={() => router.back()} className="mt-4 bg-default text-foreground text-xs font-bold px-4 py-2 rounded-xl">
            Go Back
          </Button>
        </Card>
      </div>
    );
  }

  if (!jobPosting) {
    return (
      <div className="max-w-xl mx-auto py-20 font-outfit">
        <Card className="p-8 border border-border text-center space-y-4 bg-surface shadow-sm">
          <div className="size-14 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center text-warning mx-auto">
            <Info size={28} />
          </div>
          <Typography.Heading level={4} className="font-bold text-foreground">No Job Posting Draft Found</Typography.Heading>
          <Typography.Paragraph size="xs" className="text-muted leading-relaxed max-w-sm mx-auto">
            A job post draft has not been initialized for this hiring requirement yet. You must create the draft record first.
          </Typography.Paragraph>
          <Button
            onClick={handleCreateDraftDirectly}
            isPending={isCreatingDraft}
            className="bg-accent text-accent-foreground font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
          >
            Create Job Posting Draft
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-outfit text-foreground select-none max-w-7xl mx-auto p-4 md:p-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => router.back()}
            className="bg-surface border border-border p-2 rounded-xl text-foreground cursor-pointer min-w-0"
          >
            <ArrowLeft size={16} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Typography type="h3" className="font-bold text-foreground text-lg md:text-xl">Review Job Posting</Typography>
              <Chip size="sm" variant="soft" className={`${getStatusBadgeStyle(jobPosting.status || "Draft")} border font-bold uppercase text-[9px] px-1.5`}>
                {jobPosting.status}
              </Chip>
            </div>
            <Typography type="body-xs" className="text-muted mt-0.5 font-medium">
              Calibrate and verify publishing details for <span className="font-semibold text-foreground">{requirement.title} (v{requirement.version})</span>
            </Typography>
          </div>
        </div>

        {/* Action Buttons and Status */}
        <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap justify-end">
          {/* Subtle Autosave Indicator */}
          {autosaveStatus !== "idle" && (
            <span className="text-[10px] font-semibold text-muted flex items-center gap-1">
              {autosaveStatus === "saving" && (
                <>
                  <Spinner size="sm" color="warning" className="size-3" />
                  Saving draft...
                </>
              )}
              {autosaveStatus === "saved" && (
                <>
                  <Check size={12} className="text-success" />
                  Autosaved {lastAutosavedAt?.toLocaleTimeString()}
                </>
              )}
              {autosaveStatus === "error" && (
                <>
                  <AlertCircle size={12} className="text-danger" />
                  Autosave failed
                </>
              )}
            </span>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleSaveDraft}
              isPending={isSaving}
              isDisabled={isPublishing}
              className="bg-surface text-foreground hover:bg-surface-secondary border border-border font-bold text-xs h-10 px-4 rounded-xl cursor-pointer flex items-center gap-1.5"
            >
              <Save size={14} /> Save Draft
            </Button>
            <Button
              onClick={handlePublish}
              isPending={isPublishing}
              isDisabled={isSaving}
              className="bg-accent text-accent-foreground font-bold text-xs h-10 px-4 rounded-xl cursor-pointer flex items-center gap-1.5 hover:opacity-90"
            >
              <Send size={14} /> Publish Job Post
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet View Selector Tabs (lg:hidden) */}
      <div className="flex lg:hidden border-b border-border mb-4 bg-surface rounded-xl overflow-hidden p-1 gap-1">
        <button
          onClick={() => setMobileTab("edit")}
          className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-colors border-none ${
            mobileTab === "edit"
              ? "bg-accent/15 text-accent"
              : "bg-transparent text-muted hover:text-foreground hover:bg-default/20"
          }`}
        >
          1. Edit Configuration
        </button>
        <button
          onClick={() => setMobileTab("preview")}
          className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-colors border-none ${
            mobileTab === "preview"
              ? "bg-accent/15 text-accent"
              : "bg-transparent text-muted hover:text-foreground hover:bg-default/20"
          }`}
        >
          2. LinkedIn Preview
        </button>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Live LinkedIn-Style Preview (Desktop: 7 cols) */}
        <div className={`lg:col-span-7 space-y-4 ${mobileTab === "preview" ? "block" : "hidden lg:block"}`}>
          <div className="border border-border bg-surface rounded-xl shadow-xs overflow-hidden select-text relative">
            
            {/* Live Preview Header Indicator */}
            <div className="flex items-center gap-2 border-b border-border/60 bg-default/10 px-5 py-3 select-none">
              <FileText className="text-accent size-4" />
              <div>
                <span className="text-xs font-bold text-foreground block">LinkedIn Job Listing Mockup</span>
                <span className="text-[10px] text-muted block font-medium">Real-time synchronized preview</span>
              </div>
            </div>

            {/* LinkedIn-Style Preview Card */}
            {previewData ? (
              <div className="font-sans leading-relaxed select-text pb-6">
                
                {/* 1. Cover Image Banner */}
                <div className="w-full h-44 relative bg-surface-secondary">
                  {previewData.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewData.coverUrl}
                      alt="Job cover"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-surface-secondary flex items-center justify-center text-xs text-muted italic">
                      No cover image specified
                    </div>
                  )}
                  {/* Status Overlay Badge */}
                  <span className={`absolute top-4 right-4 border font-bold uppercase text-[9px] px-2.5 py-1 rounded-full ${getStatusBadgeStyle(previewData.status)}`}>
                    {previewData.status}
                  </span>
                </div>

                {/* 2. Floating Company Brand Logo & Core Title */}
                <div className="px-6 flex gap-4 items-end relative z-10 -mt-8">
                  <div className="size-16 rounded-xl border-4 border-surface bg-surface shadow-xs overflow-hidden flex items-center justify-center text-accent font-bold text-lg">
                    {organizationSlug.substring(0, 1).toUpperCase()}
                  </div>
                  <div className="pb-1">
                    <span className="text-xs font-bold text-foreground/80 block select-none">
                      {organizationSlug.replace("-", " ")}
                    </span>
                  </div>
                </div>

                {/* 3. Job Title and Main Specs */}
                <div className="px-6 pt-4 pb-2 border-b border-border/40">
                  <h1 className="text-xl font-bold text-foreground leading-tight">
                    {previewData.title || <span className="text-muted italic">Untitled Job Position</span>}
                  </h1>
                  
                  {/* Details strip */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 text-xs font-medium text-muted">
                    <span className="text-foreground/80">{previewData.department || "No Department"}</span>
                    <span>&bull;</span>
                    <span>{previewData.city || "No City"} ({previewData.workplaceType})</span>
                    <span>&bull;</span>
                    <span className="text-accent font-semibold">{previewData.salary} ({previewData.salaryMinMax})</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-3">
                    <Chip size="sm" variant="soft" className="text-[10px] h-5 bg-default/40 border border-border text-foreground font-semibold">
                      {previewData.type}
                    </Chip>
                    <Chip size="sm" variant="soft" className="text-[10px] h-5 bg-default/40 border border-border text-foreground font-semibold">
                      {previewData.headcount} vacancy
                    </Chip>
                    {previewData.experience && (
                      <Chip size="sm" variant="soft" className="text-[10px] h-5 bg-default/40 border border-border text-foreground font-semibold">
                        {previewData.experience}
                      </Chip>
                    )}
                  </div>
                </div>

                {/* 4. Markdown Description Content */}
                <div className="px-6 pt-4 prose prose-sm max-w-none text-foreground/90 font-sans select-text">
                  {previewData.description && previewData.description.length > 0 ? (
                    renderMarkdown(previewData.description[0])
                  ) : (
                    <div className="text-xs text-muted italic p-4 text-center">No description text generated.</div>
                  )}
                </div>

                {/* 5. Required Skills Portfolio */}
                {previewData.skills && previewData.skills.length > 0 && (
                  <div className="px-6 pt-4 mt-4 border-t border-border/40">
                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider block mb-2 select-none">
                      Required Skills & Stack
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {previewData.skills.map((skill) => (
                        <span key={skill} className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-accent/10 border border-accent/20 text-accent">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 min-h-[300px]">
                <Spinner size="sm" color="warning" />
                <span className="text-[10px] text-muted font-bold mt-2 animate-pulse">Syncing preview data...</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Calibration Forms (Desktop: 5 cols) */}
        <div className={`lg:col-span-5 space-y-6 ${mobileTab === "edit" ? "block" : "hidden lg:block"}`}>
          
          {/* Sub-tabs header for configuration layout */}
          <div className="flex border-b border-border bg-surface rounded-xl p-1 gap-1 select-none">
            <button
              onClick={() => setEditorTab("specs")}
              className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-colors border-none ${
                editorTab === "specs"
                  ? "bg-accent/10 text-accent"
                  : "bg-transparent text-muted hover:text-foreground hover:bg-default/20"
              }`}
            >
              Job Specs
            </button>
            <button
              onClick={() => setEditorTab("sourcing")}
              className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-colors border-none ${
                editorTab === "sourcing"
                  ? "bg-accent/10 text-accent"
                  : "bg-transparent text-muted hover:text-foreground hover:bg-default/20"
              }`}
            >
              AI Sourcing Config
            </button>
          </div>

          {/* Tab 1: Publishing Details / Specs */}
          {editorTab === "specs" && (
            <Card className="p-5 border border-border space-y-4 bg-surface shadow-xs">
              <div className="flex items-center gap-2 border-b border-border/50 pb-3">
                <Briefcase className="text-accent size-4" />
                <span className="text-xs font-bold text-foreground">1. Publishing Specifications</span>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80">Job Title</label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Senior Backend Engineer"
                      className="text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80">Department</label>
                    <Input
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Platform Engineering"
                      className="text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80">Workplace Model</label>
                    <select
                      value={workplaceType}
                      onChange={(e) => setWorkplaceType(e.target.value)}
                      className="w-full px-3 py-2 border border-border bg-field-background text-foreground text-xs font-medium rounded-xl outline-hidden cursor-pointer"
                    >
                      <option value="On-site">On-site</option>
                      <option value="Remote">Remote</option>
                      <option value="Hybrid">Hybrid</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80">Target City</label>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Ho Chi Minh City"
                      className="text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80">Employment Type</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="w-full px-3 py-2 border border-border bg-field-background text-foreground text-xs font-medium rounded-xl outline-hidden cursor-pointer"
                    >
                      <option value="Full-Time">Full-Time</option>
                      <option value="Part-Time">Part-Time</option>
                      <option value="Contract">Contract</option>
                      <option value="Internship">Internship</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80">Salary Description</label>
                    <Input
                      value={salary}
                      onChange={(e) => setSalary(e.target.value)}
                      placeholder="e.g. 2000 - 3500 USD or Negotiable"
                      className="text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80">Salary Bounds (Min-Max)</label>
                    <Input
                      value={salaryMinMax}
                      onChange={(e) => setSalaryMinMax(e.target.value)}
                      placeholder="e.g. 2000-3500"
                      className="text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80">Headcount</label>
                    <Input
                      type="number"
                      value={headcount.toString()}
                      onChange={(e) => setHeadcount(parseInt(e.target.value) || 1)}
                      className="text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80">Experience Range</label>
                    <Input
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      placeholder="e.g. 3-5 years"
                      className="text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80">Degree Requirement</label>
                    <Input
                      value={degree}
                      onChange={(e) => setDegree(e.target.value)}
                      placeholder="e.g. Bachelor's Degree"
                      className="text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80">Industry Category</label>
                    <Input
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g. Software Engineering"
                      className="text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80">Cover Image URL</label>
                    <Input
                      value={coverUrl}
                      onChange={(e) => setCoverUrl(e.target.value)}
                      placeholder="https://..."
                      className="text-xs font-medium"
                    />
                  </div>
                </div>

                {/* Job Tags and Stack Editors */}
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground/80 block">Job Tags</label>
                    <div className="flex gap-2">
                      <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                        placeholder="Add tag and press Enter"
                        className="text-xs font-medium"
                      />
                      <Button onClick={handleAddTag} className="bg-default text-foreground text-xs font-bold rounded-xl px-3 cursor-pointer">
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {tags.map((t) => (
                        <Chip
                          key={t}
                          variant="soft"
                          className="bg-surface-secondary text-foreground text-[10px] font-semibold rounded-lg px-1.5 py-0.5 flex items-center gap-1"
                        >
                          <Chip.Label>{t}</Chip.Label>
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(t)}
                            className="hover:opacity-85 cursor-pointer outline-hidden p-0.5"
                          >
                            <X size={10} />
                          </button>
                        </Chip>
                      ))}
                      {tags.length === 0 && <span className="text-[10px] text-muted italic">No tags added yet.</span>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground/80 block">Required Stack / Technologies</label>
                    <div className="flex gap-2">
                      <Input
                        value={newSkill}
                        onChange={(e) => setNewSkill(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddSkill()}
                        placeholder="Add technology and press Enter"
                        className="text-xs font-medium"
                      />
                      <Button onClick={handleAddSkill} className="bg-default text-foreground text-xs font-bold rounded-xl px-3 cursor-pointer">
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {skills.map((s) => (
                        <Chip
                          key={s}
                          variant="soft"
                          className="bg-surface-secondary text-foreground text-[10px] font-semibold rounded-lg px-1.5 py-0.5 flex items-center gap-1"
                        >
                          <Chip.Label>{s}</Chip.Label>
                          <button
                            type="button"
                            onClick={() => handleRemoveSkill(s)}
                            className="hover:opacity-85 cursor-pointer outline-hidden p-0.5"
                          >
                            <X size={10} />
                          </button>
                        </Chip>
                      ))}
                      {skills.length === 0 && <span className="text-[10px] text-muted italic">No stack skills mapped.</span>}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Tab 2: AI Sourcing & Discovery Configuration */}
          {editorTab === "sourcing" && (
            <div className="space-y-6">
              
              {/* Sourcing Strategy card */}
              <Card className="p-5 border border-border space-y-4 bg-surface shadow-xs">
                <div className="flex items-center gap-2 border-b border-border/50 pb-3">
                  <Target className="text-accent size-4" />
                  <span className="text-xs font-bold text-foreground">2. Candidate Sourcing Strategy</span>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80">Strategy Mode</label>
                    <select
                      value={acquisitionStrategy}
                      onChange={(e) => setAcquisitionStrategy(e.target.value as AcquisitionStrategy)}
                      className="w-full px-3 py-2.5 border border-border bg-field-background text-foreground text-xs font-medium rounded-xl outline-hidden cursor-pointer"
                    >
                      <option value="Hybrid">Hybrid (Sourcing + Public Applications)</option>
                      <option value="AiMatchingOnly">AI Matching Only (Hidden Listing)</option>
                      <option value="ManualOnly">Manual Only (Applications Only)</option>
                    </select>
                  </div>

                  <div className="p-3 bg-surface-secondary/40 border border-border/60 rounded-xl flex gap-2 text-[10px] text-muted leading-normal font-semibold">
                    <Info size={14} className="text-accent shrink-0 mt-0.5" />
                    <span>
                      {acquisitionStrategy === "Hybrid" && "Candidates can apply publicly, and CVerify continuously queries background portfolios."}
                      {acquisitionStrategy === "AiMatchingOnly" && "No public job board. Vacancy is hidden, sourcing runs in private matching pipeline."}
                      {acquisitionStrategy === "ManualOnly" && "Sourcing indexes disabled. Relies entirely on manual intake forms."}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Dynamic Schema-Driven Discovery Profile card */}
              <Card className="p-5 border border-border space-y-4 bg-surface shadow-xs">
                <div className="flex items-center gap-2 border-b border-border/50 pb-3">
                  <Settings className="text-accent size-4" />
                  <span className="text-xs font-bold text-foreground">3. Schema-Driven AI Discovery Rules</span>
                </div>

                <div className="space-y-5">
                  
                  {/* Dynamic rendering of sourcing fields based on schema */}
                  {SOURCING_FIELDS.map((field) => {
                    const currentVal = discoveryValues[field.key];

                    if (field.type === "number") {
                      return (
                        <div key={field.key} className="space-y-1.5">
                          <div className="flex justify-between items-center select-none">
                            <label className="text-xs font-semibold text-foreground/80">{field.label}</label>
                            <span className="text-[10px] text-muted italic">Key: {field.key}</span>
                          </div>
                          <Input
                            type="number"
                            min={field.min ?? 0}
                            value={currentVal?.toString() ?? "0"}
                            onChange={(e) => updateDiscoveryValue(field.key, parseInt(e.target.value) || 0)}
                            className="text-xs font-medium"
                          />
                          {field.description && (
                            <span className="text-[10px] text-muted leading-normal font-medium block pt-0.5">{field.description}</span>
                          )}
                        </div>
                      );
                    }

                    if (field.type === "slider") {
                      return (
                        <div key={field.key} className="space-y-1.5">
                          <div className="flex justify-between items-center select-none">
                            <label className="text-xs font-semibold text-foreground/80">{field.label}</label>
                            <span className="text-xs font-bold text-accent">{currentVal}%</span>
                          </div>
                          <div className="pt-1.5">
                            <Slider
                              aria-label={field.label}
                              step={field.step ?? 1}
                              minValue={field.min ?? 0}
                              maxValue={field.max ?? 100}
                              value={currentVal ?? 60}
                              onChange={(val) => updateDiscoveryValue(field.key, Array.isArray(val) ? val[0] : val)}
                              className="w-full animate-none"
                            />
                          </div>
                          {field.description && (
                            <span className="text-[10px] text-muted leading-normal font-medium block pt-0.5">{field.description}</span>
                          )}
                        </div>
                      );
                    }

                    if (field.type === "checkbox") {
                      return (
                        <div key={field.key} className="flex flex-col gap-1 py-1">
                          <Checkbox
                            id={field.key}
                            isSelected={!!currentVal}
                            onChange={(val: any) => updateDiscoveryValue(field.key, !!val)}
                          >
                            <Checkbox.Control className="border-2 border-border data-[selected=true]:bg-accent data-[selected=true]:border-accent rounded size-4 before:rounded">
                              <Checkbox.Indicator className="text-accent-foreground size-3" />
                            </Checkbox.Control>
                            <Checkbox.Content>
                              <span className="text-xs font-semibold text-foreground/80">{field.label}</span>
                            </Checkbox.Content>
                          </Checkbox>
                          {field.description && (
                            <span className="text-[10px] text-muted leading-normal font-medium block pl-6">{field.description}</span>
                          )}
                        </div>
                      );
                    }

                    if (field.type === "tags") {
                      const tagsList = currentVal || [];
                      return (
                        <div key={field.key} className="space-y-2 border-t border-border/40 pt-3">
                          <div className="flex justify-between items-center select-none">
                            <label className="text-xs font-semibold text-foreground/80 block">{field.label}</label>
                            <span className="text-[10px] text-muted italic">Dynamic Tag Array</span>
                          </div>
                          <div className="flex gap-2">
                            <Input
                              value={newKeyword}
                              onChange={(e) => setNewKeyword(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
                              placeholder="Add keyword and press Enter"
                              className="text-xs font-medium"
                            />
                            <Button onClick={handleAddKeyword} className="bg-default text-foreground text-xs font-bold rounded-xl px-3 cursor-pointer">
                              Add
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {tagsList.map((kw: string) => (
                              <Chip
                                key={kw}
                                variant="soft"
                                className="bg-surface-secondary text-foreground text-[10px] font-semibold rounded-lg px-1.5 py-0.5 flex items-center gap-1"
                              >
                                <Chip.Label>{kw}</Chip.Label>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveKeyword(kw)}
                                  className="hover:opacity-85 cursor-pointer outline-hidden p-0.5"
                                >
                                  <X size={10} />
                                </button>
                              </Chip>
                            ))}
                            {tagsList.length === 0 && <span className="text-[10px] text-muted italic">No discovery keywords.</span>}
                          </div>
                          {field.description && (
                            <span className="text-[10px] text-muted leading-normal font-medium block pt-0.5">{field.description}</span>
                          )}
                        </div>
                      );
                    }

                    return null;
                  })}

                  {/* Capability weights configuration (Weights) */}
                  <div className="space-y-3.5 pt-3 border-t border-border/40">
                    <div className="flex items-center justify-between select-none">
                      <span className="text-xs font-bold text-foreground">Capability Matcher Weights</span>
                      <HelpCircle className="size-3.5 text-muted hover:text-foreground cursor-help" />
                    </div>

                    <div className="space-y-3">
                      {Object.entries(priorityWeights).map(([capId, weight]) => (
                        <div key={capId} className="space-y-1.5 p-3 bg-surface-secondary/40 border border-border/60 rounded-xl">
                          <div className="flex justify-between items-center text-xs font-bold">
                            <span className="text-foreground truncate max-w-[70%]">{getCapabilityDisplayName(capId)}</span>
                            <span className="text-accent">{Math.round(weight * 100)}%</span>
                          </div>
                          <div className="pt-1">
                            <Slider
                              aria-label={`Weight for ${capId}`}
                              step={0.01}
                              minValue={0}
                              maxValue={1}
                              value={weight}
                              onChange={(val) => handleWeightChange(capId, Array.isArray(val) ? val[0] : val)}
                              className="w-full animate-none"
                            />
                          </div>
                        </div>
                      ))}
                      {Object.keys(priorityWeights).length === 0 && (
                        <span className="text-[10px] text-muted italic block">No capability weights defined.</span>
                      )}
                    </div>
                  </div>

                </div>
              </Card>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
