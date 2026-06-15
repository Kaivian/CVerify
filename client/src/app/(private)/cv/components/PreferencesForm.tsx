import React, { useState } from "react";
import { Input, Button, Checkbox, Switch, Chip, TextArea, Tooltip } from "@heroui/react";
import { PlusCircle, X, Info } from "lucide-react";
import { type PreferencesDraft } from "./types";
import { BaseUnsavedChangesBar } from "@/components/ui/unsaved-changes-bar";
import { TagChipMultiSelect } from "@/app/(private)/settings/components/TagChipMultiSelect";
import { SelectDropdown } from "@/components/ui/select-dropdown";

interface PreferencesFormProps {
  draft: PreferencesDraft;
  onChange: (updated: Partial<PreferencesDraft>) => void;
  onSave: () => Promise<void>;
  onReset: () => void;
  isSaving: boolean;
  isDirty: boolean;
}

const ROLES_OPTIONS = [
  "Frontend Engineer",
  "Backend Engineer",
  "Fullstack Engineer",
  "DevOps Engineer",
  "Data Engineer",
  "AI/ML Engineer",
  "Mobile Engineer",
  "QA Engineer",
  "Security Engineer",
  "System Architect",
  "Tech Lead",
  "Engineering Manager",
];

const WORK_STATUS_OPTIONS = [
  { value: "active", label: "Active Job Search" },
  { value: "casual", label: "Casual Browsing" },
  { value: "closed", label: "Not Open to Work" },
];

const REMOTE_OPTIONS = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "Onsite" },
  { value: "any", label: "Any" },
];

const CURRENCY_OPTIONS = [
  { value: "VND", label: "VND" },
  { value: "USD", label: "USD" },
];

const SALARY_TYPE_OPTIONS = [
  { value: "Monthly", label: "Monthly" },
  { value: "Hourly", label: "Hourly" },
  { value: "Project-based", label: "Project-based" },
];

const EMPLOYMENT_OPTIONS = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "freelance", label: "Freelance" },
  { value: "internship", label: "Internship" },
];

const LEADERSHIP_TRACK_OPTIONS = [
  { value: "ic", label: "Individual Contributor" },
  { value: "management", label: "Engineering Management" },
  { value: "undecided", label: "Undecided" },
];

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "vi", label: "Vietnamese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
];

