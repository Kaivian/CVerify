"use client";

import React, { useEffect, useRef } from "react";
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
  phoneNumber: z
    .string()
    .optional()
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
  const extendedUser = user as
    | (User & { phoneNumber?: string; birthDate?: string; headline?: string })
    | null;

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
      phoneNumber: extendedUser?.phoneNumber || "",
      birthDate: extendedUser?.birthDate || "",
      headline: extendedUser?.headline || "Software Engineer at CVerify",
      socialLinks: [
        { id: "1", url: "https://github.com/developer-cverify" },
        { id: "2", url: "https://linkedin.com/in/cverify" },
      ],
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
        phoneNumber: extendedUser?.phoneNumber || "",
        birthDate: extendedUser?.birthDate || "",
        headline: extendedUser?.headline || "Software Engineer at CVerify",
        socialLinks: [
          { id: "1", url: "https://github.com/developer-cverify" },
          { id: "2", url: "https://linkedin.com/in/cverify" },
        ],
      });
    }
  }, [user, reset, isDirty, extendedUser]);

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
  const bioValue = currentValues.bio || "";
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
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        <SettingsSection title="General Information">
          <Card className="flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 items-start">
              {/* Left Column — Avatar */}
              <div className="flex flex-col items-start gap-2">
                <Label>Profile Picture</Label>
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
                  <div className="flex flex-col">
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
    </FormProvider>
  );
};

export default ProfileTab;
