"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "../store/use-workspace-store";
import { Typography, Chip, Input, TextArea, toast, Card, Button, Skeleton } from "@heroui/react";
import { getTagLabel } from "../types/workspace.types";
import { BusinessVerificationBadge } from "@/components/ui/cverify/verification-badges";
import {
  Building2,
  Globe,
  MapPin,
  Briefcase,
  Calendar,
  ShieldCheck,
  Edit3,
  Save,
  AlertTriangle,
  Plus,
  X,
  User,
  Phone,
  Mail,
  Map,
  Link,
  Compass,
  Gift,
  Info
} from "lucide-react";

// Inline brand SVGs to bypass Lucide member mismatch errors
const LinkedInIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" {...props}>
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
  </svg>
);

const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" {...props}>
    <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z" />
  </svg>
);

const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface WorkspaceInformationViewProps {
  organizationSlug: string;
}

const PREDEFINED_INDUSTRY_TAGS = {
  "Software & Systems": ["Web Development", "Mobile Development", "Embedded Systems", "Cloud Computing"],
  "AI & Data": ["Artificial Intelligence", "Machine Learning", "Data Science", "Computer Vision"],
  "Hardware & Advanced Tech": ["Semiconductor", "IC Design", "IoT (Internet of Things)", "Microchip Technology"]
};

const PREDEFINED_BENEFIT_TAGS = [
  "Healthcare",
  "Remote Work",
  "Flexible Hours",
  "Training",
  "Free Lunch",
  "Gym Membership",
  "Stock Options",
  "Performance Bonus",
  "Laptop Provided",
  "Team Building",
  "Paid Time Off"
];

export function sanitizeMapUrl(url: string): { url: string; error?: string } {
  if (!url) return { url: "" };

  // Case A: Full iframe extraction
  const iframeRegex = /<iframe[^>]+src=["'](https:\/\/(www\.)?google\.com\/maps\/embed[^"']+)["']/i;
  const match = url.match(iframeRegex);
  if (match && match[1]) {
    return { url: match[1] };
  }

  // Case B: Clean embed URL
  if (url.startsWith("https://www.google.com/maps/embed") || url.startsWith("https://google.com/maps/embed")) {
    return { url };
  }

  // Case C: Standard browser sharing links or directions links
  if (
    url.includes("maps.app.goo.gl") ||
    url.includes("google.com/maps/place") ||
    url.includes("google.com/maps/dir") ||
    /https:\/\/(www\.)?google\.com\/maps\/@/i.test(url)
  ) {
    return {
      url: "",
      error: "Standard Google Maps sharing links are not supported for embed previews. Please use a 'Google Maps Embed URL' or copy the 'Embed a map' iframe code from Google Maps share options."
    };
  }

  // Fallback checks
  if (url.includes("<iframe")) {
    return {
      url: "",
      error: "Invalid iframe code detected. Please copy the clean iframe HTML snippet directly from Google Maps."
    };
  }

  if (!url.includes("google.com/maps")) {
    return {
      url: "",
      error: "Invalid Google Maps URL. Please copy a correct Maps embed source URL."
    };
  }

  return { url };
}

