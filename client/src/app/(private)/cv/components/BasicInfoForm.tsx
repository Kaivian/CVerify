import React, { useRef, useState } from "react";
import { Input, Button, Select, ListBox, Spinner, toast, TextArea, Tooltip, Dropdown, DatePicker, DateField, Calendar, Chip } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { PlusCircle, Trash2, Camera, Info, Sparkles } from "lucide-react";
import { type BasicInfoDraft } from "./types";
import { profileApi } from "@/services/profile.service";
import { BaseUnsavedChangesBar } from "@/components/ui/unsaved-changes-bar";
import { type CandidateAssessmentResponse } from "@/types/profile.types";
import {
  parseAiSuggestions,
  stringifyAiSuggestions,
  getFieldSuggestion,
  selectSuggestion,
  selectUserValue
} from "@/utils/ai-suggestions";

interface BasicInfoFormProps {
  draft: BasicInfoDraft;
  baseline: BasicInfoDraft;
  onChange: (updated: Partial<BasicInfoDraft>) => void;
  onSave: (updated: BasicInfoDraft) => Promise<void>;
  onReset: () => void;
  isSaving: boolean;
  isDirty: boolean;
  avatarUrl?: string | null;
  latestAssessment?: CandidateAssessmentResponse | null;
  parsedProfile?: any | null;
}

