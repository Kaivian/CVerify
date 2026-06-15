"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Typography,
  Button,
  Spinner,
  toast,
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
} from "lucide-react";

import { useProfile } from "@/hooks/use-profile";
import { useCareerPreferences } from "@/hooks/use-career-preferences";
import { useEducation } from "@/hooks/use-education";
import { useWorkExperience } from "@/hooks/use-work-experience";
import { useAchievements } from "@/hooks/use-achievements";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useCandidateAssessment } from "@/hooks/use-candidate-assessment";
import { isDeepEqual } from "@/components/ui/unsaved-changes-bar";

import {
  type CvDraftState,
  type CvSectionId,
  type BasicInfoDraft,
  type SkillsDraft,
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

const ASSESSMENT_STAGES = [
  { id: 'CloneRepository', label: 'Clone and parse source code repositories' },
  { id: 'StaticAnalysis', label: 'Run static analysis and security auditing tools' },
  { id: 'ComputeMetrics', label: 'Calculate codebase architecture and ownership metrics' },
  { id: 'AIEval', label: 'AI evaluation of candidate experience and engineering depth' }
];

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
  "projects": {},
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
  const { user } = useAuth();

  // Page Views State
  const [viewState, setViewState] = useState<ViewState>("overview");
  const [activeTab, setActiveTab] = useState<CvSectionId>("basic-info");
  const [editorMode, setEditorMode] = useState<"edit" | "preview">("edit");
  const [isSaving, setIsSaving] = useState(false);
  const [mobileShowPreview, setMobileShowPreview] = useState(false);

  // Dynamic Data hooks
  const { profile, isLoading: isProfileLoading, updateProfile, updateUsername, refreshProfile } = useProfile();
  const { career, isLoading: isCareerLoading, updateCareer, refreshCareer } = useCareerPreferences();
  const { education, isLoading: isEduLoading, addEducation, updateEducation, deleteEducation, reorderEducation, refreshEducation } = useEducation();
  const { workExperiences, isLoading: isWorkLoading, addWorkExperience, updateWorkExperience, deleteWorkExperience, reorderWorkExperiences, refreshWorkExperiences } = useWorkExperience();
  const { achievements, isLoading: isAchLoading, addAchievement, updateAchievement, deleteAchievement, reorderAchievements, refreshAchievements } = useAchievements();

  // Baseline and local drafts state
  const [baselines, setBaselines] = useState<CvDraftState>(INITIAL_DRAFT_STATE);
  const [drafts, setDrafts] = useState<CvDraftState>(INITIAL_DRAFT_STATE);

  // A4 Preview Overlay state
  const [isA4PreviewOpen, setIsA4PreviewOpen] = useState(false);
  const [useSampleData, setUseSampleData] = useState(false);

  // Fetch verified repositories
  const [repositories, setRepositories] = useState<SourceCodeRepository[]>([]);

  // Candidate Assessment Hook & States
  const {
    readiness,
    latestAssessment,
    assessmentDetails,
    isLoadingDetails,
    error: assessmentError,
    triggerAssessment,
    streamStatus,
    streamProgress,
    streamStep,
    streamMessage,
    disconnectProgressStream,
    fetchDetails,
  } = useCandidateAssessment();

  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<string>("summary");

  const handleTriggerAssessment = async () => {
    try {
      setIsProgressModalOpen(true);
      await triggerAssessment();
    } catch (err: any) {
      toast.danger(err.message || "Failed to run candidate assessment.");
    }
  };

  const handleViewAssessmentDetails = async (id: string) => {
    setViewState("assessment");
    await fetchDetails(id);
  };

  // Dynamic scale for the A4 preview modal to fit smaller screens
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewContentHeight, setPreviewContentHeight] = useState(1123);

  useEffect(() => {
    if (!isA4PreviewOpen) return;

    const frame = previewFrameRef.current;
    const content = previewContentRef.current;
    if (!frame) return;

    const A4_WIDTH_PX = 794;
    const FRAME_PADDING_PX = 64; // p-8 = 32px each side

    const updateLayout = () => {
      const available = frame.clientWidth - FRAME_PADDING_PX;
      setPreviewScale(Math.min(1, available / A4_WIDTH_PX));
      if (content) {
        setPreviewContentHeight(content.scrollHeight || content.offsetHeight || 1123);
      }
    };

    updateLayout();
    const observer = new ResizeObserver(updateLayout);
    observer.observe(frame);
    if (content) observer.observe(content);
    return () => observer.disconnect();
  }, [isA4PreviewOpen]);

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
            (r) => r.isVerified || r.latestAnalysisStatus === "Completed"
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
        schoolName: edu.schoolName,
        degree: edu.degree || "",
        major: edu.major || "",
        gpa: edu.gpa,
        gpaScale: edu.gpaScale,
        description: edu.description || "",
        startDate: edu.startDate ? edu.startDate.split("T")[0] : "",
        endDate: edu.endDate ? edu.endDate.split("T")[0] : null,
        isCurrentlyStudying: edu.isCurrentlyStudying,
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

  // Compute dirty states per section
  const dirtyFlags = {
    "basic-info": !isDeepEqual(drafts["basic-info"], baselines["basic-info"]),
    "skills": !isDeepEqual(drafts["skills"], baselines["skills"]),
    "projects": false,
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

  const isLoading = isProfileLoading || isCareerLoading || isEduLoading || isWorkLoading || isAchLoading;

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
        };

        setBaselines((prev) => ({ ...prev, "basic-info": updatedBasic }));
        setDrafts((prev) => ({ ...prev, "basic-info": updatedBasic }));
        toast.success("Changes saved successfully!");
        await refreshProfile();
      } else if (activeTab === "skills") {
        const payload = drafts["skills"];
        const response = await updateCareer({
          targetSkills: payload.targetSkills,
          version: career?.declaredPreferences?.version || 0,
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
          version: career?.declaredPreferences?.version || 0,
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
            schoolName: item.schoolName,
            degree: item.degree || null,
            major: item.major || null,
            gpa: item.gpa,
            gpaScale: item.gpaScale,
            description: item.description || null,
            startDate: new Date(item.startDate).toISOString(),
            endDate: item.endDate ? new Date(item.endDate).toISOString() : null,
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
      }
    } catch (err) {
      console.error(err);
      toast.danger("Some changes failed to save. Re-syncing with server...");
      // Resynchronize client list with store upon partial failure
      if (activeTab === "experience") await refreshWorkExperiences();
      if (activeTab === "education") await refreshEducation();
      if (activeTab === "achievements") await refreshAchievements();
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
  };

  const activeEdu = useSampleData ? SAMPLE_DATA.education : drafts["education"];
  const activeExp = useSampleData ? SAMPLE_DATA.experience : drafts["experience"];
  const activeAch = useSampleData ? SAMPLE_DATA.achievements : drafts["achievements"];
  const activeCareer = useSampleData ? SAMPLE_DATA.career : {
    targetSkills: drafts["skills"].targetSkills || [],
    desiredJobPositions: drafts["preferences"].desiredJobPositions || [],
  };

  const activePreferences = useSampleData ? INITIAL_DRAFT_STATE["preferences"] : drafts["preferences"];
  const activeProjects = useSampleData ? SAMPLE_DATA.projects : repositories;

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

    return (
      <div className="flex flex-col gap-6 text-left w-full h-full relative pb-10">
        {/* Dashboard Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/40 select-none">
          <Button
            size="sm"
            variant="secondary"
            className="rounded-xl font-bold text-xs select-none border-border/40 flex items-center gap-1.5"
            onPress={() => setViewState("overview")}
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Overview</span>
          </Button>
          <Typography.Heading level={4} className="font-bold text-accent">
            AI Profile Assessment Dashboard
          </Typography.Heading>
        </div>

        {/* Top Header Card - Score and Overview */}
        <Card rounded="xl" className="p-6 border border-border/40 bg-surface flex flex-col md:flex-row gap-6 items-center">
          {/* Circular Score Gauge */}
          <div className="relative size-32 flex items-center justify-center shrink-0">
            <svg className="size-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-border/20"
                strokeWidth="3"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-accent transition-all duration-500 ease-out"
                strokeDasharray={`${activeData.candidateScore || activeData.overallScore || 0}, 100`}
                strokeWidth="3.2"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-2xl font-black text-foreground">
                {Math.round(activeData.candidateScore || activeData.overallScore || 0)}
              </span>
              <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Score</span>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex-1 flex flex-col gap-3 text-center md:text-left">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <h3 className="text-lg font-black text-foreground">
                  {profile?.fullName || "Candidate Evaluation"}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-accent-soft text-accent">
                  {activeData.careerLevelLabel || activeData.careerLevel || "Middle"}
                </span>
                {activeData.displayConfidence && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-default-soft text-muted">
                    Confidence: {Math.round(activeData.displayConfidence * 100)}%
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground italic max-w-2xl">
                "{activeData.recruiterHeadline || activeData.summaryHeadline || "Verified Software Engineer Profile"}"
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-border/10 pt-3 text-xs">
              <div className="flex flex-col">
                <span className="text-muted text-[10px] uppercase font-bold">Primary Tendency</span>
                <span className="font-extrabold text-foreground">{activeData.primaryTendency || "Fullstack Engineer"}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted text-[10px] uppercase font-bold">Working Style</span>
                <span className="font-extrabold text-foreground">{activeData.primaryWorkingStyle || "Collaborative"}</span>
              </div>
              <div className="flex flex-col col-span-2 sm:col-span-1">
                <span className="text-muted text-[10px] uppercase font-bold">Evaluation Framework</span>
                <span className="font-extrabold text-foreground">Pipeline v{assessment.pipelineVersion}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Tabs Navigation */}
        <div className="flex border-b border-border/20 gap-2 overflow-x-auto select-none">
          {[
            { id: "summary", label: "Overview Summary", icon: FileText },
            { id: "skills", label: "Calibrated Skills", icon: Award },
            { id: "breakdown", label: "Score Breakdown", icon: TrendingUp },
            { id: "roles", label: "Recommended Roles", icon: Target },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeDetailTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveDetailTab(tab.id)}
                className={[
                  "flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-bold transition-all cursor-pointer whitespace-nowrap bg-transparent outline-none",
                  isActive ? "border-accent text-accent font-black" : "border-transparent text-muted-foreground hover:text-foreground"
                ].join(" ")}
              >
                <Icon className="size-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div className="w-full">
          {activeDetailTab === "summary" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Recruiter Summary narrative */}
              <Card rounded="xl" className="md:col-span-2 p-6 border border-border/40 bg-surface flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h4 className="font-extrabold text-sm uppercase tracking-wide text-foreground">AI Evaluation Narrative</h4>
                  <p className="text-xs text-muted">A synthesized, recruiter-ready profile summary backed by source code artifacts.</p>
                </div>
                <div className="w-full h-px bg-border/10" />
                <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {activeData.fullSummary || activeData.summaryParagraph || "No assessment narrative generated."}
                </p>
              </Card>

              {/* Strengths & Watchpoints checklist */}
              <div className="flex flex-col gap-6">
                {/* Key Strengths */}
                <Card rounded="xl" className="p-6 border border-border/40 bg-surface flex flex-col gap-3">
                  <h4 className="font-extrabold text-sm uppercase tracking-wide text-success flex items-center gap-2">
                    <CheckCircle2 className="size-4 shrink-0" />
                    Key Strengths
                  </h4>
                  <div className="w-full h-px bg-border/10" />
                  <ul className="flex flex-col gap-2 pl-4 list-disc text-xs text-muted-foreground text-left">
                    {activeData.keyStrengths && activeData.keyStrengths.length > 0 ? (
                      activeData.keyStrengths.map((str: string, index: number) => (
                        <li key={index} className="leading-relaxed">
                          {str}
                        </li>
                      ))
                    ) : (
                      <li>Strong codebase contribution patterns detected.</li>
                    )}
                  </ul>
                </Card>

                {/* Watch Points */}
                <Card rounded="xl" className="p-6 border border-border/40 bg-surface flex flex-col gap-3">
                  <h4 className="font-extrabold text-sm uppercase tracking-wide text-warning flex items-center gap-2">
                    <ShieldAlert className="size-4 shrink-0" />
                    Watch Points
                  </h4>
                  <div className="w-full h-px bg-border/10" />
                  <ul className="flex flex-col gap-2 pl-4 list-disc text-xs text-muted-foreground text-left">
                    {activeData.watchPoints && activeData.watchPoints.length > 0 ? (
                      activeData.watchPoints.map((wp: string, index: number) => (
                        <li key={index} className="leading-relaxed">
                          {wp}
                        </li>
                      ))
                    ) : (
                      <li>No major adversarial risks or gaps identified.</li>
                    )}
                  </ul>
                </Card>
              </div>
            </div>
          )}

          {activeDetailTab === "skills" && (
            <Card rounded="xl" className="p-6 border border-border/40 bg-surface flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h4 className="font-extrabold text-sm uppercase tracking-wide text-foreground">Calibrated Technical Skill Stack</h4>
                <p className="text-xs text-muted">Skills derived from the commit evidence graph mapping and target CV skills.</p>
              </div>
              <div className="w-full h-px bg-border/10" />

              <div className="flex flex-col gap-4">
                {activeData.skillProficiencies && activeData.skillProficiencies.length > 0 ? (
                  activeData.skillProficiencies.map((item: any, index: number) => (
                    <div key={index} className="flex flex-col gap-2 p-4 border border-border/30 rounded-xl bg-surface-secondary/10 text-xs">
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-foreground text-sm">{item.skillName}</span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-accent-soft text-accent uppercase">
                            {item.proficiencyLevel}
                          </span>
                        </div>
                        {item.evidenceCount !== undefined && (
                          <span className="text-[10px] text-muted font-bold">
                            Evidence commits: {item.evidenceCount}
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        {item.reasoning}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    No individual skill mappings available in this assessment.
                  </div>
                )}
              </div>
            </Card>
          )}

          {activeDetailTab === "breakdown" && (
            <Card rounded="xl" className="p-6 border border-border/40 bg-surface flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h4 className="font-extrabold text-sm uppercase tracking-wide text-foreground">Overall Score Calibrated Breakdown</h4>
                <p className="text-xs text-muted">Weights and sub-scores according to the Line 2 Candidate score framework.</p>
              </div>
              <div className="w-full h-px bg-border/10" />

              <div className="flex flex-col gap-5">
                {activeData.scoreBreakdown ? (
                  Object.entries(activeData.scoreBreakdown).map(([key, value]: [string, any]) => {
                    const labelMap: Record<string, string> = {
                      skillDepth: "Skill Depth & Scope",
                      ownership: "Repository Ownership Ratio",
                      architecture: "System Architecture Evidence",
                      problemSolving: "Problem Solving Complexity",
                      impact: "Engineering Business Impact",
                    };
                    const percent = value.score;
                    const weight = Math.round(value.weight * 100);

                    return (
                      <div key={key} className="flex flex-col gap-2 text-xs">
                        <div className="flex justify-between font-bold text-foreground">
                          <span>{labelMap[key] || key}</span>
                          <span>{Math.round(percent)}/100 (Weight: {weight}%)</span>
                        </div>
                        <div className="w-full bg-surface-secondary/50 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-accent h-full rounded-full transition-all duration-300"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    No detailed score breakdown details available.
                  </div>
                )}
              </div>
            </Card>
          )}

          {activeDetailTab === "roles" && (
            <Card rounded="xl" className="p-6 border border-border/40 bg-surface flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h4 className="font-extrabold text-sm uppercase tracking-wide text-foreground">Target Role Recommendations</h4>
                <p className="text-xs text-muted font-medium">Matched roles based on tech stack evidence, maturity levels, and preferences.</p>
              </div>
              <div className="w-full h-px bg-border/10" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activeData.suggestedRoles && activeData.suggestedRoles.length > 0 ? (
                  activeData.suggestedRoles.map((item: any, index: number) => (
                    <Card key={index} rounded="xl" glow={false} className="p-4 border border-border/40 bg-surface-secondary/10 flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-foreground text-xs">{item.role}</span>
                        <span className="text-xs font-black text-accent">{Math.round(item.matchScore)}% Match</span>
                      </div>
                      <div className="w-full h-px bg-border/10" />
                      <ul className="flex flex-col gap-1.5 pl-4 list-disc text-[10px] text-muted-foreground text-left">
                        {item.reasons && item.reasons.map((r: string, rIdx: number) => (
                          <li key={rIdx}>{r}</li>
                        ))}
                      </ul>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-2 py-8 text-center text-muted-foreground text-xs">
                    No role recommendations found in this assessment.
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    );
  };

  const renderProgressModal = () => {
    if (!isProgressModalOpen) return null;

    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
        <Card rounded="xl" className="w-full max-w-[500px] max-h-[90vh] border border-border flex flex-col overflow-hidden text-left p-6">
          <div className="flex items-center justify-between border-b border-border/20 pb-3 shrink-0">
            <span className="font-extrabold text-sm uppercase tracking-wide text-foreground flex items-center gap-2">
              <Sparkles className="size-4 text-accent animate-pulse" />
              AI Profile Evaluation
            </span>
            {streamStatus !== 'connecting' && streamStatus !== 'streaming' && (
              <Button
                isIconOnly
                size="sm"
                variant="secondary"
                className="rounded-xl border border-border/30 h-8 w-8"
                onPress={() => {
                  setIsProgressModalOpen(false);
                  disconnectProgressStream();
                }}
                aria-label="Close modal"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-4 min-h-0">
            <div className="flex flex-col gap-1 text-center py-2 shrink-0">
              <span className="text-sm font-extrabold text-foreground">
                {streamStatus === 'connecting'
                  ? 'Connecting to Evaluation Stream...'
                  : streamStatus === 'streaming'
                    ? 'Analyzing Codebase & Calibrating Profile...'
                    : streamStatus === 'completed'
                      ? 'Evaluation Completed!'
                      : streamStatus === 'failed'
                        ? 'Evaluation Failed'
                        : 'Idle'}
              </span>
              <span className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
                {streamMessage || 'Starting background evaluation...'}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-surface-secondary/50 rounded-full h-3 overflow-hidden shrink-0">
              <div
                className={`h-full rounded-full transition-all duration-300 ${streamStatus === 'failed' ? 'bg-danger' : streamStatus === 'completed' ? 'bg-success' : 'bg-accent'
                  }`}
                style={{ width: `${streamProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground shrink-0 font-bold">
              <span>ACTIVE STAGE: {streamStep || 'FETCH_ARTIFACTS'}</span>
              <span>{Math.round(streamProgress)}%</span>
            </div>

            {/* Visual Timeline of Stages */}
            <div className="flex flex-col gap-2 border-t border-border/10 pt-3 overflow-y-auto">
              <span className="text-[10px] text-muted uppercase font-bold tracking-wider select-none mb-1">
                Evaluation Timeline
              </span>
              <div className="flex flex-col gap-2.5 pl-1.5">
                {[
                  { id: 'FetchLine1', label: 'Fetch verified repository analysis artifacts' },
                  { id: 'ConsolidateLine1', label: 'Consolidate multi-repository metrics' },
                  ...ASSESSMENT_STAGES
                ].map((stage) => {
                  let status: 'pending' | 'running' | 'completed' | 'failed' = 'pending';

                  if (streamStatus === 'completed') {
                    status = 'completed';
                  } else if (streamStatus === 'failed') {
                    const steps = ['FetchLine1', 'ConsolidateLine1', ...ASSESSMENT_STAGES.map(s => s.id)];
                    const activeIndex = steps.indexOf(streamStep);
                    const stageIndex = steps.indexOf(stage.id);
                    if (stage.id === streamStep) {
                      status = 'failed';
                    } else if (stageIndex < activeIndex && activeIndex !== -1) {
                      status = 'completed';
                    } else {
                      status = 'pending';
                    }
                  } else {
                    const steps = ['FetchLine1', 'ConsolidateLine1', ...ASSESSMENT_STAGES.map(s => s.id)];
                    const activeIndex = steps.indexOf(streamStep);
                    const stageIndex = steps.indexOf(stage.id);
                    if (stage.id === streamStep) {
                      status = 'running';
                    } else if (stageIndex < activeIndex && activeIndex !== -1) {
                      status = 'completed';
                    } else {
                      status = 'pending';
                    }
                  }

                  return (
                    <div key={stage.id} className="flex items-center gap-3 text-xs">
                      <div className="shrink-0 flex items-center justify-center">
                        {status === 'completed' ? (
                          <CheckCircle2 className="size-4 text-success" />
                        ) : status === 'failed' ? (
                          <XCircle className="size-4 text-danger" />
                        ) : status === 'running' ? (
                          <Spinner size="sm" color="accent" className="size-4" />
                        ) : (
                          <div className="size-3.5 rounded-full border border-border bg-surface-secondary/40" />
                        )}
                      </div>
                      <span className={[
                        "truncate font-medium",
                        status === 'running' ? 'text-accent font-bold' :
                          status === 'completed' ? 'text-foreground/80' : 'text-muted-foreground'
                      ].join(" ")}>
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border-t border-border/20 pt-4 flex gap-2 justify-end shrink-0">
            {streamStatus === 'completed' && (
              <Button
                size="sm"
                className="bg-accent text-accent-foreground font-bold rounded-xl border-none"
                onPress={() => {
                  setIsProgressModalOpen(false);
                  if (latestAssessment) {
                    handleViewAssessmentDetails(latestAssessment.id);
                  }
                }}
              >
                Open Dashboard
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              className="rounded-xl font-bold border-border/30"
              isDisabled={streamStatus === 'connecting' || streamStatus === 'streaming'}
              onPress={() => {
                setIsProgressModalOpen(false);
                disconnectProgressStream();
              }}
            >
              Close
            </Button>
          </div>
        </Card>
      </div>
    );
  };

  const renderOverview = () => {
    // Dynamically calculate completeness status per section
    const isBasicInfoFilled = !!(drafts["basic-info"].fullName && drafts["basic-info"].publicEmail && drafts["basic-info"].bio);
    const isSkillsFilled = !!(drafts["skills"].targetSkills && drafts["skills"].targetSkills.length > 0);
    const isProjectsFilled = repositories.length > 0;
    const isExperienceFilled = drafts["experience"] && drafts["experience"].length > 0;
    const isEducationFilled = drafts["education"] && drafts["education"].length > 0;
    const isAchievementsFilled = drafts["achievements"] && drafts["achievements"].length > 0;
    const isPreferencesFilled = !!(drafts["preferences"].desiredJobPositions && drafts["preferences"].desiredJobPositions.length > 0);

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
      <div className="flex flex-col gap-6 w-full">
        {/* Profile Completeness card */}
        <Card rounded="2xl" glow={true} className="p-6 border border-border/40 bg-surface flex flex-col gap-5 relative overflow-hidden">
          <div className="flex items-center justify-between gap-3 w-full border-b border-border/20 pb-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase font-extrabold tracking-widest text-muted-foreground">Completeness</span>
              <Typography type="body-sm" className="font-extrabold text-foreground leading-none">
                Profile Optimization
              </Typography>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0 font-outfit">
              <span className="text-3xl font-black text-foreground tracking-tight">{completenessPercent}%</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-${status.color}-soft text-${status.color}`}>
                {String(status.label)}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            <div className="w-full bg-surface-secondary rounded-full h-3 overflow-hidden p-0.5 border border-border/20">
              <div
                className="bg-accent h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${completenessPercent}%` }}
              />
            </div>
          </div>

          {suggestedActions.length > 0 ? (
            <div className="flex flex-col gap-3 pt-2">
              <span className="text-[10px] text-muted font-bold uppercase tracking-wider">
                Action Checklist
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {suggestedActions.map((action) => (
                  <div key={action.id} className="flex gap-2.5 items-start text-[11px] text-muted-foreground leading-normal bg-surface-secondary/40 p-2.5 rounded-xl border border-border/10">
                    <AlertCircle className="size-4 text-warning shrink-0 mt-0.5" />
                    <span>{String(action.text)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex gap-3 items-center text-xs text-success bg-success-soft/20 p-3 rounded-xl mt-1 border border-success/10">
              <CheckCircle2 className="size-5 text-success shrink-0" />
              <span className="font-bold">Your profile is fully optimized!</span>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
          {/* Left Column: CV Structure sections (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Identity & Summary Group */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-border/40 pb-2 mb-1 text-left">
                <span className="w-1.5 h-3.5 bg-accent rounded-full" />
                <Typography type="body-xs" className="font-extrabold uppercase tracking-widest text-accent">
                  Identity & Summary
                </Typography>
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
                    <Card
                      key={section.id}
                      rounded="2xl"
                      glow={true}
                      className="p-5 border border-border/40 hover:border-accent/40 bg-surface cursor-pointer text-left select-none relative group h-[110px] transition-all duration-300"
                      onClick={() => {
                        setActiveTab(section.id);
                        setViewState("editor");
                      }}
                    >
                      <div className="flex gap-4 items-start w-full h-full">
                        <div className="p-2.5 rounded-xl bg-surface-secondary text-accent group-hover:bg-accent group-hover:text-accent-foreground shrink-0 flex items-center justify-center size-10 mt-0.5 transition-all duration-300">
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
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-warning-soft text-warning" title="Unsaved changes">
                                    Draft
                                  </span>
                                )}
                                <span className={`w-2 h-2 rounded-full ${isComplete ? "bg-success" : "bg-muted-foreground/30"}`} title={isComplete ? "Completed" : "Incomplete"} />
                              </div>
                            </div>
                            <span className="text-[10px] text-muted leading-tight line-clamp-2 mt-0.5">{String(section.desc)}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Credentials & Background Group */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-border/40 pb-2 mb-1 text-left">
                <span className="w-1.5 h-3.5 bg-accent rounded-full" />
                <Typography type="body-xs" className="font-extrabold uppercase tracking-widest text-accent">
                  Credentials & Background
                </Typography>
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
                    <Card
                      key={section.id}
                      rounded="2xl"
                      glow={true}
                      className="p-5 border border-border/40 hover:border-accent/40 bg-surface cursor-pointer text-left select-none relative group h-[110px] transition-all duration-300"
                      onClick={() => {
                        setActiveTab(section.id);
                        setViewState("editor");
                      }}
                    >
                      <div className="flex gap-4 items-start w-full h-full">
                        <div className="p-2.5 rounded-xl bg-surface-secondary text-accent group-hover:bg-accent group-hover:text-accent-foreground shrink-0 flex items-center justify-center size-10 mt-0.5 transition-all duration-300">
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
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-warning-soft text-warning" title="Unsaved changes">
                                    Draft
                                  </span>
                                )}
                                <span className={`w-2 h-2 rounded-full ${isComplete ? "bg-success" : "bg-muted-foreground/30"}`} title={isComplete ? "Completed" : "Incomplete"} />
                              </div>
                            </div>
                            <span className="text-[10px] text-muted leading-tight line-clamp-2 mt-0.5">{String(section.desc)}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Integrations & Preferences Group */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-border/40 pb-2 mb-1 text-left">
                <span className="w-1.5 h-3.5 bg-accent rounded-full" />
                <Typography type="body-xs" className="font-extrabold uppercase tracking-widest text-accent">
                  Integrations & Preferences
                </Typography>
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
                    <Card
                      key={section.id}
                      rounded="2xl"
                      glow={true}
                      className="p-5 border border-border/40 hover:border-accent/40 bg-surface cursor-pointer text-left select-none relative group h-[110px] transition-all duration-300"
                      onClick={() => {
                        setActiveTab(section.id);
                        setViewState("editor");
                      }}
                    >
                      <div className="flex gap-4 items-start w-full h-full">
                        <div className="p-2.5 rounded-xl bg-surface-secondary text-accent group-hover:bg-accent group-hover:text-accent-foreground shrink-0 flex items-center justify-center size-10 mt-0.5 transition-all duration-300">
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
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-warning-soft text-warning" title="Unsaved changes">
                                    Draft
                                  </span>
                                )}
                                <span className={`w-2 h-2 rounded-full ${isComplete ? "bg-success" : "bg-muted-foreground/30"}`} title={isComplete ? "Completed" : "Incomplete"} />
                              </div>
                            </div>
                            <span className="text-[10px] text-muted leading-tight line-clamp-2 mt-0.5">{String(section.desc)}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Previews and Assessments (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* AI Candidate Assessment Card */}
            <Card rounded="2xl" glow={true} className="p-6 border border-accent/25 bg-surface flex flex-col gap-5 relative overflow-hidden">
              {latestAssessment?.status === 'Completed' && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-2xl pointer-events-none" />
              )}

              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-accent-soft text-accent shrink-0">
                  <Sparkles className="size-5.5 animate-pulse" />
                </div>
                <div className="flex flex-col text-left">
                  <Typography type="body-sm" className="font-extrabold text-foreground">
                    AI Candidate Assessment
                  </Typography>
                  <span className="text-[10px] text-muted mt-0.5">
                    Verified Codebase Quality & Tech Stack Calibrations
                  </span>
                </div>
              </div>

              <div className="w-full h-px bg-border/20" />

              <p className="text-xs text-muted-foreground leading-relaxed">
                Analyze your full technical profile, system complexity, and contribution ratios across all verified repositories.
              </p>

              <div className="flex flex-col gap-3.5 bg-surface-secondary/40 p-4 rounded-2xl border border-border/10">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground">Status:</span>
                  {latestAssessment?.status === 'Running' || latestAssessment?.status === 'Queued' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-warning-soft text-warning animate-pulse">
                      Running ({streamProgress}%)
                    </span>
                  ) : latestAssessment?.status === 'Completed' ? (
                    readiness?.requiresReassessment ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-warning-soft text-warning">
                        Outdated
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-success-soft text-success">
                        Up To Date
                      </span>
                    )
                  ) : latestAssessment?.status === 'Failed' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-danger-soft text-danger">
                      Failed
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-default-soft text-muted-foreground">
                      Never Assessed
                    </span>
                  )}
                </div>

                {readiness && !readiness.isReady ? (
                  <div className="flex gap-2.5 items-start text-muted text-xs">
                    <AlertCircle className="size-4 text-warning shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-foreground">Required Fields Missing</span>
                      <span className="text-[10px] text-danger-foreground bg-danger-soft px-2.5 py-1 rounded-lg font-semibold leading-relaxed">
                        Missing: {readiness.missingFields.join(", ")}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {latestAssessment?.completedAtUtc && (
                      <div className="flex justify-between text-[10px] text-muted">
                        <span>Last Assessed</span>
                        <span>{new Date(latestAssessment.completedAtUtc).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex gap-2 w-full mt-1">
                      {latestAssessment?.status === 'Completed' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="rounded-xl font-bold text-xs select-none border-border/30 h-10 flex-1"
                          onPress={() => handleViewAssessmentDetails(latestAssessment.id)}
                        >
                          View Report
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className={`rounded-xl font-bold text-xs select-none h-10 flex-1 border-none ${latestAssessment?.status === 'Running' || latestAssessment?.status === 'Queued'
                          ? "bg-warning text-warning-foreground"
                          : "bg-accent text-accent-foreground"
                          }`}
                        onPress={
                          latestAssessment?.status === 'Running' || latestAssessment?.status === 'Queued'
                            ? () => setIsProgressModalOpen(true)
                            : handleTriggerAssessment
                        }
                      >
                        {latestAssessment?.status === 'Running' || latestAssessment?.status === 'Queued'
                          ? "Progress"
                          : latestAssessment?.status === 'Completed'
                            ? "Re-Run"
                            : "Run Assessment"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Export & Previews unified card */}
            <Card rounded="2xl" glow={true} className="p-6 border border-border/40 bg-surface flex flex-col gap-5">
              <div className="flex flex-col gap-1 border-b border-border/20 pb-3 text-left">
                <Typography type="body-sm" className="font-extrabold text-foreground">
                  Export & Sharing
                </Typography>
                <span className="text-[10px] text-muted">
                  Publish or view your profile formats.
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {/* Option 1: Standard A4 CV */}
                <div className="flex flex-col gap-2.5 p-4 rounded-2xl border border-border/30 bg-surface-secondary/20 hover:border-accent/30 transition-all group/item">
                  <div className="flex items-center gap-2 text-accent">
                    <FileText className="size-4 shrink-0" />
                    <span className="text-xs font-bold text-foreground">Standard A4 CV</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-normal text-left">
                    Traditional A4 layout ready for download or printing.
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-xl font-bold text-xs select-none w-full border-border/30 py-1.5 bg-surface-secondary hover:bg-surface-tertiary transition-colors"
                    onPress={() => setIsA4PreviewOpen(true)}
                  >
                    Open A4 Preview
                  </Button>
                </div>

                {/* Option 2: CVerify Digital Profile */}
                <div className="flex flex-col gap-2.5 p-4 rounded-2xl border border-border/30 bg-surface-secondary/20 hover:border-emerald-500/30 transition-all group/item">
                  <div className="flex items-center gap-2 text-emerald-500">
                    <Sparkles className="size-4 shrink-0" />
                    <span className="text-xs font-bold text-foreground">Digital Profile</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-normal text-left">
                    Online portfolio containing your AI verification badges.
                  </p>
                  <Button
                    size="sm"
                    className="rounded-xl font-bold text-xs select-none w-full bg-accent text-accent-foreground border-none py-1.5 hover:opacity-90 transition-opacity"
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
            </Card>
          </div>
        </div>
      </div>
    );
  };

  const renderEditor = () => {
    // Dynamically calculate completeness status per section
    const isBasicInfoFilled = !!(drafts["basic-info"].fullName && drafts["basic-info"].publicEmail && drafts["basic-info"].bio);
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
              onClick={() => setViewState("overview")}
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
                    {activeTab === "projects" && <ProjectsForm />}
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
            <div className="flex-1 overflow-y-auto p-8 bg-surface-secondary/50 flex justify-center items-start cv-preview-content-frame">
              <div className="shadow-md border border-border rounded-xs overflow-hidden cv-preview-box">
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
          </Card>
        </div>
      )}
      {renderProgressModal()}
    </div>
  );
}
