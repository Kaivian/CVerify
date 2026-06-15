"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Typography,
  Button,
  Spinner,
  toast,
  ProgressBar,
  Chip,
} from "@heroui/react";
import { Card } from "@/components/ui/card";
import {
  User,
  Briefcase,
  GraduationCap,
  Award,
  FileText,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  Printer,
  FolderCode,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Target,
  ShieldAlert,
  X,
  Compass,
  Clock,
  AlertTriangle,
  ExternalLink,
  Share2,
  ShieldCheck,
} from "lucide-react";

import { useProfile } from "@/hooks/use-profile";
import { useCareerPreferences } from "@/hooks/use-career-preferences";
import { useEducation } from "@/hooks/use-education";
import { useWorkExperience } from "@/hooks/use-work-experience";
import { useAchievements } from "@/hooks/use-achievements";
import { useProjects } from "@/hooks/use-projects";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useAssessment } from "@/providers/assessment-provider";
import { isDeepEqual } from "@/components/ui/unsaved-changes-bar";
import { parseDate } from "@internationalized/date";
import { useProfileStore } from "@/stores/use-profile-store";

import {
  type CvDraftState,
  type CvSectionId,
  type BasicInfoDraft,
  type SkillsDraft,
  type ProjectDraftItem,
  type ExperienceDraftItem,
  type EducationDraftItem,
  type AchievementsDraftItem,
  type PreferencesDraft,
} from "./components/types";

import { BasicInfoForm } from "./components/BasicInfoForm";
import { SkillsForm } from "./components/SkillsForm";
import { ProjectsForm } from "./components/ProjectsForm";
import { ExperienceForm } from "./components/ExperienceForm";
import { EducationForm } from "./components/EducationForm";
import { AchievementsForm } from "./components/AchievementsForm";
import { PreferencesForm } from "./components/PreferencesForm";
import { CvLivePreview } from "./components/CvLivePreview";
import { CVPreview } from "./components/CVPreview";
import { sourceCodeProviderApi } from "@/services/source-code-provider.service";
import type { SourceCodeRepository } from "@/types/source-code-provider.types";
import { RequiredFieldsMissingModal } from "@/components/ui/RequiredFieldsMissingModal";

// Mock Sample Data for testing the standard A4 template
const SAMPLE_DATA = {
  profile: {
    fullName: "Nguyễn Văn A",
    headline: "Senior Fullstack Engineer",
    bio: "Đam mê xây dựng các sản phẩm phần mềm chất lượng cao và có thể mở rộng. Hơn 5 năm kinh nghiệm làm việc với các hệ thống phân tán, React, Node.js, .NET Core và thiết kế cơ sở dữ liệu lớn.",
    location: "Hà Nội, Việt Nam",
    publicEmail: "nguyenvana@cverify.com",
    phoneNumber: "0987654321",
    socialLinks: ["github.com/nguyenvana", "linkedin.com/in/nguyenvana"],
  },
  education: [
    {
      id: "sample-edu-1",
      schoolName: "Đại học FPT",
      label: "Cử nhân Kỹ thuật phần mềm",
      startDate: "2018-09-01",
      endDate: "2022-06-30",
      gpa: 3.6,
      gpaScale: 4.0,
      description: "Thủ khoa đầu ra, học bổng 100% toàn khóa học.",
    },
  ],
  experience: [
    {
      id: "sample-exp-1",
      company: "CVerify AI Technology",
      jobTitle: "Lead Fullstack Engineer",
      startDate: "2022-07-01",
      endDate: null,
      isCurrentlyWorking: true,
      description: "Kiến trúc và triển khai giải pháp xác minh danh tính lập trình viên bằng AI. Tối ưu hóa hiệu năng cơ sở dữ liệu giúp tốc độ phân tích tăng 40%.",
      technologies: ["React", ".NET Core", "PostgreSQL", "Docker"],
      achievements: [
        { title: "Optimize DB", description: "Tối ưu hóa thành công truy vấn lớn giúp giảm tải CPU 25%" }
      ],
      links: []
    },
  ],
  achievements: [
    {
      id: "sample-ach-1",
      title: "AWS Certified Solutions Architect",
      issuer: "Amazon Web Services (AWS)",
      issueDate: "2023-05-15",
      description: "Chứng chỉ thiết kế hệ thống điện toán đám mây cấp độ chuyên nghiệp.",
    },
  ],
  projects: [
    {
      id: "sample-proj-1",
      name: "CVerify AI Portal",
      startDate: "2025-04-01",
      endDate: null,
      description: "Hệ thống tự động xác thực thông tin ứng viên và lịch sử hoạt động lập trình dựa trên phân tích mã nguồn bằng trí tuệ nhân tạo.",
      technologies: ["React.js", "Tailwind CSS", "TypeScript", "Node.js"],
      role: "Lead Front-end Developer",
      contributions: [
        "Xây dựng giao diện xem trước CV trực quan theo chuẩn A4, hỗ trợ in ấn và xuất PDF tự động.",
        "Thiết kế và triển khai cơ chế đồng bộ hóa dữ liệu thời gian thực giữa cài đặt tài khoản và CV.",
        "Tối ưu hóa tài nguyên hình ảnh và script giúp giảm 35% dung lượng bundle đầu ra."
      ]
    },
    {
      id: "sample-proj-2",
      name: "OpenSource Analytics",
      startDate: "2024-10-01",
      endDate: "2025-02-15",
      description: "Hệ thống phân tích hiệu năng đóng góp mã nguồn mở trên GitHub.",
      technologies: ["Next.js", "PostgreSQL", "D3.js", "Docker"],
      role: "Full-stack Developer",
      contributions: [
        "Tích hợp API GitHub REST & GraphQL để thu thập thông tin hoạt động commits và pull requests.",
        "Xây dựng các biểu đồ tương tác trực quan hóa tần suất đóng góp mã nguồn của lập trình viên.",
        "Triển khai Docker hóa toàn bộ ứng dụng và thiết lập pipeline CI/CD tự động lên AWS."
      ]
    }
  ],
  career: {
    targetSkills: ["React", "TypeScript", "Node.js", ".NET Core", "Kubernetes"],
    desiredJobPositions: ["Software Architect", "Fullstack Tech Lead"],
  },
};

type ViewState = "overview" | "editor" | "assessment";

// Local state for layout view

// Initial draft states to prevent undefined errors before hydration
const INITIAL_DRAFT_STATE: CvDraftState = {
  "basic-info": {
    fullName: "",
    username: "",
    headline: "",
    bio: "",
    publicEmail: "",
    phoneNumber: "",
    location: "",
    pronouns: "prefer_not",
    customPronouns: "",
    company: "",
    birthDate: "",
    socialLinks: [],
  },
  "skills": {
    targetSkills: [],
  },
  "projects": [],
  "experience": [],
  "education": [],
  "achievements": [],
  "preferences": {
    availableForHire: true,
    openToWorkStatus: "casual",
    preferredLanguage: "en",
    remotePreference: "any",
    openToRelocation: false,
    preferredLocations: [],
    employmentPreferences: [],
    expectedSalaryMin: null,
    expectedSalaryMax: null,
    expectedSalaryCurrency: "USD",
    expectedSalaryType: "Monthly",
    expectedSalaryNegotiable: false,
    isExpectedSalaryVisible: false,
    desiredJobPositions: [],
    leadershipTrack: "undecided",
    companyStagePreferences: [],
    preferredIndustries: [],
    preferredWorkEnvironments: [],
    workStyles: [],
    companyValues: [],
    workPreferenceNotes: "",
  },
};

