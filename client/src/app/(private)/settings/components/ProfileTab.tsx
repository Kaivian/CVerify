import React, { useEffect, useRef, useState } from "react";
import { useForm, FormProvider, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { SettingsSection } from "./SettingsSection";
import { SocialLinksEditor } from "./SocialLinksEditor";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { parseDate } from "@internationalized/date";
import { type User } from "@/types/auth.types";
import { UnsavedChangesBar, isDeepEqual } from "@/components/ui/unsaved-changes-bar";

import {
  Avatar,
  Select,
  Label,
  ListBox,
  TextArea,
  Description,
  Input,
  InputGroup,
  TextField,
  FieldError,
  DatePicker,
  DateField,
  Calendar,
  Spinner,
  toast,
  Skeleton,
  Button,
} from "@heroui/react";
import { useProfile } from "@/hooks/use-profile";
import { type UpdateProfileRequest } from "@/types/profile.types";
import { profileApi } from "@/services/profile.service";
import { AvatarCropperModal } from "./AvatarCropperModal";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { useProfileStore } from "@/stores/use-profile-store";

// 1. Define schema using Zod
const profileSchema = z.object({
  fullName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be under 50 characters"),
  publicEmail: z.string(),
  bio: z.string().max(160, "Bio must be under 160 characters").optional().or(z.literal("")),
  pronouns: z.enum(["he_him", "she_her", "they_them", "prefer_not", "custom"]),
  customPronouns: z
    .string()
    .max(30, "Pronouns must be under 30 characters")
    .optional()
    .or(z.literal("")),
  company: z.string().max(50, "Company must be under 50 characters").optional().or(z.literal("")),
  location: z
    .string()
    .max(50, "Location must be under 50 characters")
    .optional()
    .or(z.literal("")),
  phoneNumber: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((val) => !val || /^[0-9]{9,10}$/.test(val), {
      message: "Phone number is invalid",
    }),
  birthDate: z.string().optional().or(z.literal("")),
  headline: z
    .string()
    .max(50, "Headline must be under 50 characters")
    .optional()
    .or(z.literal("")),
  socialLinks: z.array(
    z.object({
      id: z.string(),
      url: z.string(),
    })
  ).optional(),
  version: z.number(),
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
  const { user, updateProfile: updateLocalAuthUser } = useAuth();
  const { profile, isLoading, isFetched, isUpdating, updateProfile, error: apiError } = useProfile();

  // Avatar upload states
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [lastSelectedFile, setLastSelectedFile] = useState<File | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  // Temporary diagnostics effect to trace avatar rendering
  useEffect(() => {
    console.log("[Avatar Render Diagnostics] current states - avatarPreview:", avatarPreview, "user.avatarUrl:", user?.avatarUrl, "active source:", avatarPreview || user?.avatarUrl || "fallback initials");
  }, [avatarPreview, user?.avatarUrl]);

  const handleUpload = async (file: File) => {
    setIsUploadingAvatar(true);
    setUploadProgress(0);

    // Create optimistic preview
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    console.log("[Avatar Upload] Created optimistic preview:", previewUrl);

    try {
      console.log("[Avatar Upload] Initiating API request to R2...");
      const result = await profileApi.uploadAvatar(file, (progress) => {
        if (progress.total) {
          const percentage = Math.round((progress.loaded / progress.total) * 100);
          setUploadProgress(percentage);
        }
      });
      
      console.log("[Avatar Upload] API Response received:", result);
      console.log("[Avatar Upload] Returned avatar URL:", result.avatarUrl);

      // Update local global auth store details
      updateLocalAuthUser({
        avatarUrl: result.avatarUrl,
      });

      // Log store user status to verify mutation propagation
      const updatedUser = useAuthStore.getState().user;
      console.log("[Avatar Upload] Global User State after mutation:", updatedUser);

      toast.success("Avatar updated successfully.");
      setAvatarPreview(null); // Clear preview to fallback to newly returned signed URL
      setLastSelectedFile(null);
    } catch (error: any) {
      console.error("Failed to upload avatar:", error);
      const errMsg = error.response?.data?.message || error.message || "Failed to upload avatar.";
      
      toast.danger(errMsg);
      
      // Revert optimistic preview
      setAvatarPreview(null);
    } finally {
      setIsUploadingAvatar(false);
      setUploadProgress(null);
      URL.revokeObjectURL(previewUrl);
      console.log("[Avatar Upload] Revoked optimistic preview URL:", previewUrl);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (<2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.danger("File size exceeds the maximum allowed limit of 2MB.");
      return;
    }

    // Validate MIME type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      toast.danger("Only JPEG, PNG, WebP, and GIF images are supported.");
      return;
    }

    setLastSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setCropImageSrc(objectUrl);
    setIsCropModalOpen(true);
    
    // Reset file input so that the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    setIsCropModalOpen(false);
    
    // Revoke the original raw image object URL immediately to prevent memory leaks
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
    }

    const fileExt = lastSelectedFile ? lastSelectedFile.name.split('.').pop() : 'jpg';
    const originalName = lastSelectedFile ? lastSelectedFile.name.substring(0, lastSelectedFile.name.lastIndexOf('.')) : 'avatar';
    const croppedFile = new File(
      [croppedBlob], 
      `${originalName}_cropped.${fileExt}`, 
      { type: "image/jpeg" }
    );
    
    handleUpload(croppedFile);
  };

  const handleCropCancel = () => {
    setIsCropModalOpen(false);
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
    }
    setLastSelectedFile(null);
  };

  // Setup form methods
  const methods = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      publicEmail: "none",
      bio: "",
      pronouns: "prefer_not",
      customPronouns: "",
      company: "",
      location: "",
      phoneNumber: "",
      birthDate: "",
      headline: "",
      socialLinks: [],
      version: 0,
    },
    mode: "onChange",
  });

  const {
    handleSubmit,
    reset,
    setValue,
    formState: { isDirty, errors },
  } = methods;

  const currentValues = useWatch({ control: methods.control });

  const birthDateString = currentValues.birthDate || "";
  let birthDateValue = null;
  if (birthDateString) {
    try {
      birthDateValue = parseDate(birthDateString);
    } catch (e) {
      console.error("Failed to parse birthDate:", e);
    }
  }

  // Reset form when user/profile data loads
  useEffect(() => {
    if (profile && !isDirty) {
      reset({
        fullName: profile.fullName || user?.fullName || "",
        publicEmail: profile.publicEmail || "none",
        bio: profile.bio || "",
        pronouns: (profile.pronouns as any) || "prefer_not",
        customPronouns: profile.customPronouns || "",
        company: profile.company || "",
        location: profile.location || "",
        phoneNumber: profile.phoneNumber || "",
        birthDate: profile.birthDate ? profile.birthDate.split("T")[0] : "",
        headline: profile.headline || "",
        socialLinks: (profile.socialLinks || []).map((url, i) => ({ id: String(i + 1), url })),
        version: profile.version || 0,
      });
    }
  }, [profile, user, reset, isDirty]);

  // Track dirty changes to inform parent page navigation guard
  useEffect(() => {
    const hasChanges = !isDeepEqual(currentValues, methods.formState.defaultValues);
    onDirtyChange(hasChanges);
  }, [currentValues, methods.formState.defaultValues, onDirtyChange]);

  const handleReset = () => {
    reset();
  };

  const handleFormSubmit = async (data: ProfileFormValues) => {
    try {
      // Update local global auth store details in-memory for name/avatar
      updateLocalAuthUser({
        fullName: data.fullName,
      });

      const request: UpdateProfileRequest = {
        fullName: data.fullName || null,
        bio: data.bio || null,
        location: data.location || null,
        phoneNumber: data.phoneNumber || null,
        birthDate: data.birthDate ? new Date(data.birthDate).toISOString() : null,
        headline: data.headline || null,
        company: data.company || null,
        pronouns: data.pronouns || null,
        customPronouns: data.customPronouns || null,
        publicEmail: data.publicEmail === "none" ? null : data.publicEmail,
        profileVisibility: profile?.profileVisibility || "public",
        recruiterVisibility: profile?.recruiterVisibility ?? true,
        socialLinks: (data.socialLinks || []).map((l) => l.url),
        version: useProfileStore.getState().profile?.version || data.version || profile?.version || 0,
      };

      const updated = await updateProfile(request);

      // Synchronize/reset React Hook Form dirty values
      reset({
        ...data,
        version: updated.version,
      });
      onSaveSuccess();
    } catch (error: any) {
      console.error("Failed to save profile:", error);
      const errorMsg = error.response?.data?.message || error.message || "Failed to update profile settings.";
      toast.danger(errorMsg);
    }
  };

  // Auto-resize Bio textarea handler
  const bioValue = currentValues.bio || "";
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [bioValue]);

  if (isLoading && !isFetched) {
    return (
      <div className="space-y-6">
        <SettingsSection title="General Information">
          <Card className="flex flex-col gap-6 p-6">
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 items-start">
              {/* Left Column — Avatar Skeleton */}
              <div className="flex flex-col items-center md:items-start gap-4">
                <Skeleton className="w-30 h-30 rounded-full animate-pulse" />
                <Skeleton className="h-8 w-28 rounded-xl animate-pulse" />
              </div>

              {/* Right Column — Form Inputs Skeletons */}
              <div className="flex flex-col gap-6 w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-20 rounded animate-pulse" />
                    <Skeleton className="h-10 w-full rounded-xl animate-pulse" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-12 rounded animate-pulse" />
                    <Skeleton className="h-10 w-full rounded-xl animate-pulse" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-20 rounded animate-pulse" />
                  <Skeleton className="h-20 w-full rounded-xl animate-pulse" />
                  <Skeleton className="h-3 w-16 rounded self-end animate-pulse" />
                </div>
              </div>
            </div>

            {/* Grid 3-column Skeletons */}
            <div className="grid grid-cols-[180px_250px_1fr] gap-4 mb-6 items-start">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-24 rounded animate-pulse" />
                <Skeleton className="h-10 w-full rounded-xl animate-pulse" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-24 rounded animate-pulse" />
                <Skeleton className="h-10 w-full rounded-xl animate-pulse" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-20 rounded animate-pulse" />
                <Skeleton className="h-10 w-full rounded-xl animate-pulse" />
                <Skeleton className="h-3 w-16 rounded self-end animate-pulse" />
              </div>
            </div>

            {/* Grid 3-column Skeletons (Pronouns, Company, Location) */}
            <div className="grid grid-cols-[180px_300px_1fr] gap-4 items-start">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-20 rounded animate-pulse" />
                <Skeleton className="h-10 w-full rounded-xl animate-pulse" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-20 rounded animate-pulse" />
                <Skeleton className="h-10 w-full rounded-xl animate-pulse" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-20 rounded animate-pulse" />
                <Skeleton className="h-10 w-full rounded-xl animate-pulse" />
              </div>
            </div>
          </Card>
        </SettingsSection>

        {/* Personal Links Skeleton */}
        <SettingsSection title="Personal Links">
          <Card className="p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-border/40">
              <Skeleton className="h-5 w-28 rounded animate-pulse" />
              <Skeleton className="h-8 w-24 rounded-xl animate-pulse" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-xl animate-pulse" />
              <Skeleton className="h-10 w-full rounded-xl animate-pulse" />
            </div>
          </Card>
        </SettingsSection>
      </div>
    );
  }

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
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        <input type="hidden" {...methods.register("version")} />
        <SettingsSection title="General Information">
          <Card className="flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 items-start">
              {/* Left Column — Avatar */}
              <div className="flex flex-col items-center md:items-start gap-2">
                <Label>Profile Picture</Label>
                <Avatar
                  key={avatarPreview || user?.avatarUrl || "default"}
                  variant="default"
                  className="w-30 h-30 select-none rounded-full"
                >
                  {avatarPreview ? (
                    <Avatar.Image src={avatarPreview} alt={user?.fullName} />
                  ) : user?.avatarUrl ? (
                    <Avatar.Image src={user.avatarUrl} alt={user.fullName} />
                  ) : (
                    <Avatar.Fallback>{initials}</Avatar.Fallback>
                  )}
                </Avatar>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleAvatarChange}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  isDisabled={isUploadingAvatar}
                  onPress={() => fileInputRef.current?.click()}
                  className="rounded-xl font-bold text-xs mt-2 select-none w-full"
                >
                  {isUploadingAvatar ? (
                    <span className="flex items-center gap-1.5">
                      <Spinner size="sm" color="current" />
                      <span>{uploadProgress !== null ? `${uploadProgress}%` : "Uploading..."}</span>
                    </span>
                  ) : (
                    "Change Avatar"
                  )}
                </Button>
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
                  <div className="flex flex-col w-full gap-2">
                    <Select
                      placeholder="Select one"
                      value={currentValues.publicEmail || "none"}
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
            <div className="grid grid-cols-[180px_250px_1fr] gap-4 mb-6 items-start">
              <TextField
                name="phoneNumber"
                isInvalid={!!errors.phoneNumber}
                className="flex flex-col w-full h-full"
              >
                <Label htmlFor="input-type-phone">Phone Number</Label>
                <InputGroup>
                  <InputGroup.Prefix className="text-muted text-xs font-mono bg-background">
                    +084
                  </InputGroup.Prefix>
                  <InputGroup.Input
                    id="input-type-phone"
                    type="tel"
                    placeholder="912345678"
                    className="pl-2"
                    value={currentValues.phoneNumber || ""}
                    onChange={(e) =>
                      setValue("phoneNumber", e.target.value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  />
                </InputGroup>
                {errors.phoneNumber && (
                  <FieldError>{errors.phoneNumber.message}</FieldError>
                )}
              </TextField>

              {/* Date of Birth DatePicker */}
              <DatePicker
                name="birthDate"
                value={birthDateValue}
                onChange={(val) =>
                  setValue("birthDate", val ? val.toString() : "", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                className="flex flex-col gap-1 w-full"
              >
                <Label>Date of Birth</Label>
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
                        {(day) => (
                          <Calendar.HeaderCell>{day}</Calendar.HeaderCell>
                        )}
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

              {/* Headline Input with character cap */}
              <div className="flex flex-col gap-1 w-full">
                <Label htmlFor="input-type-headline">Headline</Label>
                <Input
                  id="input-type-headline"
                  type="text"
                  value={currentValues.headline || ""}
                  onChange={(e) =>
                    setValue("headline", e.target.value.slice(0, 50), {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  placeholder="e.g. Lead Architect"
                  maxLength={50}
                />
                <Description className="text-muted text-[10px] flex justify-end">
                  {(currentValues.headline || "").length}/50 characters
                </Description>
              </div>
            </div>
            <div className="grid grid-cols-[180px_300px_1fr] gap-4 items-start">
              <Select
                placeholder="Select one"
                value={currentValues.pronouns || "he_him"}
                onChange={(val) =>
                  setValue(
                    "pronouns",
                    val as
                    | "he_him"
                    | "she_her"
                    | "they_them"
                    | "prefer_not"
                    | "custom",
                    {
                      shouldDirty: true,
                      shouldValidate: true,
                    },
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
            <Controller
              control={methods.control}
              name="socialLinks"
              render={({ field: { value, onChange } }) => (
                <SocialLinksEditor
                  links={value || []}
                  onChange={onChange}
                />
              )}
            />
          </Card>
        </SettingsSection>
        {/* Sticky Actions Bar */}
        <UnsavedChangesBar
          message="You have unsaved public profile changes."
          onReset={handleReset}
        />
      </form>
      <AvatarCropperModal
        isOpen={isCropModalOpen}
        onOpenChange={setIsCropModalOpen}
        imageSrc={cropImageSrc}
        onCropComplete={handleCropComplete}
        onCancel={handleCropCancel}
      />
    </FormProvider>
  );
};

export default ProfileTab;
