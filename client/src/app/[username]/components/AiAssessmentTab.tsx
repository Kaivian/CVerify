'use client';

import React, { useState } from 'react';
import { Chip, ProgressCircle, ProgressBar, Tooltip, Skeleton, Button } from '@heroui/react';
import {
  ShieldCheck,
  CheckCircle2,
  Award,
  Sparkles,
  GitCommit,
  Clock,
  HelpCircle,
  Info,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ShieldAlert,
  GitFork
} from 'lucide-react';
import { type CandidateAssessmentDetailResponse, type PublicRepository } from '@/types/profile.types';

// ==========================================
// 1. Interfaces & Types
// ==========================================

export interface NormalizedSkill {
  name: string;
  score: number;
  level: string;
  confidence: number;
  rationale: string;
  verificationLevel: 'AiAnalyzed' | 'SelfDeclared' | 'Unverified';
  repositories: Array<{
    name: string;
    confidence: number;
    contributionWeight: number;
  }>;
}

export interface NormalizedRepoEvidence {
  id: string;
  name: string;
  verificationLevel: string;
  ownershipPercent: number;
  contributionPercent: number;
  trustLevel: number;
}

export interface NormalizedRecommendation {
  id: string;
  priority: 'High' | 'Medium' | 'Low';
  dimension: string;
  observation: string;
  action: string;
  scoreBoost: number;
}

export interface NormalizedAssessmentViewModel {
  status: 'Completed' | 'Failed' | 'Running' | 'Legacy';
  failureReason: string | null;
  pipelineVersion: string;
  calculationDate: string | null;
  modelName: string;
  promptVersion: string;
  schemaVersion: string;

  overallScore: number;
  careerLevel: string;
  careerLevelLabel: string;
  careerLevelConfidence: number;
  primaryAffinity: string;
  workingStyle: string;
  headline: string;
  summary: string;

  trustScore: number;
  verifiedSkillRatio: number;
  verifiedRepositoryRatio: number;
  verifiedEvidenceRatio: number;

  dimensions: {
    skillDepth: number;
    ownership: number;
    architecture: number;
    problemSolving: number;
    impact: number;
  };

  keyStrengths: string[];
  watchPoints: string[];
  bestFitRoles: Array<{
    title: string;
    matchScore: number;
    rationale: string;
    rank: number;
  }>;
  skills: NormalizedSkill[];
  evidenceGovernance: NormalizedRepoEvidence[];

  improvementPlan: {
    summary: string;
    targetLevel: string;
    scorePotential: number;
    recommendations: NormalizedRecommendation[];
  } | null;
}

// ==========================================
// 2. Metadata Configurations
// ==========================================

const CAPABILITY_PILLARS = [
  {
    key: 'skillDepth',
    label: 'Skill Depth',
    description: 'Technical proficiency and framework complexity across primary stacks.',
    tooltip: 'Evaluates the language and library complexity used in your commits. Higher depth indicates advanced language features usage.',
    color: 'accent',
    icon: Award
  },
  {
    key: 'ownership',
    label: 'Authorship & Ownership',
    description: 'Commit density, active authoring ratio, and codebase stewardship.',
    tooltip: 'Measures commit volume and lines-of-code authorship. Requires a minimum of 30% repository ownership to pass verification.',
    color: 'success',
    icon: GitCommit
  },
  {
    key: 'architecture',
    label: 'Architecture & Decoupling',
    description: 'Modularity, application of design patterns, and unit test coverage.',
    tooltip: 'Scored based on decoupled design layers, package structuring, unit test suites, and consistent module separation.',
    color: 'accent',
    icon: GitFork
  },
  {
    key: 'problemSolving',
    label: 'Problem Solving & Quality',
    description: 'Bug fix efficiency, regression rate, and complex defect handling.',
    tooltip: 'Analyzes bug-related commits: time-to-fix, bug recurrence rates, and code complexity in bug fix branches.',
    color: 'success',
    icon: Sparkles
  },
  {
    key: 'impact',
    label: 'Codebase Impact & Value',
    description: 'Feature scope, critical path edits, and project volume contribution.',
    tooltip: 'Calculates the volume of changes in core modules vs. peripheral files, measuring business value delivery.',
    color: 'accent',
    icon: TrendingUp
  }
] as const;

const TRUST_SCORE_METRICS = [
  {
    key: 'verifiedSkillRatio',
    label: 'Skill Match Rate',
    tooltip: 'Percentage of CV skills that match verified repository technologies.',
    format: (val: number) => `${Math.round(val * 100)}%`,
  },
  {
    key: 'verifiedRepositoryRatio',
    label: 'Repository Gate Pass Rate',
    tooltip: 'Percentage of connected repositories that pass authorship verification rules (e.g. minimum 30% direct code ownership).',
    format: (val: number) => `${Math.round(val * 100)}%`,
  },
  {
    key: 'verifiedEvidenceRatio',
    label: 'Evidence Strength',
    tooltip: 'The ratio of overall assessment score backed directly by verifiable code evidence.',
    format: (val: number) => `${Math.round(val * 100)}%`,
  },
] as const;

interface AiAssessmentTabProps {
  assessmentDetail: CandidateAssessmentDetailResponse;
  fullName: string;
  repositories?: PublicRepository[] | null;
}

// ==========================================
// 3. Normalization Mapper Function
// ==========================================

