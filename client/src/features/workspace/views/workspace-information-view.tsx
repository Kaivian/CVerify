"use client";

import React, { useEffect, useState } from "react";
import { useWorkspaceStore } from "../store/use-workspace-store";
import { Card } from "@/components/ui/card";
import { Typography, Chip, Input, TextArea } from "@heroui/react";
import { Button } from "@/components/ui/button";
import { Building2, Globe, MapPin, Briefcase, Calendar, ShieldCheck, Edit3, Save, AlertTriangle } from "lucide-react";
import { SkeletonLoader } from "@/components/ui/states";

interface WorkspaceInformationViewProps {
  organizationSlug: string;
}

export const WorkspaceInformationView: React.FC<WorkspaceInformationViewProps> = ({
  organizationSlug,
}) => {
  const fetchWorkspace = useWorkspaceStore((s) => s.fetchWorkspace);
  const workspaceDetails = useWorkspaceStore((s) => s.workspaces[organizationSlug]);
  const isDetailsLoading = useWorkspaceStore((s) => s.loading[organizationSlug]);
  const detailsError = useWorkspaceStore((s) => s.errors[organizationSlug]);

  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(
    "Leading technology solutions provider specializing in developer screening, automated credential validation, and AI-driven skill mapping systems. Empowering modern hiring teams worldwide."
  );
  const [website, setWebsite] = useState("https://cverify.dev");
  const [location, setLocation] = useState("Hanoi, Vietnam");
  const [industry, setIndustry] = useState("Information Technology & Services");
  const [founded, setFounded] = useState("2022");

  // Save State
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (organizationSlug) {
      fetchWorkspace(organizationSlug);
    }
  }, [organizationSlug, fetchWorkspace]);

  if (isDetailsLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 font-outfit text-foreground">
        <div className="h-10 w-48 bg-separator/50 animate-pulse rounded-lg mb-4" />
        <Card className="p-0 overflow-hidden">
          <SkeletonLoader rows={6} columns={4} />
        </Card>
      </div>
    );
  }

  if (detailsError || !workspaceDetails) {
    const isAccessDenied = detailsError?.toLowerCase().includes("forbidden") || detailsError?.toLowerCase().includes("forbid") || detailsError?.includes("403");
    return (
      <div className="max-w-xl mx-auto py-20 font-outfit text-foreground">
        <Card className="p-8 border border-border bg-surface text-center">
          <div className="size-16 rounded-2xl bg-danger/10 flex items-center justify-center border border-danger/20 mx-auto mb-5 text-danger">
            <AlertTriangle size={28} />
          </div>
          <Typography type="h4" className="font-bold text-foreground mb-2">
            {isAccessDenied ? "Access Denied" : "Workspace Loading Error"}
          </Typography>
          <Typography type="body-xs" className="text-muted leading-relaxed mb-6">
            {isAccessDenied 
              ? "You do not have permission to access this organization workspace. Please verify your membership credentials or switch accounts."
              : detailsError || "Organization not found"}
          </Typography>
        </Card>
      </div>
    );
  }

  const userRole = workspaceDetails.userRole;
  const canEdit = userRole === "OWNER" || userRole === "REPRESENTATIVE";

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setIsEditing(false);
    }, 800);
  };

  return (
    <div className="space-y-6 font-outfit max-w-7xl mx-auto text-foreground">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-surface border border-border text-foreground select-none">
        <div className="space-y-1">
          <Typography
            type="h2"
            className="text-2xl font-bold flex items-center gap-2 text-foreground"
          >
            <Building2 size={24} className="text-accent" />
            {workspaceDetails.organizationName}
          </Typography>
          <Typography type="body-xs" className="text-muted font-light mt-0.5">
            Workspace context: <span className="font-mono text-accent">@{workspaceDetails.organizationSlug}</span> • My Role: <span className="font-semibold text-foreground">{workspaceDetails.userRole}</span>
          </Typography>
        </div>
        <div className="flex gap-2">
          <Chip color="success" variant="soft" size="sm" className="font-semibold text-xs py-1">
            <ShieldCheck size={12} className="inline mr-1" />
            Verified Enterprise
          </Chip>
        </div>
      </div>

      {/* 2. Profile details & edit card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Profile Card / Edit Mode Form */}
        <div className="lg:col-span-2">
          <Card className="p-6 md:p-8 bg-surface border border-border rounded-2xl space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-separator/40">
              <Typography type="h3" className="font-bold text-foreground">
                Organization Profile Settings
              </Typography>
              {canEdit && !isEditing && (
                <Button
                  size="sm"
                  variant="bordered"
                  onClick={() => setIsEditing(true)}
                  className="font-bold text-xs cursor-pointer"
                >
                  <Edit3 size={14} className="mr-1.5" />
                  Edit Profile
                </Button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted uppercase">Company Description</span>
                  <TextArea
                    value={description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                    className="w-full text-sm font-outfit"
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-muted uppercase">Website URL</span>
                    <Input
                      type="url"
                      value={website}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWebsite(e.target.value)}
                      className="w-full text-sm font-outfit"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-muted uppercase">Headquarters</span>
                    <Input
                      type="text"
                      value={location}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocation(e.target.value)}
                      className="w-full text-sm font-outfit"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-muted uppercase">Industry</span>
                    <Input
                      type="text"
                      value={industry}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIndustry(e.target.value)}
                      className="w-full text-sm font-outfit"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-muted uppercase">Founded Year</span>
                    <Input
                      type="text"
                      value={founded}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFounded(e.target.value)}
                      className="w-full text-sm font-outfit"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t border-separator/40">
                  <Button
                    size="sm"
                    variant="bordered"
                    onClick={() => setIsEditing(false)}
                    className="font-bold text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="solid"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="font-bold text-xs bg-accent text-background border-none hover:bg-accent/90 shrink-0 cursor-pointer"
                  >
                    {isSaving ? "Saving..." : (
                      <>
                        <Save size={14} className="mr-1.5" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <Typography type="body-xs" className="text-muted leading-relaxed text-sm">
                  {description}
                </Typography>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-separator/40">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                      <Globe size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted font-bold uppercase block">Website</span>
                      <a href={website} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-accent hover:underline">
                        {website.replace("https://", "")}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                      <MapPin size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted font-bold uppercase block">Headquarters</span>
                      <span className="text-xs font-bold text-foreground">
                        {location}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                      <Briefcase size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted font-bold uppercase block">Industry</span>
                      <span className="text-xs font-bold text-foreground">
                        {industry}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                      <Calendar size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted font-bold uppercase block">Founded</span>
                      <span className="text-xs font-bold text-foreground">
                        {founded}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Side Widget card */}
        <div>
          <Card className="p-6 bg-surface border border-border rounded-2xl space-y-4">
            <Typography type="h4" className="font-bold text-foreground flex items-center gap-2">
              <ShieldCheck size={18} className="text-accent" />
              Information Administration
            </Typography>
            <Typography type="body-xs" className="text-muted leading-relaxed">
              Use this page to keep corporate contact coordinates, founded year, and details updated. Candidates will see these details on the public organization page.
            </Typography>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceInformationView;
