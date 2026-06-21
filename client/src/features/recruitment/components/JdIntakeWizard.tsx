"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Button,
  Input,
  Chip,
  Spinner,
  Typography,
  toast,
  Tooltip
} from "@heroui/react";
import { Card } from "@/components/ui/card";
import {
  Briefcase,
  Target,
  User,
  Coins,
  ChevronRight,
  ArrowRight,
  Check,
  AlertTriangle,
  Loader2,
  Sparkles,
  Plus,
  X,
  HelpCircle,
  Trash2,
  Calendar
} from "lucide-react";
import {
  hiringRequirementService,
  type HiringRequirement,
  type CapabilityCatalogItem
} from "@/services/hiring-requirement.service";

interface JdIntakeWizardProps {
  workspaceId: string;
  organizationSlug: string;
  initialDraft: HiringRequirement | null;
  onGenerationStarted: (id: string) => void;
  onCancel: () => void;
}

const mapPriorityToBackend = (p: string): "MustHave" | "ShouldHave" | "NiceToHave" => {
  if (p === "Must Have" || p === "MustHave") return "MustHave";
  if (p === "Should Have" || p === "ShouldHave") return "ShouldHave";
  return "NiceToHave";
};

const mapPriorityToFrontend = (p: string): "Must Have" | "Should Have" | "Nice To Have" => {
  if (p === "MustHave" || p === "Must Have") return "Must Have";
  if (p === "ShouldHave" || p === "Should Have") return "Should Have";
  return "Nice To Have";
};

const HelpTooltip = ({ content }: { content: string }) => (
  <Tooltip delay={0}>
    <Tooltip.Trigger>
      <HelpCircle className="size-3.5 text-muted hover:text-foreground cursor-help shrink-0 inline-block align-middle ml-1" />
    </Tooltip.Trigger>
    <Tooltip.Content showArrow className="max-w-xs bg-surface border border-border p-2 shadow-md rounded-lg">
      <span className="text-xs text-foreground leading-normal font-normal">{content}</span>
    </Tooltip.Content>
  </Tooltip>
);