function mapToViewModel(
  assessmentDetail: CandidateAssessmentDetailResponse | null,
  repositories?: PublicRepository[] | null
): NormalizedAssessmentViewModel {
  if (!assessmentDetail || !assessmentDetail.assessment) {
    return {
      status: 'Running',
      failureReason: null,
      pipelineVersion: '3.0.0',
      calculationDate: null,
      modelName: 'Gemini',
      promptVersion: 'v2.1',
      schemaVersion: 'candidate-profile-v2',
      overallScore: 0,
      careerLevel: 'L2',
      careerLevelLabel: 'Middle',
      careerLevelConfidence: 0.8,
      primaryAffinity: '',
      workingStyle: '',
      headline: '',
      summary: '',
      trustScore: 0,
      verifiedSkillRatio: 0,
      verifiedRepositoryRatio: 0,
      verifiedEvidenceRatio: 0,
      dimensions: { skillDepth: 0, ownership: 0, architecture: 0, problemSolving: 0, impact: 0 },
      keyStrengths: [],
      watchPoints: [],
      bestFitRoles: [],
      skills: [],
      evidenceGovernance: [],
      improvementPlan: null
    };
  }

  const { assessment, artifacts } = assessmentDetail;

  const profileArtifact = artifacts.find((a) => a.artifactType === 'CandidateProfile');
  const profileData = profileArtifact ? JSON.parse(profileArtifact.jsonData) : null;

  const improvementPlanArtifact = artifacts.find((a) => a.artifactType === 'ImprovementPlan');
  const improvementPlanData = improvementPlanArtifact ? JSON.parse(improvementPlanArtifact.jsonData) : null;

  const status = assessment.status || 'Completed';
  const failureReason = assessment.failureReason || null;
  const pipelineVersion = assessment.pipelineVersion || '3.0.0';
  const calculationDate = assessment.completedAtUtc || null;
  const rawModelName = assessment.modelVersion || 'Gemini';
  const modelName = rawModelName === 'gemini-1.5-flash' || rawModelName === 'Gemini' ? 'claude-haiku-4-5-20251001' : rawModelName;
  const promptVersion = assessment.promptVersion || 'v2.1';
  const schemaVersion = profileData?.schemaVersion || 'candidate-profile-v1';

  // Determine if it is a legacy version (e.g. candidate-profile-v1 which lacked detailed capability vector or other dimensions)
  const isLegacy = schemaVersion !== 'candidate-profile-v2' || !profileData?.capabilityVector;

  const score = assessment.overallScore ?? profileData?.candidateScore ?? 0;
  const careerLevel = assessment.careerLevel ?? profileData?.careerLevel ?? 'L2';
  const careerLevelLabel = assessment.careerLevelLabel ?? profileData?.careerLevelLabel ?? 'Middle';
  const careerLevelConfidence = profileData?.careerLevelConfidence ?? profileData?.displayConfidence ?? 0.8;
  const primaryAffinity = assessment.primaryTendency ?? profileData?.primaryTendency ?? '';
  const workingStyle = assessment.primaryWorkingStyle ?? profileData?.primaryWorkingStyle ?? '';
  const headline = assessment.summaryHeadline ?? profileData?.recruiterHeadline ?? '';
  const summary = assessment.summaryParagraph ?? profileData?.fullSummary ?? '';

  const trustScore = profileData?.trustLevel ?? profileData?.trustScoreMetrics?.candidateTrustScore ?? 0;
  const verifiedSkillRatio = profileData?.trustScoreMetrics?.verifiedSkillRatio ?? 0;
  const verifiedRepositoryRatio = profileData?.trustScoreMetrics?.verifiedRepositoryRatio ?? 0;
  const verifiedEvidenceRatio = profileData?.trustScoreMetrics?.verifiedEvidenceRatio ?? 0;

  const vector = profileData?.capabilityVector || {};
  const dimensions = {
    skillDepth: typeof vector.skillDepth === 'number' ? vector.skillDepth : 0,
    ownership: typeof vector.ownership === 'number' ? vector.ownership : 0,
    architecture: typeof vector.architecture === 'number' ? vector.architecture : 0,
    problemSolving: typeof vector.problemSolving === 'number' ? vector.problemSolving : 0,
    impact: typeof vector.impact === 'number' ? vector.impact : 0,
  };

  const keyStrengths = profileData?.keyStrengths || [];
  const watchPoints = profileData?.watchPoints || [];

  const rawRoles = profileData?.bestFitRoles || [];
  const bestFitRoles = rawRoles.map((r: any) => ({
    title: r.roleTitle || '',
    matchScore: typeof r.matchScore === 'number' ? r.matchScore : 0,
    rationale: r.evidence ? JSON.parse(r.evidence)?.rationale || '' : '',
    rank: typeof r.rank === 'number' ? r.rank : 1,
  }));

  const rawSkills = profileData?.skills || [];
  const skills = rawSkills.map((s: any) => {
    let evidenceSources = null;
    try {
      evidenceSources = s.evidenceSources ? JSON.parse(s.evidenceSources) : null;
    } catch {
      // ignore
    }
    const repos = evidenceSources?.metadata?.repositories || [];
    return {
      name: s.skillName || '',
      score: typeof s.score === 'number' ? s.score : 0,
      level: s.level || 'Working',
      confidence: typeof s.confidence === 'number' ? s.confidence : 0,
      rationale: evidenceSources?.rationale || '',
      verificationLevel: evidenceSources?.verification_level || 'Unverified',
      repositories: repos.map((r: any) => ({
        name: r.repositoryName || '',
        confidence: typeof r.confidence === 'number' ? r.confidence : 0,
        contributionWeight: typeof r.contributionWeight === 'number' ? r.contributionWeight : 0,
      })),
    };
  });

  const rawEvidence = profileData?.evidenceGovernance || [];
  const evidenceGovernance = rawEvidence.map((e: any) => {
    const matchedRepo = repositories?.find(
      (r) => r.name.toLowerCase() === e.repositoryName?.toLowerCase() || r.id === e.repositoryId
    );

    let ownershipPercent = 0;
    if (matchedRepo) {
      ownershipPercent = Math.round(matchedRepo.trustScore * 100);
    } else if (typeof e.authorshipPercent === 'number') {
      ownershipPercent = e.authorshipPercent;
    } else if (typeof e.ownershipPercent === 'number') {
      ownershipPercent = e.ownershipPercent;
    } else if (typeof e.trustLevel === 'number' && e.trustLevel > 3) {
      ownershipPercent = e.trustLevel;
    }

    return {
      id: e.repositoryId || '',
      name: e.repositoryName || '',
      verificationLevel: e.cvVerificationLevel || 'Background',
      ownershipPercent,
      contributionPercent: typeof e.scoreContributionPercent === 'number' ? e.scoreContributionPercent : 0,
      trustLevel: typeof e.trustLevel === 'number' ? e.trustLevel : 0,
    };
  });

  const plan = profileData?.improvementPlan || improvementPlanData;
  const improvementPlan = plan ? {
    summary: plan.summary || '',
    targetLevel: plan.targetLevel || 'L3',
    scorePotential: typeof plan.estimatedScorePotential === 'number' ? plan.estimatedScorePotential : 0,
    recommendations: (plan.recommendations || []).map((r: any) => ({
      id: r.id || '',
      priority: r.priority || 'Medium',
      dimension: r.dimension || '',
      observation: r.observation || '',
      action: r.action || '',
      scoreBoost: r.impact?.scoreBoost || 0,
    })),
  } : null;

  let finalStatus: NormalizedAssessmentViewModel['status'] = 'Completed';
  if (status === 'Failed') {
    finalStatus = 'Failed';
  } else if (status === 'Running' || status === 'Pending') {
    finalStatus = 'Running';
  } else if (isLegacy) {
    finalStatus = 'Legacy';
  }

  return {
    status: finalStatus,
    failureReason,
    pipelineVersion,
    calculationDate,
    modelName,
    promptVersion,
    schemaVersion,
    overallScore: score,
    careerLevel,
    careerLevelLabel,
    careerLevelConfidence,
    primaryAffinity,
    workingStyle,
    headline,
    summary,
    trustScore,
    verifiedSkillRatio,
    verifiedRepositoryRatio,
    verifiedEvidenceRatio,
    dimensions,
    keyStrengths,
    watchPoints,
    bestFitRoles,
    skills,
    evidenceGovernance,
    improvementPlan
  };
}

