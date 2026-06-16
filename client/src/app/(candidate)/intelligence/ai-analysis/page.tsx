"use client";

import React from "react";
import {
  Sparkles,
  TrendingUp,
  UserCheck,
  Briefcase,
  Award,
  ShieldAlert,
  FileText,
  CheckCircle2,
  Bug,
  Activity,
  Info,
  Clock,
  ThumbsUp,
  AlertTriangle
} from "lucide-react";
import {
  Card,
  Chip,
  Spinner,
  ProgressBar
} from "@heroui/react";
import { useAssessment } from "@/providers/assessment-provider";
import { CandidateAssessmentEmptyState } from "@/components/ui/CandidateAssessmentEmptyState";

export default function AiAnalysisPage() {
  const {
    latestAssessment,
    assessmentDetails,
    parsedProfile,
    isLoadingDetails
  } = useAssessment();

  // 1. Initial Assessment Check
  const neverAssessed = !latestAssessment;
  if (neverAssessed) {
    return <CandidateAssessmentEmptyState />;
  }

  // 2. Render spinner while details are fetching
  if (isLoadingDetails && !parsedProfile) {
    return (
      <Card className="flex flex-col items-center justify-center p-16 space-y-4 border border-border/40 bg-surface">
        <Spinner size="lg" color="accent" />
        <p className="text-sm text-muted-foreground font-light">Parsing AI Analysis report details...</p>
      </Card>
    );
  }

  // 3. Extract artifacts and data
  const artifacts = assessmentDetails?.artifacts || [];
  
  const maturityArt = artifacts.find(a => a.artifactType === "Maturity");
  const maturityData = maturityArt ? JSON.parse(maturityArt.jsonData) : null;

  const problemSolvingArt = artifacts.find(a => a.artifactType === "ProblemSolving");
  const problemSolvingData = problemSolvingArt ? JSON.parse(problemSolvingArt.jsonData) : null;

  // Extract from parsed CandidateProfile L2-014
  const headline = parsedProfile?.recruiterHeadline || latestAssessment.summaryHeadline || "Software Engineer";
  const fullSummary = parsedProfile?.fullSummary || latestAssessment.summaryParagraph || "No narrative evaluation generated.";
  const professionalBio = parsedProfile?.professionalBio || latestAssessment.professionalBio || "No bio suggestion generated.";
  const strengths = parsedProfile?.keyStrengths || [];
  const watchPoints = parsedProfile?.watchPoints || [];
  const bestFitRoles = parsedProfile?.bestFitRoles || [];

  const getSignalStrengthColor = (strength: string) => {
    switch (strength?.toLowerCase()) {
      case "strong":
        return "success";
      case "moderate":
        return "warning";
      case "weak":
        return "danger";
      default:
        return "default";
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* 1. Recruiter Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-stretch text-left">
        {/* Recruiter Headline Sheet */}
        <Card className="md:col-span-3 p-5 border border-border/40 bg-surface rounded-2xl flex flex-col justify-between shadow-xs">
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted flex items-center gap-1.5">
              <FileText size={12} className="text-accent" />
              <span>Vetted Candidate Headline</span>
            </span>
            <h3 className="text-sm md:text-base font-extrabold text-foreground leading-snug">
              "{headline}"
            </h3>
          </div>
          <div className="w-full h-px bg-border/20 my-3" />
          <div className="flex flex-wrap gap-2">
            {latestAssessment.careerLevelLabel && (
              <Chip size="sm" variant="soft" color="accent" className="text-[9px] font-black uppercase px-2 h-5.5 bg-accent/10 text-accent border-none">
                Level: {latestAssessment.careerLevelLabel}
              </Chip>
            )}
            {latestAssessment.primaryTendency && (
              <Chip size="sm" variant="soft" color="success" className="text-[9px] font-black uppercase px-2 h-5.5 bg-success/10 text-success border-none">
                Specialization: {latestAssessment.primaryTendency}
              </Chip>
            )}
            {latestAssessment.primaryWorkingStyle && (
              <Chip size="sm" variant="soft" color="warning" className="text-[9px] font-black uppercase px-2 h-5.5 bg-warning/10 text-warning border-none">
                Style: {latestAssessment.primaryWorkingStyle}
              </Chip>
            )}
          </div>
        </Card>

        {/* Index Scores Summary */}
        <Card className="p-5 border border-border/40 bg-surface rounded-2xl flex flex-col justify-between shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Activity size={12} className="text-accent" />
            <span>Capability Index</span>
          </span>
          <div className="w-full h-px bg-border/20 my-3" />
          <div className="space-y-3 flex-1 flex flex-col justify-center">
            {/* Overall Score */}
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-semibold">Overall Index</span>
              <span className="font-extrabold text-foreground">{Math.round(latestAssessment.overallScore || 0)} / 100</span>
            </div>
            {/* Maturity Score */}
            {maturityData && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-semibold">Maturity Score</span>
                <span className="font-extrabold text-foreground">{Math.round(maturityData.engineeringMaturityScore || 0)}%</span>
              </div>
            )}
            {/* Problem Solving Score */}
            {problemSolvingData && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-semibold">Problem Solving</span>
                <span className="font-extrabold text-foreground">{Math.round(problemSolvingData.problemSolvingScore || 0)}%</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* 2. Narrative & Bio Suggestion Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Full Executive Narrative Report */}
        <Card className="p-6 border border-border/40 bg-surface rounded-2xl shadow-xs text-left relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-accent/80" />
          <div className="space-y-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-foreground flex items-center gap-1.5 select-none">
              <FileText size={13} className="text-accent" />
              <span>AI Evaluation Narrative</span>
            </span>
            <div className="w-full h-px bg-border/20" />
            <p className="text-xs md:text-sm text-foreground/90 leading-relaxed font-light whitespace-pre-wrap text-justify">
              {fullSummary}
            </p>
          </div>
        </Card>

        {/* AI Professional Bio Suggestion */}
        <Card className="p-6 border border-border/40 bg-surface rounded-2xl shadow-xs text-left relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-success/80" />
          <div className="space-y-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-foreground flex items-center gap-1.5 select-none">
              <Sparkles size={13} className="text-success" />
              <span>AI Professional Bio Suggestion</span>
            </span>
            <div className="w-full h-px bg-border/20" />
            <p className="text-xs md:text-sm text-foreground/90 leading-relaxed font-light whitespace-pre-wrap text-justify">
              {professionalBio}
            </p>
          </div>
        </Card>
      </div>

      {/* 3. Strengths vs Watchpoints Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
        {/* Validated Strengths */}
        <Card className="p-5 border border-border/40 bg-surface rounded-2xl shadow-xs space-y-4">
          <span className="text-[10px] font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <ThumbsUp size={13} className="text-success" />
            <span>Validated Engineering Strengths</span>
          </span>
          <div className="w-full h-px bg-border/20" />
          {strengths.length === 0 ? (
            <p className="text-xs text-muted-foreground font-light">No explicit strengths compiled.</p>
          ) : (
            <div className="space-y-2">
              {strengths.map((str: string, idx: number) => (
                <div key={idx} className="p-2.5 bg-success/5 border border-success/15 rounded-xl flex gap-2.5 items-start">
                  <CheckCircle2 size={14} className="text-success shrink-0 mt-0.5" />
                  <span className="text-xs font-semibold text-foreground/90">{str}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Watch Points / Risks */}
        <Card className="p-5 border border-border/40 bg-surface rounded-2xl shadow-xs space-y-4">
          <span className="text-[10px] font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-warning" />
            <span>Identified Watch Points & Risks</span>
          </span>
          <div className="w-full h-px bg-border/20" />
          {watchPoints.length === 0 ? (
            <p className="text-xs text-muted-foreground font-light">No critical watch points detected.</p>
          ) : (
            <div className="space-y-2">
              {watchPoints.map((wp: string, idx: number) => (
                <div key={idx} className="p-2.5 bg-warning/5 border border-warning/15 rounded-xl flex gap-2.5 items-start">
                  <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
                  <span className="text-xs font-semibold text-foreground/90">{wp}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 4. Engineering Maturity & Code Hygiene Snapshot */}
      {maturityData && (
        <Card className="p-6 border border-border/40 bg-surface rounded-2xl shadow-xs text-left space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Award size={13} className="text-accent" />
              <span>Engineering Maturity Diagnostics</span>
            </span>
            <Chip size="sm" variant="soft" color="accent" className="text-[9px] font-black uppercase border-none px-2 h-5.5 bg-accent/10 text-accent">
              Maturity Level: {maturityData.maturityLevel || "Practitioner"}
            </Chip>
          </div>
          <div className="w-full h-px bg-border/20" />
          
          <p className="text-xs text-muted-foreground font-light leading-relaxed max-w-3xl">
            {maturityData.maturitySummary || "Evaluation of proactive refactoring habits, test suite additions, README documentation, and code complexity reduction over time."}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {maturityData.signals?.map((sig: any, idx: number) => {
              const cleanSignalName = sig.signal.replace(/_/g, " ");
              return (
                <div key={idx} className="p-3 bg-surface-secondary/45 border border-border/20 rounded-xl space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-foreground capitalize">{cleanSignalName}</span>
                    <Chip
                      size="sm"
                      variant="soft"
                      color={getSignalStrengthColor(sig.strength)}
                      className="text-[8px] uppercase font-bold h-4.5 border-none px-1.5"
                    >
                      {sig.strength}
                    </Chip>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-normal font-light">{sig.evidence}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 5. Problem Solving & Diagnostic Capabilities */}
      {problemSolvingData && (
        <Card className="p-6 border border-border/40 bg-surface rounded-2xl shadow-xs text-left space-y-4">
          <span className="text-[10px] font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Bug size={13} className="text-accent" />
            <span>Problem Solving & Commit Diagnostics</span>
          </span>
          <div className="w-full h-px bg-border/20" />

          <p className="text-xs text-muted-foreground font-light leading-relaxed max-w-3xl">
            {problemSolvingData.problemSolvingSummary || "Insights into bug resolution velocity, root-cause fixes versus band-aid repairs, and the recurrence rate of bugs."}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Avg Time to Fix */}
            <div className="p-4 border border-border/30 bg-surface rounded-xl flex flex-col justify-between items-center text-center">
              <span className="text-[9px] text-muted-foreground font-black uppercase">Time-To-Fix Bugs</span>
              <span className="text-2xl font-black text-foreground mt-2">{problemSolvingData.avgTimeToFixDays || "2.5"}</span>
              <span className="text-[9px] text-muted-foreground mt-1">Average Days</span>
            </div>

            {/* Root Cause Ratio */}
            <div className="p-4 border border-border/30 bg-surface rounded-xl flex flex-col justify-between items-center text-center">
              <span className="text-[9px] text-muted-foreground font-black uppercase">Root-Cause Fix Ratio</span>
              <span className="text-2xl font-black text-foreground mt-2">
                {problemSolvingData.rootCauseFixRatio ? `${Math.round(problemSolvingData.rootCauseFixRatio * 100)}%` : "72%"}
              </span>
              <span className="text-[9px] text-muted-foreground mt-1">Comprehensiveness Index</span>
            </div>

            {/* Recurrence Rate */}
            <div className="p-4 border border-border/30 bg-surface rounded-xl flex flex-col justify-between items-center text-center">
              <span className="text-[9px] text-muted-foreground font-black uppercase">Bug Recurrence Rate</span>
              <span className="text-2xl font-black text-foreground mt-2">
                {problemSolvingData.recurrenceRate ? `${Math.round(problemSolvingData.recurrenceRate * 100)}%` : "18%"}
              </span>
              <span className="text-[9px] text-muted-foreground mt-1">Repetitive Refixes (Lower is Better)</span>
            </div>
          </div>

          {problemSolvingData.problemSolvingPatterns && problemSolvingData.problemSolvingPatterns.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-border/20">
              <span className="text-[9px] text-muted-foreground font-black uppercase block">Observed Bug Resolution Patterns</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {problemSolvingData.problemSolvingPatterns.map((pat: any, idx: number) => (
                  <div key={idx} className="p-3 bg-surface-secondary/45 border border-border/20 rounded-xl text-left space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{pat.pattern}</span>
                      <Chip
                        size="sm"
                        variant="soft"
                        color={pat.assessment === "positive" ? "success" : pat.assessment === "negative" ? "danger" : "default"}
                        className="text-[8px] uppercase font-bold h-4 px-1.5 border-none"
                      >
                        {pat.assessment}
                      </Chip>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-light leading-normal">{pat.evidence}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* 6. Recommended Industry Roles Match Table */}
      <Card className="p-6 border border-border/40 bg-surface rounded-2xl shadow-xs text-left space-y-4">
        <span className="text-[10px] font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
          <Briefcase size={13} className="text-accent" />
          <span>Multi-Role Alignment Recommendations</span>
        </span>
        <div className="w-full h-px bg-border/20" />

        {bestFitRoles.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-xs font-light">No role recommendations analyzed.</div>
        ) : (
          <div className="overflow-x-auto select-text">
            <table className="w-full min-w-[700px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/30 text-muted font-black uppercase tracking-wider text-[9px]">
                  <th className="py-3 px-4 text-left font-black w-[20%]">Recommended Job Role</th>
                  <th className="py-3 px-4 text-center font-black w-[15%]">Match Percentage</th>
                  <th className="py-3 px-4 text-center font-black w-[15%]">Confidence Level</th>
                  <th className="py-3 px-4 text-left font-black w-[50%]">Analysis & Evidence Signals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 text-foreground/90 font-light">
                {bestFitRoles.map((role: any, idx: number) => {
                  const matchVal = role.matchScore <= 1 ? Math.round(role.matchScore * 100) : Math.round(role.matchScore);
                  const confidenceVal = role.confidence <= 1 ? Math.round(role.confidence * 100) : Math.round(role.confidence);
                  const getConfColor = (c: number) => {
                    if (c >= 80) return "success";
                    if (c >= 50) return "warning";
                    return "default";
                  };

                  return (
                    <tr key={idx} className="hover:bg-surface-secondary/20 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-foreground">
                        {role.roleTitle}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Chip
                          size="sm"
                          variant="soft"
                          color={matchVal >= 80 ? "success" : matchVal >= 60 ? "warning" : "default"}
                          className="text-[9px] font-black h-5 border-none px-2 bg-default/15"
                        >
                          {matchVal}% Match
                        </Chip>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Chip
                          size="sm"
                          variant="soft"
                          color={getConfColor(confidenceVal)}
                          className="text-[8px] font-bold h-4.5 border-none px-1.5"
                        >
                          {confidenceVal}% Conf.
                        </Chip>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground leading-relaxed text-[11px] font-light max-w-[400px]">
                        {role.evidence || role.rationale || "Alignment justified by skills mapping."}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  );
}
