"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Button,
  Chip,
  Spinner,
  Tabs,
  Typography,
  toast,
  AlertDialog
} from "@heroui/react";
import { Card } from "@/components/ui/card";
import { AccordionWrapper } from "@/components/ui/accordion-wrapper";
import {
  ArrowLeft,
  Briefcase,
  Target,
  User,
  Coins,
  ShieldCheck,
  Shield,
  AlertTriangle,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cpu,
  Sparkles,
  GitBranch,
  RefreshCw,
  Info,
  Printer,
  FileText,
  Search
} from "lucide-react";
import {
  hiringRequirementService,
  type HiringRequirement,
  type GeneratedArtifacts,
  type CandidateMatch,
  type RequirementArtifact
} from "@/services/hiring-requirement.service";
import { API_URL } from "@/services/axios-client";
import { useStreamingStore } from "@/modules/streaming";

interface JdDetailViewProps {
  workspaceId: string;
  requirementId: string;
  onBack: () => void;
  onEdit: (req: HiringRequirement) => void;
}

export default function JdDetailView({
  workspaceId,
  requirementId,
  onBack,
  onEdit
}: JdDetailViewProps) {
  const params = useParams();
  const router = useRouter();
  const [activeRequirement, setActiveRequirement] = useState<HiringRequirement | null>(null);
  const [artifacts, setArtifacts] = useState<GeneratedArtifacts | null>(null);
  const [candidateMatches, setCandidateMatches] = useState<CandidateMatch[]>([]);
  const [jobPosting, setJobPosting] = useState<any | null>(null);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);

  // Loading states
  const [isLoadingMain, setIsLoadingMain] = useState(true);
  const [isLoadingArtifacts, setIsLoadingArtifacts] = useState(false);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isLoadingJobPosting, setIsLoadingJobPosting] = useState(false);

  // SSE Progress Streaming State
  const [generationProgress, setGenerationProgress] = useState<{
    status: string;
    step: string;
    message: string;
    percentage: number;
  } | null>(null);

  // Token-by-token streaming state
  const [streamedMarkdown, setStreamedMarkdown] = useState<string>("");
  const [isGeneratingJd, setIsGeneratingJd] = useState(false);

  // Navigation tabs
  const [activeArtifactTab, setActiveArtifactTab] = useState<string>("jd");
  const esRef = useRef<EventSource | null>(null);

  // Discovery Run States
  const [discoveryRuns, setDiscoveryRuns] = useState<any[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryProgress, setDiscoveryProgress] = useState<{
    status: string;
    step: string;
    message: string;
    percentage: number;
  } | null>(null);

  // Version Comparison State
  const [selectedCompareVersion, setSelectedCompareVersion] = useState<any | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [rollbackConfirmSnap, setRollbackConfirmSnap] = useState<any | null>(null);

  // Expander state for JD regeneration history runs
  const [expandedRuns, setExpandedRuns] = useState<Record<number, boolean>>({});

  // Expander state for Candidate Matches details
  const [expandedCandidates, setExpandedCandidates] = useState<string[]>([]);

  const toggleCandidateExpand = (candidateId: string) => {
    setExpandedCandidates((prev) =>
      prev.includes(candidateId)
        ? prev.filter((id) => id !== candidateId)
        : [...prev, candidateId]
    );
  };

  // Setup SSE stream for AI generation
  const setupProgressStream = (reqId: string, initialContent = "") => {
    setStreamedMarkdown(initialContent);
    setIsGeneratingJd(true);

    const { useStreamingStore } = require("@/modules/streaming");

    const unsubscribe = useStreamingStore.subscribe((state: any) => {
      const activeSession = state.activeSession;
      if (activeSession && activeSession.id === reqId) {
        if (state.latestTextChunk) {
          setStreamedMarkdown(prev => prev + state.latestTextChunk);
          useStreamingStore.setState({ latestTextChunk: null });
        }

        setGenerationProgress({
          status: activeSession.status,
          step: activeSession.currentStep || "",
          message: activeSession.errorMessage || "",
          percentage: activeSession.progress || 0
        });

        if (activeSession.status === "Completed") {
          setIsGeneratingJd(false);
          setGenerationProgress(null);
          loadRequirementDetails();
          toast.success("AI capability artifacts generated successfully!");
          unsubscribe();
        } else if (activeSession.status === "Failed") {
          setIsGeneratingJd(false);
          setGenerationProgress(null);
          toast.danger(`Generation failed: ${activeSession.errorMessage || "Unknown error"}`);
          unsubscribe();
        } else if (activeSession.status === "Cancelled") {
          setIsGeneratingJd(false);
          setGenerationProgress(null);
          toast.warning("Generation cancelled.");
          loadRequirementDetails();
          unsubscribe();
        }
      }
    });

    useStreamingStore.getState().connectSession("jd-generation", reqId, undefined, reqId);
  };

  const loadMatches = async () => {
    setIsLoadingMatches(true);
    try {
      const matches = await hiringRequirementService.getCandidateMatches(requirementId);
      const sorted = [...matches].sort((a, b) => b.matchScore - a.matchScore);
      setCandidateMatches(sorted);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingMatches(false);
    }
  };

  const loadDiscoveryRuns = async () => {
    setIsLoadingRuns(true);
    try {
      const runs = await hiringRequirementService.getDiscoveryRuns(requirementId);
      setDiscoveryRuns(runs);
    } catch (err) {
      console.error("Failed to load discovery runs", err);
    } finally {
      setIsLoadingRuns(false);
    }
  };

  const setupDiscoveryProgressStream = (reqId: string) => {
    setIsDiscovering(true);

    const { useStreamingStore } = require("@/modules/streaming");

    const unsubscribe = useStreamingStore.subscribe((state: any) => {
      const activeSession = state.activeSession;
      if (activeSession && activeSession.id === reqId) {
        setDiscoveryProgress({
          status: activeSession.status,
          step: activeSession.currentStep || "",
          message: activeSession.errorMessage || "",
          percentage: activeSession.progress || 0
        });

        if (activeSession.status === "Completed") {
          setIsDiscovering(false);
          setDiscoveryProgress(null);
          loadMatches();
          loadDiscoveryRuns();
          toast.success("Candidate matches discovered successfully!");
          unsubscribe();
        } else if (activeSession.status === "Failed") {
          setIsDiscovering(false);
          setDiscoveryProgress(null);
          toast.danger(`Discovery failed: ${activeSession.errorMessage || "Unknown error"}`);
          loadDiscoveryRuns();
          unsubscribe();
        } else if (activeSession.status === "Cancelled") {
          setIsDiscovering(false);
          setDiscoveryProgress(null);
          loadMatches();
          loadDiscoveryRuns();
          unsubscribe();
        }
      }
    });

    useStreamingStore.getState().connectSession("candidate-discovery", reqId, undefined, reqId);
  };

  const handleTriggerDiscovery = async () => {
    setIsDiscovering(true);
    setDiscoveryProgress({
      status: "Running",
      step: "DiscoveryInit",
      message: "Initializing Candidate Discovery Run...",
      percentage: 0
    });
    try {
      await hiringRequirementService.triggerDiscovery(requirementId);
      setupDiscoveryProgressStream(requirementId);
    } catch (err: any) {
      toast.danger(err.message || "Failed to trigger candidate matches discovery.");
      setIsDiscovering(false);
      setDiscoveryProgress(null);
    }
  };

  const loadArtifacts = async (reqOverride?: HiringRequirement) => {
    setIsLoadingArtifacts(true);
    try {
      const arts = await hiringRequirementService.getArtifacts(requirementId);
      setArtifacts(arts);
      
      const req = reqOverride || activeRequirement;
      if (req?.status.toLowerCase() === "published") {
        loadMatches();
      }

      // Check if JobDescription is in Generating or Regenerating state for reconnection
      const jdArtifact = arts?.artifacts?.find(a => a.artifactType === "JobDescription") || arts?.generatedJd;
      if (jdArtifact && (jdArtifact.status === "Generating" || jdArtifact.status === "Regenerating")) {
        setupProgressStream(requirementId, jdArtifact.markdownContent || "");
      }
    } catch (err) {
      setArtifacts(null);
      console.warn("No artifacts generated yet.");
    } finally {
      setIsLoadingArtifacts(false);
    }
  };

  const loadJobPosting = async () => {
    setIsLoadingJobPosting(true);
    try {
      const posting = await hiringRequirementService.getJobPosting(requirementId);
      setJobPosting(posting);
    } catch (err) {
      setJobPosting(null);
    } finally {
      setIsLoadingJobPosting(false);
    }
  };

  const loadRequirementDetails = async () => {
    setIsLoadingMain(true);
    try {
      const req = await hiringRequirementService.getById(requirementId);
      setActiveRequirement(req);
      await loadArtifacts(req);
      await loadJobPosting();
    } catch (err) {
      toast.danger("Failed to load requirement details.");
    } finally {
      setIsLoadingMain(false);
    }
  };

  useEffect(() => {
     
    loadRequirementDetails();
    return () => {
      const { useStreamingStore } = require("@/modules/streaming");
      useStreamingStore.getState().disconnect();
    };
  }, [requirementId]);

  useEffect(() => {
    if (activeRequirement && activeArtifactTab === "matches" && activeRequirement.status.toLowerCase() === "published") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadMatches();
      loadDiscoveryRuns();
    }
  }, [activeArtifactTab, activeRequirement]);

  const handleGenerateRequirements = async () => {
    if (!activeRequirement) return;
    try {
      setStreamedMarkdown("");
      setIsGeneratingJd(true);
      setGenerationProgress({
        status: "Running",
        step: "Initialize",
        message: "Initiating unified requirements package generation...",
        percentage: 0
      });
      await hiringRequirementService.triggerArtifactGeneration(activeRequirement.id);
      setupProgressStream(activeRequirement.id, "");
    } catch (err: any) {
      toast.danger(err.message || "Failed to trigger requirements package generation.");
      setIsGeneratingJd(false);
      setGenerationProgress(null);
    }
  };

  const handleGenerateJd = handleGenerateRequirements;
  const handleGenerateRubric = handleGenerateRequirements;
  const handleGenerateBlueprint = handleGenerateRequirements;

  const handleCreateJobPostingDraft = async () => {
    setIsLoadingJobPosting(true);
    try {
      const draft = await hiringRequirementService.createJobPostingDraft(requirementId);
      toast.success("Job posting draft created successfully!");
      setJobPosting(draft);
      router.push(`/business/${params.organizationSlug}/recruitment/jd/${requirementId}/review`);
    } catch (err: any) {
      toast.danger(err.response?.data?.message || err.message || "Failed to create job posting draft.");
    } finally {
      setIsLoadingJobPosting(false);
    }
  };

  const handleCreateNewVersion = async () => {
    setIsCreatingVersion(true);
    try {
      await hiringRequirementService.createNewVersion(requirementId);
      toast.success("New requirement version draft created successfully!");
      onBack();
    } catch (err: any) {
      toast.danger(err.response?.data?.message || err.message || "Failed to create new version.");
    } finally {
      setIsCreatingVersion(false);
    }
  };

  const handleCancelJdGeneration = async () => {
    if (!activeRequirement) return;
    try {
      await hiringRequirementService.cancelArtifactGeneration(activeRequirement.id, "JobDescription");
      const { useStreamingStore } = require("@/modules/streaming");
      useStreamingStore.getState().disconnect();
      setIsGeneratingJd(false);
      setGenerationProgress(null);
      toast.warning("Job Description generation cancelled.");
      await loadRequirementDetails();
    } catch (err: any) {
      toast.danger(err.message || "Failed to cancel generation.");
    }
  };

  const handlePublish = async () => {
    if (!activeRequirement) return;
    setIsPublishing(true);
    try {
      await hiringRequirementService.publish(activeRequirement.id);
      toast.success("Intake published successfully! Candidate matches are now calculated.");
      await loadRequirementDetails();
      setActiveArtifactTab("matches");
    } catch (err: any) {
      toast.danger(err.message || "Failed to publish hiring requirement.");
    } finally {
      setIsPublishing(false);
    }
  };

  // Rollback to previous version snapshot
  const handleRollback = (snap: any) => {
    setRollbackConfirmSnap(snap);
  };

  const executeRollback = async (snap: any) => {
    if (!activeRequirement || !snap) return;

    try {
      setIsLoadingMain(true);
      
      const outcomes = snap.businessOutcomesJson ? JSON.parse(snap.businessOutcomesJson).map((o: any) => o.Text || o.text) : [];
      const responsibilities = snap.responsibilitiesJson ? JSON.parse(snap.responsibilitiesJson).map((r: any) => ({
        text: r.Text || r.text,
        priority: r.Priority || r.priority,
        ownershipLevel: r.OwnershipLevel || r.ownershipLevel,
        isLeadership: r.IsLeadership || r.isLeadership
      })) : [];
      const capabilities = snap.capabilitiesJson ? JSON.parse(snap.capabilitiesJson).map((c: any) => ({
        capabilityId: c.CapabilityId || c.capabilityId,
        name: c.Name || c.name,
        category: c.Category || c.category,
        priority: c.Priority || c.priority,
        ownershipLevel: c.OwnershipLevel || c.ownershipLevel,
        expectedProficiency: c.ExpectedProficiency || c.expectedProficiency
      })) : [];
      const skills = snap.technologyRequirementsJson ? JSON.parse(snap.technologyRequirementsJson).map((s: any) => ({
        name: s.Name || s.name,
        priority: s.Priority || s.priority,
        sfiaLevel: s.SfiaLevel || s.sfiaLevel
      })) : [];

      await hiringRequirementService.updateDraft(activeRequirement.id, {
        hiringReason: snap.hiringReason,
        businessProblem: snap.businessProblem,
        outcomes,
        responsibilities,
        capabilities,
        skills,
        salaryMin: snap.salaryMin,
        salaryMax: snap.salaryMax,
        currency: snap.currency || "USD",
        timezoneRange: snap.timezoneRange,
        degreeRequirement: snap.degreeRequirement,
        benefits: snap.benefits || [],
        languageRequirements: snap.languageRequirements || []
      });

      toast.success(`Successfully rolled back requirement to version ${snap.version}.`);
      await loadRequirementDetails();
    } catch (err: any) {
      toast.danger(err.message || "Failed to rollback version.");
    } finally {
      setIsLoadingMain(false);
    }
  };

  const getSectionId = (title: string) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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

  // Helper parser for markdown preview
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    return text.split("\n").map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("# ")) {
        const title = trimmed.substring(2).trim();
        return <h1 key={idx} id={getSectionId(title)} className="text-xl font-bold text-foreground mt-6 mb-2 border-b border-border/40 pb-1">{parseInlineMarkdown(title)}</h1>;
      }
      if (trimmed.startsWith("## ")) {
        const title = trimmed.substring(3).trim();
        return <h2 key={idx} id={getSectionId(title)} className="text-sm font-bold text-accent mt-5 mb-2">{parseInlineMarkdown(title)}</h2>;
      }
      if (trimmed.startsWith("### ")) {
        const title = trimmed.substring(4).trim();
        return <h3 key={idx} id={getSectionId(title)} className="text-xs font-semibold text-foreground mt-3 mb-1">{parseInlineMarkdown(title)}</h3>;
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

  if (isLoadingMain) {
    return (
      <Card className="p-12 text-center border border-border/80">
        <Spinner size="md" color="warning" />
        <span className="text-xs font-bold text-muted block mt-2">Loading requirement details...</span>
      </Card>
    );
  }

  if (!activeRequirement) {
    return (
      <Card className="p-12 text-center text-danger border border-border/80 font-bold">
        Hiring requirement not found.
      </Card>
    );
  }

  const isPublished = activeRequirement.status.toLowerCase() === "published";
  const jdArtifact = artifacts?.artifacts?.find(a => a.artifactType === "JobDescription") || artifacts?.generatedJd;
  const hasGenerated = !!jdArtifact;

  // Outline navigation definitions
  const outlineSections = [
    { id: "about-the-role", label: "About the Role", key: "about the role" },
    { id: "business-goals-outcomes", label: "Goals & Outcomes", key: "business goals" },
    { id: "30-60-90-day-milestones", label: "30-60-90 Milestones", key: "30-60-90" },
    { id: "key-responsibilities", label: "Key Responsibilities", key: "responsibilities" },
    { id: "required-capabilities", label: "Required Capabilities", key: "capabilities" },
    { id: "technology-stack", label: "Technology Stack", key: "technology stack" },
    { id: "preferred-skills", label: "Preferred Skills", key: "preferred skills" },
    { id: "experience-requirements", label: "Experience Requirements", key: "experience requirements" },
    { id: "qualifications", label: "Qualifications", key: "qualifications" },
    { id: "soft-skills", label: "Soft Skills", key: "soft skills" },
    { id: "benefits-compensation", label: "Benefits & Compensation", key: "benefits" },
    { id: "hiring-process", label: "Hiring Process", key: "hiring process" }
  ];

  const currentContent = isGeneratingJd ? streamedMarkdown : (jdArtifact?.markdownContent || "");
  const activeOutline = outlineSections.filter(sec => currentContent.toLowerCase().includes(sec.key));

  const renderUnifiedCTA = () => {
    return (
      <Card className="p-12 text-center border border-dashed border-border min-h-[350px] flex flex-col justify-center items-center select-none no-print">
        <div className="size-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-4">
          <Sparkles size={28} />
        </div>
        <Typography type="h4" className="font-bold text-foreground mb-1">Generate AI Requirements Package</Typography>
        <Typography type="body-xs" className="text-muted max-w-md mx-auto mb-6 leading-relaxed font-medium">
          Analyze the requirement taxonomy, business outcomes, and key parameters to automatically compile the Job Description, Evaluation Rubric, and Interview Blueprint together.
        </Typography>
        <Button
          onClick={handleGenerateRequirements}
          className="bg-accent text-accent-foreground font-bold text-xs px-5 py-3 rounded-xl cursor-pointer flex items-center gap-2 hover:opacity-95"
        >
          <Sparkles size={14} /> Generate AI Requirements
        </Button>
      </Card>
    );
  };

  const renderProgressUI = () => {
    return (
      <Card className="p-8 border border-border min-h-[350px] bg-surface select-none no-print flex flex-col justify-center items-center">
        <div className="size-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-4">
          <Sparkles size={28} className="animate-pulse" />
        </div>
        <Typography type="h4" className="font-bold text-foreground mb-1">Generating AI Requirements Package...</Typography>
        <Typography type="body-xs" className="text-muted max-w-sm mx-auto mb-6 text-center leading-relaxed font-medium">
          Claude is analyzing the codebase and requirements to generate the unified Job Description, Assessment Rubric, and Interview Blueprint.
        </Typography>

        {generationProgress && (
          <div className="w-full max-w-md space-y-2">
            <div className="flex justify-between text-xs font-bold text-foreground">
              <span>{generationProgress.message}</span>
              <span className="font-mono">{Math.round(generationProgress.percentage)}%</span>
            </div>
            <div className="w-full bg-separator/50 h-3 rounded-full overflow-hidden">
              <div className="bg-accent h-full rounded-full transition-all duration-300" style={{ width: `${generationProgress.percentage}%` }} />
            </div>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-6 font-outfit text-foreground select-none">
      {/* Print styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          .no-print, header, footer, nav, button, .tabs-container {
            display: none !important;
          }
          .print-content {
            display: block !important;
            width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
          }
        }
      `}} />

      {/* Header toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4 no-print">
        <div className="flex items-center gap-3">
          <Button
            onClick={onBack}
            className="bg-surface border border-border p-2 rounded-xl text-foreground cursor-pointer min-w-0"
          >
            <ArrowLeft size={16} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Typography type="h3" className="font-bold text-foreground">{activeRequirement.title}</Typography>
              <Chip
                size="sm"
                variant="soft"
                className={
                  isPublished
                    ? "bg-success/15 border border-success/30 text-success font-bold"
                    : "bg-default/20 text-foreground font-semibold"
                }
              >
                {activeRequirement.status}
              </Chip>
              <span className="text-xs font-mono font-bold text-accent">v{activeRequirement.version}</span>
            </div>
            <Typography type="body-xs" className="text-muted mt-0.5 font-medium">
              Department: {activeRequirement.department} &bull; Hiring Reason: {activeRequirement.hiringReason || "Team Expansion"}
            </Typography>
          </div>
        </div>

        <div className="flex gap-2">
          {!isPublished ? (
            <>
              <Button
                onClick={() => onEdit(activeRequirement)}
                className="bg-surface text-foreground hover:bg-surface-secondary border border-border font-bold text-xs h-10 px-4 rounded-xl cursor-pointer"
              >
                Edit Requirement
              </Button>
              {hasGenerated && (
                jobPosting ? (
                  <Button
                    onClick={() => router.push(`/business/${params.organizationSlug}/recruitment/jd/${requirementId}/review`)}
                    className="bg-accent text-accent-foreground font-bold text-xs h-10 px-4 rounded-xl cursor-pointer flex items-center gap-1.5 hover:opacity-90 animate-none"
                  >
                    <ExternalLink size={14} /> Review Job Posting
                  </Button>
                ) : (
                  <Button
                    onClick={handleCreateJobPostingDraft}
                    isPending={isLoadingJobPosting}
                    className="bg-accent text-accent-foreground font-bold text-xs h-10 px-4 rounded-xl cursor-pointer flex items-center gap-1.5 hover:opacity-90 animate-none"
                  >
                    <Sparkles size={14} /> Create Job Posting Draft
                  </Button>
                )
              )}
            </>
          ) : (
            <Button
              onClick={handleCreateNewVersion}
              isPending={isCreatingVersion}
              className="bg-accent text-accent-foreground font-bold text-xs h-10 px-4 rounded-xl cursor-pointer flex items-center gap-1.5 hover:opacity-90 animate-none"
            >
              <GitBranch size={14} /> Create New Version
            </Button>
          )}
        </div>
      </div>

      {/* Main Dashboard Details Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Summary Parameters */}
        <div className="lg:col-span-3 space-y-6 no-print">
          <Card className="p-5 border border-border space-y-4">
            <span className="text-[10px] font-bold text-accent uppercase tracking-wider block">Intake Parameters</span>
            <div className="space-y-3.5 text-xs select-text">
              <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <span className="font-bold text-muted">Seniority</span>
                <span className="font-semibold text-foreground">{activeRequirement.seniority}</span>
              </div>
              <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <span className="font-bold text-muted">Workplace Model</span>
                <span className="font-semibold text-foreground">
                  {activeRequirement.workplaceType} {activeRequirement.city && `(${activeRequirement.city})`}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <span className="font-bold text-muted">Employment Type</span>
                <span className="font-semibold text-foreground">{activeRequirement.employmentType}</span>
              </div>
              <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <span className="font-bold text-muted">Timezone Target</span>
                <span className="font-semibold text-foreground">{activeRequirement.timezoneRange || "Unspecified"}</span>
              </div>
              <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <span className="font-bold text-muted">Budget Bounds</span>
                <span className="font-bold text-success">
                  {activeRequirement.salaryMin && activeRequirement.salaryMax
                    ? `${activeRequirement.salaryMin} - ${activeRequirement.salaryMax} ${activeRequirement.currency}`
                    : "Negotiable"}
                </span>
              </div>
              <div className="flex justify-between items-center pb-1">
                <span className="font-bold text-muted">Degree Requirement</span>
                <span className="font-semibold text-foreground">{activeRequirement.degreeRequirement || "No Degree Required"}</span>
              </div>
            </div>
          </Card>

          {/* Capabilities Taxonomy */}
          <Card className="p-5 border border-border space-y-3">
            <span className="text-[10px] font-bold text-accent uppercase tracking-wider block">Required Capabilities Taxonomy</span>
            <div className="space-y-2.5">
              {activeRequirement.capabilities.map((cap) => (
                <div key={cap.id} className="p-2.5 bg-surface-secondary/40 border border-border/60 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-foreground block">{cap.name}</span>
                    <span className="text-[9px] text-muted font-semibold block mt-0.5">Category: {cap.category}</span>
                  </div>
                  <Chip size="sm" className="bg-accent/10 border border-accent/20 text-accent font-bold text-[9px] px-1.5 py-0.5">
                    L{cap.expectedProficiency} &bull; {cap.ownershipLevel}
                  </Chip>
                </div>
              ))}
            </div>
          </Card>

          {/* Business Outcomes */}
          <Card className="p-5 border border-border space-y-3">
            <span className="text-[10px] font-bold text-accent uppercase tracking-wider block">Target Outcomes</span>
            <div className="space-y-2">
              {activeRequirement.businessOutcomes.map((out) => (
                <div key={out.id} className="flex gap-2 text-xs font-semibold text-foreground/85 leading-normal">
                  <Target size={14} className="text-accent mt-0.5 shrink-0" />
                  <span>{out.text}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Side: Tab panel and Artifacts View */}
        <div className="lg:col-span-9 space-y-4 print-content">
          <div className="tabs-container no-print">
            <Tabs
              selectedKey={activeArtifactTab}
              onSelectionChange={(k) => {
                setActiveArtifactTab(k.toString());
                setIsComparing(false);
              }}
              className="w-full"
            >
              <Tabs.ListContainer>
                <Tabs.List aria-label="Requirement Artifacts" className="flex border-b border-border mb-4 select-none">
                  <Tabs.Tab id="jd" className="px-4 py-2 text-xs font-semibold cursor-pointer data-[selected=true]:text-accent">
                    Job Description Text
                    <Tabs.Indicator className="h-0.5 bg-accent" />
                  </Tabs.Tab>
                  <Tabs.Tab id="rubric" className="px-4 py-2 text-xs font-semibold cursor-pointer data-[selected=true]:text-accent">
                    Assessment Rubric
                    <Tabs.Indicator className="h-0.5 bg-accent" />
                  </Tabs.Tab>
                  <Tabs.Tab id="blueprint" className="px-4 py-2 text-xs font-semibold cursor-pointer data-[selected=true]:text-accent">
                    Interview Blueprint
                    <Tabs.Indicator className="h-0.5 bg-accent" />
                  </Tabs.Tab>
                  {isPublished && (
                    <Tabs.Tab id="matches" className="px-4 py-2 text-xs font-semibold cursor-pointer data-[selected=true]:text-accent">
                      Candidate Matches
                      <Tabs.Indicator className="h-0.5 bg-accent" />
                    </Tabs.Tab>
                  )}
                  <Tabs.Tab id="history" className="px-4 py-2 text-xs font-semibold cursor-pointer data-[selected=true]:text-accent">
                    Version History
                    <Tabs.Indicator className="h-0.5 bg-accent" />
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>
          </div>

          {/* JD Tab Panel */}
          {activeArtifactTab === "jd" && (
            <div className="space-y-4">
              {isGeneratingJd ? (
                // Streaming JD token-by-token state
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  <div className="md:col-span-9 space-y-4 print-content">
                    <Card className="p-6 border border-border min-h-[350px] bg-surface select-text relative">
                      {/* Document Toolbar / Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4 mb-4 select-none no-print">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-warning/10 text-warning">
                            <Sparkles size={16} className="animate-pulse" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-foreground block">AI Generating Job Description...</span>
                            <span className="text-[10px] text-muted block mt-0.5 font-medium">Writing recruiter-ready draft artifact</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            onClick={handleCancelJdGeneration}
                            className="bg-danger/10 hover:bg-danger/25 text-danger border border-danger/20 text-[10px] font-bold rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1 min-w-0"
                          >
                            Cancel Generation
                          </Button>
                        </div>
                      </div>

                      {/* Generation Header Progress */}
                      {generationProgress && (
                        <div className="mb-4 p-3.5 bg-accent/5 border border-accent/15 rounded-xl flex items-center justify-between gap-3 no-print">
                          <div className="flex items-center gap-2">
                            <Spinner size="sm" color="warning" />
                            <div className="text-[10px] font-bold text-foreground">
                              Claude is writing: <span className="text-muted font-normal">{generationProgress.message}</span>
                            </div>
                          </div>
                          <span className="text-xs font-mono font-bold text-accent">{Math.round(generationProgress.percentage)}%</span>
                        </div>
                      )}

                      <div className="prose prose-sm max-w-none pt-2 font-sans leading-relaxed select-text">
                        {streamedMarkdown ? renderMarkdown(streamedMarkdown) : (
                          <div className="text-xs text-muted italic p-4 text-center">Waiting for AI stream...</div>
                        )}
                      </div>
                    </Card>
                  </div>

                  {/* Outline side navigation during streaming */}
                  <div className="md:col-span-3 space-y-4 no-print sticky top-6">
                    <Card className="p-4 border border-border bg-surface-secondary/20 select-none">
                      <span className="text-[10px] font-bold text-accent uppercase tracking-wider block mb-3">Outline Navigation</span>
                      <div className="flex flex-col space-y-1.5 text-xs font-semibold">
                        {activeOutline.map((sec) => (
                          <button
                            key={sec.id}
                            onClick={() => scrollToSection(sec.id)}
                            className="text-left text-foreground/80 hover:text-accent font-medium hover:underline py-1 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <div className="size-1 rounded-full bg-accent" />
                            <span className="truncate">{sec.label}</span>
                          </button>
                        ))}
                        {activeOutline.length === 0 && (
                          <span className="text-[10px] text-muted italic">Streaming sections...</span>
                        )}
                      </div>
                    </Card>
                  </div>
                </div>
              ) : jdArtifact ? (
                // Completed JD View
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  <div className="md:col-span-9 space-y-4 print-content">
                    <Card className="p-6 border border-border min-h-[350px] bg-surface select-text relative">
                      {/* Document Toolbar / Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4 mb-4 select-none no-print">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-warning/10 text-warning">
                            <Sparkles size={16} />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-foreground block">AI Generated Job Description</span>
                            <span className="text-[10px] text-muted block mt-0.5 font-medium">Recruiter-ready draft artifact</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(jdArtifact.markdownContent);
                              toast.success("Copied to clipboard!");
                            }}
                            className="bg-surface text-foreground hover:bg-surface-secondary border border-border text-[10px] font-bold rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1 min-w-0"
                          >
                            <Copy size={12} /> Copy JD
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => window.print()}
                            className="bg-surface text-foreground hover:bg-surface-secondary border border-border text-[10px] font-bold rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1 min-w-0"
                          >
                            <Printer size={12} /> Print
                          </Button>
                          {!isPublished && (
                            <Button
                              size="sm"
                              onClick={handleGenerateJd}
                              className="bg-accent/15 hover:bg-accent/25 text-accent border border-accent/20 text-[10px] font-bold rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1 min-w-0"
                            >
                              <RefreshCw size={12} /> Regenerate
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Telemetry metadata stats block */}
                      {jdArtifact.generationMetadata && (
                        <div className="mb-4 p-3 bg-surface-secondary/40 border border-border/60 rounded-xl text-[10px] font-semibold text-muted flex flex-wrap gap-x-4 gap-y-1.5 select-none no-print items-center justify-between">
                          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                            <span className="flex items-center gap-1"><Cpu size={12} className="text-accent" /> Model: {jdArtifact.modelInfo || "Claude 3.5 Sonnet"}</span>
                            <span>Version: {jdArtifact.promptVersion || "1.2"}</span>
                            <span>Tokens: {jdArtifact.generationMetadata.inputTokens} In / {jdArtifact.generationMetadata.outputTokens} Out</span>
                            <span>Cost: ${jdArtifact.generationMetadata.estimatedCostUsd?.toFixed(4)}</span>
                          </div>
                          <span className="text-accent font-bold">Duration: {(jdArtifact.generationMetadata.durationMs / 1000).toFixed(1)}s</span>
                        </div>
                      )}

                      <div className="prose prose-sm max-w-none pt-2 font-sans leading-relaxed select-text">
                        {renderMarkdown(jdArtifact.markdownContent)}
                      </div>
                    </Card>
                  </div>

                  {/* Outline side navigation sidebar */}
                  <div className="md:col-span-3 space-y-4 no-print sticky top-6">
                    <Card className="p-4 border border-border bg-surface-secondary/20 select-none">
                      <span className="text-[10px] font-bold text-accent uppercase tracking-wider block mb-3">Outline Navigation</span>
                      <div className="flex flex-col space-y-1.5 text-xs font-semibold">
                        {activeOutline.map((sec) => (
                          <button
                            key={sec.id}
                            onClick={() => scrollToSection(sec.id)}
                            className="text-left text-foreground/80 hover:text-accent font-medium hover:underline py-1 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <div className="size-1 rounded-full bg-accent" />
                            <span className="truncate">{sec.label}</span>
                          </button>
                        ))}
                      </div>
                    </Card>
                  </div>
                </div>
              ) : (
                renderUnifiedCTA()
              )}
            </div>
          )}

          {/* Rubric Tab Panel */}
          {activeArtifactTab === "rubric" && (
            <div className="space-y-4">
              {isGeneratingJd ? (
                renderProgressUI()
              ) : !hasGenerated ? (
                renderUnifiedCTA()
              ) : artifacts?.rubric ? (
                <Card className="p-6 border border-border min-h-[350px] space-y-6">
                  <div>
                    <span className="text-xs font-bold text-foreground block">Dynamic Capability Assessment Weights</span>
                    <span className="text-[10px] text-muted block leading-relaxed font-semibold">
                      Calculated based on Priority, Outcomes, and Seniority calibration rules.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(artifacts?.rubric?.capabilityWeights || {}).map(([capId, weight]) => {
                      const detail = activeRequirement.capabilities.find((c) => c.capabilityId === capId);
                      return (
                        <div key={capId} className="p-3.5 bg-surface-secondary/40 border border-border/60 rounded-xl space-y-2 select-text">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-foreground truncate max-w-[70%]">{detail?.name || capId}</span>
                            <span className="text-xs font-bold text-accent">{(weight * 100).toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-separator/50 h-2 rounded-full overflow-hidden">
                            <div className="bg-accent h-full rounded-full" style={{ width: `${weight * 100}%` }} />
                          </div>
                          
                          <div className="pt-1.5 border-t border-border/30 flex items-start gap-1 text-[9px] text-muted leading-normal font-semibold">
                            <Info size={10} className="text-accent shrink-0 mt-0.5" />
                            <span>
                              {weight > 0.3 
                                ? `High priority because it is central to solving your business goals.` 
                                : `Supporting skill capability representing general seniority requirement.`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-4 pt-4 border-t border-border/50">
                    <div>
                      <span className="text-xs font-bold text-foreground block">Assessment & Evidence Signals</span>
                      <span className="text-[10px] text-muted block font-semibold">Git repository matching criteria mapping:</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border text-muted font-bold text-[10px] uppercase">
                            <th className="pb-2">Evidence Signal</th>
                            <th className="pb-2">Target Metric</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(artifacts?.rubric?.evidenceRequirements || []).map((er, idx) => (
                            <tr key={idx} className="border-b border-border/30 last:border-b-0 hover:bg-surface-secondary/20 select-text">
                              <td className="py-2.5 font-semibold text-foreground">{er.signalType}</td>
                              <td className="py-2.5 text-muted font-medium">{er.expectedMetric}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Card>
              ) : (
                renderUnifiedCTA()
              )}
            </div>
          )}

          {/* Blueprint Tab Panel */}
          {activeArtifactTab === "blueprint" && (
            <div className="space-y-4">
              {isGeneratingJd ? (
                renderProgressUI()
              ) : !hasGenerated ? (
                renderUnifiedCTA()
              ) : artifacts?.interviewBlueprint ? (
                <Card className="p-6 border border-border min-h-[350px] space-y-4">
                  <div>
                    <span className="text-xs font-bold text-foreground block">Technical & Behavioral Interview Blueprint</span>
                    <span className="text-[10px] text-muted block leading-relaxed font-semibold">
                      Standardized prompt questions calibrated to mapped capability taxonomy.
                    </span>
                  </div>

                  <AccordionWrapper
                    variant="surface"
                    className="w-full"
                    items={(artifacts.interviewBlueprint.questions || []).map((q, idx) => {
                      const capDetail = activeRequirement.capabilities.find((c) => c.capabilityId === q.capabilityId);
                      return {
                        id: idx.toString(),
                        title: capDetail?.name || q.capabilityId,
                        icon: <Cpu size={16} className="text-accent" />,
                        content: (
                          <div className="space-y-3.5 text-xs text-foreground select-text">
                            <div className="space-y-1">
                              <span className="font-bold text-foreground">Interview Prompt Question:</span>
                              <p className="text-muted leading-relaxed font-semibold">{q.questionText}</p>
                            </div>
                            <div className="space-y-1 p-3 bg-surface rounded-xl border border-border">
                              <span className="font-bold text-accent text-[10px] uppercase block tracking-wider mb-1">Grading Rubric</span>
                              <p className="text-muted leading-relaxed font-semibold">{q.gradingRubric}</p>
                            </div>
                          </div>
                        )
                      };
                    })}
                  />
                </Card>
              ) : (
                renderUnifiedCTA()
              )}
            </div>
          )}

          {/* Candidate Matches Tab */}
          {activeArtifactTab === "matches" && isPublished && (
            <div className="space-y-4 no-print">
              {/* Manual Discover CTA Header Card */}
              <Card className="p-5 border border-border bg-surface">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
                  <div>
                    <Typography type="body-sm" className="font-bold text-foreground block">
                      Candidate Discovery Engine
                    </Typography>
                    <Typography type="body-xs" className="text-muted font-medium mt-0.5">
                      Manually trigger the matching pipeline to identify, align, and rank candidate profiles across the workspace.
                    </Typography>
                  </div>
                  <Button
                    onClick={handleTriggerDiscovery}
                    isPending={isDiscovering}
                    className="bg-accent text-accent-foreground font-bold text-xs h-10 px-5 rounded-xl cursor-pointer flex items-center gap-2 hover:opacity-90 transition-all select-none shrink-0 animate-none"
                  >
                    <Search size={14} /> Find Candidates
                  </Button>
                </div>
              </Card>

              {/* Streaming Progress State */}
              {isDiscovering && (
                <Card className="p-5 border border-border bg-surface select-none no-print flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-3">
                    <Spinner size="sm" color="warning" />
                    <div>
                      <span className="text-xs font-bold text-foreground block">Running Candidate Discovery Pipeline...</span>
                      <span className="text-[10px] text-muted block mt-0.5 font-medium">
                        {discoveryProgress?.message || "Executing vector match analysis..."}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="w-full bg-separator/50 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-accent h-full rounded-full transition-all duration-300"
                        style={{ width: `${discoveryProgress?.percentage || 0}%` }}
                      />
                    </div>
                    
                    {/* Multi-step progress tracker */}
                    <div className="flex items-center justify-between text-[10px] font-semibold text-muted pt-1">
                      <div className="flex items-center gap-1">
                        <div className={`size-2 rounded-full ${
                          discoveryProgress?.step === "Searching" ? "bg-accent animate-pulse" :
                          (discoveryProgress?.percentage && discoveryProgress.percentage > 20) ? "bg-success" : "bg-border"
                        }`} />
                        <span>1. Search Candidates</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={`size-2 rounded-full ${
                          discoveryProgress?.step === "Matching" ? "bg-accent animate-pulse" :
                          (discoveryProgress?.percentage && discoveryProgress.percentage > 50) ? "bg-success" : "bg-border"
                        }`} />
                        <span>2. Match Profiles</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={`size-2 rounded-full ${
                          discoveryProgress?.step === "Ranking" ? "bg-accent animate-pulse" :
                          (discoveryProgress?.percentage && discoveryProgress.percentage > 80) ? "bg-success" : "bg-border"
                        }`} />
                        <span>3. Rank Fits</span>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Latest Run Stats / Telemetry History */}
              {discoveryRuns.length > 0 && !isDiscovering && (
                (() => {
                  const latestRun = discoveryRuns[0];
                  const isCompleted = latestRun.status === 5;
                  const isFailed = latestRun.status === 6;
                  const startedTime = new Date(latestRun.startedAt).toLocaleString();

                  return (
                    <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-[11px] font-medium select-text ${
                      isCompleted ? "bg-success/5 border-success/20 text-success" :
                      isFailed ? "bg-danger/5 border-danger/20 text-danger" :
                      "bg-warning/5 border-warning/20 text-warning"
                    }`}>
                      <div className="flex items-center gap-2">
                        <Info size={14} className="shrink-0" />
                        <div>
                          <span>
                            Latest Discovery Run: <strong>{isCompleted ? "Completed" : isFailed ? "Failed" : "Running"}</strong> at {startedTime}
                          </span>
                          {isCompleted && (
                            <span className="block mt-0.5 text-muted font-normal text-[10px]">
                              Found {latestRun.candidatesFoundCount} candidates &bull; {latestRun.matchQualitySummary || "No quality summary details"}
                            </span>
                          )}
                          {isFailed && latestRun.errorMessage && (
                            <span className="block mt-0.5 font-mono text-[10px]">
                              Error details: {latestRun.errorMessage}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}

              {/* Matches list */}
              {isLoadingMatches ? (
                <Card className="p-8 text-center min-h-[350px] flex items-center justify-center">
                  <div className="space-y-3">
                    <Spinner size="lg" color="warning" />
                    <span className="text-xs font-bold text-muted block">Comparing candidates against capability profile...</span>
                  </div>
                </Card>
              ) : candidateMatches.length === 0 ? (
                <Card className="p-12 text-center border border-dashed border-border min-h-[350px] flex flex-col justify-center items-center">
                  <div className="size-12 rounded-xl bg-accent/15 text-accent flex items-center justify-center mx-auto mb-4">
                    <User size={24} />
                  </div>
                  <Typography type="h4" className="font-bold text-foreground mb-1">No Candidate Matches Found</Typography>
                  <Typography type="body-xs" className="text-muted max-w-sm mx-auto font-medium text-center">
                    Ensure there are candidates with completed repository analysis assessments in this workspace, then click "Find Candidates" to discover matches.
                  </Typography>
                </Card>
              ) : (
                <div className="space-y-4">
                  {candidateMatches.map((match) => {
                    const isHighTrust = match.trustLevel >= 70 || (match.trustLevel >= 0.7 && match.trustLevel <= 1.0);
                    const isMedTrust = (match.trustLevel >= 40 && match.trustLevel < 70) || (match.trustLevel >= 0.4 && match.trustLevel < 0.7);
                    const isExpanded = expandedCandidates.includes(match.candidateId);
                    
                    const formatScore = (val: number) => {
                      if (val <= 1.0 && val > 0) return `${(val * 100).toFixed(0)}%`;
                      return `${val.toFixed(0)}%`;
                    };

                    return (
                      <Card key={match.candidateId} className="p-5 border border-border bg-surface space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
                          <div className="flex items-center gap-3">
                            <div className="size-10 rounded-full bg-accent/15 text-accent flex items-center justify-center font-bold text-sm select-none shrink-0">
                              {match.fullName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .substring(0, 2)
                                .toUpperCase()}
                            </div>
                            <div>
                              <Typography type="body-sm" className="font-bold text-foreground block">
                                {match.fullName}
                              </Typography>
                              <Typography type="body-xs" className="text-muted font-medium">
                                {match.headline || "Software Engineer"} &bull; {match.careerLevelLabel || match.careerLevel || "L3 - Senior"}
                              </Typography>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
                            <div className="text-right">
                              <span className="text-[10px] text-muted font-bold block uppercase tracking-wider">Match Score</span>
                              <span className="text-lg font-mono font-bold text-accent">{formatScore(match.matchScore)}</span>
                            </div>
                            <div className="text-right border-l border-border pl-3 pr-2">
                              <span className="text-[10px] text-muted font-bold block uppercase tracking-wider">Trust Level</span>
                              <span className="text-xs font-semibold text-foreground flex items-center justify-end gap-1">
                                {isHighTrust ? (
                                  <span className="text-success flex items-center gap-0.5"><ShieldCheck size={12} /> High</span>
                                ) : isMedTrust ? (
                                  <span className="text-warning flex items-center gap-0.5"><Shield size={12} /> Medium</span>
                                ) : (
                                  <span className="text-muted flex items-center gap-0.5"><Shield size={12} /> Low</span>
                                )}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleCandidateExpand(match.candidateId)}
                              className={`text-xs font-bold px-4 py-2 rounded-xl cursor-pointer min-w-[100px] border-none ${
                                isExpanded ? "bg-default text-foreground hover:bg-default/80" : "bg-accent/15 text-accent hover:bg-accent/20"
                              }`}
                            >
                              {isExpanded ? "Hide Details" : "View Details"}
                            </Button>
                          </div>
                        </div>

                        {/* Collapsible Candidate Details Section */}
                        {isExpanded && (
                          <div className="border-t border-border/50 pt-4 space-y-4">
                            {/* Breakdown stats bar */}
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 bg-surface-secondary/40 p-3 rounded-xl border border-border/60 text-center select-none">
                              <div className="space-y-0.5">
                                <span className="text-[9px] text-muted font-bold uppercase block tracking-wider">Capabilities</span>
                                <span className="text-xs font-bold text-foreground">{formatScore(match.breakdown.capabilitiesScore)}</span>
                              </div>
                              <div className="space-y-0.5">
                                <span className="text-[9px] text-muted font-bold uppercase block tracking-wider">Tech Stack</span>
                                <span className="text-xs font-bold text-foreground">{formatScore(match.breakdown.skillsScore)}</span>
                              </div>
                              <div className="space-y-0.5">
                                <span className="text-[9px] text-muted font-bold uppercase block tracking-wider">Duties</span>
                                <span className="text-xs font-bold text-foreground">{formatScore(match.breakdown.responsibilitiesScore)}</span>
                              </div>
                              <div className="space-y-0.5">
                                <span className="text-[9px] text-muted font-bold uppercase block tracking-wider">Salary Fit</span>
                                <span className="text-xs font-bold text-foreground">{formatScore(match.breakdown.salaryScore)}</span>
                              </div>
                              <div className="space-y-0.5">
                                <span className="text-[9px] text-muted font-bold uppercase block tracking-wider">Cosine Fit</span>
                                <span className="text-xs font-bold text-foreground">{formatScore(match.breakdown.cosineSimilarity)}</span>
                              </div>
                              <div className="space-y-0.5">
                                <span className="text-[9px] text-muted font-bold uppercase block tracking-wider">Gap Score</span>
                                <span className="text-xs font-bold text-foreground">{formatScore(match.breakdown.gapScore)}</span>
                              </div>
                            </div>

                            {/* Expandable Evidence Traces */}
                            <div className="space-y-2">
                              <span className="text-[10px] text-muted font-bold uppercase block select-none tracking-wider">Evidence Traceability Chain</span>
                              <AccordionWrapper
                                variant="surface"
                                className="w-full"
                                items={match.traces.map((trace, tIdx) => {
                                  let statusColor = "bg-default/20 text-foreground font-semibold";
                                  if (trace.matchStatus === "Verified") {
                                    statusColor = "bg-success/15 border border-success/30 text-success font-bold";
                                  } else if (trace.matchStatus === "Self-Declared") {
                                    statusColor = "bg-warning/15 border border-warning/30 text-warning font-bold";
                                  } else if (trace.matchStatus === "Missing") {
                                    statusColor = "bg-danger/10 border border-danger/20 text-danger font-bold";
                                  }

                                  return {
                                    id: `${match.candidateId}-trace-${tIdx}`,
                                    title: trace.capabilityName || trace.capabilityId,
                                    icon: trace.matchStatus === "Verified" ? (
                                      <ShieldCheck size={14} className="text-success" />
                                    ) : trace.matchStatus === "Self-Declared" ? (
                                      <User size={14} className="text-warning" />
                                    ) : (
                                      <AlertTriangle size={14} className="text-danger" />
                                    ),
                                    content: (
                                      <div className="space-y-3.5 text-xs text-foreground select-text font-outfit">
                                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                                          <div className="flex items-center gap-2">
                                            <span className="font-bold text-muted">Status:</span>
                                            <Chip size="sm" variant="soft" className={statusColor}>
                                              {trace.matchStatus}
                                            </Chip>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="font-bold text-muted">Confidence:</span>
                                            <span className="font-mono font-bold text-accent">{(trace.confidence * 100).toFixed(0)}%</span>
                                          </div>
                                        </div>

                                        <div className="space-y-1">
                                          <span className="font-bold text-muted font-outfit">Repository Trace Signal:</span>
                                          <p className="font-semibold text-foreground bg-surface border border-border/80 p-2.5 rounded-lg font-mono text-[10px] break-all leading-normal">
                                            {trace.metric || "No active repository signal matching this capability."}
                                          </p>
                                        </div>

                                        {trace.targetFile && (
                                          <div className="space-y-1 font-outfit">
                                            <span className="font-bold text-muted">Codebase Reference:</span>
                                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-accent font-semibold hover:underline">
                                              <ExternalLink size={10} className="shrink-0" />
                                              <a href={trace.targetFile} target="_blank" rel="noopener noreferrer" className="break-all">
                                                {trace.targetFile.split("/").pop() || trace.targetFile}
                                              </a>
                                            </div>
                                          </div>
                                        )}

                                        <div className="space-y-1">
                                          <span className="font-bold text-muted font-outfit">AI Matching Rationale:</span>
                                          <p className="text-muted leading-relaxed font-semibold font-outfit">
                                            {trace.rationale || "No trace analysis extracted."}
                                          </p>
                                        </div>
                                      </div>
                                    )
                                  };
                                })}
                              />
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Version History & Rollback Tab Panel */}
          {activeArtifactTab === "history" && (
            <div className="space-y-6 no-print">
              {isComparing && selectedCompareVersion ? (
                <Card className="p-6 border border-border space-y-4">
                  <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-2">
                    <div className="flex items-center gap-2">
                      <GitBranch size={16} className="text-accent" />
                      <Typography type="h4" className="font-bold text-foreground">
                        Comparing Current (v{activeRequirement.version}) vs Snapshot (v{selectedCompareVersion.version})
                      </Typography>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setIsComparing(false)}
                      className="bg-transparent border border-border text-foreground hover:bg-surface-secondary text-[10px] font-bold rounded-lg px-2.5 py-1.5 cursor-pointer"
                    >
                      Back to history
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs select-text">
                    <div className="p-4 bg-surface-secondary/40 border border-border/80 rounded-xl space-y-3">
                      <span className="text-[10px] font-bold text-accent uppercase tracking-wider block">Current Setup (v{activeRequirement.version})</span>
                      <div className="space-y-2">
                        <div><strong className="text-muted">Title:</strong> <span className="font-semibold">{activeRequirement.title}</span></div>
                        <div><strong className="text-muted">Seniority:</strong> <span className="font-semibold">{activeRequirement.seniority}</span></div>
                        <div><strong className="text-muted">Workplace:</strong> <span className="font-semibold">{activeRequirement.workplaceType}</span></div>
                        <div><strong className="text-muted">Salary:</strong> <span className="font-semibold">{activeRequirement.salaryMin} - {activeRequirement.salaryMax} {activeRequirement.currency}</span></div>
                        <div><strong className="text-muted">Problem Statement:</strong> <p className="text-muted mt-1 leading-relaxed">{activeRequirement.businessProblem}</p></div>
                      </div>
                    </div>

                    <div className="p-4 bg-surface-secondary/40 border border-border/80 rounded-xl space-y-3">
                      <span className="text-[10px] font-bold text-accent uppercase tracking-wider block">Version Snapshot (v{selectedCompareVersion.version})</span>
                      <div className="space-y-2">
                        <div><strong className="text-muted">Title:</strong> <span className="font-semibold">{selectedCompareVersion.title}</span></div>
                        <div><strong className="text-muted">Seniority:</strong> <span className="font-semibold">{selectedCompareVersion.seniority}</span></div>
                        <div><strong className="text-muted">Workplace:</strong> <span className="font-semibold">{selectedCompareVersion.workplaceType}</span></div>
                        <div><strong className="text-muted">Salary:</strong> <span className="font-semibold">{selectedCompareVersion.salaryMin} - {selectedCompareVersion.salaryMax} {selectedCompareVersion.currency}</span></div>
                        <div><strong className="text-muted">Problem Statement:</strong> <p className="text-muted mt-1 leading-relaxed">{selectedCompareVersion.businessProblem}</p></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 border-t border-border/40 pt-4">
                    <Button
                      onClick={() => handleRollback(selectedCompareVersion)}
                      className="bg-accent text-accent-foreground text-xs font-bold py-2 px-4 rounded-xl cursor-pointer hover:opacity-90"
                    >
                      Restore to version v{selectedCompareVersion.version}
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="space-y-6">
                  {/* Snapshots Table */}
                  <Card className="p-0 overflow-hidden border border-border">
                    {(!activeRequirement.snapshots || activeRequirement.snapshots.length === 0) ? (
                      <div className="p-12 text-center select-none flex flex-col justify-center items-center h-full">
                        <GitBranch size={32} className="text-muted/40 mb-3 animate-pulse" />
                        <Typography type="h4" className="font-bold text-foreground mb-1">No Snapshots Found</Typography>
                        <Typography type="body-xs" className="text-muted max-w-sm mx-auto font-semibold">
                          Versions are saved automatically when requirement files are published.
                        </Typography>
                      </div>
                    ) : (
                      <div className="overflow-x-auto select-none">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-border bg-surface-secondary/50 font-bold text-muted uppercase tracking-wider text-[10px]">
                              <th className="p-4">Version</th>
                              <th className="p-4">Published At</th>
                              <th className="p-4">Role Title</th>
                              <th className="p-4">Seniority</th>
                              <th className="p-4">Model</th>
                              <th className="p-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeRequirement.snapshots
                              .slice()
                              .sort((a, b) => b.version - a.version)
                              .map((snap) => (
                                <tr key={snap.id} className="border-b border-border/60 hover:bg-surface-secondary/35 transition-colors">
                                  <td className="p-4 font-mono font-bold text-accent">v{snap.version}</td>
                                  <td className="p-4 text-muted font-medium">
                                    {new Date(snap.snapshottedAt).toLocaleString()}
                                  </td>
                                  <td className="p-4 font-bold text-foreground">{snap.title}</td>
                                  <td className="p-4 font-medium text-foreground/80">{snap.seniority}</td>
                                  <td className="p-4 font-medium text-muted">{snap.workplaceType}</td>
                                  <td className="p-4 text-right flex justify-end gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setSelectedCompareVersion(snap);
                                        setIsComparing(true);
                                      }}
                                      className="bg-default hover:bg-surface-tertiary border border-border text-[10px] font-bold rounded-lg px-2.5 py-1.5 cursor-pointer"
                                    >
                                      Compare
                                    </Button>
                                    {!isPublished && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleRollback(snap)}
                                        className="bg-accent text-accent-foreground text-[10px] font-bold rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1"
                                      >
                                        <RefreshCw size={10} /> Restore
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>

                  {/* JD Regeneration History list with expander details */}
                  {jdArtifact?.regenerationHistory && jdArtifact.regenerationHistory.length > 0 && (
                    <div className="space-y-4">
                      <div>
                        <span className="text-xs font-bold text-foreground block">AI Job Description Generation History</span>
                        <span className="text-[10px] text-muted block font-semibold leading-relaxed">
                          Review previous drafts generated by the AI models before the final publishing step.
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        {jdArtifact.regenerationHistory.map((run: any, rIdx: number) => {
                          const isExpanded = expandedRuns[rIdx] || false;
                          return (
                            <Card key={rIdx} className="p-4 border border-border bg-surface">
                              <div className="flex items-center justify-between select-none">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-foreground">Generation Run #{(jdArtifact.regenerationHistory?.length ?? 0) - rIdx}</span>
                                    <Chip size="sm" variant="soft" className="bg-default/20 text-foreground text-[9px] font-semibold">
                                      {run.modelInfo || "Claude 3.5 Sonnet"}
                                    </Chip>
                                  </div>
                                  <span className="text-[10px] text-muted block font-medium">
                                    Generated: {new Date(run.timestamp).toLocaleString()} &bull; Version: {run.promptVersion || "1.2"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => setExpandedRuns(prev => ({ ...prev, [rIdx]: !isExpanded }))}
                                    className="bg-surface hover:bg-surface-secondary border border-border text-[10px] font-bold rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1"
                                  >
                                    {isExpanded ? "Collapse Content" : "View Content"}
                                  </Button>
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="mt-4 border-t border-border/50 pt-4 space-y-4 animate-none">
                                  {/* Metadata specs */}
                                  {run.generationMetadata && (
                                    <div className="p-2.5 bg-surface-secondary/40 border border-border/60 rounded-lg text-[10px] font-semibold text-muted flex flex-wrap gap-x-4 gap-y-1.5">
                                      <span>Cost: ${run.generationMetadata.estimatedCostUsd?.toFixed(4)}</span>
                                      <span>Input Tokens: {run.generationMetadata.inputTokens}</span>
                                      <span>Output Tokens: {run.generationMetadata.outputTokens}</span>
                                      <span>Duration: {(run.generationMetadata.durationMs / 1000).toFixed(1)}s</span>
                                    </div>
                                  )}

                                  {/* Markdown rendering */}
                                  <div className="prose prose-sm max-w-none max-h-[300px] overflow-y-auto font-sans leading-relaxed border border-border/40 p-3 rounded-lg bg-surface-secondary/10">
                                    {renderMarkdown(run.markdownContent)}
                                  </div>
                                </div>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {rollbackConfirmSnap && (
        <AlertDialog.Backdrop
          isOpen={!!rollbackConfirmSnap}
          onOpenChange={(open) => {
            if (!open) setRollbackConfirmSnap(null);
          }}
        >
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-[400px] no-print">
              {(renderProps) => (
                <>
                  <AlertDialog.CloseTrigger />
                  <AlertDialog.Header>
                    <AlertDialog.Icon status="warning">
                      <AlertTriangle className="size-5 text-warning" />
                    </AlertDialog.Icon>
                    <AlertDialog.Heading>
                      Restore Previous Version
                    </AlertDialog.Heading>
                  </AlertDialog.Header>
                  <AlertDialog.Body className="text-sm font-sans font-light leading-relaxed">
                    <p>
                      Are you sure you want to restore the requirements to Version <strong>{rollbackConfirmSnap.version}</strong>?
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      This will overwrite your current draft settings.
                    </p>
                  </AlertDialog.Body>
                  <AlertDialog.Footer>
                    <Button
                      variant="tertiary"
                      onPress={() => {
                        setRollbackConfirmSnap(null);
                        renderProps.close();
                      }}
                      className="rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      onPress={() => {
                        executeRollback(rollbackConfirmSnap);
                        setRollbackConfirmSnap(null);
                        renderProps.close();
                      }}
                      className="bg-warning/15 hover:bg-warning/25 text-warning border border-warning/20 rounded-xl font-semibold animate-none"
                    >
                      Restore
                    </Button>
                  </AlertDialog.Footer>
                </>
              )}
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      )}
    </div>
  );
}