export const BasicInfoForm: React.FC<BasicInfoFormProps> = ({
  draft,
  baseline,
  onChange,
  onSave,
  onReset,
  isSaving,
  isDirty,
  avatarUrl,
  latestAssessment,
  parsedProfile,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const suggestionsMap = parseAiSuggestions(draft.aiSuggestionsJson);
  const headlineSuggestion = getFieldSuggestion(suggestionsMap, "headline", latestAssessment?.summaryHeadline);
  const bioSuggestion = getFieldSuggestion(suggestionsMap, "bio", latestAssessment?.professionalBio);

  const rawRoles = parsedProfile?.bestFitRoles || [];
  const bestFitRoles = rawRoles.map((r: any) => ({
    title: r.roleTitle || '',
    matchScore: typeof r.matchScore === 'number' ? r.matchScore : 0,
    rank: typeof r.rank === 'number' ? r.rank : 1,
  }));

  const rolesList: Array<{ title: string; matchScore: number }> = [];
  if (bestFitRoles.length > 0) {
    bestFitRoles.forEach((role: any) => {
      rolesList.push({ title: role.title, matchScore: role.matchScore });
    });
  } else if (headlineSuggestion.aiValue) {
    rolesList.push({ title: headlineSuggestion.aiValue, matchScore: 90 });
  }

  const [userHeadline, setUserHeadline] = useState(() => {
    return suggestionsMap.headline?.source === 'user' ? (draft.headline || "") : "";
  });
  const [userBio, setUserBio] = useState(() => {
    return suggestionsMap.bio?.source === 'user' ? (draft.bio || "") : "";
  });

  const [prevHeadline, setPrevHeadline] = useState(draft.headline);
  const [prevHeadlineSuggestions, setPrevHeadlineSuggestions] = useState(draft.aiSuggestionsJson);
  if (draft.headline !== prevHeadline || draft.aiSuggestionsJson !== prevHeadlineSuggestions) {
    setPrevHeadline(draft.headline);
    setPrevHeadlineSuggestions(draft.aiSuggestionsJson);
    if (suggestionsMap.headline?.source === 'user') {
      setUserHeadline(draft.headline || "");
    }
  }

  const [prevBio, setPrevBio] = useState(draft.bio);
  const [prevBioSuggestions, setPrevBioSuggestions] = useState(draft.aiSuggestionsJson);
  if (draft.bio !== prevBio || draft.aiSuggestionsJson !== prevBioSuggestions) {
    setPrevBio(draft.bio);
    setPrevBioSuggestions(draft.aiSuggestionsJson);
    if (suggestionsMap.bio?.source === 'user') {
      setUserBio(draft.bio || "");
    }
  }

  const handleHeadlineChange = (val: string) => {
    setUserHeadline(val);
    const updatedMap = selectUserValue(suggestionsMap, "headline");
    onChange({
      headline: val,
      aiSuggestionsJson: stringifyAiSuggestions(updatedMap)
    });
  };

  const handleUseHeadlineSuggestion = () => {
    if (headlineSuggestion.source === 'user') {
      setUserHeadline(draft.headline || "");
    }
    const updatedMap = selectSuggestion(suggestionsMap, "headline", headlineSuggestion.aiValue);
    onChange({
      headline: headlineSuggestion.aiValue,
      aiSuggestionsJson: stringifyAiSuggestions(updatedMap)
    });
  };

  const handleSelectHeadlineRole = (roleTitle: string, matchScore: number) => {
    if (headlineSuggestion.source === 'user') {
      setUserHeadline(draft.headline || "");
    }
    const updatedMap = {
      ...suggestionsMap,
      headline: {
        aiValue: roleTitle,
        source: 'ai' as const,
        generatedAt: new Date().toISOString(),
        matchScore: matchScore
      }
    };
    onChange({
      headline: roleTitle,
      aiSuggestionsJson: stringifyAiSuggestions(updatedMap)
    });
  };

  const handleKeepUserHeadline = () => {
    const updatedMap = selectUserValue(suggestionsMap, "headline");
    onChange({
      headline: userHeadline,
      aiSuggestionsJson: stringifyAiSuggestions(updatedMap)
    });
  };

  const handleBioChange = (val: string) => {
    setUserBio(val);
    const updatedMap = selectUserValue(suggestionsMap, "bio");
    onChange({
      bio: val,
      aiSuggestionsJson: stringifyAiSuggestions(updatedMap)
    });
  };

  const handleUseBioSuggestion = () => {
    if (bioSuggestion.source === 'user') {
      setUserBio(draft.bio || "");
    }
    const updatedMap = selectSuggestion(suggestionsMap, "bio", bioSuggestion.aiValue);
    onChange({
      bio: bioSuggestion.aiValue,
      aiSuggestionsJson: stringifyAiSuggestions(updatedMap)
    });
  };

  const handleKeepUserBio = () => {
    const updatedMap = selectUserValue(suggestionsMap, "bio");
    onChange({
      bio: userBio,
      aiSuggestionsJson: stringifyAiSuggestions(updatedMap)
    });
  };

  const birthDateString = draft.birthDate || "";
  let birthDateValue = null;
  if (birthDateString) {
    try {
      birthDateValue = parseDate(birthDateString);
    } catch (e) {
      console.error("Failed to parse birthDate:", e);
    }
  }

  // Pronoun select options
  const pronounsOptions = [
    { value: "he_him", label: "He/Him" },
    { value: "she_her", label: "She/Her" },
    { value: "they_them", label: "They/Them" },
    { value: "prefer_not", label: "Prefer not to say" },
    { value: "custom", label: "Custom" },
  ];

  // Validate form fields
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!draft.fullName || draft.fullName.trim().length < 2) {
      newErrors.fullName = "Required";
    }

    if (draft.publicEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(draft.publicEmail)) {
        newErrors.publicEmail = "Invalid email format.";
      }
    }

    if (draft.phoneNumber) {
      const phoneRegex = /^[0-9+\s-]{9,15}$/;
      if (!phoneRegex.test(draft.phoneNumber)) {
        newErrors.phoneNumber = "Required";
      }
    }

    if (draft.bio && draft.bio.length > 1000) {
      newErrors.bio = "Bio cannot exceed 1000 characters.";
    }

    // Verify all social links are valid URLs
    draft.socialLinks.forEach((link, index) => {
      if (link.trim()) {
        try {
          if (!link.startsWith("http://") && !link.startsWith("https://")) {
            new URL("https://" + link);
          } else {
            new URL(link);
          }
        } catch (e) {
          newErrors[`link-${index}`] = "Invalid URL format.";
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.danger("File size exceeds 2MB limit.");
      return;
    }

    setIsUploading(true);
    try {
      const result = await profileApi.uploadAvatar(file);
      toast.success("Avatar uploaded successfully.");
      // Reload page state or let parent know we uploaded the avatar
      onChange({}); // trigger re-render / fetch in parent
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (error) {
      console.error(error);
      toast.danger("Failed to upload avatar.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.danger("Input formats failed validation.");
      return;
    }

    // Call save handler
    await onSave(draft);
  };

  // Add a social link input
  const addSocialLink = () => {
    onChange({ socialLinks: [...draft.socialLinks, ""] });
  };

  // Remove a social link input
  const removeSocialLink = (index: number) => {
    const filtered = draft.socialLinks.filter((_, i) => i !== index);
    onChange({ socialLinks: filtered });
  };

  // Handle a social link input change
  const handleSocialLinkChange = (value: string, index: number) => {
    const updated = [...draft.socialLinks];
    updated[index] = value;
    onChange({ socialLinks: updated });
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col h-full overflow-hidden relative text-left">
      <div className="flex-1 overflow-y-auto px-1.5 flex flex-col gap-4 pb-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 border-b border-border/20 pb-4">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-20 h-20 rounded-full bg-surface-secondary flex items-center justify-center text-muted border border-border/40 overflow-hidden relative">
              {isUploading ? (
                <Spinner size="sm" />
              ) : avatarUrl ? (
                <>
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="size-5 text-white" />
                  </div>
                </>
              ) : (
                <Camera className="size-6 text-muted-foreground group-hover:scale-110 transition-transform" />
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleAvatarChange}
            />
          </div>
          <div className="flex flex-col gap-1 select-none">
            <span className="font-bold text-sm text-foreground">{draft.fullName || "Full Name"}</span>
            <span className="text-[10px] text-muted-foreground">JPEG, PNG, or WebP. Max 2MB.</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-foreground">Full Name *</label>
            <Input
              value={draft.fullName}
              onChange={(e) => onChange({ fullName: e.target.value })}
              placeholder="John Doe"
              aria-label="Full Name"
              maxLength={100}
            />
            <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-0.5 select-none">
              {errors.fullName ? (
                <span className="text-danger">{errors.fullName}</span>
              ) : (
                <span />
              )}
              <span>{(draft.fullName || "").length}/100 characters</span>
            </div>
          </div>

          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-bold text-foreground">Username *</label>
              <Tooltip delay={0}>
                <Tooltip.Trigger>
                  <Info className="size-3.5 text-muted-foreground hover:text-foreground cursor-help" />
                </Tooltip.Trigger>
                <Tooltip.Content showArrow className="bg-surface border border-border rounded-xl p-2 text-xs max-w-xs text-foreground break-words">
                  This will form your public profile URL: cverify.com/username
                </Tooltip.Content>
              </Tooltip>
            </div>
            <Input
              value={draft.username}
              onChange={(e) => onChange({ username: e.target.value })}
              placeholder="johndoe"
              aria-label="Username"
              maxLength={30}
            />
            <div className="flex justify-end text-[10px] text-muted-foreground mt-0.5 select-none">
              <span>{(draft.username || "").length}/30 characters</span>
            </div>
          </div>

          {/* Headline */}
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-bold text-foreground">Professional Headline</label>
                {headlineSuggestion.source === 'ai' && (
                  <Chip
                    size="sm"
                    color="accent"
                    variant="soft"
                    className="text-[9px] font-extrabold uppercase px-1.5 h-4.5 bg-primary/10 text-primary border-none select-none"
                  >
                    AI Suggested
                  </Chip>
                )}
                <Tooltip delay={0}>
                  <Tooltip.Trigger>
                    <Info className="size-3.5 text-muted-foreground hover:text-foreground cursor-help" />
                  </Tooltip.Trigger>
                  <Tooltip.Content showArrow className="bg-surface border border-border rounded-xl p-2 text-xs max-w-xs text-foreground break-words">
                    A short, catchy phrase summarizing your expertise, e.g. "Senior Fullstack Engineer"
                  </Tooltip.Content>
                </Tooltip>
              </div>

              {rolesList.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {headlineSuggestion.source === 'user' ? (
                    <Dropdown>
                      <Dropdown.Trigger>
                        <span
                          role="button"
                          tabIndex={0}
                          className="inline-flex items-center gap-1 rounded-lg h-6 px-2 text-[10px] font-bold text-primary hover:bg-primary/10 border-none cursor-pointer bg-transparent select-none focus:outline-none"
                        >
                          <Sparkles className="size-3" />
                          <span>Use AI Suggestion</span>
                        </span>
                      </Dropdown.Trigger>
                      <Dropdown.Popover className="bg-overlay border border-border shadow-overlay rounded-xl p-1.5 min-w-[240px] outline-hidden animate-in fade-in duration-100 z-50 font-outfit">
                        <Dropdown.Menu
                          aria-label="AI Headline Suggestions"
                          onAction={(key) => {
                            const idx = parseInt(key as string, 10);
                            const selectedRole = rolesList[idx];
                            if (selectedRole) {
                              handleSelectHeadlineRole(selectedRole.title, selectedRole.matchScore);
                            }
                          }}
                        >
                          {rolesList.map((role, idx) => (
                            <Dropdown.Item
                              key={idx.toString()}
                              onClick={() => handleSelectHeadlineRole(role.title, role.matchScore)}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer text-foreground hover:bg-surface-secondary focus:bg-surface-secondary outline-none select-none transition-colors duration-150"
                            >
                              <div className="flex items-center justify-between gap-4 w-full text-xs font-semibold">
                                <span className="truncate max-w-[150px]">{role.title}</span>
                                <Chip size="sm" className="bg-accent/10 text-accent font-bold font-outfit border-none h-5 shrink-0">
                                  {role.matchScore}% Match
                                </Chip>
                              </div>
                            </Dropdown.Item>
                          ))}
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-lg h-6 px-2 text-[10px] font-bold text-muted hover:bg-surface-secondary border-none cursor-pointer"
                      onPress={handleKeepUserHeadline}
                    >
                      <span>Restore My Input</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
            <Input
              value={draft.headline}
              onChange={(e) => handleHeadlineChange(e.target.value)}
              placeholder="Senior Fullstack Engineer"
              aria-label="Professional Headline"
              maxLength={150}
              className="w-full"
            />
            <div className="flex justify-end text-[10px] text-muted-foreground mt-0.5 select-none">
              <span>{(draft.headline || "").length}/150 characters</span>
            </div>
          </div>

          {/* Bio Summary */}
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-bold text-foreground">Professional Bio / Profile Summary</label>
                {bioSuggestion.source === 'ai' && (
                  <Chip
                    size="sm"
                    color="accent"
                    variant="soft"
                    className="text-[9px] font-extrabold uppercase px-1.5 h-4.5 bg-primary/10 text-primary border-none select-none"
                  >
                    AI Suggested
                  </Chip>
                )}
              </div>

              {bioSuggestion.aiValue && (
                <div className="flex items-center gap-1.5">
                  {bioSuggestion.source === 'user' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-lg h-6 px-2 text-[10px] font-bold text-primary hover:bg-primary/10 border-none cursor-pointer flex items-center gap-1"
                      onPress={handleUseBioSuggestion}
                    >
                      <Sparkles className="size-3" />
                      <span>Use AI Suggestion</span>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-lg h-6 px-2 text-[10px] font-bold text-muted hover:bg-surface-secondary border-none cursor-pointer"
                      onPress={handleKeepUserBio}
                    >
                      <span>Restore My Input</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
            <TextArea
              value={draft.bio}
              onChange={(e) => handleBioChange(e.target.value)}
              placeholder="Write a brief professional bio detailing your background, key expertise, and engineering projects..."
              rows={4}
              aria-label="Professional Bio"
              maxLength={1000}
            />
            <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-0.5 select-none">
              {errors.bio ? (
                <span className="text-danger">{errors.bio}</span>
              ) : (
                <span />
              )}
              <span>{(draft.bio || "").length}/1000 characters</span>
            </div>
          </div>

          {/* Public Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-foreground">Public Email</label>
            <Input
              value={draft.publicEmail}
              onChange={(e) => onChange({ publicEmail: e.target.value })}
              placeholder="email@example.com"
              aria-label="Public Email"
              maxLength={100}
            />
            <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-0.5 select-none">
              {errors.publicEmail ? (
                <span className="text-danger">{errors.publicEmail}</span>
              ) : (
                <span />
              )}
              <span>{(draft.publicEmail || "").length}/100 characters</span>
            </div>
          </div>

          {/* Phone Number */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-foreground">Phone Number</label>
            <Input
              value={draft.phoneNumber}
              onChange={(e) => onChange({ phoneNumber: e.target.value })}
              placeholder="0987654321"
              aria-label="Phone Number"
              maxLength={20}
            />
            <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-0.5 select-none">
              {errors.phoneNumber ? (
                <span className="text-danger">{errors.phoneNumber}</span>
              ) : (
                <span />
              )}
              <span>{(draft.phoneNumber || "").length}/20 characters</span>
            </div>
          </div>

          {/* Location */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-foreground">Location</label>
            <Input
              value={draft.location}
              onChange={(e) => onChange({ location: e.target.value })}
              placeholder="Hanoi, Vietnam"
              aria-label="Location"
              maxLength={100}
            />
            <div className="flex justify-end text-[10px] text-muted-foreground mt-0.5 select-none">
              <span>{(draft.location || "").length}/100 characters</span>
            </div>
          </div>

          {/* Date of Birth */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-foreground">Date of Birth</label>
            <DatePicker
              value={birthDateValue}
              onChange={(val) => onChange({ birthDate: val ? val.toString() : "" })}
              className="flex flex-col gap-1 w-full"
              aria-label="Date of Birth"
            >
              <DateField.Group fullWidth>
                <DateField.Input>
                  {(segment) => <DateField.Segment segment={segment} />}
                </DateField.Input>
                <DateField.Suffix>
                  <DatePicker.Trigger>
                    <DatePicker.TriggerIndicator />
                  </DatePicker.Trigger>
                </DateField.Suffix>
              </DateField.Group>
              <DatePicker.Popover>
                <Calendar aria-label="Birth date">
                  <Calendar.Header>
                    <Calendar.YearPickerTrigger>
                      <Calendar.YearPickerTriggerHeading />
                      <Calendar.YearPickerTriggerIndicator />
                    </Calendar.YearPickerTrigger>
                    <Calendar.NavButton slot="previous" />
                    <Calendar.NavButton slot="next" />
                  </Calendar.Header>
                  <Calendar.Grid>
                    <Calendar.GridHeader>
                      {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                    </Calendar.GridHeader>
                    <Calendar.GridBody>
                      {(date) => <Calendar.Cell date={date} />}
                    </Calendar.GridBody>
                  </Calendar.Grid>
                  <Calendar.YearPickerGrid>
                    <Calendar.YearPickerGridBody>
                      {({ year }) => <Calendar.YearPickerCell year={year} />}
                    </Calendar.YearPickerGridBody>
                  </Calendar.YearPickerGrid>
                </Calendar>
              </DatePicker.Popover>
            </DatePicker>
          </div>

          {/* Current Company */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-foreground">Current Company</label>
            <Input
              value={draft.company}
              onChange={(e) => onChange({ company: e.target.value })}
              placeholder="CVerify AI Technology"
              aria-label="Current Company"
              maxLength={100}
            />
            <div className="flex justify-end text-[10px] text-muted-foreground mt-0.5 select-none">
              <span>{(draft.company || "").length}/100 characters</span>
            </div>
          </div>

          {/* Pronouns */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-foreground">Pronouns</label>
            <Select
              placeholder="Select pronouns"
              selectedKey={draft.pronouns || "prefer_not"}
              onSelectionChange={(key) => {
                onChange({ pronouns: key as string });
              }}
              aria-label="Pronouns"
            >
              <Select.Trigger className="rounded-xl border border-border bg-surface text-xs h-10 px-3">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover className="bg-surface border border-border rounded-xl p-1 text-xs">
                <ListBox aria-label="Pronoun options">
                  {pronounsOptions.map((opt) => (
                    <ListBox.Item key={opt.value} id={opt.value} textValue={opt.label} className="p-2 hover:bg-accent/10 rounded-lg cursor-pointer">
                      {opt.label}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          {/* Custom Pronouns */}
          {draft.pronouns === "custom" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-foreground">Custom Pronouns</label>
              <Input
                value={draft.customPronouns}
                onChange={(e) => onChange({ customPronouns: e.target.value })}
                placeholder="Custom pronouns"
                aria-label="Custom Pronouns"
                maxLength={50}
              />
              <div className="flex justify-end text-[10px] text-muted-foreground mt-0.5 select-none">
                <span>{(draft.customPronouns || "").length}/50 characters</span>
              </div>
            </div>
          )}
        </div>

        {/* Social Links */}
        <div className="flex flex-col gap-3 border-t border-border/20 pt-4 mt-2">
          <div className="flex justify-between items-center select-none">
            <span className="text-xs font-bold text-foreground">Social Profiles & Links</span>
            <Button
              size="sm"
              variant="secondary"
              className="rounded-xl text-[10px] font-bold flex items-center gap-1 border border-border/30 h-8"
              onPress={addSocialLink}
              type="button"
            >
              <PlusCircle className="size-3.5" />
              Add Link
            </Button>
          </div>

          <div className="flex flex-col gap-3">
            {draft.socialLinks.map((link, index) => (
              <div key={index} className="flex gap-2 items-center">
                <div className="flex-1 flex flex-col gap-0.5">
                  <Input
                    value={link}
                    onChange={(e) => handleSocialLinkChange(e.target.value, index)}
                    placeholder="github.com/username"
                    aria-label={`Social link ${index + 1}`}
                    maxLength={250}
                  />
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-0.5 select-none">
                    {errors[`link-${index}`] ? (
                      <span className="text-danger">{errors[`link-${index}`]}</span>
                    ) : (
                      <span />
                    )}
                    <span>{(link || "").length}/250 characters</span>
                  </div>
                </div>
                <Button
                  isIconOnly
                  size="sm"
                  variant="secondary"
                  className="rounded-xl border border-border/30 h-10 w-10 text-danger"
                  onPress={() => removeSocialLink(index)}
                  type="button"
                  aria-label={`Remove social link ${index + 1}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

      </div>

      <BaseUnsavedChangesBar
        message="You have unsaved basic information changes."
        onReset={onReset}
        isDirty={isDirty}
        isSubmitting={isSaving}
        resetLabel="Reset Changes"
        saveLabel="Save Changes"
      />
    </form>
  );
};
export default BasicInfoForm;