export const WorkspaceInformationView: React.FC<WorkspaceInformationViewProps> = ({
  organizationSlug,
}) => {
  const router = useRouter();
  const fetchWorkspace = useWorkspaceStore((s) => s.fetchWorkspace);
  const workspaceDetails = useWorkspaceStore((s) => s.workspaces[organizationSlug]);
  const isDetailsLoading = useWorkspaceStore((s) => s.loading[organizationSlug]);
  const detailsError = useWorkspaceStore((s) => s.errors[organizationSlug]);
  const updateWorkspaceDetails = useWorkspaceStore((s) => s.updateWorkspaceDetails);
  const fetchMyOrganizations = useWorkspaceStore((s) => s.fetchMyOrganizations);
  const myOrganizations = useWorkspaceStore((s) => s.myOrganizations);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [branchCount, setBranchCount] = useState<number>(0);
  const [taxCode, setTaxCode] = useState("");
  const [industryTags, setIndustryTags] = useState<string[]>([]);
  const [benefitTags, setBenefitTags] = useState<string[]>([]);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [city, setCity] = useState("");
  const [detailAddress, setDetailAddress] = useState("");
  const [googleMapsEmbedUrl, setGoogleMapsEmbedUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");

  // Input helpers state
  const [customIndustryTag, setCustomIndustryTag] = useState("");
  const [customBenefitTag, setCustomBenefitTag] = useState("");
  const [mapError, setMapError] = useState<string | null>(null);

  // Category recommendations filter
  const [industryCategoryFilter, setIndustryCategoryFilter] = useState<"All" | "Software & Systems" | "AI & Data" | "Hardware & Advanced Tech">("All");

  useEffect(() => {
    if (organizationSlug) {
      fetchWorkspace(organizationSlug);
      fetchMyOrganizations();
    }
  }, [organizationSlug, fetchWorkspace, fetchMyOrganizations]);

  useEffect(() => {
    if (workspaceDetails) {
      const initForm = async () => {
        await Promise.resolve();
        setDescription(workspaceDetails.description || "");
        setWebsite(workspaceDetails.website || "");
        setCompanyType(workspaceDetails.companyType || "");
        setCompanySize(workspaceDetails.companySize || "");
        setBranchCount(workspaceDetails.branchCount || 0);
        setTaxCode(workspaceDetails.taxCode || "");
        setIndustryTags(workspaceDetails.industryTags || []);
        setBenefitTags(workspaceDetails.benefitTags || []);
        setContactName(workspaceDetails.contactName || "");
        setContactPhone(workspaceDetails.contactPhone || "");
        setContactEmail(workspaceDetails.contactEmail || "");
        setCity(workspaceDetails.city || "");
        setDetailAddress(workspaceDetails.detailAddress || "");
        setGoogleMapsEmbedUrl(workspaceDetails.googleMapsEmbedUrl || "");
        setLinkedinUrl(workspaceDetails.linkedinUrl || "");
        setFacebookUrl(workspaceDetails.facebookUrl || "");
        setTwitterUrl(workspaceDetails.twitterUrl || "");
        setMapError(null);
      };
      initForm();
    }
  }, [workspaceDetails]);

  if (isDetailsLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 font-outfit text-foreground">
        <div className="h-10 w-48 bg-separator/50 animate-pulse rounded-lg mb-4" />
        <Card className="p-6 space-y-4">
          <Skeleton className="h-8 w-1/3 rounded-lg" />
          <Skeleton className="h-4 w-2/3 rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-12 w-1/2 rounded-lg" />
        </Card>
      </div>
    );
  }

  if (detailsError || !workspaceDetails) {
    const isAccessDenied = detailsError?.toLowerCase().includes("forbidden") || detailsError?.toLowerCase().includes("forbid") || detailsError?.includes("403");
    return (
      <div className="max-w-xl mx-auto py-20 font-outfit text-foreground">
        <Card className="p-8 border border-border bg-surface text-center">
          <div className="size-16 rounded-2xl bg-danger/10 flex items-center justify-center border border-danger/20 mx-auto mb-5 text-danger">
            <AlertTriangle size={28} />
          </div>
          <Typography type="h4" className="font-bold text-foreground mb-2">
            {isAccessDenied ? "Access Denied" : "Workspace Loading Error"}
          </Typography>
          <Typography type="body-xs" className="text-muted leading-relaxed mb-6">
            {isAccessDenied
              ? "You do not have permission to access this organization workspace. Please verify your membership credentials or switch accounts."
              : detailsError || "Organization not found"}
          </Typography>
          <div className="flex gap-4 justify-center mb-2">
            <button
              onClick={() => router.push("/user")}
              className="px-4 py-2 bg-foreground text-background font-bold rounded-xl text-xs cursor-pointer"
            >
              Back to Home
            </button>
          </div>
          {myOrganizations && myOrganizations.length > 0 && (
            <div className="mt-6 border-t border-separator/40 pt-6 text-left w-full">
              <span className="text-[10px] text-muted font-bold uppercase tracking-wider mb-3 block text-center">
                Select a Workspace to Switch
              </span>
              <div className="grid grid-cols-1 gap-2.5 max-h-48 overflow-y-auto pr-1">
                {myOrganizations.map((org) => (
                  <button
                    key={org.slug}
                    onClick={() => router.push(`/business/${org.slug}/information`)}
                    className="flex items-center gap-3 w-full p-3.5 rounded-xl border border-border bg-surface-secondary/40 hover:bg-surface-secondary hover:border-accent/30 text-left transition-colors duration-200 group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center group-hover:bg-accent group-hover:text-background transition-colors duration-200">
                      <Building2 size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block text-xs font-bold text-foreground truncate group-hover:text-accent transition-colors duration-200">
                        {org.name}
                      </span>
                      <span className="block text-[10px] text-muted font-mono truncate">
                        @{org.slug}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  const userRole = workspaceDetails.userRole;
  const canEdit = userRole === "OWNER" || userRole === "REPRESENTATIVE";

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = {
        description,
        website,
        companyType,
        companySize,
        branchCount: Number(branchCount),
        industryTags,
        benefitTags,
        contactName,
        contactPhone,
        contactEmail,
        city,
        detailAddress,
        googleMapsEmbedUrl,
        linkedinUrl,
        facebookUrl,
        twitterUrl
      };
      await updateWorkspaceDetails(organizationSlug, updates);
      toast.success("Workspace details updated successfully.");
      setIsEditing(false);
    } catch (err: any) {
      console.error(err);
      toast.danger(err?.response?.data?.message || "Failed to update workspace details.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMapUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setGoogleMapsEmbedUrl(rawVal);

    if (!rawVal) {
      setMapError(null);
      return;
    }

    const result = sanitizeMapUrl(rawVal);
    if (result.error) {
      setMapError(result.error);
    } else {
      setMapError(null);
      setGoogleMapsEmbedUrl(result.url);
    }
  };

  const handleToggleIndustryTag = (tag: string) => {
    setIndustryTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const addIndustryTag = (tag: string) => {
    const val = tag.trim();
    if (val) {
      if (!industryTags.includes(val)) {
        setIndustryTags(prev => [...prev, val]);
      }
      setCustomIndustryTag("");
    }
  };

  const handleAddCustomIndustryTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addIndustryTag(customIndustryTag);
    }
  };

  const handleToggleBenefitTag = (tag: string) => {
    setBenefitTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleAddCustomBenefitTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = customBenefitTag.trim();
      if (val && !benefitTags.includes(val)) {
        setBenefitTags(prev => [...prev, val]);
        setCustomBenefitTag("");
      }
    }
  };

  return (
    <div className="space-y-6 font-outfit max-w-7xl mx-auto text-foreground">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-surface border border-border text-foreground select-none shadow-sm">
        <div className="space-y-1">
          <Typography
            type="h2"
            className="text-2xl font-bold flex items-center gap-2 text-foreground font-outfit"
          >
            <Building2 size={24} className="text-accent" />
            {workspaceDetails.organizationName}
          </Typography>
          <Typography type="body-xs" className="text-muted font-light mt-0.5 font-outfit">
            Workspace context: <span className="font-mono text-accent">@{workspaceDetails.organizationSlug}</span> • My Role: <span className="font-semibold text-foreground">{workspaceDetails.userRole || "Visitor"}</span>
          </Typography>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            isEditing ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    // Reload original details to reset fields
                    fetchWorkspace(organizationSlug);
                  }}
                  isDisabled={isSaving}
                  className="font-bold text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleSave}
                  isDisabled={isSaving}
                  className="font-bold text-xs bg-accent text-background border-none hover:bg-accent/90 shrink-0 cursor-pointer"
                >
                  <Save size={14} className="mr-1.5" />
                  Save Changes
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
                className="font-bold text-xs cursor-pointer"
              >
                <Edit3 size={14} className="mr-1.5" />
                Edit Profile
              </Button>
            )
          )}
          <BusinessVerificationBadge level={workspaceDetails.verificationLevel} />
        </div>
      </div>

      {/* 2-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Left Column - Main Details (Span 2) */}
        <div className="lg:col-span-2 space-y-6">

          {/* Card 1: About the Company */}
          <Card className="p-6 md:p-8 bg-surface border border-border rounded-2xl space-y-4">
            <Typography type="h4" className="font-bold text-foreground font-outfit">
              About the Company
            </Typography>
            {isEditing ? (
              <div className="space-y-1">
                <span className="text-xs font-bold text-muted uppercase">Company Description</span>
                <TextArea
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                  className="w-full text-sm font-outfit"
                  placeholder="Enter a detailed description about the organization..."
                  rows={5}
                />
              </div>
            ) : (
              <Typography type="body-xs" className="text-muted leading-relaxed text-sm font-outfit">
                {description || "No description provided yet."}
              </Typography>
            )}
          </Card>

          {/* Card 2: Focus Areas & Industry Tags */}
          <Card className="p-6 md:p-8 bg-surface border border-border rounded-2xl space-y-4">
            <div className="flex justify-between items-center">
              <Typography type="h4" className="font-bold text-foreground font-outfit flex items-center gap-2">
                <Compass size={18} className="text-accent" />
                Focus Areas & Industry Tags
              </Typography>
            </div>

            {isEditing ? (
              <div className="space-y-4">
                {/* Category Recommendations Filter */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-muted uppercase block">Predefined Recommendations</span>
                  <div className="flex gap-1 bg-surface-secondary/40 p-1 rounded-xl border border-border w-fit">
                    {(["All", "Software & Systems", "AI & Data", "Hardware & Advanced Tech"] as const).map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setIndustryCategoryFilter(cat)}
                        className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${industryCategoryFilter === cat
                          ? "bg-surface text-foreground shadow-sm border border-border/30"
                          : "text-muted hover:text-foreground"
                          }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Predefined Ready-to-Click tag list */}
                <div className="space-y-2.5 p-3 bg-surface-secondary/40 border border-border rounded-xl">
                  {Object.entries(PREDEFINED_INDUSTRY_TAGS)
                    .filter(([category]) => industryCategoryFilter === "All" || industryCategoryFilter === category)
                    .map(([category, tags]) => (
                      <div key={category} className="space-y-1">
                        <span className="text-[10px] text-muted font-bold block">{category}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {tags.map(tag => {
                            const isSelected = industryTags.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => handleToggleIndustryTag(tag)}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${isSelected
                                  ? "bg-accent/10 border-accent text-accent"
                                  : "bg-transparent border-border text-muted hover:border-muted"
                                  }`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>

                {/* Custom input */}
                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted uppercase">Add Custom Industry Tags</span>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Type or select an industry focus..."
                      value={customIndustryTag}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomIndustryTag(e.target.value)}
                      onKeyDown={handleAddCustomIndustryTag}
                      className="w-full text-sm font-outfit"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addIndustryTag(customIndustryTag)}
                      className="font-bold text-xs"
                    >
                      Add
                    </Button>
                  </div>
                </div>

                {/* Selected Tags list */}
                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted uppercase block">Selected Focus Areas</span>
                  <div className="flex flex-wrap gap-1.5 min-h-10 p-2.5 bg-surface-secondary/20 border border-border/60 rounded-xl">
                    {industryTags.length === 0 ? (
                      <span className="text-xs text-muted font-light italic">No industry tags configured.</span>
                    ) : (
                      industryTags.map(tag => (
                        <div
                          key={tag}
                          className="flex items-center gap-1 bg-accent/10 text-accent border border-accent/20 px-2.5 py-1 rounded-full text-xs font-semibold"
                        >
                          <span>{tag}</span>
                          <button
                            type="button"
                            onClick={() => handleToggleIndustryTag(tag)}
                            className="hover:text-foreground text-accent/80 transition-colors cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {industryTags.length === 0 ? (
                  <span className="text-xs text-muted font-light italic">No industry tags configured.</span>
                ) : (
                  industryTags.map(tag => (
                    <Chip
                      key={tag}
                      color="accent"
                      variant="soft"
                      size="sm"
                      className="font-semibold text-xs py-1"
                    >
                      {tag}
                    </Chip>
                  ))
                )}
              </div>
            )}
          </Card>

          {/* Card 3: Employee Benefits */}
          <Card className="p-6 md:p-8 bg-surface border border-border rounded-2xl space-y-4">
            <Typography type="h4" className="font-bold text-foreground font-outfit flex items-center gap-2">
              <Gift size={18} className="text-accent" />
              Employee Benefits
            </Typography>

            {isEditing ? (
              <div className="space-y-4">
                {/* Predefined Ready-to-Click Benefits list */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-muted uppercase block">Benefits Recommendations</span>
                  <div className="flex flex-wrap gap-1.5 p-3 bg-surface-secondary/40 border border-border rounded-xl">
                    {PREDEFINED_BENEFIT_TAGS.map(tag => {
                      const isSelected = benefitTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleToggleBenefitTag(tag)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${isSelected
                            ? "bg-accent/10 border-accent text-accent"
                            : "bg-transparent border-border text-muted hover:border-muted"
                            }`}
                        >
                          {getTagLabel(tag)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom input */}
                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted uppercase">Add Custom Benefit</span>
                  <Input
                    type="text"
                    placeholder="Type a benefit and press Enter..."
                    value={customBenefitTag}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomBenefitTag(e.target.value)}
                    onKeyDown={handleAddCustomBenefitTag}
                    className="w-full text-sm font-outfit"
                  />
                </div>

                {/* Selected Benefits list */}
                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted uppercase block">Selected Benefits</span>
                  <div className="flex flex-wrap gap-1.5 min-h-10 p-2.5 bg-surface-secondary/20 border border-border/60 rounded-xl">
                    {benefitTags.length === 0 ? (
                      <span className="text-xs text-muted font-light italic">No benefits selected. Click recommendations above or type custom benefits.</span>
                    ) : (
                      benefitTags.map(tag => (
                        <div
                          key={tag}
                          className="flex items-center gap-1 bg-accent/10 text-accent border border-accent/20 px-2.5 py-1 rounded-full text-xs font-semibold"
                        >
                          <span>{getTagLabel(tag)}</span>
                          <button
                            type="button"
                            onClick={() => handleToggleBenefitTag(tag)}
                            className="hover:text-foreground text-accent/80 transition-colors cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {benefitTags.length === 0 ? (
                  <span className="text-xs text-muted font-light italic">No employee benefits listed.</span>
                ) : (
                  benefitTags.map(tag => (
                    <Chip
                      key={tag}
                      color="accent"
                      variant="soft"
                      size="sm"
                      className="font-semibold text-xs py-1"
                    >
                      {getTagLabel(tag)}
                    </Chip>
                  ))
                )}
              </div>
            )}
          </Card>

          {/* Card 4: Contact Details */}
          <Card className="p-8 md:p-9 bg-surface border border-border rounded-2xl space-y-4">
            <Typography type="h4" className="font-bold text-foreground font-outfit">
              Contact Details
            </Typography>

            {isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted uppercase">Contact Name</span>
                  <Input
                    type="text"
                    value={contactName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContactName(e.target.value)}
                    className="w-full text-sm font-outfit"
                    placeholder="Representative Name"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted uppercase">Contact Phone</span>
                  <Input
                    type="text"
                    value={contactPhone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContactPhone(e.target.value)}
                    className="w-full text-sm font-outfit"
                    placeholder="Phone number"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted uppercase">Contact Email</span>
                  <Input
                    type="email"
                    value={contactEmail}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContactEmail(e.target.value)}
                    className="w-full text-sm font-outfit"
                    placeholder="Email address"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                    <User size={16} />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted font-bold uppercase block font-outfit">Contact Person</span>
                    <span className="text-xs  text-foreground font-outfit">
                      {contactName || "Not provided"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                    <Phone size={16} />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted font-bold uppercase block font-outfit">Phone</span>
                    <span className="text-xs  text-foreground font-outfit">
                      {contactPhone || "Not provided"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                    <Mail size={16} />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted font-bold uppercase block font-outfit">Email</span>
                    {contactEmail ? (
                      <a href={`mailto:${contactEmail}`} className="text-xs font-bold text-accent hover:underline font-outfit">
                        {contactEmail}
                      </a>
                    ) : (
                      <span className="text-xs font-bold text-foreground font-outfit">Not provided</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Card 5: Office Location */}
          <Card className="p-6 md:p-8 bg-surface border border-border rounded-2xl space-y-4">
            <Typography type="h3" className="font-bold text-foreground font-outfit flex items-center gap-2">
              <Map size={18} className="text-accent" />
              Office Location
            </Typography>

            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-muted uppercase">City</span>
                    <Input
                      type="text"
                      value={city}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCity(e.target.value)}
                      className="w-full text-sm font-outfit"
                      placeholder="e.g. Hanoi, Ho Chi Minh City"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-muted uppercase">Detail Address</span>
                    <Input
                      type="text"
                      value={detailAddress}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDetailAddress(e.target.value)}
                      className="w-full text-sm font-outfit"
                      placeholder="Street, District details..."
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted uppercase">Google Maps Embed URL</span>
                  <Input
                    type="text"
                    value={googleMapsEmbedUrl}
                    onChange={handleMapUrlChange}
                    className="w-full text-sm font-outfit"
                    placeholder="Paste full iframe code or direct src embed link..."
                  />
                  {mapError && (
                    <div className="flex items-center gap-1.5 text-danger text-xs font-semibold mt-1">
                      <AlertTriangle size={14} className="shrink-0" />
                      {mapError}
                    </div>
                  )}
                </div>

                {/* Map Preview in edit mode */}
                {googleMapsEmbedUrl && !mapError && (
                  <div className="space-y-2">
                    <span className="text-[10px] text-muted font-bold uppercase block">Live Map Preview</span>
                    <div className="h-60 rounded-xl overflow-hidden border border-border/80">
                      <iframe
                        src={googleMapsEmbedUrl}
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        allowFullScreen={false}
                        loading="lazy"
                        title="Google Maps Embed Preview"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2 items-start">
                  <MapPin size={18} className="text-accent shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-bold text-foreground block font-outfit">
                      {detailAddress ? `${detailAddress}, ${city}` : city || "No address details specified."}
                    </span>
                  </div>
                </div>

                {/* Map Preview in view mode */}
                {googleMapsEmbedUrl ? (
                  <div className="h-64 rounded-2xl overflow-hidden border border-border/80 shadow-xs">
                    <iframe
                      src={googleMapsEmbedUrl}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen={false}
                      loading="lazy"
                      title="Google Maps Embed View"
                    />
                  </div>
                ) : (
                  <div className="h-32 border border-dashed border-border rounded-2xl bg-surface-secondary/40 flex flex-col items-center justify-center text-muted gap-2 select-none">
                    <Map size={24} className="opacity-40" />
                    <span className="text-xs font-medium italic">No interactive map location specified.</span>
                  </div>
                )}
              </div>
            )}
          </Card>

        </div>

        {/* Right Column - Sidebar Widgets (Span 1) */}
        <div className="space-y-6">

          {/* Card 6: Administrative Details */}
          <Card className="p-6 bg-surface border border-border rounded-2xl space-y-4">
            <Typography type="h4" className="font-bold text-foreground flex items-center gap-2 font-outfit">
              <Building2 size={16} className="text-accent" />
              Administrative Details
            </Typography>

            {isEditing ? (
              <div className="space-y-4">
                <div className="space-y-5">
                  <span className="text-xs font-bold text-muted uppercase font-outfit">Company Type</span>
                  <Input
                    type="text"
                    value={companyType}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompanyType(e.target.value)}
                    className="w-full text-sm font-outfit"
                    placeholder="e.g. Private, Public, Government"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted uppercase font-outfit">Company Size</span>
                  <Input
                    type="text"
                    value={companySize}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompanySize(e.target.value)}
                    className="w-full text-sm font-outfit"
                    placeholder="e.g. 50-100 employees"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted uppercase font-outfit">Branch Count</span>
                  <Input
                    type="number"
                    value={branchCount.toString()}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBranchCount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full text-sm font-outfit"
                    min="0"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted uppercase block font-outfit">Tax Code (Read-Only)</span>
                  <Input
                    type="text"
                    value={taxCode}
                    disabled
                    className="w-full text-sm font-outfit opacity-80"
                    placeholder="No tax code loaded"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs font-outfit select-none">
                <div>
                  <span className="text-[10px] text-muted-foreground font-bold uppercase block font-outfit">Company Type</span>
                  <span className="font-semibold text-foreground text-sm font-outfit">{companyType || "Not specified"}</span>
                </div>

                <div>
                  <span className="text-[10px] text-muted-foreground font-bold uppercase block font-outfit">Company Size</span>
                  <span className="font-semibold text-foreground text-sm font-outfit">{companySize || "Not specified"}</span>
                </div>

                <div>
                  <span className="text-[10px] text-muted-foreground font-bold uppercase block font-outfit">Branches Count</span>
                  <span className="font-semibold text-foreground text-sm font-outfit">{branchCount} branch offices</span>
                </div>

                <div>
                  <span className="text-[10px] text-muted-foreground font-bold uppercase block font-outfit">Tax Code</span>
                  <span className="font-semibold text-foreground text-sm font-mono font-outfit">{taxCode || "Not registered"}</span>
                </div>
              </div>
            )}
          </Card>

          {/* Card 7: Social Networks */}
          <Card className="p-6 bg-surface border border-border rounded-2xl space-y-4">
            <Typography type="h4" className="font-bold text-foreground font-outfit">
              Social Networks
            </Typography>

            {isEditing ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted uppercase block font-outfit">LinkedIn URL</span>
                  <Input
                    type="url"
                    value={linkedinUrl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLinkedinUrl(e.target.value)}
                    className="w-full text-sm font-outfit"
                    placeholder="https://linkedin.com/company/..."
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted uppercase block font-outfit">Facebook URL</span>
                  <Input
                    type="url"
                    value={facebookUrl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFacebookUrl(e.target.value)}
                    className="w-full text-sm font-outfit"
                    placeholder="https://facebook.com/..."
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted uppercase block font-outfit">Twitter URL</span>
                  <Input
                    type="url"
                    value={twitterUrl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTwitterUrl(e.target.value)}
                    className="w-full text-sm font-outfit"
                    placeholder="https://twitter.com/..."
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted uppercase block font-outfit">Corporate Website</span>
                  <Input
                    type="url"
                    value={website}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWebsite(e.target.value)}
                    className="w-full text-sm font-outfit"
                    placeholder="https://website.com"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {linkedinUrl ? (
                  <a
                    href={linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-card/10 hover:bg-card/50 transition-colors text-xs font-semibold text-muted hover:text-foreground"
                  >
                    <LinkedInIcon className="size-4 text-accent" />
                    LinkedIn
                  </a>
                ) : null}

                {facebookUrl ? (
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-card/10 hover:bg-card/50 transition-colors text-xs font-semibold text-muted hover:text-foreground"
                  >
                    <FacebookIcon className="size-4 text-accent" />
                    Facebook
                  </a>
                ) : null}

                {twitterUrl ? (
                  <a
                    href={twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-card/10 hover:bg-card/50 transition-colors text-xs font-semibold text-muted hover:text-foreground"
                  >
                    <TwitterIcon className="size-4 text-accent" />
                    Twitter / X
                  </a>
                ) : null}

                {website ? (
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-card/10 hover:bg-card/50 transition-colors text-xs font-semibold text-muted hover:text-foreground"
                  >
                    <Globe size={14} className="text-accent" />
                    Corporate Website
                  </a>
                ) : null}

                {!linkedinUrl && !facebookUrl && !twitterUrl && !website && (
                  <span className="text-xs text-muted font-light italic">No social links configured.</span>
                )}
              </div>
            )}
          </Card>

          {/* Card 8: Info / Security Widget */}
          <Card className="p-6 bg-surface border border-border rounded-2xl space-y-4">
            <Typography type="h4" className="font-bold text-foreground flex items-center gap-2 font-outfit">
              <ShieldCheck size={18} className="text-accent" />
              Information Administration
            </Typography>
            <Typography type="body-xs" className="text-muted leading-relaxed font-outfit">
              Use this page to keep corporate contact coordinates, founded year, and details updated. Candidates will see these details on the public organization page.
            </Typography>
          </Card>

        </div>
      </div>
    </div>
  );
};

export default WorkspaceInformationView;
