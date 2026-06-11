import React, { useRef, useState } from "react";
import { Input, Button, Select, ListBox, Spinner, toast } from "@heroui/react";
import { PlusCircle, Trash2, Camera } from "lucide-react";
import { type BasicInfoDraft } from "./types";
import { profileApi } from "@/services/profile.service";
import { BaseUnsavedChangesBar } from "@/components/ui/unsaved-changes-bar";

interface BasicInfoFormProps {
  draft: BasicInfoDraft;
  baseline: BasicInfoDraft;
  onChange: (updated: Partial<BasicInfoDraft>) => void;
  onSave: (updated: BasicInfoDraft) => Promise<void>;
  onReset: () => void;
  isSaving: boolean;
  isDirty: boolean;
  avatarUrl?: string | null;
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
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
          />
          {errors.fullName && <span className="text-[10px] text-danger">{errors.fullName}</span>}
        </div>

        {/* Username */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-foreground">Username *</label>
          <Input
            value={draft.username}
            onChange={(e) => onChange({ username: e.target.value })}
            placeholder="johndoe"
            aria-label="Username"
          />
        </div>

        {/* Headline */}
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-[11px] font-bold text-foreground">Professional Headline</label>
          <Input
            value={draft.headline}
            onChange={(e) => onChange({ headline: e.target.value })}
            placeholder="Senior Fullstack Engineer"
            aria-label="Professional Headline"
          />
        </div>

        {/* Public Email */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-foreground">Public Email</label>
          <Input
            value={draft.publicEmail}
            onChange={(e) => onChange({ publicEmail: e.target.value })}
            placeholder="email@example.com"
            aria-label="Public Email"
          />
          {errors.publicEmail && <span className="text-[10px] text-danger">{errors.publicEmail}</span>}
        </div>

        {/* Phone Number */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-foreground">Phone Number</label>
          <Input
            value={draft.phoneNumber}
            onChange={(e) => onChange({ phoneNumber: e.target.value })}
            placeholder="0987654321"
            aria-label="Phone Number"
          />
          {errors.phoneNumber && <span className="text-[10px] text-danger">{errors.phoneNumber}</span>}
        </div>

        {/* Location */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-foreground">Location</label>
          <Input
            value={draft.location}
            onChange={(e) => onChange({ location: e.target.value })}
            placeholder="Hanoi, Vietnam"
            aria-label="Location"
          />
        </div>

        {/* Date of Birth */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-foreground">Date of Birth</label>
          <input
            type="date"
            className="flex h-10 w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs outline-none focus:border-accent transition-colors"
            value={draft.birthDate}
            onChange={(e) => onChange({ birthDate: e.target.value })}
          />
        </div>

        {/* Current Company */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-foreground">Current Company</label>
          <Input
            value={draft.company}
            onChange={(e) => onChange({ company: e.target.value })}
            placeholder="CVerify AI Technology"
            aria-label="Current Company"
          />
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
                  <ListBox.Item key={opt.value} id={opt.value} className="p-2 hover:bg-accent/10 rounded-lg cursor-pointer">
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
            />
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
                />
                {errors[`link-${index}`] && <span className="text-[10px] text-danger">{errors[`link-${index}`]}</span>}
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