// ==========================================
// 4. Component Implementation
// ==========================================

export function AiAssessmentTab({ assessmentDetail, fullName, repositories }: AiAssessmentTabProps) {
  const vm = mapToViewModel(assessmentDetail, repositories);

  // States for Progressive Disclosure
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);
  const [skillSearch, setSkillSearch] = useState('');
  const [showAllRepos, setShowAllRepos] = useState(false);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  // ==========================================
  // Render States: 4A. Running / Loading State
  // ==========================================
  if (vm.status === 'Running') {
    return (
      <div className="flex flex-col gap-8 text-left py-4">
        {/* Header Banner Skeleton */}
        <div className="p-6 border border-border rounded-xl bg-surface-secondary/20 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col gap-3 w-full max-w-xl">
            <div className="flex gap-2">
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
            <Skeleton className="h-7 w-3/4 rounded-lg" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-2/3 rounded-md" />
          </div>
          <Skeleton className="size-24 rounded-full shrink-0" />
        </div>

        {/* Pillars Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 border border-border rounded-xl bg-surface flex flex-col gap-3">
              <Skeleton className="size-8 rounded-lg" />
              <Skeleton className="h-3 w-1/2 rounded-md" />
              <Skeleton className="h-4 w-3/4 rounded-md" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>

        {/* Split Section Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-5 w-1/3 rounded-md" />
            <div className="p-5 border border-border rounded-xl bg-surface space-y-4">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-3/4 rounded-md" />
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <Skeleton className="h-5 w-1/3 rounded-md" />
            <div className="p-5 border border-border rounded-xl bg-surface space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // Render States: 4B. Failed State
  // ==========================================
  if (vm.status === 'Failed') {
    return (
      <div className="p-8 border border-danger/20 rounded-2xl bg-danger/5 text-left flex flex-col gap-5 max-w-2xl mx-auto my-8 select-none">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-danger/10 text-danger rounded-xl shrink-0">
            <AlertTriangle className="size-8" />
          </div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <h3 className="text-lg font-extrabold text-foreground">AI Assessment Execution Failed</h3>
            <p className="text-xs text-muted leading-relaxed">
              The automated assessment pipeline encountered a fatal execution error. This usually happens when connected repositories are inaccessible or structured parsing fails.
            </p>
          </div>
        </div>

        {vm.failureReason && (
          <div className="p-4 border border-border rounded-xl bg-surface-secondary/50 flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold text-muted tracking-wider">Failure Details</span>
            <code className="text-xs text-danger font-mono bg-default/45 p-2 rounded-md break-all leading-normal whitespace-pre-wrap">
              {vm.failureReason}
            </code>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button size="sm" className="font-semibold text-xs rounded-xl bg-foreground hover:bg-foreground/90 text-background px-4 h-9">
            Retry Assessment
          </Button>
        </div>
      </div>
    );
  }

  // ==========================================
  // Render Helper for Tooltips
  // ==========================================
  const renderTooltip = (content: string) => (
    <Tooltip delay={0}>
      <Tooltip.Trigger>
        <HelpCircle className="size-3.5 text-muted hover:text-foreground cursor-help shrink-0" />
      </Tooltip.Trigger>
      <Tooltip.Content showArrow className="max-w-xs bg-surface border border-border p-2 shadow-md rounded-lg">
        <span className="text-xs text-foreground leading-normal font-normal">{content}</span>
      </Tooltip.Content>
    </Tooltip>
  );

  // Filter skills based on search term
  const filteredSkills = vm.skills.filter(s =>
    s.name.toLowerCase().includes(skillSearch.toLowerCase())
  );

  // Group skills by verification level
  const aiVerifiedSkills = filteredSkills.filter(s => s.verificationLevel === 'AiAnalyzed');
  const selfDeclaredSkills = filteredSkills.filter(s => s.verificationLevel === 'SelfDeclared');
  const unverifiedSkills = filteredSkills.filter(s => s.verificationLevel === 'Unverified');

  return (
    <div className="flex flex-col gap-8 text-left py-4">

      {/* Legacy Warning Banner */}
      {vm.status === 'Legacy' && (
        <div className="p-4 border border-warning/30 bg-warning/5 rounded-xl flex items-start gap-3 select-none">
          <AlertTriangle className="size-5 text-warning shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <h5 className="text-xs font-bold text-warning">Legacy Assessment Version</h5>
            <p className="text-[11px] text-muted leading-relaxed">
              This assessment was calculated using a previous pipeline version ({vm.pipelineVersion}). Some multi-dimensional capability metrics, pillars, and recommendations are not fully mapped. We recommend re-running the talent assessment.
            </p>
          </div>
        </div>
      )}

      {/* ==========================================
          SECTION 1: Dashboard Header & Trust Dial
          ========================================== */}
      <div className="p-6 border border-border rounded-xl bg-surface flex flex-col lg:flex-row items-center lg:items-start justify-between gap-8 shadow-xs">

        {/* Left: General Assessment Info */}
        <div className="flex flex-col gap-3 min-w-0 w-full lg:max-w-xl text-center lg:text-left">
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 select-none">
            <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase bg-success/10 text-success border border-success/20 rounded-full flex items-center gap-1">
              <ShieldCheck className="size-2.5" />
              AI Verified
            </span>
            <span className="text-[10px] text-muted font-medium">
              Pipeline v{vm.pipelineVersion}
            </span>
          </div>

          <h3 className="text-2xl font-black text-foreground tracking-tight leading-none mt-1 flex items-center justify-center lg:justify-start gap-1.5">
            AI-Verified Talent Assessment
            {renderTooltip("A composite score of engineering depth, ownership, architecture, and complexity normalized against peer cohort values.")}
          </h3>
          <p className="text-xs text-muted leading-relaxed">
            This assessment represents a verified evaluation of {fullName || 'the candidate'}&apos;s code submissions, architectural patterns, and development metrics. All results are strictly backed by repository evidence.
          </p>

          {/* Core metadata row */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-2 mt-2 pt-2 border-t border-separator text-[10px] text-muted select-none">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              Calculated: {vm.calculationDate ? new Date(vm.calculationDate).toLocaleDateString() : 'Pending'}
            </span>
            <span>•</span>
            <span>Model: {vm.modelName}</span>
            <span>•</span>
            <span>Prompt: {vm.promptVersion}</span>
          </div>
        </div>

        {/* Right: Score Dial & Trust breakdown */}
        <div className="flex flex-col sm:flex-row items-center gap-6 shrink-0 w-full lg:w-auto justify-center lg:justify-end">

          {/* Circular Score Dial */}
          <div className="relative flex items-center justify-center shrink-0 select-none">
            <ProgressCircle aria-label="Overall Score" value={vm.overallScore} size="lg" className="w-24 h-24">
              <ProgressCircle.Track strokeWidth={4} className="w-full! h-full!">
                <ProgressCircle.TrackCircle strokeWidth={4} />
                <ProgressCircle.FillCircle strokeWidth={4} className="stroke-accent" />
              </ProgressCircle.Track>
            </ProgressCircle>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-black font-outfit leading-none">{vm.overallScore}</span>
              <span className="text-[8px] font-bold text-muted uppercase tracking-widest mt-1">VERIFIED</span>
            </div>
          </div>

          {/* Trust breakdown card */}
          <div className="p-4 rounded-xl bg-surface-secondary/35 flex flex-col gap-3 min-w-[200px] w-full sm:w-auto">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-black text-foreground tracking-wider flex items-center gap-1.5">
                AI Trust Score
                {renderTooltip("Reliability index indicating how well the candidate's CV matches their verifiable code contributions.")}
              </span>
              <span className="text-xs font-black text-accent font-outfit">{vm.trustScore}%</span>
            </div>
            <div className="flex flex-col gap-2">
              {TRUST_SCORE_METRICS.map((metric) => {
                const val = (vm as any)[metric.key];
                return (
                  <div key={metric.key} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-muted font-semibold flex items-center gap-1">
                        {metric.label}
                        {renderTooltip(metric.tooltip)}
                      </span>
                      <span className="text-foreground font-bold">{metric.format(val)}</span>
                    </div>
                    <ProgressBar aria-label={metric.label} value={val * 100} size="sm" className="h-1 bg-border rounded-full" />
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Legacy Mode Warning Placeholder for Details */}
      {vm.status === 'Legacy' && (
        <div className="p-6 border border-dashed border-border rounded-xl text-center flex flex-col items-center justify-center gap-3">
          <Info className="size-8 text-muted" />
          <h4 className="text-sm font-bold text-foreground">Detailed Capability Dimensions Unavailable</h4>
          <p className="text-xs text-muted max-w-md">
            This candidate assessment has legacy metrics. Re-run the assessment pipeline in the dashboard to generate multi-dimensional vector structures, roadmap progression paths, and detailed repository contribution metrics.
          </p>
        </div>
      )}

      {/* ==========================================
          SECTION 2: Five Capability Pillars
          ========================================== */}
      {vm.status !== 'Legacy' && (
        <div className="flex flex-col gap-4 text-left">
          <h4 className="text-xs font-black uppercase tracking-wider text-foreground select-none flex items-center gap-1.5">
            Capability Vector Space
            {renderTooltip("Deconstructs the candidate's engineering competencies into five objective dimensions mapped directly from codebase signals.")}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {CAPABILITY_PILLARS.map((pillar) => {
              const val = vm.dimensions[pillar.key];
              const Icon = pillar.icon;
              return (
                <div key={pillar.key} className="p-4 border border-border rounded-xl bg-surface flex flex-col justify-between gap-3 shadow-xs">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <div className="p-2 bg-default rounded-lg text-foreground/80 shrink-0">
                        <Icon className="size-4" />
                      </div>
                      <span className="text-lg font-black font-outfit text-foreground">{Math.round(val)}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs font-bold text-foreground truncate">{pillar.label}</span>
                      {renderTooltip(pillar.tooltip)}
                    </div>
                    <p className="text-[10px] text-muted leading-relaxed">
                      {pillar.description}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-separator">
                    <ProgressBar
                      aria-label={pillar.label}
                      value={Math.min(val, 100)}
                      size="sm"
                      className={`h-1.5 rounded-full ${pillar.color === 'success' ? 'bg-success/20' : 'bg-accent/20'}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==========================================
          SECTION 3: Snapshot & Role Alignment (Split columns)
          ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">

        {/* Left: Summary and Credentials */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-foreground select-none">
              Professional Synthesis
            </h4>
            <div className="p-5 border border-border rounded-xl bg-surface flex flex-col gap-4 shadow-xs">
              {vm.headline && (
                <h3 className="text-base font-bold text-foreground leading-snug">
                  &ldquo;{vm.headline}&rdquo;
                </h3>
              )}
              {vm.summary && (
                <p className="text-muted text-xs leading-relaxed whitespace-pre-line">
                  {vm.summary}
                </p>
              )}

              {/* Snapshot Metrics */}
              <div className="grid grid-cols-3 gap-3 border-t border-separator pt-4 mt-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] uppercase font-bold text-muted tracking-wider flex items-center gap-1">
                    Level
                    {renderTooltip("Calibrated seniority level derived from code ownership scope and design patterns.")}
                  </span>
                  <span className="text-xs font-bold text-foreground">{vm.careerLevelLabel} ({vm.careerLevel})</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] uppercase font-bold text-muted tracking-wider flex items-center gap-1">
                    Primary Affinity
                    {renderTooltip("Core technological focus categorized from file density and stack analysis.")}
                  </span>
                  <span className="text-xs font-bold text-foreground">{vm.primaryAffinity || 'Fullstack'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] uppercase font-bold text-muted tracking-wider flex items-center gap-1">
                    Working Style
                    {renderTooltip("The primary contribution archetype mapped from active work sessions and commit behaviors.")}
                  </span>
                  <span className="text-xs font-bold text-foreground">{vm.workingStyle || 'Feature Builder'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Strengths & Watchpoints Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Strengths */}
            <div className="flex flex-col gap-3">
              <h5 className="text-[10px] uppercase font-black tracking-wider text-success flex items-center gap-1">
                Verified Key Strengths
              </h5>
              <div className="p-4 border border-success/15 bg-success/2 rounded-xl flex flex-col gap-2.5 h-full">
                {vm.keyStrengths.length > 0 ? (
                  vm.keyStrengths.map((str, idx) => (
                    <div key={idx} className="flex gap-2 text-[11px] text-muted leading-relaxed">
                      <CheckCircle2 className="size-3.5 text-success shrink-0 mt-0.5" />
                      <span>{str}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-[11px] text-muted italic">No specific strengths listed.</span>
                )}
              </div>
            </div>

            {/* Watchpoints / Gaps */}
            <div className="flex flex-col gap-3">
              <h5 className="text-[10px] uppercase font-black tracking-wider text-danger flex items-center gap-1">
                Watch Points & Gaps
              </h5>
              <div className="p-4 border border-danger/15 bg-danger/2 rounded-xl flex flex-col gap-2.5 h-full">
                {vm.watchPoints.length > 0 ? (
                  vm.watchPoints.map((gap, idx) => (
                    <div key={idx} className="flex gap-2 text-[11px] text-muted leading-relaxed">
                      <ShieldAlert className="size-3.5 text-danger shrink-0 mt-0.5" />
                      <span>{gap}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-[11px] text-muted italic">No critical warning points.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Suggested Roles Map */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-foreground select-none flex items-center gap-1.5">
            Role Archetype Alignment
            {renderTooltip("Maps the capability vector against classic software roles, evaluating matching suitability and confidence indicators.")}
          </h4>

          <div className="p-5 border border-border rounded-xl bg-surface flex flex-col gap-4 shadow-xs h-full justify-between">
            {vm.bestFitRoles.length > 0 ? (
              <div className="flex flex-col gap-4">
                {vm.bestFitRoles.map((role) => (
                  <div key={role.title} className="flex flex-col gap-1.5 p-3.5 border border-border rounded-xl bg-surface-secondary/40 hover:bg-surface-secondary/60 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-default flex items-center justify-center text-[10px] font-black">{role.rank}</span>
                        <span className="text-xs font-bold text-foreground">{role.title}</span>
                      </div>
                      <Chip size="sm" className="bg-accent/10 text-accent font-bold font-outfit border-none h-5">
                        {Math.round(role.matchScore)}% Match
                      </Chip>
                    </div>
                    {role.rationale && (
                      <p className="text-[10px] text-muted leading-relaxed pl-7">
                        {role.rationale}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center gap-2">
                <Sparkles className="size-8 text-muted/40" />
                <span className="text-xs text-muted italic">No role archetypes mapped yet.</span>
              </div>
            )}

            <div className="text-[9px] text-muted leading-relaxed border-t border-separator pt-3">
              Matches are derived from repository content categories, commit timeline structures, and design complexity ratios.
            </div>
          </div>
        </div>

      </div>

      {/* ==========================================
          SECTION 4: Verified Skill Proficiencies
          ========================================== */}
      <div className="flex flex-col gap-4 text-left border-t border-separator pt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-foreground select-none flex items-center gap-1.5">
            Technical Skill Ledger
            {renderTooltip("A complete audit of skills declared on the CV. Green-badged skills have confirmed code repository evidence.")}
          </h4>

          {/* Search bar inside progressive disclosure */}
          <div className="relative max-w-xs w-full">
            <input
              type="text"
              placeholder="Search audited skills..."
              value={skillSearch}
              onChange={(e) => setSkillSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-border bg-surface-secondary/35 focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-muted/65"
            />
          </div>
        </div>

        {filteredSkills.length > 0 ? (
          <div className="flex flex-col gap-6">

            {/* Split Skills by Verification Type */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Group A: AI Verified (Evidence backed) */}
              <div className="flex flex-col gap-3">
                <span className="text-[10px] uppercase font-black text-success tracking-wider select-none flex items-center gap-1.5">
                  AI-Verified Skills
                  <Chip size="sm" className="bg-success/10 text-success text-[8px] h-4 min-h-4 border-none font-bold">{aiVerifiedSkills.length}</Chip>
                </span>
                <div className="flex flex-col gap-2.5">
                  {aiVerifiedSkills.length > 0 ? (
                    aiVerifiedSkills.map(s => renderSkillCard(s))
                  ) : (
                    <span className="text-[10px] text-muted italic">No verified skills found.</span>
                  )}
                </div>
              </div>

              {/* Group B: Self Declared (Linked project only) */}
              <div className="flex flex-col gap-3">
                <span className="text-[10px] uppercase font-black text-accent tracking-wider select-none flex items-center gap-1.5">
                  Self-Declared (Linked)
                  <Chip size="sm" className="bg-accent/10 text-accent text-[8px] h-4 min-h-4 border-none font-bold">{selfDeclaredSkills.length}</Chip>
                </span>
                <div className="flex flex-col gap-2.5">
                  {selfDeclaredSkills.length > 0 ? (
                    selfDeclaredSkills.map(s => renderSkillCard(s))
                  ) : (
                    <span className="text-[10px] text-muted italic">No self-declared linked skills.</span>
                  )}
                </div>
              </div>

              {/* Group C: Unverified */}
              <div className="flex flex-col gap-3">
                <span className="text-[10px] uppercase font-black text-muted tracking-wider select-none flex items-center gap-1.5">
                  Unverified / Declarative Only
                  <Chip size="sm" className="bg-default text-muted-foreground text-[8px] h-4 min-h-4 border-none font-bold">{unverifiedSkills.length}</Chip>
                </span>
                <div className="flex flex-col gap-2.5">
                  {unverifiedSkills.length > 0 ? (
                    unverifiedSkills.map(s => renderSkillCard(s))
                  ) : (
                    <span className="text-[10px] text-muted italic">No unverified skills listed.</span>
                  )}
                </div>
              </div>

            </div>

          </div>
        ) : (
          <p className="text-xs text-muted italic py-4">No matching skills found.</p>
        )}
      </div>

      {/* ==========================================
          SECTION 5: Actionable Improvement Plan
          ========================================== */}
      {vm.status !== 'Legacy' && vm.improvementPlan && (
        <div className="flex flex-col gap-4 text-left border-t border-separator pt-8">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-foreground select-none flex items-center gap-1.5">
              Level Progression Path
              {renderTooltip("Actionable roadmap generated by analyzing score gaps against target seniority level vectors.")}
            </h4>

            <div className="flex items-center gap-3 select-none">
              <span className="text-[10px] text-muted font-semibold">Current: <b className="text-foreground">{vm.careerLevelLabel} ({vm.careerLevel})</b></span>
              <span className="text-[10px] text-muted font-semibold">Target: <b className="text-accent">{vm.improvementPlan.targetLevel}</b></span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

            {/* Plan Info Card */}
            <div className="lg:col-span-4 p-5 border border-accent/20 bg-accent/2 rounded-xl flex flex-col justify-between gap-5 shadow-xs">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase font-black text-accent tracking-wider flex items-center gap-1.5">
                  Progress Estimate
                </span>
                <h5 className="text-sm font-bold text-foreground mt-1">
                  Improvement Plan Summary
                </h5>
                <p className="text-xs text-muted leading-relaxed">
                  {vm.improvementPlan.summary}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-separator pt-4 select-none">
                <span className="text-[10px] uppercase font-bold text-muted tracking-wider flex items-center gap-1">
                  Score Potential
                  {renderTooltip("Estimated overall capability score if the High and Medium recommendations are resolved.")}
                </span>
                <span className="text-xl font-black text-accent font-outfit">{vm.overallScore} → {vm.improvementPlan.scorePotential}</span>
              </div>
            </div>

            {/* Recommendations Roadmap List */}
            <div className="lg:col-span-8 flex flex-col gap-3">
              {vm.improvementPlan.recommendations.length > 0 ? (
                (() => {
                  const items = showAllRecommendations
                    ? vm.improvementPlan.recommendations
                    : vm.improvementPlan.recommendations.slice(0, 2);

                  return (
                    <div className="flex flex-col gap-3">
                      {items.map((rec) => (
                        <div key={rec.id} className="p-4 border border-border rounded-xl bg-surface flex flex-col sm:flex-row sm:items-start justify-between gap-4 shadow-xs">
                          <div className="flex items-start gap-3 min-w-0">
                            <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-full shrink-0 mt-0.5 select-none ${rec.priority === 'High' ? 'bg-danger/10 text-danger border border-danger/15' : 'bg-warning/10 text-warning border border-warning/15'
                              }`}>
                              {rec.priority} PRIORITY
                            </span>
                            <div className="flex flex-col gap-1 min-w-0">
                              <span className="text-[10px] uppercase font-bold text-muted tracking-wider">{rec.id} • {rec.dimension.toUpperCase()}</span>
                              <p className="text-xs font-bold text-foreground leading-normal mt-0.5">{rec.observation}</p>
                              <p className="text-xs text-muted leading-normal mt-1 bg-surface-secondary/40 p-2.5 border border-border/50 rounded-lg">
                                <b>Action:</b> {rec.action}
                              </p>
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1 shrink-0 select-none">
                            <span className="text-[9px] uppercase font-bold text-muted tracking-wider">Est. Boost</span>
                            <span className="text-sm font-black text-success font-outfit">+{rec.scoreBoost} pts</span>
                          </div>
                        </div>
                      ))}

                      {/* Progressive Disclosure Toggle */}
                      {vm.improvementPlan.recommendations.length > 2 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="font-bold text-xs text-accent hover:text-accent/80 flex items-center justify-center gap-1"
                          onClick={() => setShowAllRecommendations(!showAllRecommendations)}
                        >
                          {showAllRecommendations ? (
                            <>
                              Collapse Recommendations
                              <ChevronUp className="size-4" />
                            </>
                          ) : (
                            <>
                              Show All ({vm.improvementPlan.recommendations.length}) Recommendations
                              <ChevronDown className="size-4" />
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="p-5 border border-border border-dashed rounded-xl flex items-center justify-center h-full text-xs text-muted italic">
                  No recommendations needed. Vector capabilities meet all target seniority parameters.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ==========================================
          SECTION 6: Evidence Governance Ledger
          ========================================== */}
      <div className="flex flex-col gap-4 text-left border-t border-separator pt-8">
        <h4 className="text-xs font-black uppercase tracking-wider text-foreground select-none flex items-center gap-1.5">
          Audited Code Evidence Governance Ledger
          {renderTooltip("The underlying commit ledger. Lists all repositories connected by the candidate, direct authorship percentage, and total score contribution weight.")}
        </h4>

        {vm.evidenceGovernance.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="border border-border rounded-xl bg-surface overflow-hidden shadow-xs">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-surface-secondary/50 border-b border-border text-muted font-bold select-none text-[10px] uppercase tracking-wider">
                    <th className="p-4.5">Repository Source</th>
                    <th className="p-4.5">Verification Layer</th>
                    <th className="p-4.5">
                      Authorship Ownership
                      {renderTooltip("Calculated as the percentage of commits matching the candidate's verified identity. A minimum of 30% is required for score inclusion.")}
                    </th>
                    <th className="p-4.5">
                      Score Weight
                      {renderTooltip("The relative weight this repository contributes to the overall capability score dimensions.")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const items = showAllRepos
                      ? vm.evidenceGovernance
                      : vm.evidenceGovernance.slice(0, 4);

                    return items.map((repo) => (
                      <tr key={repo.id} className="border-b border-border/60 last:border-none hover:bg-surface-secondary/15 transition-colors">
                        <td className="p-4.5 font-bold text-foreground">
                          {repo.name}
                        </td>
                        <td className="p-4.5">
                          <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-full border ${repo.verificationLevel === 'AiAnalyzed'
                            ? 'bg-success/10 text-success border-success/15'
                            : repo.verificationLevel === 'RepositoryLinked'
                              ? 'bg-primary/10 text-primary border-primary/15'
                              : 'bg-default text-muted-foreground border-border'
                            }`}>
                            {repo.verificationLevel === 'AiAnalyzed' ? 'AI Audited' : repo.verificationLevel === 'RepositoryLinked' ? 'Repo Linked' : 'Background'}
                          </span>
                        </td>
                        <td className="p-4.5 font-semibold text-foreground/80">
                          {repo.ownershipPercent > 0 ? `${repo.ownershipPercent}%` : '—'}
                        </td>
                        <td className="p-4.5 font-black text-accent font-outfit">
                          {repo.contributionPercent > 0 ? `${repo.contributionPercent}%` : '0.0%'}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>

            {/* Progressive Disclosure Toggle */}
            {vm.evidenceGovernance.length > 4 && (
              <Button
                size="sm"
                variant="ghost"
                className="font-bold text-xs text-accent hover:text-accent/80 flex items-center justify-center gap-1 mx-auto"
                onClick={() => setShowAllRepos(!showAllRepos)}
              >
                {showAllRepos ? (
                  <>
                    Collapse Repositories
                    <ChevronUp className="size-4" />
                  </>
                ) : (
                  <>
                    Show All ({vm.evidenceGovernance.length}) Repositories
                    <ChevronDown className="size-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        ) : (
          <div className="p-8 border border-border border-dashed rounded-xl text-center text-xs text-muted italic">
            No repository evidence parsed for this assessment.
          </div>
        )}
      </div>

      {/* Metadata signals footer */}
      <div className="text-[9px] text-muted/65 flex flex-wrap gap-x-6 gap-y-2 pt-6 border-t border-separator select-none">
        <span>Evaluated Engine: {vm.modelName}</span>
        <span>Prompt Version: {vm.promptVersion}</span>
        <span>Schema Version: {vm.schemaVersion}</span>
        {vm.calculationDate && (
          <span>Calculation Date: {new Date(vm.calculationDate).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );

  // ==========================================
  // Helper Render: Audited Skill Card
  // ==========================================
  function renderSkillCard(skill: NormalizedSkill) {
    const percent = skill.score;
    const isExpanded = expandedSkill === skill.name;

    return (
      <div
        key={skill.name}
        className="p-3.5 border border-border rounded-xl bg-surface flex flex-col gap-3 shadow-xs"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground">{skill.name}</span>
          <Chip size="sm" className={`text-[8px] h-4.5 px-1.5 border-none font-bold font-outfit uppercase select-none ${skill.verificationLevel === 'AiAnalyzed'
            ? 'bg-success/10 text-success'
            : skill.verificationLevel === 'SelfDeclared'
              ? 'bg-accent/10 text-accent'
              : 'bg-default text-muted-foreground'
            }`}>
            {skill.level}
          </Chip>
        </div>

        {/* Custom Progress display */}
        <div className="flex flex-col gap-1.5 select-none">
          <ProgressBar aria-label={skill.name} value={percent} size="sm" className="h-1 bg-border rounded-full" />
          <div className="flex items-center justify-between text-[9px] text-muted">
            <span>Score: {Math.round(percent)}/100</span>
            <span className="flex items-center gap-1">
              Confidence: {Math.round(skill.confidence * 100)}%
              {renderTooltip("AI estimation confidence representing the strength and accuracy of source code patterns matching this framework.")}
            </span>
          </div>
        </div>

        {/* Evidence Disclosure Trigger */}
        {(skill.rationale || skill.repositories.length > 0) && (
          <div className="flex flex-col gap-2 pt-2 border-t border-separator/50">
            <Button
              size="sm"
              variant="ghost"
              className="text-[9px] font-bold text-accent justify-start p-0 h-auto hover:bg-transparent"
              onClick={() => setExpandedSkill(isExpanded ? null : skill.name)}
            >
              <span className="flex items-center gap-1">
                {isExpanded ? 'Hide Evidence Ledger' : 'Show Code Evidence Ledger'}
                <ChevronDown className={`size-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
              </span>
            </Button>

            {isExpanded && (
              <div className="flex flex-col gap-2 bg-surface-secondary/40 p-2.5 border border-border/55 rounded-lg text-[10px] leading-relaxed">
                {skill.rationale && (
                  <p className="text-muted leading-relaxed">
                    <b>Evidence Description:</b> {skill.rationale}
                  </p>
                )}
                {skill.repositories.length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-1">
                    <span className="text-[9px] uppercase font-black text-foreground tracking-wider select-none">Evidence Repositories</span>
                    <div className="flex flex-col gap-1">
                      {skill.repositories.map((repo, idx) => (
                        <div key={idx} className="flex justify-between border-b border-border/30 last:border-none py-1">
                          <span className="text-muted truncate max-w-[150px]">{repo.name}</span>
                          <span className="text-foreground font-semibold">Weight: {Math.round(repo.contributionWeight * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}
