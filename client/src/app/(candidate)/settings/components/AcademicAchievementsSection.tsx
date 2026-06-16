import React from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { Plus, Award } from "lucide-react";
import { Button, Typography } from "@heroui/react";
import { Card } from "@/components/ui/card";
import { SettingsSection } from "./SettingsSection";
import { AchievementCard } from "./AchievementCard";
import type { PersonalInfoFormValues } from "./types";

export const AcademicAchievementsSection: React.FC = () => {
  const { control } = useFormContext<PersonalInfoFormValues>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: "achievements",
  });

  const handleAddAchievement = () => {
    append({
      title: "",
      issuer: "",
      issueDate: "",
      description: "",
      credentialUrl: "",
      evidence: [],
    });
  };

  return (
    <SettingsSection
      title="Academic Achievements"
      description="Verify your certificates, honors, and extracurricular credentials."
    >
      <Card className="flex flex-col gap-6 text-left p-6">
        {fields.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 border border-dashed border-border rounded-2xl text-center">
            <div className="p-3 bg-accent-soft rounded-2xl text-accent mb-4 border border-tertiary">
              <Award className="size-6 text-primary" />
            </div>

            <Typography className="text-sm font-semibold text-foreground mb-1">
              Add Academic Achievements
            </Typography>

            <Typography className="text-center text-xs text-muted max-w-sm mb-6 leading-relaxed">
              Showcase your certifications, course credentials, honors, or academic distinctions to build verifiable credibility.
            </Typography>

            <Button
              className="rounded-xl justify-center text-center items-center text-xs"
              onPress={handleAddAchievement}
            >
              <Plus className="size-4" />
              <span className="pt-0.5 font-bold">Add Achievement</span>
            </Button>
          </div>
        ) : (
          // Dynamic Achievements List
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-5">
              {fields.map((field, index) => (
                <AchievementCard
                  key={field.id}
                  index={index}
                  remove={remove}
                />
              ))}
            </div>

            {/* Bottom Append Button */}
            <div className="flex select-none border-t border-border/40 pt-4 mt-2">
              <Button
                className="rounded-xl justify-center text-center items-center text-xs"
                onPress={handleAddAchievement}
              >
                <Plus className="size-4" />
                <span className="pt-0.5 font-bold">Add Achievement</span>
              </Button>
            </div>
          </div>
        )}
      </Card>
    </SettingsSection>
  );
};

export default AcademicAchievementsSection;