export default function CvManagementCenter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // Page Views State
  const [viewState, setViewState] = useState<ViewState>("overview");
  const [activeTab, setActiveTab] = useState<CvSectionId>("basic-info");

  // Sync tab search param with editor state on mount/update
  const tabParam = searchParams?.get("tab") as CvSectionId | null;
  const [prevTabParam, setPrevTabParam] = useState<CvSectionId | null>(null);
  if (tabParam !== prevTabParam) {
    setPrevTabParam(tabParam);
    if (tabParam && ["basic-info", "skills", "projects", "experience", "education", "achievements", "preferences"].includes(tabParam)) {
      setActiveTab(tabParam);
      setViewState("editor");
    } else {
      setViewState("overview");
    }
  }
  const [editorMode, setEditorMode] = useState<"edit" | "preview">("edit");
  const [isSaving, setIsSaving] = useState(false);
  const [mobileShowPreview, setMobileShowPreview] = useState(false);

  // Dynamic Data hooks
  const { profile, isLoading: isProfileLoading, updateProfile, updateUsername, refreshProfile } = useProfile();
  const { career, isLoading: isCareerLoading, updateCareer, refreshCareer } = useCareerPreferences();
  const { education, isLoading: isEduLoading, addEducation, updateEducation, deleteEducation, reorderEducation, refreshEducation } = useEducation();
  const { workExperiences, isLoading: isWorkLoading, addWorkExperience, updateWorkExperience, deleteWorkExperience, reorderWorkExperiences, refreshWorkExperiences } = useWorkExperience();
  const { achievements, isLoading: isAchLoading, addAchievement, updateAchievement, deleteAchievement, reorderAchievements, refreshAchievements } = useAchievements();
  const { projects, isLoading: isProjLoading, addProject, updateProject, deleteProject, reorderProjects, refreshProjects } = useProjects();

  // Baseline and local drafts state
  const [baselines, setBaselines] = useState<CvDraftState>(INITIAL_DRAFT_STATE);
  const [drafts, setDrafts] = useState<CvDraftState>(INITIAL_DRAFT_STATE);

  // A4 Preview Overlay state
  const [isA4PreviewOpen, setIsA4PreviewOpen] = useState(false);
  const [useSampleData, setUseSampleData] = useState(false);



  // Fetch verified repositories
  const [repositories, setRepositories] = useState<SourceCodeRepository[]>([]);

  // Candidate Assessment Context & States
  const {
    readiness,
    latestAssessment,
    assessmentDetails,
    parsedProfile,
    isLoadingDetails,
    triggerAssessment,
    fetchDetails,
    connectProgressStream,
    streamProgress
  } = useAssessment();

  const [activeDetailTab, setActiveDetailTab] = useState<string>("summary");

  const [isRequiredFieldsModalOpen, setIsRequiredFieldsModalOpen] = useState(false);

  const handleTriggerAssessment = async () => {
    if (readiness && readiness.missingFields && readiness.missingFields.length > 0) {
      setIsRequiredFieldsModalOpen(true);
      return;
    }

    try {
      await triggerAssessment();
    } catch (err: any) {
      toast.danger(err.message || "Failed to run candidate assessment.");
    }
  };

  const handleForceTriggerAssessment = async () => {
    try {
      await triggerAssessment();
    } catch (err: any) {
      toast.danger(err.message || "Failed to run candidate assessment.");
    }
  };

  const handleViewAssessmentDetails = async (id: string) => {
    setViewState("assessment");
    await fetchDetails(id);
  };

  // Callback states for ResizeObserver to track modal elements safely after mounting
  const [modalFrameEl, setModalFrameEl] = useState<HTMLDivElement | null>(null);
  const [modalContentEl, setModalContentEl] = useState<HTMLDivElement | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewContentHeight, setPreviewContentHeight] = useState(1123);

  // Track container width to calculate scale
  useEffect(() => {
    if (!isA4PreviewOpen || !modalFrameEl) return;

    const A4_WIDTH_PX = 794;
    const FRAME_PADDING_PX = 64; // p-8 = 32px each side

    const updateScale = () => {
      const available = modalFrameEl.clientWidth - FRAME_PADDING_PX;
      setPreviewScale(Math.min(1, available / A4_WIDTH_PX));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(modalFrameEl);

    return () => observer.disconnect();
  }, [isA4PreviewOpen, modalFrameEl]);

  // Track content element height via ResizeObserver (fires reliably after pagination completes)
  useEffect(() => {
    if (!modalContentEl) return;

    const observer = new ResizeObserver(() => {
      const height = modalContentEl.offsetHeight;
      if (height > 0) setPreviewContentHeight(height);
    });

    observer.observe(modalContentEl);
    return () => observer.disconnect();
  }, [modalContentEl]);

  useEffect(() => {
    let active = true;
    const fetchRepos = async () => {
      try {
        const result = await sourceCodeProviderApi.fetchRepositories({
          page: 1,
          pageSize: 100,
        });
        if (active) {
          const verifiedRepos = result.items.filter(
            (r) => r.isEnabled
          );
          setRepositories(verifiedRepos);
        }
      } catch (err) {
        console.error("Failed to load repositories for CV page:", err);
      }
    };
    fetchRepos();
    return () => {
      active = false;
    };
  }, []);

  // Manage parent dashboard layout overflow on desktop
  useEffect(() => {
    if (typeof window === "undefined") return;

    const parentMain = document.querySelector("main.flex-1.overflow-y-auto");
    if (!parentMain) return;

    if (viewState === "editor") {
      parentMain.classList.add("lg:overflow-hidden");
    } else {
      parentMain.classList.remove("lg:overflow-hidden");
    }

    return () => {
      parentMain.classList.remove("lg:overflow-hidden");
    };
  }, [viewState]);



  // Hydrate states when server data fetches successfully
  useEffect(() => {
    if (profile) {
      const basicMapped: BasicInfoDraft = {
        fullName: profile.fullName || "",
        username: profile.username || "",
        headline: profile.headline || "",
        bio: profile.bio || "",
        publicEmail: profile.publicEmail || "",
        phoneNumber: profile.phoneNumber || "",
        location: profile.location || "",
        pronouns: profile.pronouns || "prefer_not",
        customPronouns: profile.customPronouns || "",
        company: profile.company || "",
        birthDate: profile.birthDate ? profile.birthDate.split("T")[0] : "",
        socialLinks: profile.socialLinks || [],
        aiSuggestionsJson: profile.aiSuggestionsJson || null,
      };

      const timer = setTimeout(() => {
        setBaselines((prev) => ({
          ...prev,
          "basic-info": basicMapped,
        }));
        setDrafts((prev) => ({
          ...prev,
          "basic-info": basicMapped,
        }));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [profile]);

  useEffect(() => {
    if (career) {
      const declared = career.declaredPreferences || {};
      const skillsMapped: SkillsDraft = {
        targetSkills: declared.targetSkills || [],
      };

      const prefMapped: PreferencesDraft = {
        availableForHire: declared.availableForHire ?? true,
        openToWorkStatus: declared.openToWorkStatus || "casual",
        preferredLanguage: declared.preferredLanguage || "en",
        remotePreference: declared.remotePreference || "any",
        openToRelocation: declared.openToRelocation ?? false,
        preferredLocations: declared.preferredLocations || [],
        employmentPreferences: declared.employmentPreferences || [],
        expectedSalaryMin: declared.expectedSalaryMin ?? null,
        expectedSalaryMax: declared.expectedSalaryMax ?? null,
        expectedSalaryCurrency: declared.expectedSalaryCurrency || "USD",
        expectedSalaryType: declared.expectedSalaryType || "Monthly",
        expectedSalaryNegotiable: declared.expectedSalaryNegotiable ?? false,
        isExpectedSalaryVisible: declared.isExpectedSalaryVisible ?? false,
        desiredJobPositions: declared.desiredJobPositions || [],
        leadershipTrack: declared.leadershipTrack || "undecided",
        companyStagePreferences: declared.companyStagePreferences || [],
        preferredIndustries: declared.preferredIndustries || [],
        preferredWorkEnvironments: declared.preferredWorkEnvironments || [],
        workStyles: declared.workStyles || [],
        companyValues: declared.companyValues || [],
        workPreferenceNotes: declared.workPreferenceNotes || "",
      };

      const timer = setTimeout(() => {
        setBaselines((prev) => ({
          ...prev,
          "skills": skillsMapped,
          "preferences": prefMapped,
        }));
        setDrafts((prev) => ({
          ...prev,
          "skills": skillsMapped,
          "preferences": prefMapped,
        }));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [career]);

  useEffect(() => {
    if (workExperiences) {
      const expMapped: ExperienceDraftItem[] = workExperiences.map((we) => ({
        id: we.id,
        jobTitle: we.jobTitle,
        company: we.company,
        experienceCategory: we.experienceCategory,
        employmentType: we.employmentType,
        location: we.location || "",
        startDate: we.startDate ? we.startDate.split("T")[0] : "",
        endDate: we.endDate ? we.endDate.split("T")[0] : null,
        isCurrentlyWorking: we.isCurrentlyWorking,
        description: we.description,
        technologies: we.technologies || [],
        achievements: we.achievements || [],
        links: we.links || [],
        isLeadership: we.isLeadership || false,
      }));

      const timer = setTimeout(() => {
        setBaselines((prev) => ({ ...prev, "experience": expMapped }));
        setDrafts((prev) => ({ ...prev, "experience": expMapped }));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [workExperiences]);

  useEffect(() => {
    if (education) {
      const eduMapped: EducationDraftItem[] = education.map((edu) => ({
        id: edu.id,
        label: edu.label,
        school: edu.schoolName,
        degree: edu.degree || "",
        major: edu.major || "",
        gpa: edu.gpa,
        gpaScale: edu.gpaScale,
        description: edu.description || "",
        isCurrentlyStudying: edu.isCurrentlyStudying,
        period: {
          start: edu.startDate ? parseDate(edu.startDate.split("T")[0]) : null,
          end: edu.endDate ? parseDate(edu.endDate.split("T")[0]) : null,
        },
      }));

      const timer = setTimeout(() => {
        setBaselines((prev) => ({ ...prev, "education": eduMapped }));
        setDrafts((prev) => ({ ...prev, "education": eduMapped }));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [education]);

  useEffect(() => {
    if (achievements) {
      const achMapped: AchievementsDraftItem[] = achievements.map((ach) => ({
        id: ach.id,
        title: ach.title,
        issuer: ach.issuer,
        issueDate: ach.issueDate ? ach.issueDate.split("T")[0] : "",
        description: ach.description || "",
        credentialUrl: ach.credentialUrl || "",
        attachmentId: ach.attachment?.id || null,
        attachmentName: ach.attachment?.fileName,
        attachmentSize: ach.attachment?.fileSize,
        attachmentUrl: ach.attachment?.fileUrl,
      }));

      const timer = setTimeout(() => {
        setBaselines((prev) => ({ ...prev, "achievements": achMapped }));
        setDrafts((prev) => ({ ...prev, "achievements": achMapped }));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [achievements]);

  useEffect(() => {
    if (projects) {
      const projMapped: ProjectDraftItem[] = projects.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role || "",
        description: p.description || "",
        startDate: p.startDate ? p.startDate.split("T")[0] : "",
        endDate: p.endDate ? p.endDate.split("T")[0] : null,
        isCurrentlyWorking: p.isCurrentlyWorking,
        verificationLevel: p.verificationLevel,
        verificationStatus: p.verificationStatus,
        verifiedAt: p.verifiedAt,
        verificationMetadataJson: p.verificationMetadataJson,
        repositoryLinks: p.repositoryLinks || [],
        technologies: p.technologies || [],
        contributions: p.contributions || [],
      }));

      const timer = setTimeout(() => {
        setBaselines((prev) => ({ ...prev, "projects": projMapped }));
        setDrafts((prev) => ({ ...prev, "projects": projMapped }));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [projects]);

  // Compute dirty states per section
  const dirtyFlags = {
    "basic-info": !isDeepEqual(drafts["basic-info"], baselines["basic-info"]),
    "skills": !isDeepEqual(drafts["skills"], baselines["skills"]),
    "projects": !isDeepEqual(drafts["projects"], baselines["projects"]),
    "experience": !isDeepEqual(drafts["experience"], baselines["experience"]),
    "education": !isDeepEqual(drafts["education"], baselines["education"]),
    "achievements": !isDeepEqual(drafts["achievements"], baselines["achievements"]),
    "preferences": !isDeepEqual(drafts["preferences"], baselines["preferences"]),
  };

  const calculateCompleteness = () => {
    if (career?.readinessReport?.completenessPercent !== undefined) {
      return career.readinessReport.completenessPercent;
    }

    let count = 0;
    const total = 8;
    if (profile?.fullName) count++;
    if (profile?.bio) count++;
    if (education && education.length > 0) count++;
    if (workExperiences && workExperiences.length > 0) count++;
    if (achievements && achievements.length > 0) count++;
    if (career?.declaredPreferences?.targetSkills && career.declaredPreferences.targetSkills.length > 0) count++;
    if (career?.declaredPreferences?.desiredJobPositions && career.declaredPreferences.desiredJobPositions.length > 0) count++;
    if (career?.declaredPreferences?.openToWorkStatus) count++;

    return Math.round((count / total) * 100);
  };

  const completenessPercent = calculateCompleteness();

  const getCompletenessStatus = (percent: number) => {
    if (percent < 50) return { label: "Needs Improvement", color: "warning" as const };
    if (percent < 80) return { label: "In Progress", color: "default" as const };
    return { label: "Strong", color: "success" as const };
  };

  const status = getCompletenessStatus(completenessPercent);

  // Suggested Actions Checklist
  const getSuggestedActions = () => {
    if (career?.readinessReport?.actionItems && career.readinessReport.actionItems.length > 0) {
      return career.readinessReport.actionItems.map((item, idx) => ({
        id: item.id || `ai-action-${idx}`,
        text: item.message,
      }));
    }

    const actions = [];
    if (!profile?.fullName) actions.push({ id: "fullName", text: "Add your full name" });
    if (!profile?.bio) actions.push({ id: "bio", text: "Add your profile summary / bio" });
    if (!education || education.length === 0) actions.push({ id: "education", text: "Add school and education information" });
    if (!workExperiences || workExperiences.length === 0) actions.push({ id: "experience", text: "Add work experience" });
    if (!achievements || achievements.length === 0) actions.push({ id: "achievements", text: "Update achievements and certificates" });
    if (!career?.declaredPreferences?.targetSkills || career.declaredPreferences.targetSkills.length === 0) {
      actions.push({ id: "skills", text: "Update your target skills" });
    }
    return actions;
  };

  const suggestedActions = getSuggestedActions();

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const isLoading = isProfileLoading || isCareerLoading || isEduLoading || isWorkLoading || isAchLoading || isProjLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" color="accent" />
      </div>
    );
  }

  // Handle saving of active section
  const handleSaveActiveSection = async (sectionData?: any) => {
    setIsSaving(true);
    try {
      if (activeTab === "basic-info") {
        const payload = sectionData || drafts["basic-info"];

        // 1. Separate Username update if it changed from baseline
        if (payload.username !== baselines["basic-info"].username) {
          try {
            await updateUsername(payload.username);
            toast.success("Username updated successfully!");
          } catch (err: any) {
            console.error(err);
            const errMsg = err.response?.data?.message || "Username is already taken, please choose another one.";
            toast.danger(errMsg);
            setIsSaving(false);
            return; // Halt save operation if username update fails
          }
        }

        // 2. Profile Details Save
        const response = await updateProfile({
          fullName: payload.fullName || null,
          bio: payload.bio || null,
          location: payload.location || null,
          phoneNumber: payload.phoneNumber || null,
          birthDate: payload.birthDate ? new Date(payload.birthDate).toISOString() : null,
          headline: payload.headline || null,
          company: payload.company || null,
          pronouns: payload.pronouns || null,
          customPronouns: payload.customPronouns || null,
          publicEmail: payload.publicEmail || null,
          profileVisibility: profile?.profileVisibility || "public",
          recruiterVisibility: profile?.recruiterVisibility ?? true,
          aiTalentDiscovery: profile?.aiTalentDiscovery || "disabled",
          socialLinks: payload.socialLinks || [],
          aiSuggestionsJson: payload.aiSuggestionsJson || null,
          version: profile?.version || 0,
        });

        const updatedBasic: BasicInfoDraft = {
          fullName: response.fullName || "",
          username: response.username || "",
          headline: response.headline || "",
          bio: response.bio || "",
          publicEmail: response.publicEmail || "",
          phoneNumber: response.phoneNumber || "",
          location: response.location || "",
          pronouns: response.pronouns || "prefer_not",
          customPronouns: response.customPronouns || "",
          company: response.company || "",
          birthDate: response.birthDate ? response.birthDate.split("T")[0] : "",
          socialLinks: response.socialLinks || [],
          aiSuggestionsJson: response.aiSuggestionsJson || null,
        };

        setBaselines((prev) => ({ ...prev, "basic-info": updatedBasic }));
        setDrafts((prev) => ({ ...prev, "basic-info": updatedBasic }));
        toast.success("Changes saved successfully!");
        await refreshProfile();
      } else if (activeTab === "skills") {
        const payload = drafts["skills"];
        const response = await updateCareer({
          targetSkills: payload.targetSkills,
          version:
            useProfileStore.getState().career?.declaredPreferences?.version ??
            career?.declaredPreferences?.version ??
            0,
        });

        const updatedSkills: SkillsDraft = { targetSkills: response.declaredPreferences.targetSkills || [] };
        setBaselines((prev) => ({ ...prev, "skills": updatedSkills }));
        setDrafts((prev) => ({ ...prev, "skills": updatedSkills }));
        toast.success("Changes saved successfully!");
        await refreshCareer();
      } else if (activeTab === "preferences") {
        const payload = drafts["preferences"];
        const response = await updateCareer({
          availableForHire: payload.availableForHire,
          openToWorkStatus: payload.openToWorkStatus,
          preferredLanguage: payload.preferredLanguage,
          remotePreference: payload.remotePreference,
          openToRelocation: payload.openToRelocation,
          preferredLocations: payload.preferredLocations,
          employmentPreferences: payload.employmentPreferences,
          expectedSalaryMin: payload.expectedSalaryMin,
          expectedSalaryMax: payload.expectedSalaryMax,
          expectedSalaryCurrency: payload.expectedSalaryCurrency,
          expectedSalaryType: payload.expectedSalaryType,
          expectedSalaryNegotiable: payload.expectedSalaryNegotiable,
          isExpectedSalaryVisible: payload.isExpectedSalaryVisible,
          desiredJobPositions: payload.desiredJobPositions,
          leadershipTrack: payload.leadershipTrack,
          companyStagePreferences: payload.companyStagePreferences,
          preferredIndustries: payload.preferredIndustries,
          preferredWorkEnvironments: payload.preferredWorkEnvironments,
          workStyles: payload.workStyles,
          companyValues: payload.companyValues,
          workPreferenceNotes: payload.workPreferenceNotes,
          version:
            useProfileStore.getState().career?.declaredPreferences?.version ??
            career?.declaredPreferences?.version ??
            0,
        });

        const declared = response.declaredPreferences || {};
        const updatedPref: PreferencesDraft = {
          availableForHire: declared.availableForHire ?? true,
          openToWorkStatus: declared.openToWorkStatus || "casual",
          preferredLanguage: declared.preferredLanguage || "en",
          remotePreference: declared.remotePreference || "any",
          openToRelocation: declared.openToRelocation ?? false,
          preferredLocations: declared.preferredLocations || [],
          employmentPreferences: declared.employmentPreferences || [],
          expectedSalaryMin: declared.expectedSalaryMin ?? null,
          expectedSalaryMax: declared.expectedSalaryMax ?? null,
          expectedSalaryCurrency: declared.expectedSalaryCurrency || "USD",
          expectedSalaryType: declared.expectedSalaryType || "Monthly",
          expectedSalaryNegotiable: declared.expectedSalaryNegotiable ?? false,
          isExpectedSalaryVisible: declared.isExpectedSalaryVisible ?? false,
          desiredJobPositions: declared.desiredJobPositions || [],
          leadershipTrack: declared.leadershipTrack || "undecided",
          companyStagePreferences: declared.companyStagePreferences || [],
          preferredIndustries: declared.preferredIndustries || [],
          preferredWorkEnvironments: declared.preferredWorkEnvironments || [],
          workStyles: declared.workStyles || [],
          companyValues: declared.companyValues || [],
          workPreferenceNotes: declared.workPreferenceNotes || "",
        };

        setBaselines((prev) => ({ ...prev, "preferences": updatedPref }));
        setDrafts((prev) => ({ ...prev, "preferences": updatedPref }));
        toast.success("Changes saved successfully!");
        await refreshCareer();
      } else if (activeTab === "experience") {
        // List-based Work Experience save
        const formItems = drafts["experience"];
        const baselineItems = baselines["experience"];
        const finalIds: string[] = [];

        // 1. Delete removed items
        const formIds = formItems.map((item) => item.id);
        const toDelete = baselineItems.filter((item) => !formIds.includes(item.id));
        for (const item of toDelete) {
          await deleteWorkExperience(item.id);
        }

        // 2. Add or Update remaining items
        for (const item of formItems) {
          const payload = {
            jobTitle: item.jobTitle,
            company: item.company,
            experienceCategory: item.experienceCategory,
            employmentType: item.employmentType,
            location: item.location || null,
            startDate: new Date(item.startDate).toISOString(),
            endDate: item.endDate ? new Date(item.endDate).toISOString() : null,
            isCurrentlyWorking: item.isCurrentlyWorking,
            description: item.description,
            achievements: item.achievements,
            technologies: item.technologies,
            links: item.links,
          };

          if (item.id.startsWith("temp-")) {
            const response = await addWorkExperience(payload);
            finalIds.push(response.id);
          } else {
            const response = await updateWorkExperience(item.id, payload);
            finalIds.push(response.id);
          }
        }

        // 3. Reorder list
        if (finalIds.length > 0) {
          await reorderWorkExperiences(finalIds);
        }

        toast.success("Changes saved successfully!");
        await refreshWorkExperiences();
      } else if (activeTab === "education") {
        // List-based Education save
        const formItems = drafts["education"];
        const baselineItems = baselines["education"];
        const finalIds: string[] = [];

        const formIds = formItems.map((item) => item.id);
        const toDelete = baselineItems.filter((item) => !formIds.includes(item.id));
        for (const item of toDelete) {
          await deleteEducation(item.id);
        }

        for (const item of formItems) {
          const payload = {
            label: item.label,
            schoolName: item.school,
            degree: item.degree || null,
            major: item.major || null,
            gpa: item.gpa,
            gpaScale: item.gpaScale,
            description: item.description || null,
            startDate: item.period?.start ? new Date(item.period.start.toString()).toISOString() : null,
            endDate: item.isCurrentlyStudying ? null : (item.period?.end ? new Date(item.period.end.toString()).toISOString() : null),
            isCurrentlyStudying: item.isCurrentlyStudying,
          };

          if (item.id.startsWith("temp-")) {
            const response = await addEducation(payload);
            finalIds.push(response.id);
          } else {
            const response = await updateEducation(item.id, payload);
            finalIds.push(response.id);
          }
        }

        if (finalIds.length > 0) {
          await reorderEducation(finalIds);
        }

        toast.success("Changes saved successfully!");
        await refreshEducation();
      } else if (activeTab === "achievements") {
        // List-based Achievements save
        const formItems = drafts["achievements"];
        const baselineItems = baselines["achievements"];
        const finalIds: string[] = [];

        const formIds = formItems.map((item) => item.id);
        const toDelete = baselineItems.filter((item) => !formIds.includes(item.id));
        for (const item of toDelete) {
          await deleteAchievement(item.id);
        }

        for (const item of formItems) {
          const payload = {
            title: item.title,
            issuer: item.issuer,
            issueDate: new Date(item.issueDate).toISOString(),
            description: item.description,
            credentialUrl: item.credentialUrl || null,
            attachmentId: item.attachmentId,
          };

          if (item.id.startsWith("temp-")) {
            const response = await addAchievement(payload);
            finalIds.push(response.id);
          } else {
            const response = await updateAchievement(item.id, payload);
            finalIds.push(response.id);
          }
        }

        if (finalIds.length > 0) {
          await reorderAchievements(finalIds);
        }

        toast.success("Changes saved successfully!");
        await refreshAchievements();
      } else if (activeTab === "projects") {
        const formItems = drafts["projects"];
        const baselineItems = baselines["projects"];
        const finalIds: string[] = [];

        const formIds = formItems.map((item) => item.id);
        const toDelete = baselineItems.filter((item) => !formIds.includes(item.id));
        for (const item of toDelete) {
          await deleteProject(item.id);
        }

        for (const item of formItems) {
          const payload = {
            name: item.name,
            role: item.role || null,
            description: item.description,
            startDate: item.startDate ? new Date(item.startDate).toISOString() : null,
            endDate: item.endDate ? new Date(item.endDate).toISOString() : null,
            isCurrentlyWorking: item.isCurrentlyWorking,
            verificationLevel: item.verificationLevel,
            linkedRepositoryIds: item.repositoryLinks.map((r) => r.sourceCodeRepositoryId),
            technologies: item.technologies,
            contributions: item.contributions,
          };

          if (item.id.startsWith("temp-")) {
            const response = await addProject(payload);
            finalIds.push(response.id);
          } else {
            const response = await updateProject(item.id, payload);
            finalIds.push(response.id);
          }
        }

        if (finalIds.length > 0) {
          await reorderProjects(finalIds);
        }

        toast.success("Changes saved successfully!");
        await refreshProjects();
      }
    } catch (err: any) {
      console.error(err);
      const serverMessage = err?.response?.data?.message;
      const validationErrors = err?.response?.data?.errors;
      let displayError = serverMessage || "Some changes failed to save. Re-syncing with server...";

      if (validationErrors && typeof validationErrors === "object") {
        const errorList = Object.entries(validationErrors)
          .map(([field, msgs]: any) => `${field}: ${msgs.join(", ")}`)
          .join(" | ");
        if (errorList) {
          displayError = `${displayError} (${errorList})`;
        }
      }

      toast.danger(displayError);
      // Resynchronize client list with store upon partial failure
      if (activeTab === "experience") await refreshWorkExperiences();
      if (activeTab === "education") await refreshEducation();
      if (activeTab === "achievements") await refreshAchievements();
      if (activeTab === "projects") await refreshProjects();
      if (activeTab === "basic-info") await refreshProfile();
      if (activeTab === "skills" || activeTab === "preferences") await refreshCareer();
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetActiveSection = () => {
    setDrafts((prev) => ({ ...prev, [activeTab]: baselines[activeTab] }));
    toast.success("Section reset successfully!");
  };

  const activeProfile = useSampleData ? SAMPLE_DATA.profile : {
    fullName: drafts["basic-info"].fullName || "Untitled",
    headline: drafts["basic-info"].headline || "Headline not set",
    bio: drafts["basic-info"].bio || "",
    location: drafts["basic-info"].location || "",
    publicEmail: drafts["basic-info"].publicEmail || "",
    phoneNumber: drafts["basic-info"].phoneNumber || "",
    socialLinks: drafts["basic-info"].socialLinks || [],
    aiSuggestionsJson: drafts["basic-info"].aiSuggestionsJson,
  };

  const activeEdu = useSampleData ? SAMPLE_DATA.education : drafts["education"];
  const activeExp = useSampleData ? SAMPLE_DATA.experience : drafts["experience"];
  const activeAch = useSampleData ? SAMPLE_DATA.achievements : drafts["achievements"];
  const activeCareer = useSampleData ? SAMPLE_DATA.career : {
    targetSkills: drafts["skills"].targetSkills || [],
    desiredJobPositions: drafts["preferences"].desiredJobPositions || [],
  };

  const activePreferences = useSampleData ? INITIAL_DRAFT_STATE["preferences"] : drafts["preferences"];
  const activeProjects = useSampleData ? SAMPLE_DATA.projects : drafts["projects"];

  const renderAssessmentDashboard = () => {
    if (isLoadingDetails || !assessmentDetails) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <Spinner size="lg" color="accent" />
        </div>
      );
    }

    const { assessment, artifacts } = assessmentDetails;
    const profileArtifact = artifacts.find(a => a.artifactType === 'CandidateProfile');
    const profileData = profileArtifact ? JSON.parse(profileArtifact.jsonData) : null;
    const activeData = profileData || assessment;

    const cvLinkedRepoIds = new Set(
      projects.flatMap(p => p.repositoryLinks?.map(l => l.sourceCodeRepositoryId) || [])
    );
    const cvLinkedRepos = repositories.filter(r => cvLinkedRepoIds.has(r.id));

    const scrollToSection = (id: string) => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    const handleShareProfile = () => {
      if (typeof window !== "undefined") {
        const url = `${window.location.origin}/${profile?.username || ''}`;
        navigator.clipboard.writeText(url);
        toast.success("Public profile link copied to clipboard!");
      }
    };

    // Normalize skills and role recommendations to support both legacy and Pipeline 2 schemas
    const rawSkills = (activeData.skills || activeData.skillProficiencies || []).map((item: any) => {
      let reasoningText = item.reasoning || item.evidenceRationale || "";
      if (!reasoningText && item.evidenceSources) {
        try {
          const parsed = typeof item.evidenceSources === 'string' ? JSON.parse(item.evidenceSources) : item.evidenceSources;
          reasoningText = parsed.rationale || "";
        } catch (e) { }
      }
      return {
        ...item,
        skillName: item.skillName || item.skill || "",
        proficiencyLevel: item.level || item.proficiencyLevel || "Working",
        reasoning: reasoningText
      };
    });

    const rawRoles = (activeData.bestFitRoles || activeData.suggestedRoles || []).map((item: any) => {
      let rationale = item.rationale || "";
      if (!rationale && item.evidence) {
        try {
          const parsed = typeof item.evidence === 'string' ? JSON.parse(item.evidence) : item.evidence;
          rationale = parsed.rationale || "";
        } catch (e) { }
      }
      const reasonsList = Array.isArray(item.reasons)
        ? item.reasons
        : rationale
          ? [rationale]
          : ["Verified capability match based on codebase evidence."];
      return {
        ...item,
        role: item.role || item.roleTitle || "Software Engineer",
        matchScore: item.matchScore || (item.confidence ? Math.round(item.confidence * 100) : 0),
        reasons: reasonsList
      };
    });

    // Grouping skills for capability clusters
    const sortedLangSkills = [...(rawSkills.filter((item: any) =>
      item.skillName && ['react', 'typescript', 'next.js', 'javascript', 'python', 'c#', '.net core', 'node.js', 'css', 'tailwind css', 'three.js', 'glsl'].includes(item.skillName.toLowerCase())
    ) || [])].sort((a: any, b: any) => (b.score || 0) - (a.score || 0));

    const sortedSystemSkills = [...(rawSkills.filter((item: any) =>
      item.skillName && !['react', 'typescript', 'next.js', 'javascript', 'python', 'c#', '.net core', 'node.js', 'css', 'tailwind css', 'three.js', 'glsl'].includes(item.skillName.toLowerCase())
    ) || [])].sort((a: any, b: any) => (b.score || 0) - (a.score || 0));

    const displayedLangSkills = sortedLangSkills.slice(0, 5);
    const displayedSystemSkills = sortedSystemSkills.slice(0, 5);

    return (
      <div className="flex flex-col gap-8 text-left w-full relative pb-16 select-none font-sans">
        {/* Top Breadcrumb & Quick Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/40 select-none shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Candidates</span>
            <ChevronRight className="size-3" />
            <span className="font-semibold text-foreground">{profile?.fullName || "Candidate"}</span>
            <ChevronRight className="size-3" />
            <span className="font-semibold text-accent">AI Vetting Assessment</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide ${readiness?.requiresReassessment
              ? "bg-warning/15 text-warning border border-warning/30"
              : "bg-success/15 text-success border border-success/30"
              }`}>
              {readiness?.requiresReassessment ? "Outdated" : "Verified & Up-to-date"}
            </span>
            <Button
              size="sm"
              variant="secondary"
              className="rounded-xl font-bold text-xs select-none border border-border/30 hover:bg-surface-secondary h-8 w-fit flex items-center gap-1.5 cursor-pointer"
              onPress={handleShareProfile}
            >
              <Share2 className="size-3.5" />
              <span>Share Profile</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="rounded-xl font-bold text-xs select-none border border-border/30 hover:bg-surface-secondary h-8 w-fit flex items-center gap-1.5 cursor-pointer"
              onPress={() => window.print()}
            >
              <Printer className="size-3.5" />
              <span>Export PDF</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="rounded-xl font-bold text-xs select-none border border-border/30 hover:bg-surface-secondary h-8 w-fit flex items-center gap-1.5 cursor-pointer"
              onPress={() => setViewState("overview")}
            >
              <ArrowLeft className="size-3.5" />
              <span>Back</span>
            </Button>
          </div>
        </div>

        {/* Hero Card: Candidate intelligence overview */}
        <div id="section-summary" className="p-8 md:p-10 border border-border/50 bg-surface rounded-2xl flex flex-col lg:flex-row gap-8 items-center shadow-xs relative overflow-hidden shrink-0">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-accent/10 via-accent/30 to-accent/10" />

          {/* Calibrated Dial Score */}
          <div className="relative size-32 flex items-center justify-center shrink-0 bg-surface-secondary/40 rounded-full border border-border/50 p-4">
            <svg className="size-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-border/10"
                strokeWidth="2.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-accent transition-all duration-500 ease-out"
                strokeDasharray={`${activeData.candidateScore || activeData.overallScore || 0}, 100`}
                strokeWidth="3.0"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center text-center">
              <span className="text-3xl font-black text-foreground tracking-tight">
                {Math.round(activeData.candidateScore || activeData.overallScore || 0)}
              </span>
              <span className="text-[8px] text-muted-foreground uppercase font-extrabold tracking-wider mt-0.5">Index</span>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex-1 flex flex-col gap-4 text-center lg:text-left min-w-0">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                <h3 className="text-xl font-extrabold text-foreground tracking-tight">
                  {profile?.fullName || "Candidate Evaluation"}
                </h3>
                <Chip size="sm" color="accent" variant="soft" className="text-[9px] font-black uppercase tracking-wider px-2 h-5 bg-accent/10 border-none text-accent">
                  {activeData.careerLevelLabel || activeData.careerLevel || "Middle"}
                </Chip>
                {activeData.displayConfidence && (
                  <Chip size="sm" color="default" variant="soft" className="text-[9px] font-bold uppercase tracking-wider px-2 h-5 text-muted-foreground">
                    Confidence: {Math.round(activeData.displayConfidence * 100)}%
                  </Chip>
                )}
              </div>

              {/* Premium blockquote for Recruiter Headline */}
              <div className="border-l-4 border-accent pl-5 py-3 bg-accent/5 rounded-r-xl text-left select-text">
                <p className="text-xs md:text-sm text-foreground/90 italic leading-relaxed font-medium">
                  "{activeData.recruiterHeadline || activeData.summaryHeadline || "Verified Software Engineer Profile"}"
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Intelligence Snapshot Grid (4 Columns) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
          <div className="p-5 border border-border/40 rounded-2xl bg-surface flex flex-col justify-between h-28 shadow-xs hover:border-border transition-colors">
            <div className="p-2.5 bg-surface-secondary rounded-xl text-accent shrink-0 w-fit">
              <Award className="size-4.5" />
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[9px] text-muted-foreground uppercase font-black tracking-wider">Primary Affinity</span>
              <span className="text-xs font-extrabold text-foreground truncate">{activeData.primaryTendency || "Fullstack Engineer"}</span>
            </div>
          </div>
          <div className="p-5 border border-border/40 rounded-2xl bg-surface flex flex-col justify-between h-28 shadow-xs hover:border-border transition-colors">
            <div className="p-2.5 bg-surface-secondary rounded-xl text-accent shrink-0 w-fit">
              <User className="size-4.5" />
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[9px] text-muted-foreground uppercase font-black tracking-wider">Technical Level</span>
              <span className="text-xs font-extrabold text-foreground truncate">{activeData.careerLevelLabel || "Middle (L2)"}</span>
            </div>
          </div>
          <div className="p-5 border border-border/40 rounded-2xl bg-surface flex flex-col justify-between h-28 shadow-xs hover:border-border transition-colors">
            <div className="p-2.5 bg-surface-secondary rounded-xl text-accent shrink-0 w-fit">
              <FolderCode className="size-4.5" />
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[9px] text-muted-foreground uppercase font-black tracking-wider">Scope Scanned</span>
              <span className="text-xs font-extrabold text-foreground truncate">{cvLinkedRepos.length} Repositories</span>
            </div>
          </div>
          <div className="p-5 border border-border/40 rounded-2xl bg-surface flex flex-col justify-between h-28 shadow-xs hover:border-border transition-colors">
            <div className="p-2.5 bg-surface-secondary rounded-xl text-accent shrink-0 w-fit">
              <Target className="size-4.5" />
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[9px] text-muted-foreground uppercase font-black tracking-wider">Style Index</span>
              <span className="text-xs font-extrabold text-foreground truncate">{activeData.primaryWorkingStyle || "Feature Builder"}</span>
            </div>
          </div>
        </div>

        {/* Sticky Local Nav Anchor Tabs */}
        <div className="sticky top-0 z-30 flex border-b border-border/30 bg-background/85 backdrop-blur-md gap-2 py-2 overflow-x-auto select-none scrollbar-none shrink-0">
          {[
            { id: "section-narrative", label: "AI Evaluation Report" },
            { id: "section-skills", label: "Skill Intelligence" },
            { id: "section-repos", label: "Repository Evidence" },
            { id: "section-breakdown", label: "Score Breakdown" },
            { id: "section-roles", label: "Recommended Fit" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => scrollToSection(tab.id)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-surface-secondary/50 border-none bg-transparent cursor-pointer transition-colors"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* AI Narrative & Strengths Split Grid (2-Column) */}
        <div id="section-narrative" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Narrative & Bio Suggestions Column */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Narrative Card */}
            <div className="p-6 border border-border/40 bg-surface rounded-2xl flex flex-col gap-4 shadow-xs select-text">
              <div className="flex items-center gap-2 select-none">
                <FileText className="size-4.5 text-accent" />
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-foreground">AI Evaluation Narrative</h4>
              </div>
              <div className="w-full h-px bg-border/10" />
              <p className="text-xs md:text-sm text-foreground/90 leading-relaxed text-justify font-sans font-light whitespace-pre-wrap">
                {activeData.fullSummary || activeData.summaryParagraph || "No assessment narrative generated."}
              </p>
            </div>

            {/* AI Professional Bio Suggestion Card */}
            <div className="p-6 border border-border/40 bg-surface rounded-2xl flex flex-col gap-4 shadow-xs select-text">
              <div className="flex items-center gap-2 select-none">
                <Sparkles className="size-4.5 text-success" />
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-foreground">AI Professional Bio Suggestion</h4>
              </div>
              <div className="w-full h-px bg-border/10" />
              <p className="text-xs md:text-sm text-foreground/90 leading-relaxed text-justify font-sans font-light whitespace-pre-wrap">
                {activeData.professionalBio || "No professional bio suggestion generated."}
              </p>
            </div>
          </div>

          {/* Vetting Checklists */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Key Vetted Strengths */}
            <div className="p-6 border border-success/25 bg-success/5 rounded-2xl flex flex-col gap-4 shadow-xs">
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-success flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0" />
                Key Vetted Strengths
              </h4>
              <div className="w-full h-px bg-success/15" />
              <ul className="flex flex-col gap-3 pl-0 text-xs text-foreground/90 text-left select-text list-none">
                {activeData.keyStrengths && activeData.keyStrengths.length > 0 ? (
                  activeData.keyStrengths.map((str: string, index: number) => (
                    <li key={index} className="flex gap-2.5 leading-relaxed items-start font-light">
                      <CheckCircle2 className="size-3.5 text-success mt-0.5 shrink-0" />
                      <span>{str}</span>
                    </li>
                  ))
                ) : (
                  <li className="flex gap-2.5 leading-relaxed items-start font-light">
                    <CheckCircle2 className="size-3.5 text-success mt-0.5 shrink-0" />
                    <span>Strong codebase contribution patterns detected.</span>
                  </li>
                )}
              </ul>
            </div>

            {/* Watch Points */}
            <div className="p-6 border border-warning/25 bg-warning/5 rounded-2xl flex flex-col gap-4 shadow-xs">
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-warning flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                Vetting Risks & Watch Points
              </h4>
              <div className="w-full h-px bg-warning/15" />
              <ul className="flex flex-col gap-3 pl-0 text-xs text-foreground/90 text-left select-text list-none">
                {activeData.watchPoints && activeData.watchPoints.length > 0 ? (
                  activeData.watchPoints.map((wp: string, index: number) => (
                    <li key={index} className="flex gap-2.5 leading-relaxed items-start font-light">
                      <AlertTriangle className="size-3.5 text-warning mt-0.5 shrink-0" />
                      <span>{wp}</span>
                    </li>
                  ))
                ) : (
                  <li className="flex gap-2.5 leading-relaxed items-start font-light">
                    <AlertTriangle className="size-3.5 text-warning mt-0.5 shrink-0" />
                    <span>No major risks or architectural gaps flagged.</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Skill Clusters */}
        <div id="section-skills" className="p-6 border border-border/40 bg-surface rounded-2xl flex flex-col gap-5 shadow-xs">
          <div className="flex flex-col gap-1">
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-foreground">Skill Intelligence & Evidence Graph</h4>
            <p className="text-[10px] text-muted-foreground">Technologies evaluated and verified through codebase commit signatures.</p>
          </div>
          <div className="w-full h-px bg-border/10" />

          {rawSkills.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 select-text">
              {/* Group A: Languages & Frameworks */}
              <div className="flex flex-col gap-4">
                <span className="text-[10px] uppercase font-bold text-accent tracking-wider select-none">
                  Core Languages & Front-end Stack (Top {displayedLangSkills.length})
                </span>
                <div className="flex flex-col gap-3">
                  {displayedLangSkills.map((item: any, idx: number) => (
                    <div key={idx} className="p-4 border border-border/40 rounded-xl bg-surface-secondary/20 flex flex-col gap-2">
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground text-xs">{item.skillName}</span>
                          <Chip size="sm" variant="soft" color="accent" className="text-[8px] font-black uppercase px-1.5 h-4.5 bg-accent/10 border-none text-accent">
                            {item.proficiencyLevel}
                          </Chip>
                        </div>
                        {item.evidenceCount !== undefined && (
                          <span className="text-[9px] font-semibold text-success bg-success/5 border border-success/15 px-1.5 py-0.5 rounded-full">
                            {item.evidenceCount} Commits
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed font-light">{item.reasoning}</p>
                    </div>
                  ))}
                  {displayedLangSkills.length === 0 && <span className="text-xs text-muted-foreground italic font-light">No core framework matches.</span>}
                </div>
              </div>

              {/* Group B: Systems & Databases */}
              <div className="flex flex-col gap-4">
                <span className="text-[10px] uppercase font-bold text-accent tracking-wider select-none">
                  Systems Architecture, Databases & Tooling (Top {displayedSystemSkills.length})
                </span>
                <div className="flex flex-col gap-3">
                  {displayedSystemSkills.map((item: any, idx: number) => (
                    <div key={idx} className="p-4 border border-border/40 rounded-xl bg-surface-secondary/20 flex flex-col gap-2">
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground text-xs">{item.skillName}</span>
                          <Chip size="sm" variant="soft" color="default" className="text-[8px] font-black uppercase px-1.5 h-4.5">
                            {item.proficiencyLevel}
                          </Chip>
                        </div>
                        {item.evidenceCount !== undefined && (
                          <span className="text-[9px] font-semibold text-success bg-success/5 border border-success/15 px-1.5 py-0.5 rounded-full">
                            {item.evidenceCount} Commits
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed font-light">{item.reasoning}</p>
                    </div>
                  ))}
                  {displayedSystemSkills.length === 0 && <span className="text-xs text-muted-foreground italic font-light">No architectural matches.</span>}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-xs font-light">
              No technical skill proficiencies mapped in this assessment.
            </div>
          )}
        </div>

        {/* Repository Evidence */}
        <div id="section-repos" className="p-6 border border-border/40 bg-surface rounded-2xl flex flex-col gap-5 shadow-xs">
          <div className="flex flex-col gap-1">
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-foreground">Verified Repository Evidence</h4>
            <p className="text-[10px] text-muted-foreground">Source code bases linked to candidate profile that form the basis of the assessment details.</p>
          </div>
          <div className="w-full h-px bg-border/10" />

          {cvLinkedRepos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cvLinkedRepos.map((repo) => (
                <div key={repo.id} className="p-4 border border-border/40 rounded-xl bg-surface-secondary/20 flex flex-col gap-3 hover:border-border transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ShieldCheck className="size-4 text-success shrink-0" />
                      <span className="font-bold text-foreground text-xs truncate" title={`${repo.ownerLogin}/${repo.name}`}>
                        {repo.ownerLogin}/{repo.name}
                      </span>
                    </div>
                    {repo.isPrivate && (
                      <span className="px-1.5 py-0.5 text-[8px] font-bold bg-muted-foreground/10 text-muted-foreground rounded-sm">
                        Private
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 min-h-[32px] font-light leading-normal">
                    {repo.description || "No description provided."}
                  </p>
                  <div className="w-full h-px bg-border/10 my-0.5" />
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-3">
                      {repo.primaryLanguage && (
                        <span className="font-semibold">{repo.primaryLanguage}</span>
                      )}
                      {repo.starsCount > 0 && (
                        <span>★ {repo.starsCount}</span>
                      )}
                    </div>
                    {repo.latestAnalysisStatus === "Completed" ? (
                      <span className="text-success font-bold">Analysis Vetted</span>
                    ) : (
                      <span className="text-muted-foreground">{repo.latestAnalysisStatus}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-xs font-light">
              No code repositories linked. Linked repositories will be detailed here once synchronized.
            </div>
          )}
        </div>

        {/* Detailed Score Breakdown */}
        <div id="section-breakdown" className="p-6 border border-border/40 bg-surface rounded-2xl flex flex-col gap-5 shadow-xs select-text">
          <div className="flex flex-col gap-1">
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-foreground">Overall Score Calibrated Breakdown</h4>
            <p className="text-[10px] text-muted-foreground">Calibration dimensions analyzed by CVerify Vetting engines.</p>
          </div>
          <div className="w-full h-px bg-border/10" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeData.scoreBreakdown ? (
              (() => {
                const getDimensionMetadata = (key: string, val: any) => {
                  if (val && typeof val === 'object' && 'band' in val) {
                    return {
                      score: val.score,
                      weight: Math.round(val.weight * 100),
                      band: val.band,
                      percent: val.percent,
                      isRaw: val.scale === "raw"
                    };
                  }
                  const score = typeof val === 'number' ? val : (val?.score ?? 0);
                  const weight = val?.weight !== undefined ? Math.round(val.weight * 100) : 0;
                  const isRaw = false;

                  let band = "Limited Evidence";
                  if (key === "skillDepth") {
                    if (score < 5) band = "Limited Evidence";
                    else if (score < 15) band = "Emerging Scope";
                    else if (score < 35) band = "Advanced Scope";
                    else band = "Enterprise Scale";
                  } else if (key === "ownership") {
                    if (score < 15) band = "Low/External Contributor";
                    else if (score < 50) band = "Collaborative Contributor";
                    else if (score < 80) band = "Core Owner";
                    else band = "Lead / Sole Owner";
                  } else if (key === "architecture") {
                    if (score < 30) band = "Basic CRUD / Scripting";
                    else if (score < 60) band = "Modular / Structural Design";
                    else if (score < 83) band = "System Architecture Patterns";
                    else band = "Distributed / Platform Scale";
                  } else if (key === "problemSolving") {
                    if (score < 30) band = "Symptom-level Debugging";
                    else if (score < 60) band = "Standard Bug-Fix Cycle";
                    else if (score < 83) band = "Root-Cause Diagnostics";
                    else band = "Complex Recovery & Stabilization";
                  } else if (key === "impact") {
                    if (score < 30) band = "Ad-hoc / Unstructured";
                    else if (score < 60) band = "Structured Development";
                    else if (score < 83) band = "High Quality & Test Discipline";
                    else band = "Strategic / Enterprise Standards";
                  }
                  return { score, weight, band, percent: score, isRaw };
                };

                return Object.entries(activeData.scoreBreakdown).map(([key, val]: [string, any]) => {
                  const labelMap: Record<string, string> = {
                    skillDepth: "Skill Depth & Scope",
                    ownership: "Repository Ownership Ratio",
                    architecture: "System Architecture Evidence",
                    problemSolving: "Problem Solving Complexity",
                    impact: "Engineering Business Impact",
                  };
                  const { score, weight, band, percent, isRaw } = getDimensionMetadata(key, val);

                  return (
                    <div key={key} className="flex flex-col gap-3 text-xs border border-border/40 p-4 rounded-xl bg-surface-secondary/20 hover:border-border/80 transition-colors">
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-foreground text-xs">{labelMap[key] || key}</span>
                          <span className="text-[9px] text-muted-foreground font-normal">Weight: {weight}%</span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Chip size="sm" variant="soft" color="accent" className="text-[9px] font-black h-4.5 px-1 bg-accent/10 border-none text-accent">
                            {key === "ownership" && !isNaN(score)
                              ? `${Math.round(score)}%`
                              : isRaw
                                ? `Raw: ${Math.round(score * 10) / 10}`
                                : `Score: ${Math.round(score * 10) / 10}`
                            }
                          </Chip>
                          <span className="text-[10px] font-bold text-muted-foreground">{band}</span>
                        </div>
                      </div>
                      {!isRaw && (
                        <div className="w-full mt-1 bg-surface-secondary rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-accent h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                });
              })()
            ) : (
              <div className="col-span-2 py-8 text-center text-muted-foreground text-xs font-light">
                No detailed score breakdown details available.
              </div>
            )}
          </div>
        </div>

        {/* Target Role Recommendations */}
        <div id="section-roles" className="p-6 border border-border/40 bg-surface rounded-2xl flex flex-col gap-5 shadow-xs select-text">
          <div className="flex flex-col gap-1">
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-foreground">Target Role Recommendations</h4>
            <p className="text-[10px] text-muted-foreground">Matched roles based on tech stack evidence, maturity levels, and preferences.</p>
          </div>
          <div className="w-full h-px bg-border/10" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rawRoles.length > 0 ? (
              rawRoles.map((item: any, index: number) => (
                <div key={index} className="p-5 border border-border/40 bg-surface-secondary/20 rounded-2xl flex flex-col gap-4 hover:border-border transition-colors">
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-extrabold text-foreground text-xs tracking-tight">{item.role}</span>
                    <Chip size="sm" color="accent" variant="soft" className="text-[10px] font-black uppercase px-2 h-5.5 bg-accent/15 text-accent border-none">
                      {Math.round(item.matchScore)}% Match
                    </Chip>
                  </div>
                  <div className="w-full h-px bg-border/10" />
                  <ul className="flex flex-col gap-2.5 pl-0 text-[11px] text-foreground/80 text-left leading-relaxed list-none">
                    {item.reasons && item.reasons.map((r: string, rIdx: number) => (
                      <li key={rIdx} className="flex gap-2 items-start font-light">
                        <CheckCircle2 className="size-3.5 text-success mt-0.5 shrink-0" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <div className="col-span-2 py-8 text-center text-muted-foreground text-xs font-light">
                No role recommendations found in this assessment.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };



  const renderOverview = () => {
    // Dynamically calculate completeness status per section
    const isBasicInfoFilled = !!(drafts["basic-info"].fullName && drafts["basic-info"].username);
    const isSkillsFilled = !(!drafts["skills"].targetSkills || drafts["skills"].targetSkills.length === 0);
    const isProjectsFilled = repositories.length > 0;
    const isExperienceFilled = drafts["experience"] && drafts["experience"].length > 0;
    const isEducationFilled = drafts["education"] && drafts["education"].length > 0;
    const isAchievementsFilled = drafts["achievements"] && drafts["achievements"].length > 0;
    const isPreferencesFilled = !(!drafts["preferences"].desiredJobPositions || drafts["preferences"].desiredJobPositions.length === 0);

    // Dynamic counts/summaries for sections
    const getSectionDetails = (id: CvSectionId) => {
      switch (id) {
        case "basic-info":
          return drafts["basic-info"].fullName
            ? `${drafts["basic-info"].fullName}${drafts["basic-info"].location ? ` • ${drafts["basic-info"].location}` : ""}${drafts["basic-info"].bio ? ` • Bio added` : ""}`
            : "Name, contact, and bio details not set";
        case "skills":
          const skillCount = drafts["skills"].targetSkills?.length || 0;
          return skillCount > 0 ? `${skillCount} skills specified` : "No skills defined";
        case "projects":
          return repositories.length > 0 ? `${repositories.length} verified projects linked` : "No source code projects linked";
        case "experience":
          const expCount = drafts["experience"]?.length || 0;
          return expCount > 0 ? `${expCount} work experience items` : "No work history listed";
        case "education":
          const eduCount = drafts["education"]?.length || 0;
          return eduCount > 0 ? `${eduCount} education items added` : "No schools added";
        case "achievements":
          const achCount = drafts["achievements"]?.length || 0;
          return achCount > 0 ? `${achCount} achievements & awards` : "No certificates uploaded";
        case "preferences":
          const posCount = drafts["preferences"].desiredJobPositions?.length || 0;
          return posCount > 0 ? `${posCount} target positions` : "No job preferences set";
        default:
          return "";
      }
    };

    const sectionCompleteness = {
      "basic-info": isBasicInfoFilled,
      "skills": isSkillsFilled,
      "projects": isProjectsFilled,
      "experience": isExperienceFilled,
      "education": isEducationFilled,
      "achievements": isAchievementsFilled,
      "preferences": isPreferencesFilled,
    };

    return (
      <div className="flex flex-col gap-8 w-full select-none">
        {/* Profile Completeness Card */}
        <div className="p-6 border border-border/40 bg-surface rounded-2xl flex flex-col gap-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between gap-3 w-full border-b border-border/20 pb-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Completeness</span>
              <span className="font-extrabold text-foreground text-sm">Profile Optimization</span>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-2xl font-black text-foreground tracking-tight">{completenessPercent}%</span>
              <Chip
                size="sm"
                variant="soft"
                color={status.color}
                className="text-[9px] font-black uppercase tracking-wider h-5"
              >
                {status.label}
              </Chip>
            </div>
          </div>

          <div className="w-full bg-surface-secondary rounded-full h-2 overflow-hidden border border-border/10">
            <div
              className="bg-accent h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${completenessPercent}%` }}
            />
          </div>

          {suggestedActions.length > 0 ? (
            <div className="flex flex-col gap-3 pt-2">
              <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">
                Recommended Actions
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {suggestedActions.map((action) => (
                  <div key={action.id} className="flex gap-2.5 items-start text-[11px] text-muted-foreground leading-normal bg-surface-secondary/30 p-3 rounded-xl border border-border/20">
                    <AlertCircle className="size-4 text-warning shrink-0 mt-0.5" />
                    <span>{String(action.text)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex gap-3 items-center text-xs text-success bg-success/5 p-3 rounded-xl mt-1 border border-success/15">
              <CheckCircle2 className="size-5 text-success shrink-0" />
              <span className="font-bold">Your profile is fully optimized!</span>
            </div>
          )}
        </div>

        {/* Main Columns Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
          {/* Left Column: Sections (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Identity & Summary Group */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-border/30 pb-2 mb-1">
                <span className="w-1.5 h-3.5 bg-accent rounded-full" />
                <span className="text-[10px] font-black uppercase tracking-wider text-accent">
                  Identity & Summary
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: "basic-info" as const, label: "Basic Information", desc: getSectionDetails("basic-info"), icon: User },
                  { id: "skills" as const, label: "Target Skills", desc: getSectionDetails("skills"), icon: Sparkles },
                ].map((section) => {
                  const Icon = section.icon;
                  const isComplete = sectionCompleteness[section.id];
                  const hasDraftChanges = dirtyFlags[section.id];
                  return (
                    <div
                      key={section.id}
                      className="p-5 border border-border/40 hover:border-accent/40 bg-surface rounded-2xl cursor-pointer text-left select-none relative group transition-colors flex gap-4 items-start h-28"
                      onClick={() => {
                        setActiveTab(section.id);
                        setViewState("editor");
                        router.push(`/cv?tab=${section.id}`);
                      }}
                    >
                      <div className="p-2.5 rounded-xl bg-surface-secondary text-accent group-hover:bg-accent group-hover:text-accent-foreground shrink-0 flex items-center justify-center size-10 mt-0.5 transition-colors">
                        <Icon className="size-4.5" />
                      </div>
                      <div className="flex-1 flex flex-col justify-between min-w-0 h-full">
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 w-full">
                            <span className="text-xs font-bold text-foreground truncate group-hover:text-accent">
                              {section.label}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {hasDraftChanges && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-warning/10 text-warning">
                                  Draft
                                </span>
                              )}
                              <span className={`w-2 h-2 rounded-full ${isComplete ? "bg-success" : "bg-muted-foreground/35"}`} />
                            </div>
                          </div>
                          <span className="text-[10px] text-muted-foreground leading-normal line-clamp-2 mt-0.5">{String(section.desc)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Credentials & Background Group */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-border/30 pb-2 mb-1">
                <span className="w-1.5 h-3.5 bg-accent rounded-full" />
                <span className="text-[10px] font-black uppercase tracking-wider text-accent">
                  Credentials & Background
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { id: "experience" as const, label: "Work Experience", desc: getSectionDetails("experience"), icon: Briefcase },
                  { id: "education" as const, label: "Education", desc: getSectionDetails("education"), icon: GraduationCap },
                  { id: "achievements" as const, label: "Achievements & Certificates", desc: getSectionDetails("achievements"), icon: Award },
                ].map((section) => {
                  const Icon = section.icon;
                  const isComplete = sectionCompleteness[section.id];
                  const hasDraftChanges = dirtyFlags[section.id];
                  return (
                    <div
                      key={section.id}
                      className="p-5 border border-border/40 hover:border-accent/40 bg-surface rounded-2xl cursor-pointer text-left select-none relative group transition-colors flex gap-4 items-start h-28"
                      onClick={() => {
                        setActiveTab(section.id);
                        setViewState("editor");
                        router.push(`/cv?tab=${section.id}`);
                      }}
                    >
                      <div className="p-2.5 rounded-xl bg-surface-secondary text-accent group-hover:bg-accent group-hover:text-accent-foreground shrink-0 flex items-center justify-center size-10 mt-0.5 transition-colors">
                        <Icon className="size-4.5" />
                      </div>
                      <div className="flex-1 flex flex-col justify-between min-w-0 h-full">
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 w-full">
                            <span className="text-xs font-bold text-foreground truncate group-hover:text-accent">
                              {section.label}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {hasDraftChanges && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-warning/10 text-warning">
                                  Draft
                                </span>
                              )}
                              <span className={`w-2 h-2 rounded-full ${isComplete ? "bg-success" : "bg-muted-foreground/35"}`} />
                            </div>
                          </div>
                          <span className="text-[10px] text-muted-foreground leading-normal line-clamp-2 mt-0.5">{String(section.desc)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Integrations & Preferences Group */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-border/30 pb-2 mb-1">
                <span className="w-1.5 h-3.5 bg-accent rounded-full" />
                <span className="text-[10px] font-black uppercase tracking-wider text-accent">
                  Integrations & Preferences
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: "projects" as const, label: "Linked Projects", desc: getSectionDetails("projects"), icon: FolderCode },
                  { id: "preferences" as const, label: "Career Preferences", desc: getSectionDetails("preferences"), icon: Compass },
                ].map((section) => {
                  const Icon = section.icon;
                  const isComplete = sectionCompleteness[section.id];
                  const hasDraftChanges = dirtyFlags[section.id];
                  return (
                    <div
                      key={section.id}
                      className="p-5 border border-border/40 hover:border-accent/40 bg-surface rounded-2xl cursor-pointer text-left select-none relative group transition-colors flex gap-4 items-start h-28"
                      onClick={() => {
                        setActiveTab(section.id);
                        setViewState("editor");
                        router.push(`/cv?tab=${section.id}`);
                      }}
                    >
                      <div className="p-2.5 rounded-xl bg-surface-secondary text-accent group-hover:bg-accent group-hover:text-accent-foreground shrink-0 flex items-center justify-center size-10 mt-0.5 transition-colors">
                        <Icon className="size-4.5" />
                      </div>
                      <div className="flex-1 flex flex-col justify-between min-w-0 h-full">
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 w-full">
                            <span className="text-xs font-bold text-foreground truncate group-hover:text-accent">
                              {section.label}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {hasDraftChanges && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-warning/10 text-warning">
                                  Draft
                                </span>
                              )}
                              <span className={`w-2 h-2 rounded-full ${isComplete ? "bg-success" : "bg-muted-foreground/35"}`} />
                            </div>
                          </div>
                          <span className="text-[10px] text-muted-foreground leading-normal line-clamp-2 mt-0.5">{String(section.desc)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Previews and Assessments (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* AI Candidate Assessment Hero Card */}
            <div className="p-6 border border-accent/20 bg-surface rounded-2xl flex flex-col gap-5 relative overflow-hidden shadow-xs">
              <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full blur-xl pointer-events-none" />

              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-accent/10 text-accent shrink-0">
                  <Sparkles className="size-5 animate-pulse" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-extrabold text-foreground text-xs">AI Candidate Assessment</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">Codebase quality & skill validations</span>
                </div>
              </div>

              <div className="w-full h-px bg-border/10" />

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Vetch candidate capability, architecture level, and repository metrics using CVerify AI evaluations.
              </p>

              <div className="flex flex-col gap-3.5 bg-surface-secondary/40 p-4 rounded-xl border border-border/10">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-foreground text-xs">Status:</span>
                  {latestAssessment?.status === 'Running' || latestAssessment?.status === 'Queued' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-warning/10 text-warning animate-pulse">
                      Running ({streamProgress}%)
                    </span>
                  ) : latestAssessment?.status === 'Completed' ? (
                    readiness?.requiresReassessment ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-warning/10 text-warning">
                        Outdated
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-success/15 text-success">
                        Up To Date
                      </span>
                    )
                  ) : latestAssessment?.status === 'Failed' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-danger/10 text-danger">
                      Failed
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-default text-muted-foreground">
                      Never Vetted
                    </span>
                  )}
                </div>

                {readiness && !readiness.isReady ? (
                  <div className="flex flex-col gap-2 mt-1">
                    <div className="flex gap-2.5 items-start text-xs">
                      <AlertCircle className="size-4 text-danger shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="font-bold text-foreground text-xs">Prerequisites Missing</span>
                        <span className="text-[10px] text-muted-foreground leading-relaxed">
                          An analyzed repository linked to your CV is required for AI evaluation.
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-xl border border-border/30 h-8 cursor-pointer mt-1 font-bold text-xs select-none w-full"
                      onPress={() => setIsRequiredFieldsModalOpen(true)}
                    >
                      View Prerequisites
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {latestAssessment?.completedAtUtc && (
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Last Vetted</span>
                        <span>{new Date(latestAssessment.completedAtUtc).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="flex gap-2 w-full mt-1">
                      {latestAssessment?.status === 'Completed' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="rounded-xl font-bold text-xs select-none border-border/30 h-9 flex-1 cursor-pointer"
                          onPress={() => handleViewAssessmentDetails(latestAssessment.id)}
                        >
                          View Report
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className={`rounded-xl font-bold text-xs select-none h-9 flex-1 border-none cursor-pointer ${latestAssessment?.status === 'Running' || latestAssessment?.status === 'Queued'
                          ? "bg-warning text-warning-foreground"
                          : "bg-accent text-accent-foreground"
                          }`}
                        onPress={
                          latestAssessment?.status === 'Running' || latestAssessment?.status === 'Queued'
                            ? () => connectProgressStream()
                            : handleTriggerAssessment
                        }
                      >
                        {latestAssessment?.status === 'Running' || latestAssessment?.status === 'Queued'
                          ? "Progress"
                          : latestAssessment?.status === 'Completed'
                            ? "Re-Run"
                            : "Run Vetting"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Export & Sharing */}
            <div className="p-6 border border-border/40 bg-surface rounded-2xl flex flex-col gap-5 shadow-xs">
              <div className="flex flex-col gap-1 border-b border-border/20 pb-3 text-left">
                <span className="font-extrabold text-foreground text-xs">Export & Sharing</span>
                <span className="text-[10px] text-muted-foreground">View and download your profile formats</span>
              </div>

              <div className="flex flex-col gap-3">
                {/* Option 1: Standard A4 CV */}
                <div className="flex flex-col gap-2.5 p-4 rounded-xl border border-border/20 bg-surface-secondary/20 hover:border-accent/30 transition-colors">
                  <div className="flex items-center gap-2 text-accent">
                    <FileText className="size-4 shrink-0" />
                    <span className="text-xs font-bold text-foreground">Standard A4 CV</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-normal text-left">
                    Traditional print-ready layout ready for download or sharing.
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-xl font-bold text-xs select-none w-full border-border/30 bg-surface hover:bg-surface-secondary transition-colors cursor-pointer"
                    onPress={() => {
                      setViewState("editor");
                      setEditorMode("preview");
                    }}
                  >
                    Open A4 Preview
                  </Button>
                </div>

                {/* Option 2: CVerify Digital Profile */}
                <div className="flex flex-col gap-2.5 p-4 rounded-xl border border-border/20 bg-surface-secondary/20 hover:border-emerald-500/30 transition-colors">
                  <div className="flex items-center gap-2 text-success">
                    <Sparkles className="size-4 shrink-0" />
                    <span className="text-xs font-bold text-foreground">Digital Profile</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-normal text-left">
                    Live digital portfolio with interactive commit evidence.
                  </p>
                  <Button
                    size="sm"
                    className="rounded-xl font-bold text-xs select-none w-full bg-accent text-accent-foreground border-none hover:opacity-90 cursor-pointer"
                    onPress={() => {
                      if (profile?.username) {
                        router.push(`/${profile.username.toLowerCase()}`);
                      } else {
                        toast.danger("Please set your Username in Basic Information before viewing your public profile.");
                      }
                    }}
                  >
                    Open Digital Profile
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEditor = () => {
    // Dynamically calculate completeness status per section
    const isBasicInfoFilled = !!(drafts["basic-info"].fullName && drafts["basic-info"].username);
    const isSkillsFilled = !!(drafts["skills"].targetSkills && drafts["skills"].targetSkills.length > 0);
    const isProjectsFilled = repositories.length > 0;
    const isExperienceFilled = drafts["experience"] && drafts["experience"].length > 0;
    const isEducationFilled = drafts["education"] && drafts["education"].length > 0;
    const isAchievementsFilled = drafts["achievements"] && drafts["achievements"].length > 0;
    const isPreferencesFilled = !!(drafts["preferences"].desiredJobPositions && drafts["preferences"].desiredJobPositions.length > 0);

    const sectionCompleteness = {
      "basic-info": isBasicInfoFilled,
      "skills": isSkillsFilled,
      "projects": isProjectsFilled,
      "experience": isExperienceFilled,
      "education": isEducationFilled,
      "achievements": isAchievementsFilled,
      "preferences": isPreferencesFilled,
    };

    const activeTabName = activeTab === "basic-info" ? "Basic Information" :
      activeTab === "skills" ? "Target Skills" :
        activeTab === "projects" ? "Linked Projects" :
          activeTab === "experience" ? "Work Experience" :
            activeTab === "education" ? "Education" :
              activeTab === "achievements" ? "Achievements & Certificates" :
                "Career Preferences";

    return (
      <div className="flex flex-col gap-6 text-left w-full h-full relative">
        {/* Editor Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/40 select-none">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setViewState("overview");
                router.push("/cv");
              }}
              className="text-muted hover:text-foreground border-none bg-transparent cursor-pointer p-1.5 rounded-xl hover:bg-surface-secondary flex items-center justify-center transition-colors"
              title="Back to Overview"
            >
              <ArrowLeft className="size-5" />
            </button>
            <span className="w-px h-5 bg-border/50" />
            <Typography.Heading level={4} className="font-extrabold text-foreground">
              Edit: {activeTabName}
            </Typography.Heading>
          </div>
        </div>

        {/* Grid Layout: Sidebar and Workspace (2 columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full lg:overflow-hidden min-h-0 lg:h-[calc(100dvh-var(--cv-editor-offset,185px))]">
          {/* Left column: Sidebar navigator (3 cols) */}
          <div className="lg:col-span-3 min-h-0 h-full overflow-hidden flex flex-col border-r border-border/30 pr-4">
            <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1 pb-10">
              {[
                { id: "basic-info" as const, label: "Basic Information", icon: User },
                { id: "skills" as const, label: "Target Skills", icon: Sparkles },
                { id: "projects" as const, label: "Linked Projects", icon: FolderCode },
                { id: "experience" as const, label: "Work Experience", icon: Briefcase },
                { id: "education" as const, label: "Education", icon: GraduationCap },
                { id: "achievements" as const, label: "Achievements & Certificates", icon: Award },
                { id: "preferences" as const, label: "Career Preferences", icon: Compass },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const isComplete = sectionCompleteness[tab.id];
                const hasDraftChanges = dirtyFlags[tab.id];
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      router.push(`/cv?tab=${tab.id}`);
                    }}
                    className={[
                      "flex items-center justify-between px-3.5 py-3 rounded-xl text-left border-none text-xs font-bold transition-all w-full cursor-pointer group relative",
                      isActive
                        ? "bg-accent/10 text-accent font-extrabold"
                        : "text-muted hover:bg-surface-secondary/40 text-muted-foreground"
                    ].join(" ")}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/4 bottom-1/4 w-0.75 bg-accent rounded-r-md" />
                    )}
                    <div className="flex items-center gap-3 truncate pr-2">
                      <Icon className={`size-4 shrink-0 ${isActive ? "text-accent" : "text-muted group-hover:text-foreground transition-colors"}`} />
                      <span className="truncate">{tab.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                      {hasDraftChanges && (
                        <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" title="Unsaved changes" />
                      )}
                      <span className={`w-2 h-2 rounded-full ${isComplete ? "bg-success" : "bg-muted-foreground/30"}`} title={isComplete ? "Completed" : "Incomplete"} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right column: Workspace (9 cols) */}
          <div className="lg:col-span-9 min-h-0 h-full overflow-hidden flex flex-col">
            <Card rounded="2xl" glow={true} className="flex-1 min-h-0 p-5 xl:p-6 border border-border/40 bg-surface flex flex-col gap-4 xl:gap-5 text-left relative overflow-hidden h-full">
              {/* Workspace Header with mode switcher */}
              <div className="flex border-b border-border/20 pb-3 select-none justify-between items-center shrink-0">
                <div className="flex flex-col gap-0.5">
                  <h3 className="font-extrabold text-sm uppercase tracking-wider text-foreground">
                    Section: {activeTabName}
                  </h3>
                  <p className="text-[10px] text-muted">
                    {editorMode === "edit"
                      ? "Changes made here are saved directly into your CVerify CV data."
                      : "Visual check of your current A4 CV profile details."}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {editorMode === "preview" && (
                    <button
                      onClick={() => setIsA4PreviewOpen(true)}
                      className="text-[10px] bg-accent-soft text-accent hover:bg-accent/20 px-2.5 py-1.5 rounded-lg font-bold uppercase cursor-pointer border border-accent/20 outline-none transition-colors select-none"
                    >
                      View A4
                    </button>
                  )}
                  <div className="flex items-center bg-surface-secondary/60 p-0.5 rounded-xl border border-border/20">
                    <button
                      type="button"
                      onClick={() => setEditorMode("edit")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${editorMode === "edit" ? "bg-surface text-accent shadow-xs font-extrabold" : "text-muted hover:text-foreground"}`}
                    >
                      Form Editor
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorMode("preview")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${editorMode === "preview" ? "bg-surface text-accent shadow-xs font-extrabold" : "text-muted hover:text-foreground"}`}
                    >
                      Live Preview
                    </button>
                  </div>
                </div>
              </div>

              {/* Workspace Content Panel */}
              <div className="flex-1 min-h-0 overflow-y-auto relative h-full">
                {editorMode === "edit" ? (
                  <>
                    {activeTab === "basic-info" && (
                      <BasicInfoForm
                        draft={drafts["basic-info"]}
                        baseline={baselines["basic-info"]}
                        onChange={(updated) => setDrafts((prev) => ({ ...prev, "basic-info": { ...prev["basic-info"], ...updated } }))}
                        onSave={handleSaveActiveSection}
                        onReset={handleResetActiveSection}
                        isSaving={isSaving}
                        isDirty={dirtyFlags["basic-info"]}
                        avatarUrl={user?.avatarUrl}
                        latestAssessment={latestAssessment}
                        parsedProfile={parsedProfile}
                      />
                    )}

                    {activeTab === "skills" && (
                      <SkillsForm
                        draft={drafts["skills"]}
                        onChange={(updated) => setDrafts((prev) => ({ ...prev, "skills": { ...prev["skills"], ...updated } }))}
                        onSave={handleSaveActiveSection}
                        onReset={handleResetActiveSection}
                        isSaving={isSaving}
                        isDirty={dirtyFlags["skills"]}
                      />
                    )}
                    {activeTab === "projects" && (
                      <ProjectsForm
                        draft={drafts["projects"]}
                        onChange={(updated) => setDrafts((prev) => ({ ...prev, "projects": updated }))}
                        onSave={handleSaveActiveSection}
                        onReset={handleResetActiveSection}
                        isSaving={isSaving}
                        isDirty={dirtyFlags["projects"]}
                        repositories={repositories}
                      />
                    )}
                    {activeTab === "experience" && (
                      <ExperienceForm
                        draft={drafts["experience"]}
                        onChange={(updated) => setDrafts((prev) => ({ ...prev, "experience": updated }))}
                        onSave={handleSaveActiveSection}
                        onReset={handleResetActiveSection}
                        isSaving={isSaving}
                        isDirty={dirtyFlags["experience"]}
                      />
                    )}
                    {activeTab === "education" && (
                      <EducationForm
                        draft={drafts["education"]}
                        onChange={(updated) => setDrafts((prev) => ({ ...prev, "education": updated }))}
                        onSave={handleSaveActiveSection}
                        onReset={handleResetActiveSection}
                        isSaving={isSaving}
                        isDirty={dirtyFlags["education"]}
                      />
                    )}
                    {activeTab === "achievements" && (
                      <AchievementsForm
                        draft={drafts["achievements"]}
                        onChange={(updated) => setDrafts((prev) => ({ ...prev, "achievements": updated }))}
                        onSave={handleSaveActiveSection}
                        onReset={handleResetActiveSection}
                        isSaving={isSaving}
                        isDirty={dirtyFlags["achievements"]}
                      />
                    )}
                    {activeTab === "preferences" && (
                      <PreferencesForm
                        draft={drafts["preferences"]}
                        onChange={(updated) => setDrafts((prev) => ({ ...prev, "preferences": { ...prev["preferences"], ...updated } }))}
                        onSave={handleSaveActiveSection}
                        onReset={handleResetActiveSection}
                        isSaving={isSaving}
                        isDirty={dirtyFlags["preferences"]}
                      />
                    )}
                  </>
                ) : (
                  <div className="flex justify-center items-start h-full py-2">
                    <CvLivePreview drafts={drafts} avatarUrl={user?.avatarUrl} />
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full h-full text-left relative overflow-hidden" style={{ "--cv-editor-offset": "185px" } as React.CSSProperties}>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-2 select-none cv-management-header">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-accent/10 text-accent">
            <FileText className="size-6" />
          </div>
          <div className="flex flex-col text-left">
            <Typography.Heading level={2} className="font-extrabold text-foreground tracking-tight">
              CV Management
            </Typography.Heading>
            <Typography type="body-xs" className="text-muted mt-0.5 max-w-xl">
              Manage and update your professional CV profile. All changes sync with your Account Settings.
            </Typography>
          </div>
        </div>
      </div>

      <div className="w-full h-px bg-separator my-3" />

      {/* Main Content Areas */}
      <main className={`w-full flex-1 cv-management-main ${viewState === "editor" ? "lg:overflow-hidden" : "overflow-y-auto"}`}>
        {viewState === "overview" ? renderOverview() : viewState === "assessment" ? renderAssessmentDashboard() : renderEditor()}
      </main>

      {/* Dialog standard A4 Preview overlay */}
      {isA4PreviewOpen && (
        <div className="fixed inset-0 z-50 backdrop-blur-sm flex items-center justify-center p-4 cv-preview-overlay">
          <Card rounded="xl" className="w-full max-w-[850px] max-h-[90vh] border border-border flex flex-col overflow-hidden text-left cv-preview-card">
            {/* Header controls */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 select-none bg-surface/80 backdrop-blur-md">
              <span className="font-extrabold text-sm uppercase tracking-wide text-foreground flex items-center gap-2">
                <FileText className="size-4 text-accent" />
                CV Preview
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={useSampleData ? "primary" : "secondary"}
                  className={["rounded-xl text-[10px] font-bold select-none border-border/30", useSampleData ? "bg-accent text-accent-foreground border-none" : ""].join(" ")}
                  onPress={() => setUseSampleData((prev) => !prev)}
                >
                  {useSampleData ? "Clear Sample Data" : "Load Sample Data"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-xl text-[10px] font-bold select-none border-border/30 flex items-center gap-1.5"
                  onPress={handlePrint}
                >
                  <Printer className="size-3.5" />
                  <span>Print</span>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-xl text-[10px] font-bold select-none border-border/30"
                  onPress={() => {
                    setIsA4PreviewOpen(false);
                    setUseSampleData(false);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>

            {/* A4 Printable content frame */}
            <div
              ref={setModalFrameEl}
              className="flex-1 min-h-0 overflow-y-auto p-8 bg-surface-secondary/50 flex justify-center items-start cv-preview-content-frame"
            >
              <div
                style={{
                  width: `${794 * previewScale}px`,
                  height: `${previewContentHeight * previewScale}px`,
                  position: "relative",
                  flexShrink: 0,
                }}
              >
                <div
                  ref={setModalContentEl}
                  style={{
                    transform: `scale(${previewScale})`,
                    transformOrigin: "top left",
                    width: "794px",
                    position: "absolute",
                    left: 0,
                    top: 0,
                  }}
                  className="shadow-md border border-border rounded-xs overflow-hidden cv-preview-box"
                >
                  <CVPreview
                    basic={activeProfile}
                    summary={{ bio: activeProfile.bio }}
                    skills={{ targetSkills: activeCareer.targetSkills }}
                    experience={activeExp}
                    education={activeEdu}
                    achievements={activeAch}
                    preferences={activePreferences}
                    projects={activeProjects}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {readiness && (
        <RequiredFieldsMissingModal
          isOpen={isRequiredFieldsModalOpen}
          onOpenChange={setIsRequiredFieldsModalOpen}
          missingFields={readiness.missingFields}
          onProceedAnyway={handleForceTriggerAssessment}
          isProceeding={latestAssessment?.status === 'Running' || latestAssessment?.status === 'Queued'}
        />
      )}

      {typeof document !== "undefined" && createPortal(
        <div className="cv-print-portal">
          <CVPreview
            basic={activeProfile}
            summary={{ bio: activeProfile.bio }}
            skills={{ targetSkills: activeCareer.targetSkills }}
            experience={activeExp}
            education={activeEdu}
            achievements={activeAch}
            preferences={activePreferences}
            projects={activeProjects}
          />
        </div>,
        document.body
      )}

    </div>
  );
}
