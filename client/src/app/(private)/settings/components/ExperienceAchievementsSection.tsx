import React, { useState } from "react";
import {
  useFormContext,
  useFieldArray,
  Controller,
  useWatch,
  type Control,
  type UseFormSetValue,
  type FieldErrors,
} from "react-hook-form";
import { parseDate } from "@internationalized/date";
import {
  Calendar,
  DatePicker,
  DateField,
  Input,
  TextArea,
  FieldError,
  Label,
  Button,
  Switch,
  Chip,
  Typography,
} from "@heroui/react";
import { Trash2, Briefcase, Plus, Link2, Award, Terminal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SettingsSection } from "./SettingsSection";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import type { PersonalInfoFormValues } from "./types";

const categoryOptions = [
  { value: "1", label: "Professional Work" },
  { value: "2", label: "Internship" },
  { value: "3", label: "Freelance" },
  { value: "4", label: "Open Source" },
  { value: "5", label: "Research" },
  { value: "6", label: "Startup" },
  { value: "7", label: "Personal Project" },
];

const employmentOptions = [
  { value: "1", label: "Full-time" },
  { value: "2", label: "Part-time" },
  { value: "3", label: "Contract" },
  { value: "4", label: "Internship" },
  { value: "5", label: "Freelance" },
  { value: "6", label: "Volunteer" },
];

// Helper to safely parse dates from string to Calendar Date
const getCalendarDateValue = (dateString: string | null | undefined) => {
  if (!dateString) return null;
  try {
    return parseDate(dateString.split("T")[0]);
  } catch (e) {
    console.error("Failed to parse date:", dateString, e);
    return null;
  }
};

interface TechInputProps {
  experienceIndex: number;
  control: Control<PersonalInfoFormValues>;
  setValue: UseFormSetValue<PersonalInfoFormValues>;
}