export default function JdIntakeWizard({
  workspaceId,
  organizationSlug,
  initialDraft,
  onGenerationStarted,
  onCancel
}: JdIntakeWizardProps) {
  // Stepper & Autosave State
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [draftId, setDraftId] = useState<string | null>(initialDraft?.id || null);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const autosaveTimerRef = useRef<any>(null);

  // Dynamic Capability Taxonomy Catalog
  const [catalogItems, setCatalogItems] = useState<CapabilityCatalogItem[]>([]);

  // Step 1: Role Setup
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [seniority, setSeniority] = useState("Senior");
  const [workplaceType, setWorkplaceType] = useState("Hybrid");
  const [city, setCity] = useState("");
  const [employmentType, setEmploymentType] = useState("Full-Time");
  const [headcount, setHeadcount] = useState<number>(1);

  // Step 2: Hiring Goals
  const [hiringReason, setHiringReason] = useState("Team Expansion");
  const [businessProblem, setBusinessProblem] = useState("");
  const [businessOutcomes, setBusinessOutcomes] = useState<string[]>([]);
  const [newOutcome, setNewOutcome] = useState<string>("");

  // Step 3: Responsibilities & Capabilities
  const [responsibilities, setResponsibilities] = useState<Array<{
    text: string;
    priority: "Must Have" | "Should Have" | "Nice To Have";
    ownershipLevel: "Awareness" | "Contributor" | "Owner" | "Leader";
    isLeadership: boolean;
  }>>([]);
  const [newRespText, setNewRespText] = useState<string>("");
  const [newRespPriority, setNewRespPriority] = useState<"Must Have" | "Should Have" | "Nice To Have">("Must Have");
  const [newRespOwnership, setNewRespOwnership] = useState<"Awareness" | "Contributor" | "Owner" | "Leader">("Owner");
  const [newRespIsLeadership, setNewRespIsLeadership] = useState<boolean>(false);

  const [selectedCapabilities, setSelectedCapabilities] = useState<Array<{
    capabilityId: string;
    name: string;
    category: string;
    priority: "Must Have" | "Should Have" | "Nice To Have";
    ownershipLevel: "Awareness" | "Contributor" | "Owner" | "Leader";
    expectedProficiency: number;
  }>>([]);

  // Step 4: Logistics & Stack
  const [skills, setSkills] = useState<Array<{
    name: string;
    priority: "Must Have" | "Should Have" | "Nice To Have";
    sfiaLevel: number;
  }>>([]);
  const [newSkillText, setNewSkillText] = useState<string>("");

  const [salaryMin, setSalaryMin] = useState<number>(0);
  const [salaryMax, setSalaryMax] = useState<number>(0);
  const [currency, setCurrency] = useState<string>("USD");
  const [timezoneRange, setTimezoneRange] = useState("");
  const [degreeRequirement, setDegreeRequirement] = useState("Bachelor's Degree");
  const [languageRequirements, setLanguageRequirements] = useState<string[]>([]);
  const [newLangText, setNewLangText] = useState<string>("");
  const [benefits, setBenefits] = useState<string[]>([]);
  const [newBenefitText, setNewBenefitText] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [autoCloseRule, setAutoCloseRule] = useState<number>(0);
  const [candidatesNeededCount, setCandidatesNeededCount] = useState<number>(5);
  const [salaryPeriod, setSalaryPeriod] = useState<number>(1);
  const [isSalaryNegotiable, setIsSalaryNegotiable] = useState<boolean>(false);

  // UI States
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvancedCapId, setShowAdvancedCapId] = useState<string | null>(null);

  const getStepRequirements = (step: number) => {
    switch (step) {
      case 1:
        return [
          { label: "Role Title provided", met: jobTitle.trim() !== "" },
          { label: "Department provided", met: department.trim() !== "" },
          { label: "Location city provided (or Remote)", met: workplaceType === "Remote" || city.trim() !== "" }
        ];
      case 2:
        return [
          { label: "Business problem statement (min 30 chars)", met: businessProblem.trim().length >= 30, current: `${businessProblem.trim().length}/30` },
          { label: "At least 1 measurable outcome", met: businessOutcomes.length >= 1 }
        ];
      case 3:
        return [
          { label: "At least 1 responsibility/duty", met: responsibilities.length >= 1 },
          { label: "At least 1 required capability mapped", met: selectedCapabilities.length >= 1 }
        ];
      case 4:
        return [
          { label: "At least 1 required skill/technology mapped", met: skills.length >= 1 },
          { label: "At least 1 language requirement", met: languageRequirements.length >= 1 }
        ];
      case 5:
        return [
          { label: "Salary range valid (Min <= Max)", met: salaryMin <= salaryMax },
          { label: "At least 1 perk or benefit", met: benefits.length >= 1 }
        ];
      case 6:
        return [
          { label: "Headcount target set (>= 1)", met: headcount >= 1 },
          { label: "Active Campaign Window configured", met: !!startDate && !!endDate }
        ];
      default:
        return [];
    }
  };

  const loadCatalog = async () => {
    try {
      const items = await hiringRequirementService.getCatalog(workspaceId);
      setCatalogItems(items);
    } catch (err) {
      console.error("Failed to load catalog taxonomy.", err);
    }
  };

  // 1. Initial Load: Workspace Catalog
  useEffect(() => {
    Promise.resolve().then(() => {
      loadCatalog();
    });
  }, [workspaceId]);

  // 2. Populate draft details if editing
  useEffect(() => {
    if (initialDraft) {
      const timer = setTimeout(() => {
        setJobTitle(initialDraft.title || "");
        setDepartment(initialDraft.department || "");
        setSeniority(initialDraft.seniority || "Senior");
        setWorkplaceType(initialDraft.workplaceType || "Hybrid");
        setCity(initialDraft.city || "");
        setEmploymentType(initialDraft.employmentType || "Full-Time");
        setHeadcount(initialDraft.headcount || 1);

        setHiringReason(initialDraft.hiringReason || "Team Expansion");
        setBusinessProblem(initialDraft.businessProblem || "");
        setBusinessOutcomes((initialDraft.businessOutcomes || []).map((o) => o.text));
        setResponsibilities(
          (initialDraft.responsibilities || []).map((r) => ({
            text: r.text,
            priority: mapPriorityToFrontend(r.priority),
            ownershipLevel: r.ownershipLevel,
            isLeadership: r.isLeadership
          }))
        );
        setSelectedCapabilities(
          (initialDraft.capabilities || []).map((c) => ({
            capabilityId: c.capabilityId,
            name: c.name,
            category: c.category,
            priority: mapPriorityToFrontend(c.priority),
            ownershipLevel: c.ownershipLevel,
            expectedProficiency: c.expectedProficiency
          }))
        );
        setSkills(
          (initialDraft.technologyRequirements || []).map((s) => ({
            name: s.name,
            priority: mapPriorityToFrontend(s.priority),
            sfiaLevel: s.sfiaLevel
          }))
        );
        setSalaryMin(initialDraft.salaryMin || 0);
        setSalaryMax(initialDraft.salaryMax || 0);
        setCurrency(initialDraft.currency || "USD");
        setTimezoneRange(initialDraft.timezoneRange || "");
        setDegreeRequirement(initialDraft.degreeRequirement || "Bachelor's Degree");
        setLanguageRequirements(initialDraft.languageRequirements || []);
        setBenefits(initialDraft.benefits || []);
        setStartDate(initialDraft.startDate ? initialDraft.startDate.substring(0, 10) : "");
        setEndDate(initialDraft.endDate ? initialDraft.endDate.substring(0, 10) : "");
        setAutoCloseRule(initialDraft.autoCloseRule || 0);
        setCandidatesNeededCount(initialDraft.candidatesNeededCount || 5);
        setSalaryPeriod(initialDraft.salaryPeriod || 1);
        setIsSalaryNegotiable(initialDraft.isSalaryNegotiable || false);
      }, 0);
      return () => clearTimeout(timer);
    } else {
      // Check local storage for unsubmitted drafts to trigger recovery
      const savedDraftId = localStorage.getItem(`cverify_draft_${workspaceId}`);
      if (savedDraftId) {
        toast.info("An unsaved intake draft was detected. Use the resume button to recover your draft.");
      }
    }
  }, [initialDraft, workspaceId]);

  const resumeDraftById = async (id: string) => {
    try {
      setIsLoading(true);
      const draft = await hiringRequirementService.getById(id);
      setDraftId(draft.id);
      setJobTitle(draft.title || "");
      setDepartment(draft.department || "");
      setSeniority(draft.seniority || "Senior");
      setWorkplaceType(draft.workplaceType || "Hybrid");
      setCity(draft.city || "");
      setEmploymentType(draft.employmentType || "Full-Time");
      setHeadcount(draft.headcount || 1);
      setHiringReason(draft.hiringReason || "Team Expansion");
      setBusinessProblem(draft.businessProblem || "");
      setBusinessOutcomes((draft.businessOutcomes || []).map((o) => o.text));
      setResponsibilities(
        (draft.responsibilities || []).map((r) => ({
          text: r.text,
          priority: mapPriorityToFrontend(r.priority),
          ownershipLevel: r.ownershipLevel,
          isLeadership: r.isLeadership
        }))
      );
      setSelectedCapabilities(
        (draft.capabilities || []).map((c) => ({
          capabilityId: c.capabilityId,
          name: c.name,
          category: c.category,
          priority: mapPriorityToFrontend(c.priority),
          ownershipLevel: c.ownershipLevel,
          expectedProficiency: c.expectedProficiency
        }))
      );
      setSkills(
        (draft.technologyRequirements || []).map((s) => ({
          name: s.name,
          priority: mapPriorityToFrontend(s.priority),
          sfiaLevel: s.sfiaLevel
        }))
      );
      setSalaryMin(draft.salaryMin || 0);
      setSalaryMax(draft.salaryMax || 0);
      setCurrency(draft.currency || "USD");
      setTimezoneRange(draft.timezoneRange || "");
      setDegreeRequirement(draft.degreeRequirement || "Bachelor's Degree");
      setLanguageRequirements(draft.languageRequirements || []);
      setBenefits(draft.benefits || []);
      setStartDate(draft.startDate ? draft.startDate.substring(0, 10) : "");
      setEndDate(draft.endDate ? draft.endDate.substring(0, 10) : "");
      setAutoCloseRule(draft.autoCloseRule || 0);
      setCandidatesNeededCount(draft.candidatesNeededCount || 5);
      setSalaryPeriod(draft.salaryPeriod || 1);
      setIsSalaryNegotiable(draft.isSalaryNegotiable || false);
      
      toast.success("Draft successfully recovered!");
    } catch (err) {
      localStorage.removeItem(`cverify_draft_${workspaceId}`);
      console.error("Failed to recover draft", err);
    } finally {
      setIsLoading(false);
    }
  };



  // 3. Autosave Debounce Engine
  const triggerAutosave = (updatedData: {
    hiringReason: string;
    businessProblem: string;
    outcomes: string[];
    responsibilities: typeof responsibilities;
    capabilities: typeof selectedCapabilities;
    skills: typeof skills;
    salaryMin?: number;
    salaryMax?: number;
    currency: string;
    timezoneRange: string;
    degreeRequirement: string;
    benefits: string[];
    languageRequirements: string[];
    startDate?: string;
    endDate?: string;
    autoCloseRule?: number;
    candidatesNeededCount?: number;
    salaryPeriod?: number;
    isSalaryNegotiable?: boolean;
    headcount?: number;
  }) => {
    if (!draftId) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    setAutosaveState("saving");
    autosaveTimerRef.current = setTimeout(async () => {
      try {
        await hiringRequirementService.updateDraft(draftId, {
          hiringReason: updatedData.hiringReason,
          businessProblem: updatedData.businessProblem,
          outcomes: updatedData.outcomes,
          responsibilities: updatedData.responsibilities.map((r) => ({
            text: r.text,
            priority: mapPriorityToBackend(r.priority),
            ownershipLevel: r.ownershipLevel,
            isLeadership: r.isLeadership
          })),
          capabilities: updatedData.capabilities.map((c) => ({
            capabilityId: c.capabilityId,
            name: c.name,
            category: c.category,
            priority: mapPriorityToBackend(c.priority),
            ownershipLevel: c.ownershipLevel,
            expectedProficiency: c.expectedProficiency
          })),
          skills: updatedData.skills.map((s) => ({
            name: s.name,
            priority: mapPriorityToBackend(s.priority),
            sfiaLevel: s.sfiaLevel
          })),
          salaryMin: updatedData.salaryMin,
          salaryMax: updatedData.salaryMax,
          currency: updatedData.currency,
          timezoneRange: updatedData.timezoneRange,
          degreeRequirement: updatedData.degreeRequirement,
          benefits: updatedData.benefits,
          languageRequirements: updatedData.languageRequirements,
          startDate: updatedData.startDate ? new Date(updatedData.startDate).toISOString() : undefined,
          endDate: updatedData.endDate ? new Date(updatedData.endDate).toISOString() : undefined,
          autoCloseRule: updatedData.autoCloseRule,
          candidatesNeededCount: updatedData.candidatesNeededCount,
          salaryPeriod: updatedData.salaryPeriod,
          isSalaryNegotiable: updatedData.isSalaryNegotiable,
          headcount: updatedData.headcount
        });
        setAutosaveState("saved");
        setLastSavedTime(new Date().toLocaleTimeString());
      } catch (err) {
        console.error("Autosave draft failed", err);
        setAutosaveState("error");
      }
    }, 2000);
  };

  const queueStateAutosave = (overrides?: any) => {
    const data = {
      hiringReason,
      businessProblem,
      outcomes: businessOutcomes,
      responsibilities,
      capabilities: selectedCapabilities,
      skills,
      salaryMin,
      salaryMax,
      currency,
      timezoneRange,
      degreeRequirement,
      benefits,
      languageRequirements,
      startDate,
      endDate,
      autoCloseRule,
      candidatesNeededCount,
      salaryPeriod,
      isSalaryNegotiable,
      headcount,
      ...overrides
    };
    triggerAutosave(data);
  };

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  // 4. Role baseline templates
  const applyRoleTemplates = (title: string) => {
    setJobTitle(title);
    
    let dept = "Platform Core";
    let newResps: typeof responsibilities = [];
    let newOutcomes: string[] = [];
    let newCaps: typeof selectedCapabilities = [];
    let newSkills: typeof skills = [];

    if (title.toLowerCase().includes("backend") || title.toLowerCase().includes("c#")) {
      dept = "Platform Core";
      newResps = [
        { text: "Design, build and maintain highly efficient RESTful backend APIs", priority: "Must Have", ownershipLevel: "Owner", isLeadership: false },
        { text: "Mentor junior developers and participate in code reviews", priority: "Should Have", ownershipLevel: "Leader", isLeadership: true },
        { text: "Optimize database query schemas and caching strategies", priority: "Must Have", ownershipLevel: "Owner", isLeadership: false }
      ];
      newOutcomes = [
        "Reduce API endpoint latencies by 30%",
        "Support 10k concurrent active users"
      ];
      newCaps = [
        { capabilityId: "api.rest-design", name: "REST API Architecture", category: "Backend Engineering", priority: "Must Have", ownershipLevel: "Owner", expectedProficiency: 3 },
        { capabilityId: "db.query-tuning", name: "Database Performance Tuning", category: "Backend Engineering", priority: "Must Have", ownershipLevel: "Owner", expectedProficiency: 3 }
      ];
      newSkills = [
        { name: "C#", priority: "Must Have", sfiaLevel: 3 },
        { name: "ASP.NET Core", priority: "Must Have", sfiaLevel: 3 }
      ];
    } else if (title.toLowerCase().includes("frontend") || title.toLowerCase().includes("react")) {
      dept = "Web Client Core";
      newResps = [
        { text: "Develop responsive, modular UI components utilizing React", priority: "Must Have", ownershipLevel: "Owner", isLeadership: false },
        { text: "Collaborate closely with UI/UX designers to translate Figma layouts into pixel-perfect pages", priority: "Must Have", ownershipLevel: "Contributor", isLeadership: false },
        { text: "Optimize web performance and code-splitting bundles", priority: "Should Have", ownershipLevel: "Owner", isLeadership: false }
      ];
      newOutcomes = [
        "Optimize client web application performance and bundle size"
      ];
      newCaps = [
        { capabilityId: "fe.perf-optimize", name: "Web Performance & Bundle Tuning", category: "Frontend Engineering", priority: "Should Have", ownershipLevel: "Owner", expectedProficiency: 3 },
        { capabilityId: "fe.state-mgmt", name: "Advanced State Management", category: "Frontend Engineering", priority: "Must Have", ownershipLevel: "Owner", expectedProficiency: 3 },
        { capabilityId: "fe.responsive-layouts", name: "Semantic Responsive Layouts", category: "Frontend Engineering", priority: "Must Have", ownershipLevel: "Contributor", expectedProficiency: 3 }
      ];
      newSkills = [
        { name: "React", priority: "Must Have", sfiaLevel: 3 },
        { name: "TypeScript", priority: "Must Have", sfiaLevel: 3 }
      ];
    }

    setDepartment(dept);
    setResponsibilities(newResps);
    setBusinessOutcomes(newOutcomes);
    setSelectedCapabilities(newCaps);
    setSkills(newSkills);

    if (draftId) {
      queueStateAutosave({
        hiringReason,
        businessProblem,
        outcomes: newOutcomes,
        responsibilities: newResps,
        capabilities: newCaps,
        skills: newSkills
      });
    }
  };

  // Step 1 validation & save draft
  const handleStep1Submit = async () => {
    const stepErrors: Record<string, string> = {};
    if (!jobTitle.trim()) stepErrors.jobTitle = "Role Title is required.";
    if (!department.trim()) stepErrors.department = "Department is required.";
    if (workplaceType !== "Remote" && !city.trim()) stepErrors.city = "City is required for hybrid/on-site roles.";

    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);
    try {
      if (!draftId) {
        // Create new draft
        const res = await hiringRequirementService.createDraft({
          organizationSlug,
          title: jobTitle,
          department,
          seniority,
          workplaceType,
          city: workplaceType === "Remote" ? undefined : city,
          employmentType,
          headcount
        });
        setDraftId(res.id);
        localStorage.setItem(`cverify_draft_${workspaceId}`, res.id);
        
        // Force synchronous first update
        await hiringRequirementService.updateDraft(res.id, {
          hiringReason,
          businessProblem,
          outcomes: businessOutcomes,
          responsibilities: responsibilities.map((r) => ({
            text: r.text,
            priority: mapPriorityToBackend(r.priority),
            ownershipLevel: r.ownershipLevel,
            isLeadership: r.isLeadership
          })),
          capabilities: selectedCapabilities.map((c) => ({
            capabilityId: c.capabilityId,
            name: c.name,
            category: c.category,
            priority: mapPriorityToBackend(c.priority),
            ownershipLevel: c.ownershipLevel,
            expectedProficiency: c.expectedProficiency
          })),
          skills: skills.map((s) => ({
            name: s.name,
            priority: mapPriorityToBackend(s.priority),
            sfiaLevel: s.sfiaLevel
          })),
          salaryMin: salaryMin || 0,
          salaryMax: salaryMax || 0,
          currency,
          timezoneRange,
          degreeRequirement,
          benefits,
          languageRequirements,
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
          autoCloseRule,
          candidatesNeededCount,
          salaryPeriod,
          isSalaryNegotiable
        });
      } else {
        // Just update step 1 params on existing draft
        await hiringRequirementService.updateDraft(draftId, {
          salaryMin: salaryMin || 0,
          salaryMax: salaryMax || 0,
          currency,
          timezoneRange,
          degreeRequirement,
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
          autoCloseRule,
          candidatesNeededCount,
          salaryPeriod,
          isSalaryNegotiable
        });
      }
      setCurrentStep(2);
    } catch (err: any) {
      setErrors({ step1: err.message || "Failed to initialize requirements draft." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextStep = () => {
    const stepErrors: Record<string, string> = {};
    if (currentStep === 2) {
      if (businessProblem.trim().length < 30) {
        stepErrors.businessProblem = "Please describe the business problem statement in at least 30 characters.";
      }
      if (businessOutcomes.length === 0) {
        stepErrors.businessOutcomes = "Please specify at least one expected business outcome.";
      }
    } else if (currentStep === 3) {
      if (selectedCapabilities.length === 0) {
        stepErrors.capabilities = "Please map at least one required capability.";
      }
    } else if (currentStep === 4) {
      if (skills.length === 0) {
        stepErrors.skills = "Please map at least one required skill/technology.";
      }
      if (languageRequirements.length === 0) {
        stepErrors.languageRequirements = "Please specify at least one language requirement.";
      }
    } else if (currentStep === 5) {
      if (salaryMin > salaryMax) {
        stepErrors.salaryRange = "Salary minimum cannot be greater than maximum.";
      }
    }

    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }

    setErrors({});
    if (currentStep === 3) {
      // Suggest skills matching capabilities
      suggestSkills();
    }
    setCurrentStep((prev) => prev + 1);
  };

  const suggestSkills = () => {
    const suggested: string[] = [];
    selectedCapabilities.forEach((c) => {
      const match = catalogItems.find((ci) => ci.capabilityId === c.capabilityId);
      if (match) {
        match.skills.forEach((s) => {
          if (!suggested.includes(s)) suggested.push(s);
        });
      }
    });

    const newSkills = [...skills];
    suggested.forEach((s) => {
      if (!newSkills.some((ns) => ns.name.toLowerCase() === s.toLowerCase())) {
        newSkills.push({
          name: s,
          priority: "Must Have",
          sfiaLevel: seniority === "Senior" ? 3 : seniority === "Principal" ? 4 : 2
        });
      }
    });
    setSkills(newSkills);
    queueStateAutosave({ skills: newSkills });
  };

  const handleGenerateClick = async () => {
    if (!draftId) return;
    try {
      localStorage.removeItem(`cverify_draft_${workspaceId}`);
      onGenerationStarted(draftId);
    } catch (err) {
      console.error(err);
    }
  };

  const getCurrencyConversionPreview = () => {
    if (!salaryMin && !salaryMax) return null;
    const rate = 25400; // 1 USD = 25,400 VND
    const formatNumber = (num: number) => {
      return new Intl.NumberFormat().format(Math.round(num));
    };

    if (currency === "USD") {
      const minVnd = salaryMin * rate;
      const maxVnd = salaryMax * rate;
      return (
        <div className="p-3.5 bg-accent/5 rounded-xl border border-accent/15 flex items-center justify-between text-xs mt-2 select-text font-medium text-accent">
          <span>VND Estimation Preview (approx.):</span>
          <span className="font-bold font-mono">
            ₫{formatNumber(minVnd)} - ₫{formatNumber(maxVnd)} {salaryPeriod === 1 ? "Monthly" : "Yearly"}
          </span>
        </div>
      );
    } else if (currency === "VND") {
      const minUsd = salaryMin / rate;
      const maxUsd = salaryMax / rate;
      return (
        <div className="p-3.5 bg-accent/5 rounded-xl border border-accent/15 flex items-center justify-between text-xs mt-2 select-text font-medium text-accent">
          <span>USD Estimation Preview (approx.):</span>
          <span className="font-bold font-mono">
            ${formatNumber(minUsd)} - ${formatNumber(maxUsd)} {salaryPeriod === 1 ? "Monthly" : "Yearly"}
          </span>
        </div>
      );
    }
    return null;
  };

  const getDynamicStatusPreview = () => {
    const now = new Date();
    let status = "Active";
    let explanation = "The job intake campaign is active and open for candidates.";
    let statusColor = "bg-success/10 text-success border-success/20";

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (start && start > now) {
      status = "Scheduled";
      explanation = `The campaign will automatically activate on the start date: ${startDate}.`;
      statusColor = "bg-warning/10 text-warning border-warning/20";
    } else if (end && end < now) {
      status = "Expired";
      explanation = `The campaign has passed its closing date: ${endDate}.`;
      statusColor = "bg-danger/10 text-danger border-danger/20";
    }

    return (
      <div className="p-4 bg-surface-secondary/40 border border-border/80 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground">Lifecycle Status Preview</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
            {status}
          </span>
        </div>
        <p className="text-[10px] text-muted leading-relaxed font-medium">{explanation}</p>
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6 select-none">
            <div>
              <Typography type="h3" className="font-bold mb-1">Step 1: Role Setup</Typography>
              <Typography type="body-xs" className="text-muted">Initialize the basic details of the role to create a secure intake record.</Typography>
            </div>

            {localStorage.getItem(`cverify_draft_${workspaceId}`) && !draftId && (
              <div className="bg-warning/5 p-4 rounded-xl border border-warning/20 flex items-start justify-between gap-3 select-none">
                <div className="flex gap-2">
                  <AlertTriangle size={16} className="text-warning mt-0.5" />
                  <div>
                    <span className="text-xs font-semibold text-warning block">Unsaved Draft Detected</span>
                    <span className="text-[10px] text-muted block font-medium">You have an unfinished intake form. Would you like to resume?</span>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" onClick={() => resumeDraftById(localStorage.getItem(`cverify_draft_${workspaceId}`)!)} className="bg-warning text-warning-foreground text-[10px] font-bold h-7 rounded-lg">
                    Resume
                  </Button>
                  <Button size="sm" onClick={() => {
                    localStorage.removeItem(`cverify_draft_${workspaceId}`);
                    toast.success("Previous session cleared.");
                  }} className="bg-transparent text-foreground hover:bg-surface-secondary text-[10px] font-semibold h-7 rounded-lg">
                    Discard
                  </Button>
                </div>
              </div>
            )}

            <div className="bg-accent/5 p-4 rounded-xl border border-accent/20 flex items-start gap-3">
              <Sparkles size={16} className="text-accent mt-0.5" />
              <div>
                <span className="text-xs font-semibold text-accent block">Quick Templates</span>
                <span className="text-[10px] text-muted block mb-2 font-medium">Select a standardized capability baseline structure to quickly pre-populate steps:</span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => applyRoleTemplates("Senior C# Backend Engineer")} className="bg-surface text-foreground border border-border text-[10px] font-semibold rounded-lg px-2.5 py-1 cursor-pointer">
                    Backend Engineer
                  </Button>
                  <Button size="sm" onClick={() => applyRoleTemplates("Senior React Developer")} className="bg-surface text-foreground border border-border text-[10px] font-semibold rounded-lg px-2.5 py-1 cursor-pointer">
                    Frontend Developer
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <label className="text-xs font-semibold text-foreground/80">Role Title</label>
                  <HelpTooltip content="The official name of the job position (e.g. Senior Frontend Engineer)." />
                </div>
                <Input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Senior Backend Engineer"
                  className="text-xs font-medium"
                />
                {errors.jobTitle && <span className="text-xs text-danger font-medium block">{errors.jobTitle}</span>}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <label className="text-xs font-semibold text-foreground/80">Department</label>
                  <HelpTooltip content="The business unit or engineering department hosting this role." />
                </div>
                <Input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Platform Engineering"
                  className="text-xs font-medium"
                />
                {errors.department && <span className="text-xs text-danger font-medium block">{errors.department}</span>}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <label className="text-xs font-semibold text-foreground/80">Seniority</label>
                  <HelpTooltip content="The experience and skill tier expected for this position." />
                </div>
                <select
                  value={seniority}
                  onChange={(e) => setSeniority(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-field-background text-foreground text-xs font-medium focus:border-focus focus:ring-1 focus:ring-focus/20 outline-hidden cursor-pointer"
                >
                  <option value="Junior">Junior</option>
                  <option value="Middle">Middle</option>
                  <option value="Senior">Senior</option>
                  <option value="Staff">Staff</option>
                  <option value="Principal">Principal</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <label className="text-xs font-semibold text-foreground/80">Workplace Type</label>
                  <HelpTooltip content="Physical workspace context: Remote, Hybrid, or On-site." />
                </div>
                <select
                  value={workplaceType}
                  onChange={(e) => setWorkplaceType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-field-background text-foreground text-xs font-medium focus:border-focus focus:ring-1 focus:ring-focus/20 outline-hidden cursor-pointer"
                >
                  <option value="Remote">Remote</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="On-site">On-site</option>
                </select>
              </div>

              {workplaceType !== "Remote" && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <label className="text-xs font-semibold text-foreground/80">Location (City)</label>
                    <HelpTooltip content="The primary city of employment for office attendance or payroll." />
                  </div>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Ho Chi Minh City"
                    className="text-xs font-medium"
                  />
                  {errors.city && <span className="text-xs text-danger font-medium block">{errors.city}</span>}
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <label className="text-xs font-semibold text-foreground/80">Employment Type</label>
                  <HelpTooltip content="The type of contract (e.g. Full-Time, Contract, Part-Time, Internship)." />
                </div>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-field-background text-foreground text-xs font-medium focus:border-focus focus:ring-1 focus:ring-focus/20 outline-hidden cursor-pointer"
                >
                  <option value="Full-Time">Full-Time</option>
                  <option value="Contract">Contract</option>
                  <option value="Part-Time">Part-Time</option>
                  <option value="Internship">Internship</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <label className="text-xs font-semibold text-foreground/80">Headcount Target</label>
                  <HelpTooltip content="The total number of open vacancies targeted for this role profile." />
                </div>
                <Input
                  type="number"
                  value={headcount.toString()}
                  onChange={(e) => setHeadcount(parseInt(e.target.value) || 1)}
                  className="text-xs font-medium"
                />
              </div>
            </div>
            {errors.step1 && <span className="text-xs text-danger font-medium block">{errors.step1}</span>}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <Typography type="h3" className="font-bold mb-1">Step 2: Hiring Goals & Outcomes</Typography>
              <Typography type="body-xs" className="text-muted">Define the high-level business problem and measurable outcomes expected from this hire.</Typography>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-1">
                <label className="text-xs font-semibold text-foreground/80">Hiring Reason</label>
                <HelpTooltip content="The organizational trigger or business justification for this open headcount." />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {["Team Expansion", "New Initiative", "Replacement", "Technical Transformation"].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => {
                      setHiringReason(reason);
                      queueStateAutosave({ hiringReason: reason });
                    }}
                    className={[
                      "p-4 rounded-xl text-left border text-xs font-semibold cursor-pointer transition-all bg-field-background",
                      hiringReason === reason
                        ? "border-accent ring-1 ring-accent/20 text-accent"
                        : "border-border hover:border-muted text-foreground"
                    ].join(" ")}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1 mb-1">
                <label className="text-xs font-semibold text-foreground/80">Business Problem Statement</label>
                <HelpTooltip content="A detailed description of the business or engineering challenges this hire is expected to solve." />
              </div>
              <textarea
                value={businessProblem}
                onChange={(e) => {
                  setBusinessProblem(e.target.value);
                  queueStateAutosave({ businessProblem: e.target.value });
                }}
                placeholder="Describe the business problem (e.g. We require database indexing optimization and distributed caching models to reduce page query timeouts during active hours)."
                className="w-full text-xs font-medium bg-field-background text-foreground border border-border rounded-xl placeholder-field-placeholder p-3 h-28 focus:border-focus focus:ring-1 focus:ring-focus/20 outline-hidden"
              />
              {errors.businessProblem && <span className="text-xs text-danger font-medium block">{errors.businessProblem}</span>}
              <span className="text-[10px] text-muted block text-right">{businessProblem.length}/30 characters minimum</span>
            </div>

            <div className="space-y-3 border-t border-border/40 pt-4">
              <div className="flex items-center gap-1">
                <label className="text-xs font-semibold text-foreground/80">Target Outcomes</label>
                <HelpTooltip content="Measurable business or technical achievements expected from this hire (e.g. within 6-12 months)." />
              </div>
              <div className="flex gap-2">
                <Input
                  value={newOutcome}
                  onChange={(e) => setNewOutcome(e.target.value)}
                  placeholder="e.g. Reduce database query latency by 30%"
                  className="flex-1 text-xs"
                />
                <Button
                  onClick={() => {
                    if (newOutcome.trim() && !businessOutcomes.includes(newOutcome.trim())) {
                      const nextOutcomes = [...businessOutcomes, newOutcome.trim()];
                      setBusinessOutcomes(nextOutcomes);
                      setNewOutcome("");
                      queueStateAutosave({ outcomes: nextOutcomes });
                    }
                  }}
                  className="bg-accent text-accent-foreground text-xs h-10 px-4 rounded-xl cursor-pointer font-bold animate-fade-in"
                >
                  <Plus size={16} /> Add
                </Button>
              </div>

              {businessOutcomes.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {businessOutcomes.map((out) => (
                    <Chip
                      key={out}
                      variant="soft"
                      className="bg-accent/10 border border-accent/20 text-accent font-semibold text-xs py-1.5 flex items-center gap-1.5"
                    >
                      <Chip.Label>{out}</Chip.Label>
                      <button
                        type="button"
                        onClick={() => {
                          const nextOutcomes = businessOutcomes.filter((x) => x !== out);
                          setBusinessOutcomes(nextOutcomes);
                          queueStateAutosave({ outcomes: nextOutcomes });
                        }}
                        className="hover:opacity-85 cursor-pointer outline-hidden p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </Chip>
                  ))}
                </div>
              )}
              {errors.businessOutcomes && <span className="text-xs text-danger font-medium block">{errors.businessOutcomes}</span>}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <Typography type="h3" className="font-bold mb-1">Step 3: Responsibilities & Capabilities</Typography>
              <Typography type="body-xs" className="text-muted">Define the duties of the role and select expected capabilities from the taxonomy.</Typography>
            </div>

            {/* Responsibilities list builder */}
            <div className="bg-surface-secondary/40 p-4 rounded-xl border border-border/80 space-y-4">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-xs font-semibold text-foreground">Add Custom Responsibility</span>
                <HelpTooltip content="Specific tasks, processes, or deliverables that this role will own and execute." />
              </div>
              <div className="space-y-3">
                <Input
                  value={newRespText}
                  onChange={(e) => setNewRespText(e.target.value)}
                  placeholder="e.g. Design, build and maintain highly efficient RESTful backend APIs"
                  className="text-xs font-medium"
                />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-muted uppercase">Priority</span>
                      <HelpTooltip content="Essential Must-Haves vs optional Nice-To-Haves." />
                    </div>
                    <select
                      value={newRespPriority}
                      onChange={(e) => setNewRespPriority(e.target.value as any)}
                      className="w-full text-xs bg-surface border border-border rounded-lg p-1.5 font-semibold text-foreground cursor-pointer"
                    >
                      <option value="Must Have">Must Have</option>
                      <option value="Should Have">Should Have</option>
                      <option value="Nice To Have">Nice To Have</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-muted uppercase">Role Role</span>
                      <HelpTooltip content="Ownership level expected for this responsibility (Awareness, Contributor, Owner, Leader)." />
                    </div>
                    <select
                      value={newRespOwnership}
                      onChange={(e) => setNewRespOwnership(e.target.value as any)}
                      className="w-full text-xs bg-surface border border-border rounded-lg p-1.5 font-semibold text-foreground cursor-pointer"
                    >
                      <option value="Awareness">Awareness</option>
                      <option value="Contributor">Contributor</option>
                      <option value="Owner">Owner</option>
                      <option value="Leader">Leader</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="isLeadership"
                      checked={newRespIsLeadership}
                      onChange={(e) => setNewRespIsLeadership(e.target.checked)}
                      className="rounded accent-accent border-border"
                    />
                    <label htmlFor="isLeadership" className="text-[10px] font-semibold text-foreground/80 cursor-pointer flex items-center gap-1">
                      <span>Leadership Scope</span>
                      <HelpTooltip content="Check if this duty involves leading people, teams, or technical decisions." />
                    </label>
                  </div>

                  <div className="pt-4 text-right">
                    <Button
                      onClick={() => {
                        if (newRespText.trim()) {
                          const nextResps = [
                            ...responsibilities,
                            {
                              text: newRespText.trim(),
                              priority: newRespPriority,
                              ownershipLevel: newRespOwnership,
                              isLeadership: newRespIsLeadership
                            }
                          ];
                          setResponsibilities(nextResps);
                          setNewRespText("");
                          setNewRespIsLeadership(false);
                          queueStateAutosave({ responsibilities: nextResps });
                        }
                      }}
                      className="bg-accent text-accent-foreground text-xs w-full py-2 rounded-xl cursor-pointer font-bold"
                    >
                      Add Duty
                    </Button>
                  </div>
                </div>
              </div>

              {responsibilities.length > 0 && (
                <div className="space-y-2 mt-4 pt-4 border-t border-border/50">
                  <span className="text-xs font-semibold text-foreground/80 block">Active Responsibilities Checklist</span>
                  <div className="space-y-2">
                    {responsibilities.map((resp, idx) => (
                      <div key={idx} className="p-3 bg-surface border border-border/80 rounded-xl flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-foreground block">{resp.text}</span>
                          <div className="flex gap-2">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm ${
                              resp.priority === "Must Have" ? "bg-accent/10 text-accent border border-accent/20" :
                              resp.priority === "Should Have" ? "bg-default/20 text-foreground" : "bg-muted/10 text-muted"
                            }`}>{resp.priority}</span>
                            <span className="text-[9px] bg-surface-secondary text-muted px-1.5 py-0.5 rounded-sm font-semibold">
                              Role: {resp.ownershipLevel}
                            </span>
                            {resp.isLeadership && (
                              <span className="text-[9px] bg-success/10 text-success border border-success/20 px-1.5 py-0.5 rounded-sm font-bold">
                                Leadership
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => {
                            const nextResps = responsibilities.filter((_, i) => i !== idx);
                            setResponsibilities(nextResps);
                            queueStateAutosave({ responsibilities: nextResps });
                          }}
                          className="bg-danger/10 text-danger border border-danger/20 p-1.5 rounded-lg cursor-pointer"
                          size="sm"
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Taxonomy Selection with Advanced Config collapse */}
            <div className="space-y-3">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-xs font-semibold text-foreground">Capability Taxonomy Mapping</span>
                <HelpTooltip content="Map specific tech and business competencies from our global catalog to this role profile." />
              </div>
              <span className="text-[10px] text-muted block font-medium">Select global frameworks or custom workspace capabilities:</span>

              <div className="space-y-4">
                {Object.entries(
                  catalogItems.reduce((acc, item) => {
                    if (!acc[item.category]) acc[item.category] = [];
                    acc[item.category].push(item);
                    return acc;
                  }, {} as Record<string, CapabilityCatalogItem[]>)
                ).map(([category, items]) => (
                  <div key={category} className="space-y-2 border-b border-border/40 pb-3 last:border-b-0">
                    <span className="text-[10px] font-bold text-accent uppercase tracking-wider block">{category}</span>
                    <div className="grid grid-cols-1 gap-2">
                      {items.map((item) => {
                        const isSelected = selectedCapabilities.some((c) => c.capabilityId === item.capabilityId);
                        const selected = selectedCapabilities.find((c) => c.capabilityId === item.capabilityId);
                        const isAdvancedOpen = showAdvancedCapId === item.capabilityId;

                        return (
                          <div
                            key={item.capabilityId}
                            className={[
                              "p-3.5 rounded-xl border transition-all bg-field-background text-left flex flex-col justify-between gap-3",
                              isSelected ? "border-accent ring-1 ring-accent/15" : "border-border"
                            ].join(" ")}
                          >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="flex-1 space-y-0.5">
                                <span className="text-xs font-semibold text-foreground block">{item.displayName}</span>
                                <span className="text-[10px] text-muted block leading-relaxed font-medium">{item.description}</span>
                              </div>

                              <div className="flex items-center gap-2 select-none">
                                {isSelected ? (
                                  <>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[9px] text-muted block font-bold">Lvl:</span>
                                      <select
                                        value={selected?.expectedProficiency}
                                        onChange={(e) => {
                                          const next = selectedCapabilities.map((c) =>
                                            c.capabilityId === item.capabilityId
                                              ? { ...c, expectedProficiency: parseInt(e.target.value) }
                                              : c
                                          );
                                          setSelectedCapabilities(next);
                                          queueStateAutosave({ capabilities: next });
                                        }}
                                        className="text-[10px] bg-surface border border-border rounded-lg p-1.5 font-bold text-foreground cursor-pointer"
                                      >
                                        <option value={1}>L1 - Awareness</option>
                                        <option value={2}>L2 - Contributor</option>
                                        <option value={3}>L3 - Practitioner</option>
                                        <option value={4}>L4 - Expert</option>
                                      </select>
                                    </div>

                                    <Button
                                      onClick={() => setShowAdvancedCapId(isAdvancedOpen ? null : item.capabilityId)}
                                      className="bg-default text-default-foreground border border-border text-[9px] font-bold py-1 px-2 rounded-lg cursor-pointer h-7"
                                      size="sm"
                                    >
                                      {isAdvancedOpen ? "Hide Config" : "Advanced"}
                                    </Button>

                                    <Button
                                      onClick={() => {
                                        const next = selectedCapabilities.filter((c) => c.capabilityId !== item.capabilityId);
                                        setSelectedCapabilities(next);
                                        queueStateAutosave({ capabilities: next });
                                        if (isAdvancedOpen) setShowAdvancedCapId(null);
                                      }}
                                      className="bg-accent text-accent-foreground p-1 rounded-lg cursor-pointer h-7 w-7 min-w-0"
                                      size="sm"
                                    >
                                      <Check size={12} />
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    onClick={() => {
                                      const next = [
                                        ...selectedCapabilities,
                                        {
                                          capabilityId: item.capabilityId,
                                          name: item.displayName,
                                          category: item.category,
                                          priority: "Must Have" as any,
                                          ownershipLevel: "Owner" as any,
                                          expectedProficiency: 3
                                        }
                                      ];
                                      setSelectedCapabilities(next);
                                      queueStateAutosave({ capabilities: next });
                                    }}
                                    className="bg-surface text-foreground hover:bg-surface-secondary border border-border text-[10px] font-bold py-1.5 rounded-lg cursor-pointer"
                                    size="sm"
                                  >
                                    Add Capability
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Collapsible Advanced Config (AST Rules and Priority) */}
                            {isSelected && isAdvancedOpen && (
                              <div className="mt-2 p-3 bg-surface-secondary/40 border border-border/60 rounded-xl space-y-2 text-xs select-text animate-fade-in">
                                <div className="grid grid-cols-2 gap-3 pb-2 border-b border-border/30">
                                  <div className="space-y-1">
                                    <span className="text-[9px] font-bold text-muted uppercase">Priority Fit</span>
                                    <select
                                      value={selected?.priority}
                                      onChange={(e) => {
                                        const next = selectedCapabilities.map((c) =>
                                          c.capabilityId === item.capabilityId
                                            ? { ...c, priority: e.target.value as any }
                                            : c
                                        );
                                        setSelectedCapabilities(next);
                                        queueStateAutosave({ capabilities: next });
                                      }}
                                      className="w-full text-[10px] bg-surface border border-border rounded-md p-1 font-bold text-foreground cursor-pointer"
                                    >
                                      <option value="Must Have">Must Have</option>
                                      <option value="Should Have">Should Have</option>
                                      <option value="Nice To Have">Nice To Have</option>
                                    </select>
                                  </div>

                                  <div className="space-y-1">
                                    <span className="text-[9px] font-bold text-muted uppercase">Ownership Context</span>
                                    <select
                                      value={selected?.ownershipLevel}
                                      onChange={(e) => {
                                        const next = selectedCapabilities.map((c) =>
                                          c.capabilityId === item.capabilityId
                                            ? { ...c, ownershipLevel: e.target.value as any }
                                            : c
                                        );
                                        setSelectedCapabilities(next);
                                        queueStateAutosave({ capabilities: next });
                                      }}
                                      className="w-full text-[10px] bg-surface border border-border rounded-md p-1 font-bold text-foreground cursor-pointer"
                                    >
                                      <option value="Awareness">Awareness</option>
                                      <option value="Contributor">Contributor</option>
                                      <option value="Owner">Owner</option>
                                      <option value="Leader">Leader</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <span className="text-[9px] font-bold text-muted uppercase block">Evidence Match Signals</span>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {item.expectedEvidence.map((ev, eIdx) => (
                                      <span key={eIdx} className="bg-surface font-mono text-[9px] text-muted border border-border px-1.5 py-0.5 rounded-sm block">
                                        {ev}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {errors.capabilities && <span className="text-xs text-danger font-medium block">{errors.capabilities}</span>}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <Typography type="h3" className="font-bold mb-1">Step 4: Tech Stack & Qualifications</Typography>
              <Typography type="body-xs" className="text-muted">Define the specific technologies, SFIA competency tiers, degree and language requirements.</Typography>
            </div>

            {/* Skills Builder */}
            <div className="bg-surface-secondary/40 p-4 rounded-xl border border-border/80 space-y-3">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-xs font-semibold text-foreground">Add Custom Technology</span>
                <HelpTooltip content="Add specific programming languages, frameworks, databases, or developer tools." />
              </div>
              <div className="flex gap-2">
                <Input
                  value={newSkillText}
                  onChange={(e) => setNewSkillText(e.target.value)}
                  placeholder="e.g. Docker, PostgreSQL, Next.js"
                  className="flex-1 text-xs font-medium"
                />
                <Button
                  onClick={() => {
                    if (newSkillText.trim() && !skills.some((s) => s.name.toLowerCase() === newSkillText.trim().toLowerCase())) {
                      const next = [
                        ...skills,
                        {
                          name: newSkillText.trim(),
                          priority: "Must Have" as any,
                          sfiaLevel: 3
                        }
                      ];
                      setSkills(next);
                      setNewSkillText("");
                      queueStateAutosave({ skills: next });
                    }
                  }}
                  className="bg-accent text-accent-foreground text-xs px-4 rounded-xl cursor-pointer font-bold"
                >
                  <Plus size={16} /> Add
                </Button>
              </div>

              {skills.length > 0 && (
                <div className="space-y-2 mt-4 pt-4 border-t border-border/50">
                  <span className="text-xs font-semibold text-foreground/80 block">Active Stack Priority & Competency (SFIA) Levels</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 select-none">
                    {skills.map((skill, idx) => (
                      <div key={idx} className="p-3 bg-surface border border-border/80 rounded-xl flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-foreground block">{skill.name}</span>
                          <div className="flex gap-1.5">
                            <select
                               value={skill.priority}
                               onChange={(e) => {
                                 const next = skills.map((s) => (s.name === skill.name ? { ...s, priority: e.target.value as any } : s));
                                 setSkills(next);
                                 queueStateAutosave({ skills: next });
                               }}
                               className="text-[9px] bg-surface-secondary border border-border rounded-md px-1 py-0.5 font-bold text-foreground cursor-pointer"
                            >
                              <option value="Must Have">Must Have</option>
                              <option value="Should Have">Should Have</option>
                              <option value="Nice To Have">Nice To Have</option>
                            </select>

                            <select
                               value={skill.sfiaLevel}
                               onChange={(e) => {
                                 const next = skills.map((s) => (s.name === skill.name ? { ...s, sfiaLevel: parseInt(e.target.value) } : s));
                                 setSkills(next);
                                 queueStateAutosave({ skills: next });
                               }}
                               className="text-[9px] bg-surface-secondary border border-border rounded-md px-1 py-0.5 font-bold text-foreground cursor-pointer"
                            >
                              <option value={1}>L1 - Awareness</option>
                              <option value={2}>L2 - Contributor</option>
                              <option value={3}>L3 - Practitioner</option>
                              <option value={4}>L4 - Expert</option>
                            </select>
                          </div>
                        </div>
                        <Button
                          onClick={() => {
                            const next = skills.filter((s) => s.name !== skill.name);
                            setSkills(next);
                            queueStateAutosave({ skills: next });
                          }}
                          className="bg-danger/10 text-danger border border-danger/20 p-1.5 rounded-lg cursor-pointer"
                          size="sm"
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {errors.skills && <span className="text-xs text-danger font-medium block">{errors.skills}</span>}

            {/* Degree and Timezone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border/40 pt-4">
              <div className="space-y-1.5 select-none">
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs font-semibold text-foreground/80">Degree Requirement</label>
                  <HelpTooltip content="Minimum educational degree expected from applicants." />
                </div>
                <select
                  value={degreeRequirement}
                  onChange={(e) => {
                    setDegreeRequirement(e.target.value);
                    queueStateAutosave({ degreeRequirement: e.target.value });
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-field-background text-foreground text-xs font-medium focus:border-focus focus:ring-1 focus:ring-focus/20 outline-hidden cursor-pointer"
                >
                  <option value="No Degree Required">No Degree Required</option>
                  <option value="Bachelor's Degree">Bachelor's Degree</option>
                  <option value="Master's Degree">Master's Degree</option>
                  <option value="PhD">PhD</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs font-semibold text-foreground/80">Timezone Scope</label>
                  <HelpTooltip content="Expected working hours overlap or geographical timezone coordination requirements." />
                </div>
                <Input
                  value={timezoneRange}
                  onChange={(e) => {
                    setTimezoneRange(e.target.value);
                    queueStateAutosave({ timezoneRange: e.target.value });
                  }}
                  placeholder="e.g. GMT+7 +/- 2 Hours"
                  className="text-xs font-medium"
                />
              </div>
            </div>

            {/* Language proficiencies */}
            <div className="space-y-3 border-t border-border/40 pt-4">
              <div className="flex items-center gap-1 mb-1">
                <label className="text-xs font-semibold text-foreground/80">Languages</label>
                <HelpTooltip content="Language proficiencies required for daily team collaboration (e.g. English, Vietnamese)." />
              </div>
              <div className="flex gap-2">
                <Input
                  value={newLangText}
                  onChange={(e) => setNewLangText(e.target.value)}
                  placeholder="e.g. English - Professional"
                  className="flex-1 text-xs font-medium"
                />
                <Button
                  onClick={() => {
                    if (newLangText.trim() && !languageRequirements.includes(newLangText.trim())) {
                      const next = [...languageRequirements, newLangText.trim()];
                      setLanguageRequirements(next);
                      setNewLangText("");
                      queueStateAutosave({ languageRequirements: next });
                    }
                  }}
                  className="bg-accent text-accent-foreground text-xs px-4 rounded-xl cursor-pointer font-bold h-10 w-10 min-w-0"
                >
                  <Plus size={14} />
                </Button>
              </div>
              {languageRequirements.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1 select-none">
                  {languageRequirements.map((lang) => (
                    <Chip key={lang} variant="soft" className="bg-accent/10 border border-accent/20 text-accent font-semibold text-xs py-1 flex items-center gap-1">
                      <Chip.Label>{lang}</Chip.Label>
                      <button
                        type="button"
                        onClick={() => {
                          const next = languageRequirements.filter((x) => x !== lang);
                          setLanguageRequirements(next);
                          queueStateAutosave({ languageRequirements: next });
                        }}
                        className="hover:opacity-85 cursor-pointer outline-hidden p-0.5"
                      >
                        <X size={10} />
                      </button>
                    </Chip>
                  ))}
                </div>
              )}
              {errors.languageRequirements && <span className="text-xs text-danger font-medium block">{errors.languageRequirements}</span>}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <Typography type="h3" className="font-bold mb-1">Step 5: Compensation & Benefits</Typography>
              <Typography type="body-xs" className="text-muted">Define the base salary structures, currency selections, and company perks.</Typography>
            </div>

            {/* Salary bounds */}
            <div className="bg-surface-secondary/40 p-4 rounded-xl border border-border/80 space-y-4">
              <div className="flex items-center gap-1 mb-1">
                <label className="text-xs font-semibold text-foreground/80">Salary Range & Period</label>
                <HelpTooltip content="The budgeted salary bounds. Toggle between currencies and periods." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    value={salaryMin.toString()}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setSalaryMin(val);
                      queueStateAutosave({ salaryMin: val });
                    }}
                    placeholder="Min"
                    className="text-xs font-medium flex-1"
                  />
                  <span className="text-xs text-muted font-bold">—</span>
                  <Input
                    type="number"
                    value={salaryMax.toString()}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setSalaryMax(val);
                      queueStateAutosave({ salaryMax: val });
                    }}
                    placeholder="Max"
                    className="text-xs font-medium flex-1"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={currency}
                    onChange={(e) => {
                      setCurrency(e.target.value);
                      queueStateAutosave({ currency: e.target.value });
                    }}
                    className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-field-background text-foreground text-xs font-medium focus:border-focus focus:ring-1 focus:ring-focus/20 outline-hidden cursor-pointer"
                  >
                    <option value="USD">USD</option>
                    <option value="VND">VND</option>
                    <option value="EUR">EUR</option>
                  </select>
                  <select
                    value={salaryPeriod}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setSalaryPeriod(val);
                      queueStateAutosave({ salaryPeriod: val });
                    }}
                    className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-field-background text-foreground text-xs font-medium focus:border-focus focus:ring-1 focus:ring-focus/20 outline-hidden cursor-pointer"
                  >
                    <option value={1}>Monthly</option>
                    <option value={2}>Yearly</option>
                  </select>
                </div>
              </div>

              {/* Real-time currency conversion preview */}
              {getCurrencyConversionPreview()}

              {/* Negotiable check */}
              <div className="flex items-center gap-2 pt-2 select-none">
                <input
                  type="checkbox"
                  id="isSalaryNegotiable"
                  checked={isSalaryNegotiable}
                  onChange={(e) => {
                    setIsSalaryNegotiable(e.target.checked);
                    queueStateAutosave({ isSalaryNegotiable: e.target.checked });
                  }}
                  className="rounded accent-accent border-border"
                />
                <label htmlFor="isSalaryNegotiable" className="text-xs font-semibold text-foreground/80 cursor-pointer">
                  Salary is Negotiable based on qualifications
                </label>
              </div>
            </div>
            {errors.salaryRange && <span className="text-xs text-danger font-medium block">{errors.salaryRange}</span>}

            {/* Perks & Benefits */}
            <div className="space-y-3 border-t border-border/40 pt-4">
              <div className="flex items-center gap-1 mb-1">
                <label className="text-xs font-semibold text-foreground/80">Corporate Perks & Benefits</label>
                <HelpTooltip content="Corporate perks, insurance coverage, or extra allowances associated with this role." />
              </div>
              <div className="flex gap-2">
                <Input
                  value={newBenefitText}
                  onChange={(e) => setNewBenefitText(e.target.value)}
                  placeholder="e.g. Premium Health Insurance Plan"
                  className="flex-1 text-xs font-medium"
                />
                <Button
                  onClick={() => {
                    if (newBenefitText.trim() && !benefits.includes(newBenefitText.trim())) {
                      const next = [...benefits, newBenefitText.trim()];
                      setBenefits(next);
                      setNewBenefitText("");
                      queueStateAutosave({ benefits: next });
                    }
                  }}
                  className="bg-accent text-accent-foreground text-xs px-4 rounded-xl cursor-pointer font-bold h-10 w-10 min-w-0"
                >
                  <Plus size={14} />
                </Button>
              </div>
              {benefits.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1 select-none">
                  {benefits.map((b) => (
                    <Chip key={b} variant="soft" className="bg-accent/10 border border-accent/20 text-accent font-semibold text-xs py-1 flex items-center gap-1">
                      <Chip.Label>{b}</Chip.Label>
                      <button
                        type="button"
                        onClick={() => {
                          const next = benefits.filter((x) => x !== b);
                          setBenefits(next);
                          queueStateAutosave({ benefits: next });
                        }}
                        className="hover:opacity-85 cursor-pointer outline-hidden p-0.5"
                      >
                        <X size={10} />
                      </button>
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div>
              <Typography type="h3" className="font-bold mb-1">Step 6: Campaign Window & Lifecycle</Typography>
              <Typography type="body-xs" className="text-muted">Configure your campaign targets, active windows, and automation closing policies.</Typography>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs font-semibold text-foreground/80">Start Date</label>
                  <HelpTooltip content="The scheduled launch date for this hiring requirements campaign." />
                </div>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    queueStateAutosave({ startDate: e.target.value });
                  }}
                  className="text-xs font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs font-semibold text-foreground/80">End Date</label>
                  <HelpTooltip content="The final closure date. Used to compute automatic closure." />
                </div>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    queueStateAutosave({ endDate: e.target.value });
                  }}
                  className="text-xs font-medium"
                />
              </div>

              <div className="space-y-1.5 select-none">
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs font-semibold text-foreground/80">Auto-Close Policy</label>
                  <HelpTooltip content="Rules to automatically terminate campaign status based on targets or dates." />
                </div>
                <select
                  value={autoCloseRule}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setAutoCloseRule(val);
                    queueStateAutosave({ autoCloseRule: val });
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-field-background text-foreground text-xs font-medium focus:border-focus focus:ring-1 focus:ring-focus/20 outline-hidden cursor-pointer"
                >
                  <option value={0}>No Automatic Close</option>
                  <option value={1}>Close on End Date</option>
                  <option value={2}>Close on Hiring Headcount Target</option>
                  <option value={3}>Close on Date or Hiring Target (Either)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs font-semibold text-foreground/80">Pipeline Targets (Candidates Needed)</label>
                  <HelpTooltip content="The size of verified candidate matches pipeline requested." />
                </div>
                <Input
                  type="number"
                  value={candidatesNeededCount.toString()}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 5;
                    setCandidatesNeededCount(val);
                    queueStateAutosave({ candidatesNeededCount: val });
                  }}
                  className="text-xs font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs font-semibold text-foreground/80">Hiring Headcount Target</label>
                  <HelpTooltip content="The total number of open vacancies targeted for this role profile." />
                </div>
                <Input
                  type="number"
                  value={headcount.toString()}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setHeadcount(val);
                    queueStateAutosave({ headcount: val });
                  }}
                  className="text-xs font-medium"
                />
              </div>
            </div>

            {/* Dynamic Preview Status Widget */}
            <div className="border-t border-border/40 pt-4">
              {getDynamicStatusPreview()}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-outfit text-foreground select-none">
      {/* Left Stepper Sidebar */}
      <div className="lg:col-span-3 space-y-2 select-none">
        <Card className="p-4 border border-border/80 bg-surface">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-bold text-accent uppercase tracking-wider block">Intake Steps</span>
            {autosaveState !== "idle" && (
              <div className="flex items-center gap-1 text-[9px] font-bold">
                {autosaveState === "saving" && (
                  <span className="text-warning flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin" /> Saving...
                  </span>
                )}
                {autosaveState === "saved" && (
                  <span className="text-success flex items-center gap-0.5" title={lastSavedTime ? `Last saved at ${lastSavedTime}` : ""}>
                    <Check size={10} /> Saved
                  </span>
                )}
                {autosaveState === "error" && (
                  <span className="text-danger flex items-center gap-0.5">
                    <AlertTriangle size={10} /> Error
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="space-y-1">
            {[
              { step: 1, label: "Role Definition", icon: Briefcase },
              { step: 2, label: "Hiring Goals", icon: Target },
              { step: 3, label: "Responsibilities", icon: User },
              { step: 4, label: "Tech Stack & Quals", icon: Sparkles },
              { step: 5, label: "Comp & Benefits", icon: Coins },
              { step: 6, label: "Campaign & Lifecycle", icon: Calendar }
            ].map((s) => {
              const Icon = s.icon;
              const isPassed = currentStep > s.step;
              const isActive = currentStep === s.step;

              return (
                <button
                  key={s.step}
                  type="button"
                  disabled={s.step > currentStep && !isPassed && !draftId}
                  onClick={() => {
                    if (draftId || isPassed) setCurrentStep(s.step);
                  }}
                  className={[
                    "w-full flex items-center gap-2.5 p-2 rounded-xl text-left text-xs font-semibold cursor-pointer transition-colors",
                    isActive ? "bg-accent/10 text-accent" :
                      isPassed || draftId ? "text-foreground/80 hover:bg-surface-secondary" :
                        "text-muted opacity-50 cursor-not-allowed"
                  ].join(" ")}
                >
                  <div className={[
                    "size-5 rounded-md flex items-center justify-center border text-[10px] font-bold",
                    isActive ? "border-accent bg-accent text-accent-foreground" :
                      isPassed ? "border-success bg-success/15 text-success" :
                        "border-border text-muted"
                  ].join(" ")}>
                    {isPassed ? "✓" : s.step}
                  </div>
                  <Icon size={12} className={isActive ? "text-accent" : isPassed ? "text-success" : "text-muted"} />
                  <span className="flex-1 truncate">{s.label}</span>
                  {isActive && <ChevronRight size={12} className="text-accent" />}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-4 border border-border/80 bg-surface">
          <span className="text-[10px] font-bold text-accent uppercase tracking-wider block mb-3">
            Step Requirements
          </span>
          <div className="space-y-2.5 select-text">
            {getStepRequirements(currentStep).map((req, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                {req.met ? (
                  <Check size={14} className="text-success mt-0.5 shrink-0" />
                ) : (
                  <div className="size-3.5 rounded-full border border-border flex items-center justify-center mt-0.5 shrink-0 bg-surface-secondary">
                    <div className="size-1.5 rounded-full bg-muted" />
                  </div>
                )}
                <span className={req.met ? "text-foreground/75 font-semibold" : "text-muted font-medium"}>
                  {req.label}
                  {req.current && <span className="text-[10px] ml-1 font-mono text-muted">({req.current})</span>}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Right Content Panel */}
      <div className="lg:col-span-9">
        <Card className="p-6 md:p-8 bg-surface border border-border/80 rounded-2xl h-full flex flex-col justify-between min-h-[450px]">
          {/* Step form */}
          <div className="flex-1 mb-8">
            {isLoading ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <Spinner size="md" color="warning" />
                <span className="text-xs font-bold text-muted block mt-2">Loading draft context...</span>
              </div>
            ) : (
              renderStepContent()
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between border-t border-border/60 pt-6">
            <Button
              onClick={() => {
                if (currentStep === 1) {
                  onCancel();
                } else {
                  setCurrentStep((prev) => prev - 1);
                }
              }}
              className="px-4 py-2 bg-transparent border border-border text-foreground hover:bg-surface-secondary font-bold rounded-xl text-xs cursor-pointer"
            >
              {currentStep === 1 ? "Cancel" : "Back"}
            </Button>

            {currentStep < 6 ? (
              <Button
                onClick={currentStep === 1 ? handleStep1Submit : handleNextStep}
                className="px-5 py-2 bg-foreground text-background font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1.5 hover:opacity-90"
              >
                Continue <ArrowRight size={12} />
              </Button>
            ) : (
              <Button
                onClick={handleGenerateClick}
                className="px-6 py-2 bg-accent text-accent-foreground font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1.5 hover:opacity-90"
              >
                Generate Intake Artifacts
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
