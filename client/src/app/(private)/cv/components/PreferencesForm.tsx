import React, { useState } from "react";
import { Input, Button, Checkbox, Select, ListBox, Switch, Chip, Spinner, TextArea } from "@heroui/react";
import { PlusCircle, X } from "lucide-react";
import { type PreferencesDraft } from "./types";
import { BaseUnsavedChangesBar } from "@/components/ui/unsaved-changes-bar";

interface PreferencesFormProps {
  draft: PreferencesDraft;
  onChange: (updated: Partial<PreferencesDraft>) => void;
  onSave: () => Promise<void>;
  onReset: () => void;
  isSaving: boolean;
  isDirty: boolean;
}

export const PreferencesForm: React.FC<PreferencesFormProps> = ({
  draft,
  onChange,
  onSave,
  onReset,
  isSaving,
  isDirty,
}) => {
  const [newLocation, setNewLocation] = useState("");
  const [newPosition, setNewPosition] = useState("");
  const [salaryError, setSalaryError] = useState<string | null>(null);

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

  const handleAddPosition = () => {
    const trimmed = newPosition.trim();
    if (!trimmed) return;
    if (!draft.desiredJobPositions.includes(trimmed)) {
      onChange({ desiredJobPositions: [...draft.desiredJobPositions, trimmed] });
    }
    setNewPosition("");
  };

  const handleRemovePosition = (pos: string) => {
    onChange({ desiredJobPositions: draft.desiredJobPositions.filter((p) => p !== pos) });
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
      <div className="flex-1 overflow-y-auto px-1.5 flex flex-col gap-4 pb-4">
        <div className="flex items-center justify-between gap-6 border-b border-border/20 pb-4 select-none">
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-sm text-foreground">Available for Hire</span>
            <span className="text-[10px] text-muted-foreground">Toggle availability visibility.</span>
          </div>
          <Switch
            isSelected={draft.availableForHire}
            onChange={(isSelected: boolean) => onChange({ availableForHire: isSelected })}
            aria-label="Available for hire toggle"
            className="cursor-pointer"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Job Search Status */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-foreground">Search Status</label>
            <Select
              placeholder="Select search status"
              selectedKey={draft.openToWorkStatus || "casual"}
              onSelectionChange={(key) => {
                onChange({ openToWorkStatus: key as string });
              }}
              aria-label="Search status"
            >
              <Select.Trigger className="rounded-xl border border-border bg-surface text-xs h-10 px-3">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover className="bg-surface border border-border rounded-xl p-1 text-xs">
                <ListBox aria-label="Search status options">
                  {WORK_STATUS_OPTIONS.map((opt) => (
                    <ListBox.Item key={opt.value} id={opt.value} className="p-2 hover:bg-accent/10 rounded-lg cursor-pointer">
                      {opt.label}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          {/* Remote Preference */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-foreground">Work Arrangement</label>
            <Select
              placeholder="Select arrangement"
              selectedKey={draft.remotePreference || "any"}
              onSelectionChange={(key) => {
                onChange({ remotePreference: key as string });
              }}
              aria-label="Work arrangement"
            >
              <Select.Trigger className="rounded-xl border border-border bg-surface text-xs h-10 px-3">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover className="bg-surface border border-border rounded-xl p-1 text-xs">
                <ListBox aria-label="Work arrangement options">
                  {REMOTE_OPTIONS.map((opt) => (
                    <ListBox.Item key={opt.value} id={opt.value} className="p-2 hover:bg-accent/10 rounded-lg cursor-pointer">
                      {opt.label}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        </div>

        {/* Salary preferences */}
        <div className="flex flex-col gap-3 border-t border-border/20 pt-4">
          <span className="font-bold text-xs text-foreground">Expected Salary</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-foreground">Expected Salary Min</label>
              <Input
                type="number"
                value={draft.expectedSalaryMin !== null ? String(draft.expectedSalaryMin) : ""}
                onChange={(e) =>
                  onChange({
                    expectedSalaryMin: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                placeholder="e.g. 1500"
                disabled={draft.expectedSalaryNegotiable}
                aria-label="Expected salary min"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-foreground">Expected Salary Max</label>
              <Input
                type="number"
                value={draft.expectedSalaryMax !== null ? String(draft.expectedSalaryMax) : ""}
                onChange={(e) =>
                  onChange({
                    expectedSalaryMax: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                placeholder="e.g. 3000"
                disabled={draft.expectedSalaryNegotiable}
                aria-label="Expected salary max"
              />
              {salaryError && (
                <span className="text-[10px] text-danger">{salaryError}</span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-foreground">Currency</label>
              <Select
                selectedKey={draft.expectedSalaryCurrency || "USD"}
                onSelectionChange={(key) => {
                  onChange({ expectedSalaryCurrency: key as string });
                }}
                isDisabled={draft.expectedSalaryNegotiable}
                aria-label="Expected salary currency"
              >
                <Select.Trigger className="rounded-xl border border-border bg-surface text-xs h-10 px-3">
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover className="bg-surface border border-border rounded-xl p-1 text-xs">
                  <ListBox aria-label="Expected salary currency options">
                    {CURRENCY_OPTIONS.map((opt) => (
                      <ListBox.Item key={opt.value} id={opt.value} className="p-2 hover:bg-accent/10 rounded-lg cursor-pointer">
                        {opt.label}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-foreground">Salary Type</label>
              <Select
                selectedKey={draft.expectedSalaryType || "Monthly"}
                onSelectionChange={(key) => {
                  onChange({ expectedSalaryType: key as string });
                }}
                isDisabled={draft.expectedSalaryNegotiable}
                aria-label="Expected salary type"
              >
                <Select.Trigger className="rounded-xl border border-border bg-surface text-xs h-10 px-3">
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover className="bg-surface border border-border rounded-xl p-1 text-xs">
                  <ListBox aria-label="Expected salary type options">
                    {SALARY_TYPE_OPTIONS.map((opt) => (
                      <ListBox.Item key={opt.value} id={opt.value} className="p-2 hover:bg-accent/10 rounded-lg cursor-pointer">
                        {opt.label}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>

            <div className="flex items-center gap-2 select-none">
              <Checkbox
                isSelected={draft.expectedSalaryNegotiable}
                onChange={(isSelected: boolean) => onChange({ expectedSalaryNegotiable: isSelected })}
                aria-label="Negotiable salary"
              />
              <span className="font-semibold text-foreground">Negotiable</span>
            </div>

            <div className="flex items-center gap-2 select-none">
              <Checkbox
                isSelected={draft.isExpectedSalaryVisible}
                onChange={(isSelected: boolean) => onChange({ isExpectedSalaryVisible: isSelected })}
                aria-label="Show salary publicly"
              />
              <span className="font-semibold text-foreground">Show salary publicly</span>
            </div>
          </div>
        </div>

        {/* Target Roles */}
        <div className="flex flex-col gap-3 border-t border-border/20 pt-4">
          <span className="font-bold text-xs text-foreground">Target Roles</span>
          <div className="flex gap-2">
            <Input
              value={newPosition}
              onChange={(e) => setNewPosition(e.target.value)}
              placeholder="Enter target role"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddPosition();
                }
              }}
              aria-label="New target role input"
            />
            <Button size="sm" variant="secondary" className="rounded-xl border border-border/30 h-10 min-w-10" onPress={handleAddPosition} type="button" aria-label="Add target role">
              <PlusCircle className="size-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {draft.desiredJobPositions.map((pos) => (
              <Chip
                key={pos}
                size="sm"
                variant="soft"
                color="default"
                className="text-[9px] font-bold py-0.5 px-2"
              >
                <span className="flex items-center gap-1">
                  {pos}
                  <button type="button" onClick={() => handleRemovePosition(pos)} className="bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer flex items-center" aria-label={`Remove target role ${pos}`}>
                    <X className="size-2.5" />
                  </button>
                </span>
              </Chip>
            ))}
          </div>
        </div>

        {/* Target Locations */}
        <div className="flex flex-col gap-3 border-t border-border/20 pt-4">
          <span className="font-bold text-xs text-foreground">Desired Locations</span>
          <div className="flex gap-2">
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
            />
            <Button size="sm" variant="secondary" className="rounded-xl border border-border/30 h-10 min-w-10" onPress={handleAddLocation} type="button" aria-label="Add preferred location">
              <PlusCircle className="size-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
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
        </div>

        {/* Employment Types */}
        <div className="flex flex-col gap-3 border-t border-border/20 pt-4">
          <span className="font-bold text-xs text-foreground">Employment Types</span>
          <div className="flex flex-wrap gap-x-6 gap-y-2 select-none">
            {EMPLOYMENT_OPTIONS.map((opt) => {
              const isSelected = draft.employmentPreferences.includes(opt.value);
              return (
                <div key={opt.value} className="flex items-center gap-2">
                  <Checkbox isSelected={isSelected} onChange={() => toggleEmployment(opt.value)} aria-label={opt.label} />
                  <span className="font-semibold text-foreground">{opt.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Relocation Switch */}
        <div className="flex items-center justify-between gap-6 border-t border-border/20 pt-4 select-none">
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-sm text-foreground">Open to Relocation</span>
            <span className="text-[10px] text-muted-foreground">Are you willing to relocate for work?</span>
          </div>
          <Switch
            isSelected={draft.openToRelocation}
            onChange={(isSelected: boolean) => onChange({ openToRelocation: isSelected })}
            aria-label="Open to relocation toggle"
            className="cursor-pointer"
          />
        </div>

        {/* Preference Notes */}
        <div className="flex flex-col gap-1.5 border-t border-border/20 pt-4">
          <label className="font-bold text-foreground">Additional Work Preference Notes</label>
          <TextArea
            value={draft.workPreferenceNotes}
            onChange={(e) => onChange({ workPreferenceNotes: e.target.value })}
            placeholder="e.g. Prefer collaborative engineering teams, hybrid model..."
            rows={3}
            aria-label="Additional Work Preference Notes"
          />
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
