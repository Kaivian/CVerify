'use client';

import React from 'react';
import { Typography, Card, Chip, ProgressCircle, ProgressBar } from '@heroui/react';
import { ShieldCheck, CheckCircle2, Award, Zap, GitCommit, Search, Sparkles } from 'lucide-react';
import { type CandidateAssessmentDetailResponse } from '@/types/profile.types';

interface AiAssessmentTabProps {
  assessmentDetail: CandidateAssessmentDetailResponse;
  fullName: string;
}

export function AiAssessmentTab({ assessmentDetail, fullName }: AiAssessmentTabProps) {
  const { assessment, artifacts } = assessmentDetail;

  // Extract CandidateProfile artifact
  const profileArtifact = artifacts.find((a) => a.artifactType === 'CandidateProfile');
  const profileData = profileArtifact ? JSON.parse(profileArtifact.jsonData) : null;

  // Extract other artifacts if available
  const strengthsGapsArtifact = artifacts.find((a) => a.artifactType === 'StrengthsGaps');
  const strengthsGapsData = strengthsGapsArtifact ? JSON.parse(strengthsGapsArtifact.jsonData) : null;

  const score = assessment.overallScore ?? profileData?.candidateScore ?? 0.0;
  const careerLevel = assessment.careerLevelLabel ?? profileData?.careerLevelLabel ?? 'Middle';
  const levelCode = assessment.careerLevel ?? profileData?.careerLevel ?? 'L2';
  const primaryTendency = assessment.primaryTendency ?? profileData?.primaryTendency ?? 'Backend';
  const primaryWorkingStyle = assessment.primaryWorkingStyle ?? profileData?.primaryWorkingStyle ?? 'Feature Builder';
  const summaryHeadline = assessment.summaryHeadline ?? profileData?.recruiterHeadline ?? '';
  const summaryParagraph = assessment.summaryParagraph ?? profileData?.fullSummary ?? '';

  const keyStrengths: string[] = profileData?.keyStrengths || strengthsGapsData?.overallStrengthSummary ? [strengthsGapsData.overallStrengthSummary] : [];
  const skillProficiencies: any[] = profileData?.skillProficiencies || [];

  return (
    <div className="flex flex-col gap-8 text-left">
      {/* 1. Header Banner */}
      <div className="p-6 border border-border rounded-xl bg-surface-secondary/35 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
        <div className="flex flex-col gap-2 min-w-0 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 select-none">
            <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase bg-success/15 text-success border border-success/30 rounded-full flex items-center gap-1">
              <ShieldCheck className="size-2.5" />
              AI Verified
            </span>
            <span className="text-[10px] text-muted font-medium">
              Version {assessment.pipelineVersion || '2.1.0'}
            </span>
          </div>
          <h3 className="text-xl font-bold text-foreground mt-1">
            AI Verified Talent Assessment
          </h3>
          <p className="text-xs text-muted leading-relaxed max-w-xl">
            This assessment represents a verified evaluation of {fullName || 'the candidate'}&apos;s code submissions, architectural patterns, and development metrics. All results are strictly backed by repository evidence.
          </p>
        </div>

        {/* Circular Dial score */}
        <div className="relative flex items-center justify-center shrink-0 select-none">
          <ProgressCircle aria-label="Overall Score" value={score} size="lg" className="w-24 h-24">
            <ProgressCircle.Track strokeWidth={4}>
              <ProgressCircle.TrackCircle strokeWidth={4} />
              <ProgressCircle.FillCircle strokeWidth={4} className="stroke-accent" />
            </ProgressCircle.Track>
          </ProgressCircle>
          <div className="absolute flex flex-col items-center justify-center">
            <span className="text-2xl font-black font-outfit leading-none">{score}</span>
            <span className="text-[8px] font-bold text-muted uppercase tracking-wider mt-0.5">VERIFIED</span>
          </div>
        </div>
      </div>

      {/* 2. Credentials snapshot cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 border border-border rounded-xl bg-surface flex items-start gap-3.5 shadow-xs">
          <div className="p-2 bg-default rounded-lg text-foreground/80 shrink-0">
            <Award className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider">Career Level</span>
            <span className="text-sm font-bold text-foreground">{careerLevel} ({levelCode})</span>
          </div>
        </div>

        <div className="p-4 border border-border rounded-xl bg-surface flex items-start gap-3.5 shadow-xs">
          <div className="p-2 bg-default rounded-lg text-foreground/80 shrink-0">
            <Sparkles className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider">Primary Affinity</span>
            <span className="text-sm font-bold text-foreground">{primaryTendency}</span>
          </div>
        </div>

        <div className="p-4 border border-border rounded-xl bg-surface flex items-start gap-3.5 shadow-xs">
          <div className="p-2 bg-default rounded-lg text-foreground/80 shrink-0">
            <GitCommit className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider">Working Style</span>
            <span className="text-sm font-bold text-foreground">{primaryWorkingStyle}</span>
          </div>
        </div>
      </div>

      {/* 3. Summary Headline & Paragraph */}
      <div className="flex flex-col gap-3">
        {summaryHeadline && (
          <h4 className="text-lg font-bold text-foreground leading-snug">
            &ldquo;{summaryHeadline}&rdquo;
          </h4>
        )}
        {summaryParagraph && (
          <p className="text-muted text-sm leading-relaxed whitespace-pre-line">
            {summaryParagraph}
          </p>
        )}
      </div>

      {/* 4. Strengths & Skills Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 border-t border-separator pt-6">
        {/* Left: Verified Key Strengths */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground select-none">
            Verified Key Strengths
          </h4>
          {keyStrengths.length > 0 ? (
            <div className="flex flex-col gap-3.5">
              {keyStrengths.map((str, idx) => (
                <div key={idx} className="flex gap-2.5 text-xs text-muted leading-relaxed">
                  <CheckCircle2 className="size-4 text-success shrink-0 mt-0.5" />
                  <span>{str}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted italic">No specific strengths mapped yet.</p>
          )}
        </div>

        {/* Right: Technical Capabilities Map */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground select-none">
            Verified Skill Proficiencies
          </h4>
          {skillProficiencies.length > 0 ? (
            <div className="flex flex-col gap-4">
              {skillProficiencies.map((prof, idx) => {
                const levelVal = typeof prof.proficiencyLevel === 'number' ? prof.proficiencyLevel : 2;
                const percent = levelVal * 25;
                return (
                  <div key={idx} className="flex flex-col gap-1.5 p-3 border border-border rounded-lg bg-default/20">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-foreground">{prof.skill}</span>
                      <span className="text-accent">{prof.proficiencyLabel || 'Working'} (Level {levelVal}/4)</span>
                    </div>
                    <ProgressBar aria-label={prof.skill} value={percent} size="sm" className="h-1.5 bg-border rounded-full" />
                    {prof.evidenceRationale && (
                      <span className="text-[10px] text-muted italic mt-0.5 leading-normal">
                        Evidence: {prof.evidenceRationale}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted italic">No skill proficiencies evaluated.</p>
          )}
        </div>
      </div>

      {/* Metadata / Trust signals footer */}
      <div className="text-[10px] text-muted/65 flex flex-wrap gap-x-6 gap-y-2 pt-6 border-t border-separator select-none">
        <span>Evaluated Model: {assessment.modelVersion || 'Gemini'}</span>
        <span>Prompt Template: {assessment.promptVersion || 'v2.1'}</span>
        <span>Schema Version: {assessment.assessmentSchemaVersion || '1.1'}</span>
        {assessment.completedAtUtc && (
          <span>Calculation Date: {new Date(assessment.completedAtUtc).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );
}
