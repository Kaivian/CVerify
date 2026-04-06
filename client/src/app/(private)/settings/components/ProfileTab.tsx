"use client";

import React, { useEffect, useRef } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import { FormInput } from "@/components/forms/form-input";
import { SettingsSection } from "./SettingsSection";
import { SocialLinksEditor } from "./SocialLinksEditor";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Typography, Avatar, Select, Input } from "@heroui/react";
import { Globe, Building2, MapPin } from "lucide-react";

// 1. Define schema using Zod
const profileSchema = z.object({
  fullName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be under 50 characters"),
  publicEmail: z.string(),
  bio: z.string().max(160, "Bio must be under 160 characters").optional(),
  pronouns: z.enum(["he_him", "she_her", "they_them", "prefer_not", "custom"]),
  customPronouns: z
    .string()
    .max(30, "Pronouns must be under 30 characters")
    .optional(),
  company: z.string().max(50, "Company must be under 50 characters").optional(),
  location: z
    .string()
    .max(50, "Location must be under 50 characters")
    .optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileTabProps {
  onDirtyChange: (isDirty: boolean) => void;
  onSaveSuccess: () => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  onDirtyChange,
  onSaveSuccess,
}) => {
  const { user, updateProfile } = useAuth();

  // Load social links from local state as they are not standard in user types
  const [socialLinks, setSocialLinks] = React.useState<
    { id: string; url: string }[]
  >([
    { id: "1", url: "https://github.com/developer-cverify" },
    { id: "2", url: "https://linkedin.com/in/cverify" },
  ]);

  // Setup form methods
  const methods = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      publicEmail: user?.email || "none",
      bio: "Software Engineer working on identity verification platforms. Building robust architectures.",
      pronouns: "he_him",
      customPronouns: "",
      company: "CVerify Inc.",
      location: "San Francisco, CA",
    },
    mode: "onChange",
  });

  const {
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { isDirty, isSubmitting },
  } = methods;

  const currentValues = watch();

  // Track dirty changes to inform parent page navigation guard
  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleReset = () => {
    reset();
  };

  const handleFormSubmit = async (data: ProfileFormValues) => {
    try {
      // Simulate API submit delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update local global auth store details in-memory
      updateProfile({
        fullName: data.fullName,
      });

      // Synchronize/reset React Hook Form dirty values
      reset(data);
      onSaveSuccess();
    } catch (error) {
      console.error("Failed to save profile:", error);
    }
  };

  // Auto-resize Bio textarea handler
  const bioValue = watch("bio") || "";
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [bioValue]);

  // Initials for avatar fallback
  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  // Dropdown options
  const emailOptions = [
    { value: "none", label: "Do not show publicly" },
    {
      value: user?.email || "user@cverify.com",
      label: user?.email || "user@cverify.com",
    },
  ];

  const pronounsOptions = [
    { value: "he_him", label: "He/Him" },
    { value: "she_her", label: "She/Her" },
    { value: "they_them", label: "They/Them" },
    { value: "prefer_not", label: "Prefer not to say" },
    { value: "custom", label: "Custom" },
  ];

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        className="space-y-10 pb-2"
      >
        <SettingsSection title="Profile Information">
          <Card className="flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 items-start">
              {/* Left Column — Avatar */}
              <div className="flex flex-col items-start gap-2">
                <Typography type="body-sm" className="font-semibold">
                  Profile Picture
                </Typography>

                <Avatar
                  variant="default"
                  className="w-30 h-30 select-none rounded-full"
                >
                  {user?.avatarUrl ? (
                    <Avatar.Image src={user.avatarUrl} alt={user.fullName} />
                  ) : (
                    <Avatar.Fallback>{initials}</Avatar.Fallback>
                  )}
                </Avatar>
              </div>

              {/* Right Column — Form Content */}
              <div className="flex flex-col gap-6"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col text-left gap-1.5 w-full">
                <SelectDropdown
                  label="Pronouns"
                  value={currentValues.pronouns}
                  onChange={(val: string) =>
                    setValue(
                      "pronouns",
                      val as
                        | "he_him"
                        | "she_her"
                        | "they_them"
                        | "prefer_not"
                        | "custom",
                      { shouldDirty: true },
                    )
                  }
                  options={pronounsOptions}
                  placeholder="Select pronouns"
                />
              </div>

              {currentValues.pronouns === "custom" && (
                <FormInput
                  name="customPronouns"
                  label="Custom Pronouns"
                  placeholder="Specify e.g. Ze/Zir"
                />
              )}
            </div>

            <div className="flex flex-col text-left gap-1.5 w-full">
              <label className="text-foreground/80 text-xs font-semibold select-none">
                Bio
              </label>
              <textarea
                ref={textareaRef}
                value={bioValue}
                onChange={(e) =>
                  setValue("bio", e.target.value.slice(0, 160), {
                    shouldDirty: true,
                  })
                }
                placeholder="Write a brief professional description..."
                className="w-full min-h-[80px] max-h-[200px] resize-none px-3.5 py-2.5 rounded-xl border border-field-border focus:border-focus bg-field text-foreground text-xs font-semibold focus:outline-hidden cursor-pointer hover:border-border transition-all select-none focus-visible:ring-2 focus-visible:ring-focus font-medium leading-relaxed font-sans"
              />
              <div className="flex justify-end text-muted text-[10px] font-semibold pr-1">
                {bioValue.length}/160 characters
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                name="company"
                label="Company"
                placeholder="e.g. CVerify Inc."
              />
              <FormInput
                name="location"
                label="Location"
                placeholder="e.g. San Francisco, CA"
              />
            </div>
          </Card>
        </SettingsSection>
        {/* Profile Information Section */}
        <SettingsSection title="Profile Information">
          <Card className="gap-6 flex flex-col">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <Avatar className="w-16 h-16 text-lg font-bold border border-separator select-none">
                {user?.avatarUrl ? (
                  <Avatar.Image src={user.avatarUrl} alt={user.fullName} />
                ) : (
                  <Avatar.Fallback>{initials}</Avatar.Fallback>
                )}
              </Avatar>
              <div className="flex flex-col text-left">
                <Typography
                  type="body-sm"
                  className="font-bold text-foreground font-outfit"
                >
                  Profile Picture
                </Typography>
                <Typography
                  type="body-xs"
                  className="text-muted mt-0.5 max-w-sm"
                >
                  Your profile picture is synchronized with your Single Sign-On
                  login provider.
                </Typography>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                name="fullName"
                label="Full Name"
                placeholder="Your name"
              />

              <div className="flex flex-col text-left gap-1.5 w-full">
                <SelectDropdown
                  label="Public Email"
                  value={currentValues.publicEmail}
                  onChange={(val: string) =>
                    setValue("publicEmail", val, { shouldDirty: true })
                  }
                  options={emailOptions}
                  placeholder="Select verified email"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col text-left gap-1.5 w-full">
                <SelectDropdown
                  label="Pronouns"
                  value={currentValues.pronouns}
                  onChange={(val: string) =>
                    setValue(
                      "pronouns",
                      val as
                        | "he_him"
                        | "she_her"
                        | "they_them"
                        | "prefer_not"
                        | "custom",
                      { shouldDirty: true },
                    )
                  }
                  options={pronounsOptions}
                  placeholder="Select pronouns"
                />
              </div>

              {currentValues.pronouns === "custom" && (
                <FormInput
                  name="customPronouns"
                  label="Custom Pronouns"
                  placeholder="Specify e.g. Ze/Zir"
                />
              )}
            </div>

            <div className="flex flex-col text-left gap-1.5 w-full">
              <label className="text-foreground/80 text-xs font-semibold select-none">
                Bio
              </label>
              <textarea
                ref={textareaRef}
                value={bioValue}
                onChange={(e) =>
                  setValue("bio", e.target.value.slice(0, 160), {
                    shouldDirty: true,
                  })
                }
                placeholder="Write a brief professional description..."
                className="w-full min-h-[80px] max-h-[200px] resize-none px-3.5 py-2.5 rounded-xl border border-field-border focus:border-focus bg-field text-foreground text-xs font-semibold focus:outline-hidden cursor-pointer hover:border-border transition-all select-none focus-visible:ring-2 focus-visible:ring-focus font-medium leading-relaxed font-sans"
              />
              <div className="flex justify-end text-muted text-[10px] font-semibold pr-1">
                {bioValue.length}/160 characters
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                name="company"
                label="Company"
                placeholder="e.g. CVerify Inc."
              />
              <FormInput
                name="location"
                label="Location"
                placeholder="e.g. San Francisco, CA"
              />
            </div>
          </Card>
        </SettingsSection>

        {/* Personal Links Section */}
        <SettingsSection title="Personal Links">
          <Card>
            <SocialLinksEditor
              links={socialLinks}
              onChange={(updatedLinks) => {
                setSocialLinks(updatedLinks);
                onDirtyChange(true); // Treat social link modification as dirty
              }}
            />
          </Card>
        </SettingsSection>

        {/* Live Profile Preview Section */}
        <SettingsSection title="Profile Preview">
          <Card className="flex flex-col sm:flex-row gap-6 border-2 border-accent/20 bg-accent/5 dark:bg-accent/2 select-none relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-accent/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
            <Avatar className="w-20 h-20 text-2xl font-bold border border-accent/30 shrink-0">
              {user?.avatarUrl ? (
                <Avatar.Image src={user.avatarUrl} alt={user.fullName} />
              ) : (
                <Avatar.Fallback>{initials}</Avatar.Fallback>
              )}
            </Avatar>

            <div className="flex flex-col text-left gap-3.5 min-w-0">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Typography
                    type="body-sm"
                    className="font-extrabold text-foreground font-display text-sm leading-none"
                  >
                    {currentValues.fullName || user?.fullName || "Your Name"}
                  </Typography>
                  {currentValues.pronouns !== "prefer_not" && (
                    <span className="text-[10px] text-muted font-bold font-outfit border border-separator/70 rounded-md px-1.5 py-0.5 uppercase tracking-wide">
                      {currentValues.pronouns === "custom"
                        ? currentValues.customPronouns || "Pronouns"
                        : pronounsOptions.find(
                            (p) => p.value === currentValues.pronouns,
                          )?.label}
                    </span>
                  )}
                </div>
                <Typography
                  type="body-xs"
                  className="text-muted text-[11px] font-sans truncate font-medium"
                >
                  {currentValues.publicEmail !== "none"
                    ? currentValues.publicEmail
                    : "Private Public Contact"}
                </Typography>
              </div>

              {bioValue ? (
                <Typography
                  type="body-xs"
                  className="text-foreground/95 leading-relaxed font-medium italic pr-2 font-sans"
                >
                  “{bioValue}”
                </Typography>
              ) : (
                <Typography type="body-xs" className="text-muted italic">
                  No professional description added yet.
                </Typography>
              )}

              <div className="flex flex-col gap-1.5 pt-1.5 border-t border-separator/40">
                {currentValues.company && (
                  <div className="flex items-center gap-2 text-muted text-xs font-semibold">
                    <Building2 size={13} className="shrink-0 text-accent/80" />
                    <span>{currentValues.company}</span>
                  </div>
                )}
                {currentValues.location && (
                  <div className="flex items-center gap-2 text-muted text-xs font-semibold">
                    <MapPin size={13} className="shrink-0 text-accent/80" />
                    <span>{currentValues.location}</span>
                  </div>
                )}
                {socialLinks.length > 0 && (
                  <div className="flex items-center gap-2 text-muted text-xs font-semibold">
                    <Globe size={13} className="shrink-0 text-accent/80" />
                    <span className="truncate max-w-[250px]">
                      {socialLinks
                        .map((s) => s.url.replace(/^https?:\/\//i, ""))
                        .join(" • ")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </SettingsSection>

        {/* Sticky Actions Bar */}
        {isDirty && (
          <div className="sticky bottom-0 w-[calc(100%-3rem)] max-w-3xl bg-[#ffffff] border border-border shadow-modal rounded-2xl p-4 flex items-center justify-between gap-4 z-40 animate-fade-in -mb-19">
            <Typography type="body-xs" className="font-bold select-none pl-2">
              You have unsaved public profile changes.
            </Typography>
            <div className="flex items-center gap-2.5">
              <Button
                variant="bordered"
                onClick={handleReset}
                disabled={isSubmitting}
                className="rounded-xl font-bold h-9 px-4 text-xs select-none"
              >
                Reset
              </Button>
              <Button
                variant="primary"
                type="submit"
                isLoading={isSubmitting}
                className="rounded-xl font-bold h-9 px-4 text-xs select-none"
              >
                Save profile
              </Button>
            </div>
          </div>
        )}
      </form>
    </FormProvider>
  );
};

export default ProfileTab;
