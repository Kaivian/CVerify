"use client";

import React, { useEffect, useRef } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SettingsSection } from "./SettingsSection";
import { SocialLinksEditor } from "./SocialLinksEditor";
import { useAuth } from "@/features/auth/hooks/use-auth";

import {
  Typography, Avatar, Select, Label,
  ListBox, TextArea, Description, Input,
} from "@heroui/react";

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

  // Reset form when user data loads
  useEffect(() => {
    if (user && !isDirty) {
      reset({
        fullName: user.fullName || "",
        publicEmail: user.email || "none",
        bio: "Software Engineer working on identity verification platforms. Building robust architectures.",
        pronouns: "he_him",
        customPronouns: "",
        company: "CVerify Inc.",
        location: "San Francisco, CA",
      });
    }
  }, [user, reset, isDirty]);

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

      console.log(data);

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
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="input-type-fullname">Full Name</Label>
                    <Input
                      id="input-type-fullname"
                      type="text"
                      value={currentValues.fullName || ""}
                      onChange={(e) =>
                        setValue("fullName", e.target.value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                      placeholder="Nguyễn Văn A"
                    />
                  </div>
                  <div className="flex flex-col text-left gap-2 w-full">
                    <Select
                      placeholder="Select one"
                      value={currentValues.publicEmail}
                      onChange={(val) =>
                        setValue("publicEmail", val as string, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                    >
                      <Label>Email</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {emailOptions.map((option) => (
                            <ListBox.Item
                              key={option.value}
                              id={option.value}
                              textValue={option.label}
                            >
                              {option.label}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="bio">Public Bio</Label>
                  <TextArea
                    ref={textareaRef}
                    aria-label="Public Bio"
                    id="bio"
                    value={currentValues.bio || ""}
                    onChange={(e) =>
                      setValue("bio", e.target.value.slice(0, 160), {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    placeholder="Enter your bio..."
                    rows={3}
                    maxLength={160}
                  />
                  <Description id="bio" className="text-muted flex justify-end">
                    {(currentValues.bio || "").length}/160 characters
                  </Description>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Select
                placeholder="Select one"
                value={currentValues.pronouns}
                onChange={(val) =>
                  setValue(
                    "pronouns",
                    val as "he_him" | "she_her" | "they_them" | "prefer_not" | "custom",
                    {
                      shouldDirty: true,
                      shouldValidate: true,
                    }
                  )
                }
              >
                <Label>Pronouns</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {pronounsOptions.map((option) => (
                      <ListBox.Item
                        key={option.value}
                        id={option.value}
                        textValue={option.label}
                      >
                        {option.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              <div className="flex flex-col gap-1">
                <Label htmlFor="input-type-company">Company</Label>
                <Input
                  id="input-type-company"
                  type="text"
                  value={currentValues.company || ""}
                  onChange={(e) =>
                    setValue("company", e.target.value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  placeholder="Company name"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="input-type-location">Location</Label>
                <Input
                  id="input-type-location"
                  type="text"
                  value={currentValues.location || ""}
                  onChange={(e) =>
                    setValue("location", e.target.value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  placeholder="Location"
                />
              </div>
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

        {/* Sticky Actions Bar */}
        {isDirty && (
          <div className="sticky bottom-0 w-full bg-[#ffffff] border border-border shadow-modal rounded-2xl p-4 flex items-center justify-between gap-4 z-40 animate-fade-in -mb-19">
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