const TechInput: React.FC<TechInputProps> = ({ experienceIndex, control, setValue }) => {
  const [techText, setTechText] = useState("");
  const technologies = useWatch({
    control,
    name: `workExperiences.${experienceIndex}.technologies`,
  }) || [];

  const handleAddTech = () => {
    const trimmed = techText.trim();
    if (trimmed && !technologies.includes(trimmed)) {
      const updated = [...technologies, trimmed];
      setValue(`workExperiences.${experienceIndex}.technologies`, updated, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setTechText("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTech();
    }
  };

  const handleRemoveTech = (tech: string) => {
    const updated = technologies.filter((t) => t !== tech);
    setValue(`workExperiences.${experienceIndex}.technologies`, updated, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Input
            aria-label="Add Technology"
            placeholder="e.g. React, Java (Press Enter to add)"
            value={techText}
            onChange={(e) => setTechText(e.target.value)}
            onKeyDown={handleKeyDown}
            fullWidth
          />
        </div>
        <Button
          onPress={handleAddTech}
          variant="secondary"
          className="h-10 px-4 rounded-xl font-bold text-xs"
        >
          Add
        </Button>
      </div>

      {technologies.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {technologies.map((tech) => (
            <Chip
              key={tech}
              size="sm"
              variant="soft"
              color="accent"
              className="font-bold font-outfit pr-1"
            >
              <div className="flex items-center gap-1.5">
                <span>{tech}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTech(tech)}
                  className="hover:bg-foreground/10 rounded-full p-0.5 transition-colors cursor-pointer focus-ring"
                  aria-label={`Remove technology: ${tech}`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-2.5 opacity-60 hover:opacity-100"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
};

interface ExperienceEntryItemProps {
  index: number;
  remove: (index: number) => void;
  errors: FieldErrors<PersonalInfoFormValues>;
  control: Control<PersonalInfoFormValues>;
  setValue: UseFormSetValue<PersonalInfoFormValues>;
}

const ExperienceEntryItem: React.FC<ExperienceEntryItemProps> = ({
  index,
  remove,
  errors,
  control,
  setValue,
}) => {
  const jobTitleValue =
    useWatch({
      control,
      name: `workExperiences.${index}.jobTitle`,
    }) || "Job Title";

  const companyValue =
    useWatch({
      control,
      name: `workExperiences.${index}.company`,
    }) || "Company";

  const isCurrentlyWorking = useWatch({
    control,
    name: `workExperiences.${index}.isCurrentlyWorking`,
  }) ?? false;

  const startDateString = useWatch({
    control,
    name: `workExperiences.${index}.startDate`,
  });

  const endDateString = useWatch({
    control,
    name: `workExperiences.${index}.endDate`,
  });

  // Watch links separately for a custom URL map input layout
  const repoUrl = useWatch({ control, name: `workExperiences.${index}._links.repo` }) || "";
  const projectUrl = useWatch({ control, name: `workExperiences.${index}._links.project` }) || "";
  const portfolioUrl = useWatch({ control, name: `workExperiences.${index}._links.portfolio` }) || "";
  const demoUrl = useWatch({ control, name: `workExperiences.${index}._links.demo` }) || "";
  const articleUrl = useWatch({ control, name: `workExperiences.${index}._links.article` }) || "";

  // Achievements Field Array
  const {
    fields: achievementFields,
    append: appendAchievement,
    remove: removeAchievement,
  } = useFieldArray({
    control,
    name: `workExperiences.${index}.achievements`,
  });

  return (
    <div className="relative border border-border/60 bg-surface-secondary/10 hover:bg-surface-secondary/15 rounded-2xl p-5 sm:p-6 flex flex-col gap-6 text-left transition-all duration-300 hover:border-border">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-3 select-none">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
            <Briefcase className="size-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            {jobTitleValue} @ {companyValue}
          </span>
        </div>
        <Button
          isIconOnly
          variant="danger-soft"
          className="h-8 w-8 min-w-8 rounded-xl"
          onPress={() => remove(index)}
          aria-label={`Remove working experience: ${jobTitleValue}`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {/* Main Grid: Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Job Title */}
        <div className="flex flex-col gap-2">
          <Label htmlFor={`work-jobTitle-${index}`}>Job Title</Label>
          <Controller
            control={control}
            name={`workExperiences.${index}.jobTitle`}
            render={({ field: { value, onChange } }) => (
              <Input
                id={`work-jobTitle-${index}`}
                aria-label="Job Title"
                placeholder="e.g. Senior Software Engineer"
                value={value || ""}
                onChange={onChange}
              />
            )}
          />
          {errors.workExperiences?.[index]?.jobTitle && (
            <FieldError className="text-danger text-xs mt-1 block">
              {errors.workExperiences[index]?.jobTitle?.message}
            </FieldError>
          )}
        </div>

        {/* Company */}
        <div className="flex flex-col gap-2">
          <Label htmlFor={`work-company-${index}`}>Company / Organization</Label>
          <Controller
            control={control}
            name={`workExperiences.${index}.company`}
            render={({ field: { value, onChange } }) => (
              <Input
                id={`work-company-${index}`}
                aria-label="Company / Organization"
                placeholder="e.g. Google, FPT Software"
                value={value || ""}
                onChange={onChange}
              />
            )}
          />
          {errors.workExperiences?.[index]?.company && (
            <FieldError className="text-danger text-xs mt-1 block">
              {errors.workExperiences[index]?.company?.message}
            </FieldError>
          )}
        </div>

        {/* Category */}
        <div className="flex flex-col gap-2">
          <Controller
            control={control}
            name={`workExperiences.${index}.experienceCategory`}
            render={({ field: { value, onChange } }) => (
              <SelectDropdown
                label="Experience Category"
                value={value ? value.toString() : ""}
                onChange={onChange}
                options={categoryOptions}
                placeholder="Select category"
              />
            )}
          />
          {errors.workExperiences?.[index]?.experienceCategory && (
            <FieldError className="text-danger text-xs mt-1 block">
              Category is required
            </FieldError>
          )}
        </div>

        {/* Employment Type */}
        <div className="flex flex-col gap-2">
          <Controller
            control={control}
            name={`workExperiences.${index}.employmentType`}
            render={({ field: { value, onChange } }) => (
              <SelectDropdown
                label="Employment Type"
                value={value ? value.toString() : ""}
                onChange={onChange}
                options={employmentOptions}
                placeholder="Select employment type"
              />
            )}
          />
          {errors.workExperiences?.[index]?.employmentType && (
            <FieldError className="text-danger text-xs mt-1 block">
              Employment type is required
            </FieldError>
          )}
        </div>

        {/* Location */}
        <div className="flex flex-col gap-2">
          <Label htmlFor={`work-location-${index}`}>Location (Optional)</Label>
          <Controller
            control={control}
            name={`workExperiences.${index}.location`}
            render={({ field: { value, onChange } }) => (
              <Input
                id={`work-location-${index}`}
                aria-label="Location"
                placeholder="e.g. Mountain View, CA or Remote"
                value={value || ""}
                onChange={onChange}
              />
            )}
          />
        </div>

        {/* Currently working here toggle */}
        <div className="flex items-center justify-between py-2 select-none">
          <div className="flex flex-col gap-0.5">
            <Typography className="text-xs font-bold text-foreground font-outfit">
              Currently Working Here
            </Typography>
            <Typography className="text-[10px] text-muted max-w-[200px]">
              Active experiences will display on your card header.
            </Typography>
          </div>
          <Controller
            control={control}
            name={`workExperiences.${index}.isCurrentlyWorking`}
            render={({ field: { value, onChange } }) => (
              <Switch
                isSelected={value}
                onChange={(checked) => {
                  onChange(checked);
                  if (checked) {
                    setValue(`workExperiences.${index}.endDate`, null, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }
                }}
                aria-label="Currently working toggle"
                className="cursor-pointer"
              >
                {({ isSelected }) => (
                  <Switch.Control
                    className={`w-10 h-5.5 rounded-full relative flex items-center transition-colors duration-200 ${isSelected ? "bg-success" : "bg-separator"}`}
                  >
                    <Switch.Thumb
                      className={`w-4 h-4 bg-foreground rounded-full absolute transition-all duration-200 ${isSelected ? "left-[20px]" : "left-0.5"}`}
                    />
                  </Switch.Control>
                )}
              </Switch>
            )}
          />
        </div>

        {/* Start Date Picker */}
        <div className="flex flex-col gap-2">
          <DatePicker
            name={`workExperiences.${index}.startDate`}
            value={getCalendarDateValue(startDateString)}
            onChange={(val) =>
              setValue(`workExperiences.${index}.startDate`, val ? val.toString() : "", {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            className="flex flex-col gap-1 w-full"
            isInvalid={!!errors.workExperiences?.[index]?.startDate}
          >
            <Label>Start Date</Label>
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
              <Calendar aria-label="Start Date">
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
          {errors.workExperiences?.[index]?.startDate && (
            <FieldError className="text-danger text-xs mt-1 block">
              {errors.workExperiences[index]?.startDate?.message}
            </FieldError>
          )}
        </div>

        {/* End Date Picker */}
        <div className="flex flex-col gap-2">
          <DatePicker
            name={`workExperiences.${index}.endDate`}
            value={getCalendarDateValue(endDateString)}
            onChange={(val) =>
              setValue(`workExperiences.${index}.endDate`, val ? val.toString() : null, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            className="flex flex-col gap-1 w-full"
            isDisabled={isCurrentlyWorking}
            isInvalid={!!errors.workExperiences?.[index]?.endDate}
          >
            <Label>End Date</Label>
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
              <Calendar aria-label="End Date">
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
          {errors.workExperiences?.[index]?.endDate && (
            <FieldError className="text-danger text-xs mt-1 block">
              {errors.workExperiences[index]?.endDate?.message}
            </FieldError>
          )}
        </div>
      </div>

      {/* Experience Description */}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`work-description-${index}`}>Description</Label>
        <Controller
          control={control}
          name={`workExperiences.${index}.description`}
          render={({ field: { value, onChange } }) => (
            <TextArea
              id={`work-description-${index}`}
              aria-label="Description"
              placeholder="Describe your responsibilities, contributions, and key projects performed..."
              value={value || ""}
              onChange={onChange}
              rows={4}
            />
          )}
        />
        {errors.workExperiences?.[index]?.description && (
          <FieldError className="text-danger text-xs mt-1 block">
            {errors.workExperiences[index]?.description?.message}
          </FieldError>
        )}
      </div>

      {/* Key Achievements nested list */}
      <div className="border-t border-border/40 pt-4 flex flex-col gap-4">
        <div className="flex items-center justify-between select-none">
          <span className="text-xs font-bold text-foreground font-outfit uppercase flex items-center gap-1.5">
            <Award size={14} className="text-primary" /> Key Achievements
          </span>
          <Button
            size="sm"
            variant="secondary"
            className="rounded-xl text-[11px] font-bold h-7 px-3"
            onPress={() => appendAchievement({ title: "", description: "" })}
          >
            <Plus className="size-3.5" /> Add Achievement
          </Button>
        </div>

        {achievementFields.length === 0 ? (
          <Typography className="text-muted text-[11px] italic pl-1 leading-normal">
            No achievements added. List measurable career impact like 'Reduced load times by 30%'.
          </Typography>
        ) : (
          <div className="flex flex-col gap-4">
            {achievementFields.map((achField, achIndex) => (
              <div
                key={achField.id}
                className="p-4 border border-border/50 bg-surface-secondary/5 rounded-xl flex gap-4 items-start relative hover:border-border transition-colors duration-200"
              >
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4">
                  {/* Achievement Title */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`ach-title-${index}-${achIndex}`}>Title</Label>
                    <Controller
                      control={control}
                      name={`workExperiences.${index}.achievements.${achIndex}.title`}
                      render={({ field: { value, onChange } }) => (
                        <Input
                          id={`ach-title-${index}-${achIndex}`}
                          placeholder="e.g. API Performance Optimization"
                          value={value || ""}
                          onChange={onChange}
                        />
                      )}
                    />
                    {errors.workExperiences?.[index]?.achievements?.[achIndex]?.title && (
                      <FieldError className="text-danger text-[10px] mt-1 block">
                        Title is required
                      </FieldError>
                    )}
                  </div>

                  {/* Achievement Description */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`ach-desc-${index}-${achIndex}`}>Description</Label>
                    <Controller
                      control={control}
                      name={`workExperiences.${index}.achievements.${achIndex}.description`}
                      render={({ field: { value, onChange } }) => (
                        <Input
                          id={`ach-desc-${index}-${achIndex}`}
                          placeholder="e.g. Reduced API latency by 40% using Redis caching"
                          value={value || ""}
                          onChange={onChange}
                        />
                      )}
                    />
                    {errors.workExperiences?.[index]?.achievements?.[achIndex]?.description && (
                      <FieldError className="text-danger text-[10px] mt-1 block">
                        Description is required
                      </FieldError>
                    )}
                  </div>
                </div>

                <Button
                  isIconOnly
                  variant="danger-soft"
                  className="h-8 w-8 min-w-8 rounded-lg mt-5"
                  onPress={() => removeAchievement(achIndex)}
                  aria-label={`Remove achievement`}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Technologies Section */}
      <div className="border-t border-border/40 pt-4 flex flex-col gap-2">
        <span className="text-xs font-bold text-foreground font-outfit uppercase flex items-center gap-1.5 select-none">
          <Terminal size={14} className="text-primary" /> Technologies Used
        </span>
        <TechInput experienceIndex={index} control={control} setValue={setValue} />
      </div>

      {/* Related Links Section (Repository, Project, Portfolio, Demo, Article) */}
      <div className="border-t border-border/40 pt-4 flex flex-col gap-4">
        <span className="text-xs font-bold text-foreground font-outfit uppercase flex items-center gap-1.5 select-none">
          <Link2 size={14} className="text-primary" /> Related Links (Optional)
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {/* Repository URL */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`link-repo-${index}`}>Repository URL</Label>
            <Controller
              control={control}
              name={`workExperiences.${index}._links.repo`}
              render={({ field: { value, onChange } }) => (
                <Input
                  id={`link-repo-${index}`}
                  placeholder="https://github.com/..."
                  value={value || ""}
                  onChange={onChange}
                />
              )}
            />
            {errors.workExperiences?.[index]?._links?.repo && (
              <FieldError className="text-danger text-[10px] mt-1 block">
                Must be a valid URL
              </FieldError>
            )}
          </div>

          {/* Project URL */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`link-project-${index}`}>Project URL</Label>
            <Controller
              control={control}
              name={`workExperiences.${index}._links.project`}
              render={({ field: { value, onChange } }) => (
                <Input
                  id={`link-project-${index}`}
                  placeholder="https://project-url.com"
                  value={value || ""}
                  onChange={onChange}
                />
              )}
            />
            {errors.workExperiences?.[index]?._links?.project && (
              <FieldError className="text-danger text-[10px] mt-1 block">
                Must be a valid URL
              </FieldError>
            )}
          </div>

          {/* Portfolio URL */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`link-portfolio-${index}`}>Portfolio URL</Label>
            <Controller
              control={control}
              name={`workExperiences.${index}._links.portfolio`}
              render={({ field: { value, onChange } }) => (
                <Input
                  id={`link-portfolio-${index}`}
                  placeholder="https://portfolio.com"
                  value={value || ""}
                  onChange={onChange}
                />
              )}
            />
            {errors.workExperiences?.[index]?._links?.portfolio && (
              <FieldError className="text-danger text-[10px] mt-1 block">
                Must be a valid URL
              </FieldError>
            )}
          </div>

          {/* Demo URL */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`link-demo-${index}`}>Demo URL</Label>
            <Controller
              control={control}
              name={`workExperiences.${index}._links.demo`}
              render={({ field: { value, onChange } }) => (
                <Input
                  id={`link-demo-${index}`}
                  placeholder="https://demo-app.com"
                  value={value || ""}
                  onChange={onChange}
                />
              )}
            />
            {errors.workExperiences?.[index]?._links?.demo && (
              <FieldError className="text-danger text-[10px] mt-1 block">
                Must be a valid URL
              </FieldError>
            )}
          </div>

          {/* Article URL */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`link-article-${index}`}>Article / Publication URL</Label>
            <Controller
              control={control}
              name={`workExperiences.${index}._links.article`}
              render={({ field: { value, onChange } }) => (
                <Input
                  id={`link-article-${index}`}
                  placeholder="https://medium.com/..."
                  value={value || ""}
                  onChange={onChange}
                />
              )}
            />
            {errors.workExperiences?.[index]?._links?.article && (
              <FieldError className="text-danger text-[10px] mt-1 block">
                Must be a valid URL
              </FieldError>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ExperienceAchievementsSection: React.FC = () => {
  const {
    control,
    setValue,
    formState: { errors },
  } = useFormContext<PersonalInfoFormValues>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: "workExperiences",
  });

  const handleAddExperience = () => {
    append({
      jobTitle: "",
      company: "",
      experienceCategory: 1, // Default Professional Work
      employmentType: 1, // Default Full-time
      location: "",
      startDate: "",
      endDate: null,
      isCurrentlyWorking: false,
      description: "",
      achievements: [],
      technologies: [],
      links: [],
      _links: {
        repo: "",
        project: "",
        portfolio: "",
        demo: "",
        article: "",
      },
    });
  };

  return (
    <SettingsSection
      title="Experience & Achievements"
      description="Merges your professional experience history together with the verifiable achievements and technologies used during those roles."
    >
      <Card className="flex flex-col gap-6 text-left p-6">
        {fields.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 border border-dashed border-border rounded-2xl text-center bg-surface-secondary/5">
            <div className="p-3 bg-accent-soft rounded-2xl text-accent mb-4 border border-tertiary">
              <Briefcase className="size-6 text-primary" />
            </div>

            <Typography className="text-sm font-semibold text-foreground mb-1">
              Add Working Experience & Achievements
            </Typography>

            <Typography className="text-center text-xs text-muted max-w-sm mb-6 leading-relaxed">
              Showcase your career highlights, employment type, location details, and link key verifiable accomplishments to each role.
            </Typography>

            <Button
              className="rounded-xl justify-center text-center items-center text-xs"
              onPress={handleAddExperience}
            >
              <Plus className="size-4" />
              <span className="pt-0.5 font-bold">Add Experience</span>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-5">
              {fields.map((field, index) => (
                <ExperienceEntryItem
                  key={field.id}
                  index={index}
                  remove={remove}
                  errors={errors}
                  control={control}
                  setValue={setValue}
                />
              ))}
            </div>

            {/* Bottom Append Button */}
            <div className="flex select-none border-t border-border/40 pt-4 mt-2">
              <Button
                className="rounded-xl justify-center text-center items-center text-xs"
                onPress={handleAddExperience}
              >
                <Plus className="size-4" />
                <span className="pt-0.5 font-bold">Add Experience</span>
              </Button>
            </div>
          </div>
        )}
      </Card>
    </SettingsSection>
  );
};

export default ExperienceAchievementsSection;