export const PreferencesForm: React.FC<PreferencesFormProps> = ({
  draft,
  onChange,
  onSave,
  onReset,
  isSaving,
  isDirty,
}) => {
  const [newLocation, setNewLocation] = useState("");
  const [salaryError, setSalaryError] = useState<string | null>(null);

  const isVnd = draft.expectedSalaryCurrency === "VND";
  const placeholderMin = isVnd ? "e.g. 35.000.000" : "e.g. 1500";
  const placeholderMax = isVnd ? "e.g. 70.000.000" : "e.g. 3000";

  const formatSalaryString = (val: number | null, currency: string): string => {
    if (val === null || val === undefined || isNaN(val)) return "";
    if (currency === "VND") {
      return new Intl.NumberFormat("vi-VN").format(val);
    }
    return new Intl.NumberFormat("en-US").format(val);
  };

  const handleSalaryChange = (
    key: "expectedSalaryMin" | "expectedSalaryMax",
    rawValue: string
  ) => {
    const cleanValue = rawValue.replace(/\D/g, "");
    const num = cleanValue ? parseInt(cleanValue, 10) : null;
    onChange({ [key]: num });
  };

  const validate = (): boolean => {
    if (
      draft.expectedSalaryMin !== null &&
      draft.expectedSalaryMax !== null &&
      draft.expectedSalaryMin > draft.expectedSalaryMax
    ) {
      setSalaryError("Expected salary min must not be greater than max");
      return false;
    }
    setSalaryError(null);
    return true;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      return;
    }
    await onSave();
  };

  const handleAddLocation = () => {
    const trimmed = newLocation.trim();
    if (!trimmed) return;
    if (!draft.preferredLocations.includes(trimmed)) {
      onChange({ preferredLocations: [...draft.preferredLocations, trimmed] });
    }
    setNewLocation("");
  };

  const handleRemoveLocation = (loc: string) => {
    onChange({ preferredLocations: draft.preferredLocations.filter((l) => l !== loc) });
  };

  const toggleEmployment = (val: string) => {
    const current = draft.employmentPreferences || [];
    if (current.includes(val)) {
      onChange({ employmentPreferences: current.filter((x) => x !== val) });
    } else {
      onChange({ employmentPreferences: [...current, val] });
    }
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col h-full overflow-hidden relative text-left text-xs">
      <div className="flex-1 overflow-y-auto px-1.5 flex flex-col gap-5 pb-20">
        
        {/* SECTION 1: Availability & Job Targeting */}
        <div className="bg-surface-secondary/40 border border-border/20 rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border/10 pb-3">
            <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Availability & Status</h4>
          </div>

          <div className="flex items-center justify-between gap-6 select-none bg-surface/50 border border-border/10 p-3 rounded-xl">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-foreground">Available for Hire</span>
                <Tooltip delay={0}>
                  <Tooltip.Trigger>
                    <span tabIndex={0} className="inline-flex items-center outline-none cursor-help shrink-0">
                      <Info className="size-3.5 text-muted-foreground hover:text-foreground" />
                    </span>
                  </Tooltip.Trigger>
                  <Tooltip.Content showArrow className="bg-surface border border-border rounded-xl p-2 text-xs max-w-xs text-foreground wrap-break-word">
                    Toggle whether your public CV displays an 'Open to Work' badge
                  </Tooltip.Content>
                </Tooltip>
              </div>
              <span className="text-[10px] text-muted-foreground">Toggle availability visibility.</span>
            </div>
            <Switch
              isSelected={draft.availableForHire}
              onChange={(isSelected: boolean) => onChange({ availableForHire: isSelected })}
              aria-label="Available for hire toggle"
              className="cursor-pointer"
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <label className="font-bold text-xs text-foreground">Job Search Status</label>
                <Tooltip delay={0}>
                  <Tooltip.Trigger>
                    <span tabIndex={0} className="inline-flex items-center outline-none cursor-help shrink-0">
                      <Info className="size-3.5 text-muted-foreground hover:text-foreground" />
                    </span>
                  </Tooltip.Trigger>
                  <Tooltip.Content showArrow className="bg-surface border border-border rounded-xl p-2 text-xs max-w-xs text-foreground wrap-break-word">
                    Your current job search status (active, browsing, or closed)
                  </Tooltip.Content>
                </Tooltip>
              </div>
              <SelectDropdown
                value={draft.openToWorkStatus || "casual"}
                onChange={(value) => onChange({ openToWorkStatus: value })}
                options={WORK_STATUS_OPTIONS}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <label className="font-bold text-xs text-foreground">Primary Spoken Language</label>
                <Tooltip delay={0}>
                  <Tooltip.Trigger>
                    <span tabIndex={0} className="inline-flex items-center outline-none cursor-help shrink-0">
                      <Info className="size-3.5 text-muted-foreground hover:text-foreground" />
                    </span>
                  </Tooltip.Trigger>
                  <Tooltip.Content showArrow className="bg-surface border border-border rounded-xl p-2 text-xs max-w-xs text-foreground wrap-break-word">
                    The main language you use for work and communications
                  </Tooltip.Content>
                </Tooltip>
              </div>
              <SelectDropdown
                value={draft.preferredLanguage || "en"}
                onChange={(value) => onChange({ preferredLanguage: value })}
                options={LANGUAGE_OPTIONS}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs text-foreground">Target Roles</label>
            <TagChipMultiSelect
              options={ROLES_OPTIONS}
              value={draft.desiredJobPositions || []}
              onChange={(val) => onChange({ desiredJobPositions: val })}
              allowCustom={false}
            />
          </div>
        </div>

        {/* SECTION 2: Work Arrangements & Location */}
        <div className="bg-surface-secondary/40 border border-border/20 rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border/10 pb-3">
            <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Work Arrangements & Location</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <label className="font-bold text-xs text-foreground">Work Arrangement</label>
                <Tooltip delay={0}>
                  <Tooltip.Trigger>
                    <span tabIndex={0} className="inline-flex items-center outline-none cursor-help shrink-0">
                      <Info className="size-3.5 text-muted-foreground hover:text-foreground" />
                    </span>
                  </Tooltip.Trigger>
                  <Tooltip.Content showArrow className="bg-surface border border-border rounded-xl p-2 text-xs max-w-xs text-foreground wrap-break-word">
                    Preferred work model: Remote, Hybrid, Onsite, or any arrangements
                  </Tooltip.Content>
                </Tooltip>
              </div>
              <SelectDropdown
                value={draft.remotePreference || "any"}
                onChange={(value) => onChange({ remotePreference: value })}
                options={REMOTE_OPTIONS}
              />
            </div>

            <div className="flex items-center justify-between gap-4 select-none bg-surface/50 border border-border/10 p-3 rounded-xl h-10 mt-5">
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-xs text-foreground">Open to Relocation</span>
              </div>
              <Switch
                isSelected={draft.openToRelocation}
                onChange={(isSelected: boolean) => onChange({ openToRelocation: isSelected })}
                aria-label="Open to relocation toggle"
                className="cursor-pointer"
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </div>
          </div>

          {/* Desired Locations */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs text-foreground">Desired Locations</label>
            <div className="flex gap-2 items-start">
              <div className="flex-1 flex flex-col gap-0.5">
                <Input
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="Enter preferred location"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddLocation();
                    }
                  }}
                  aria-label="New preferred location input"
                  maxLength={50}
                />
                <div className="flex justify-end text-[10px] text-muted-foreground mt-0.5 select-none">
                  <span>{(newLocation || "").length}/50 characters</span>
                </div>
              </div>
              <Button size="sm" variant="secondary" className="rounded-xl border border-border/30 h-10 min-w-10 cursor-pointer" onPress={handleAddLocation} type="button" aria-label="Add preferred location">
                <PlusCircle className="size-4" />
              </Button>
            </div>
            {draft.preferredLocations && draft.preferredLocations.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {draft.preferredLocations.map((loc) => (
                  <Chip
                    key={loc}
                    size="sm"
                    variant="soft"
                    color="default"
                    className="text-[9px] font-bold py-0.5 px-2"
                  >
                    <span className="flex items-center gap-1">
                      {loc}
                      <button type="button" onClick={() => handleRemoveLocation(loc)} className="bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer flex items-center" aria-label={`Remove preferred location ${loc}`}>
                        <X className="size-2.5" />
                      </button>
                    </span>
                  </Chip>
                ))}
              </div>
            )}
          </div>

          {/* Employment Types */}
          <div className="flex flex-col gap-1.5">
            <span className="font-bold text-xs text-foreground">Employment Types</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 select-none mt-1">
              {EMPLOYMENT_OPTIONS.map((opt) => {
                const isSelected = draft.employmentPreferences?.includes(opt.value) || false;
                return (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox
                      isSelected={isSelected}
                      onChange={() => toggleEmployment(opt.value)}
                      aria-label={opt.label}
                      className="cursor-pointer"
                    >
                      <Checkbox.Content>
                        <Checkbox.Control className="w-4 h-4 rounded border border-field-border flex items-center justify-center bg-field group-data-[selected=true]:bg-accent group-data-[selected=true]:border-accent transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-focus">
                          <Checkbox.Indicator className="text-accent-foreground flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 fill-none stroke-current stroke-3" viewBox="0 0 24 24">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </Checkbox.Indicator>
                        </Checkbox.Control>
                      </Checkbox.Content>
                    </Checkbox>
                    <span className="font-semibold text-foreground">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* SECTION 3: Compensation & Career Track */}
        <div className="bg-surface-secondary/40 border border-border/20 rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border/10 pb-3">
            <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Compensation & Career Track</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-xs text-foreground">Expected Salary Min</label>
              <Input
                type="text"
                value={formatSalaryString(draft.expectedSalaryMin, draft.expectedSalaryCurrency || "USD")}
                onChange={(e) => handleSalaryChange("expectedSalaryMin", e.target.value)}
                placeholder={placeholderMin}
                disabled={draft.expectedSalaryNegotiable}
                aria-label="Expected salary min"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-xs text-foreground">Expected Salary Max</label>
              <Input
                type="text"
                value={formatSalaryString(draft.expectedSalaryMax, draft.expectedSalaryCurrency || "USD")}
                onChange={(e) => handleSalaryChange("expectedSalaryMax", e.target.value)}
                placeholder={placeholderMax}
                disabled={draft.expectedSalaryNegotiable}
                aria-label="Expected salary max"
              />
              {salaryError && (
                <span className="text-[10px] text-danger">{salaryError}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-xs text-foreground">Currency</label>
              <SelectDropdown
                value={draft.expectedSalaryCurrency || "USD"}
                onChange={(value) => onChange({ expectedSalaryCurrency: value })}
                options={CURRENCY_OPTIONS}
                isDisabled={draft.expectedSalaryNegotiable}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-xs text-foreground">Salary Type</label>
              <SelectDropdown
                value={draft.expectedSalaryType || "Monthly"}
                onChange={(value) => onChange({ expectedSalaryType: value })}
                options={SALARY_TYPE_OPTIONS}
                isDisabled={draft.expectedSalaryNegotiable}
              />
            </div>
          </div>

          <div className="flex items-center gap-6 mt-1 bg-surface/30 p-2.5 rounded-xl border border-border/10">
            <label className="flex items-center gap-2 select-none cursor-pointer">
              <Checkbox
                isSelected={draft.expectedSalaryNegotiable}
                onChange={(isSelected: boolean) => onChange({ expectedSalaryNegotiable: isSelected })}
                aria-label="Negotiable salary"
                className="cursor-pointer"
              >
                <Checkbox.Content>
                  <Checkbox.Control className="w-4 h-4 rounded border border-field-border flex items-center justify-center bg-field group-data-[selected=true]:bg-accent group-data-[selected=true]:border-accent transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-focus">
                    <Checkbox.Indicator className="text-accent-foreground flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 fill-none stroke-current stroke-3" viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </Checkbox.Indicator>
                  </Checkbox.Control>
                </Checkbox.Content>
              </Checkbox>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-foreground">Negotiable</span>
                <Tooltip delay={0}>
                  <Tooltip.Trigger>
                    <span tabIndex={0} className="inline-flex items-center outline-none cursor-help shrink-0">
                      <Info className="size-3.5 text-muted-foreground hover:text-foreground" />
                    </span>
                  </Tooltip.Trigger>
                  <Tooltip.Content showArrow className="bg-surface border border-border rounded-xl p-2 text-xs max-w-xs text-foreground wrap-break-word">
                    Specify if your salary requirements are open to negotiation
                  </Tooltip.Content>
                </Tooltip>
              </div>
            </label>

            <label className="flex items-center gap-2 select-none cursor-pointer">
              <Checkbox
                isSelected={draft.isExpectedSalaryVisible}
                onChange={(isSelected: boolean) => onChange({ isExpectedSalaryVisible: isSelected })}
                aria-label="Show salary publicly"
                className="cursor-pointer"
              >
                <Checkbox.Content>
                  <Checkbox.Control className="w-4 h-4 rounded border border-field-border flex items-center justify-center bg-field group-data-[selected=true]:bg-accent group-data-[selected=true]:border-accent transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-focus">
                    <Checkbox.Indicator className="text-accent-foreground flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 fill-none stroke-current stroke-3" viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </Checkbox.Indicator>
                  </Checkbox.Control>
                </Checkbox.Content>
              </Checkbox>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-foreground">Show salary publicly</span>
                <Tooltip delay={0}>
                  <Tooltip.Trigger>
                    <span tabIndex={0} className="inline-flex items-center outline-none cursor-help shrink-0">
                      <Info className="size-3.5 text-muted-foreground hover:text-foreground" />
                    </span>
                  </Tooltip.Trigger>
                  <Tooltip.Content showArrow className="bg-surface border border-border rounded-xl p-2 text-xs max-w-xs text-foreground wrap-break-word">
                    Toggle whether recruiters can see your expected salary range on your public developer card
                  </Tooltip.Content>
                </Tooltip>
              </div>
            </label>
          </div>

          <div className="flex flex-col gap-1.5 mt-2">
            <div className="flex items-center gap-1.5">
              <label className="font-bold text-xs text-foreground">Leadership Track</label>
              <Tooltip delay={0}>
                <Tooltip.Trigger>
                  <span tabIndex={0} className="inline-flex items-center outline-none cursor-help shrink-0">
                    <Info className="size-3.5 text-muted-foreground hover:text-foreground" />
                  </span>
                </Tooltip.Trigger>
                <Tooltip.Content showArrow className="bg-surface border border-border rounded-xl p-2 text-xs max-w-xs text-foreground wrap-break-word">
                  Indicate your preference for individual contributor or management tracks
                </Tooltip.Content>
              </Tooltip>
            </div>
            <SelectDropdown
              value={draft.leadershipTrack || "undecided"}
              onChange={(value) => onChange({ leadershipTrack: value })}
              options={LEADERSHIP_TRACK_OPTIONS}
            />
          </div>
        </div>

        {/* SECTION 4: Preference Notes */}
        <div className="bg-surface-secondary/40 border border-border/20 rounded-xl p-4 flex flex-col gap-2.5">
          <label className="font-bold text-xs text-foreground">Additional Work Preference Notes</label>
          <TextArea
            value={draft.workPreferenceNotes}
            onChange={(e) => onChange({ workPreferenceNotes: e.target.value })}
            placeholder="e.g. Prefer collaborative engineering teams, hybrid model..."
            rows={3}
            aria-label="Additional Work Preference Notes"
            maxLength={500}
          />
          <div className="flex justify-end text-[10px] text-muted-foreground mt-0.5 select-none">
            <span>{(draft.workPreferenceNotes || "").length}/500 characters</span>
          </div>
        </div>

      </div>

      <BaseUnsavedChangesBar
        message="You have unsaved career preferences changes."
        onReset={onReset}
        isDirty={isDirty}
        isSubmitting={isSaving}
      />
    </form>
  );
};
