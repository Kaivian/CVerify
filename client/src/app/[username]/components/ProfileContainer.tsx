'use client';

import React, { useState } from 'react';
import { Compass, Briefcase, MapPin, Link as LinkIcon, ShieldCheck, GraduationCap, Award } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button, Tabs } from '@heroui/react';
import { type PublicProfileResponse, type CandidateAssessmentDetailResponse } from '@/types/profile.types';
import {
  normalizeScore,
  getVerifiedSkills,
  isGitHubConnected,
  isLinkedInConnected,
  isTrustScoreEvaluated
} from '@/lib/ai-score-mapper';
import { AiAssessmentTab } from './AiAssessmentTab';

interface ProfileContainerProps {
  profile: PublicProfileResponse;
  assessment: CandidateAssessmentDetailResponse | null;
  username: string;
}

type TabId = 'overview' | 'assessment';

export function ProfileContainer({ profile, assessment, username: _username }: ProfileContainerProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const cp = profile.careerPreference;
  const preferredWorkEnvironments = cp?.preferredWorkEnvironments || [];
  const workStyles = cp?.workStyles || [];
  const companyValues = cp?.companyValues || [];
  const preferredLocations = cp?.preferredLocations || [];
  const desiredJobPositions = cp?.desiredJobPositions || [];
  const notes = cp?.workPreferenceNotes;

  // Format expected salary
  const formatExpectedSalary = (preference: NonNullable<PublicProfileResponse['careerPreference']>) => {
    const min = preference.expectedSalaryMin;
    const max = preference.expectedSalaryMax;
    const currency = preference.expectedSalaryCurrency || 'VND';
    const type = preference.expectedSalaryType || 'Monthly';
    const negotiable = preference.expectedSalaryNegotiable;

    const formatNumber = (num: number) => {
      return new Intl.NumberFormat('en-US').format(num);
    };

    let salaryStr = '';
    if (min !== null && min !== undefined && max !== null && max !== undefined) {
      salaryStr = `${formatNumber(min)} - ${formatNumber(max)} ${currency} / ${type}`;
    } else if (min !== null && min !== undefined) {
      salaryStr = `From ${formatNumber(min)} ${currency} / ${type}`;
    } else if (max !== null && max !== undefined) {
      salaryStr = `Up to ${formatNumber(max)} ${currency} / ${type}`;
    }

    if (negotiable) {
      if (salaryStr) {
        salaryStr += ' (Negotiable)';
      } else {
        salaryStr = 'Negotiable';
      }
    }
    return salaryStr || null;
  };

  const salaryText = cp ? formatExpectedSalary(cp) : null;

  const hasPreferences = !!(
    preferredWorkEnvironments.length > 0 ||
    workStyles.length > 0 ||
    companyValues.length > 0 ||
    preferredLocations.length > 0 ||
    desiredJobPositions.length > 0 ||
    salaryText ||
    (notes && notes.trim().length > 0)
  );

  const hasCompletedAssessment = profile.hasCompletedAssessment;
  const isEvaluated = hasCompletedAssessment && isTrustScoreEvaluated(profile.trustScore);
  const hasAudited = hasCompletedAssessment;
  const githubConnected = isGitHubConnected(profile.socialLinks) || (profile.repositories && profile.repositories.length > 0);
  const linkedinConnected = isLinkedInConnected(profile.socialLinks);
  const verifiedSkills = getVerifiedSkills(profile.repositories);

  const completedRepos = (profile.repositories || []).filter(r => r.latestAnalysisStatus === 'Completed');

  const formatMonthYear = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  const portfolioProjects = (profile.projects && profile.projects.length > 0)
    ? profile.projects.map((proj: any) => {
        const numLevel = typeof proj.verificationLevel === 'string'
          ? (proj.verificationLevel === 'AiAnalyzed' ? 1 : proj.verificationLevel === 'RepositoryLinked' ? 2 : 3)
          : proj.verificationLevel;
        const numStatus = typeof proj.verificationStatus === 'string'
          ? (proj.verificationStatus === 'Verified' ? 1 : proj.verificationStatus === 'Outdated' ? 2 : proj.verificationStatus === 'Disconnected' ? 3 : 4)
          : proj.verificationStatus;
        return {
          ...proj,
          verificationLevel: numLevel,
          verificationStatus: numStatus
        };
      })
    : completedRepos.map(repo => ({
        id: repo.id,
        name: repo.name,
        role: "Contributor",
        description: repo.description || "",
        startDate: repo.latestAnalysisCompletedAtUtc,
        endDate: null,
        isCurrentlyWorking: false,
        verificationLevel: 1, // AI Analyzed
        verificationStatus: 1, // Verified
        verifiedAt: repo.latestAnalysisCompletedAtUtc,
        verificationMetadataJson: null,
        displayOrder: 0,
        repositoryLinks: [{
          id: repo.id,
          sourceCodeRepositoryId: repo.id,
          name: repo.name,
          owner: repo.owner,
          htmlUrl: repo.htmlUrl
        }],
        technologies: repo.primaryLanguage ? [repo.primaryLanguage] : [],
        contributions: []
      }));

  const renderPublicVerificationBadge = (level: any, status: any) => {
    const numLevel = typeof level === 'string'
      ? (level === 'AiAnalyzed' ? 1 : level === 'RepositoryLinked' ? 2 : 3)
      : level;
    const numStatus = typeof status === 'string'
      ? (status === 'Verified' ? 1 : status === 'Outdated' ? 2 : status === 'Disconnected' ? 3 : 4)
      : status;

    if (numLevel === 1) { // AI Analyzed
      if (numStatus === 2) {
        return (
          <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase bg-warning/10 text-warning border border-warning/20 rounded-full">
            AI Audited • Outdated
          </span>
        );
      }
      if (numStatus === 3) {
        return (
          <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase bg-danger/10 text-danger border border-danger/20 rounded-full">
            AI Audited • Disconnected
          </span>
        );
      }
      return (
        <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase bg-success/10 text-success border border-success/20 rounded-full">
          AI Audited
        </span>
      );
    }
    if (numLevel === 2) { // Repo Linked
      if (numStatus === 3) {
        return (
          <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase bg-danger/10 text-danger border border-danger/20 rounded-full">
            Repo Linked • Disconnected
          </span>
        );
      }
      return (
        <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase bg-primary/10 text-primary border border-primary/20 rounded-full">
          Repo Linked
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase bg-default/45 text-muted-foreground border border-default rounded-full">
        Self Declared
      </span>
    );
  };

  return (
    <div className="relative min-h-screen w-full bg-background text-foreground flex flex-col justify-between overflow-x-hidden antialiased">
      {/* Grid backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(var(--separator)_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none opacity-40" />

      {/* Header */}
      <header className="z-10 w-full bg-surface/85 backdrop-blur-md border-b border-border select-none sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center shadow-md font-bold">
              <Compass size={18} />
            </div>
            <span className="font-extrabold text-sm tracking-tight text-foreground">
              CVerify
            </span>
          </Link>
          <Link href="/login">
            <Button size="sm" className="font-semibold text-xs rounded-xl bg-foreground hover:bg-foreground/90 text-background transition-colors px-4 border-none h-8 min-h-8">
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

        {/* Sleek Document Paper Container */}
        <div className="w-full bg-surface border border-border rounded-2xl shadow-xs p-6 sm:p-8 flex flex-col gap-8">

          {/* 1. Header Area */}
          <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6 pb-6 border-b border-separator">
            {/* Avatar & Info */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left min-w-0 w-full">
              {/* Avatar */}
              <div className="w-24 h-24 rounded-full border-2 border-border overflow-hidden shadow-xs shrink-0 bg-default flex items-center justify-center relative select-none">
                {profile.avatarUrl ? (
                  <Image
                    src={profile.avatarUrl}
                    alt={profile.fullName || ""}
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full bg-default flex items-center justify-center text-3xl font-bold text-default-foreground">
                    {profile.fullName ? profile.fullName.charAt(0).toUpperCase() : ""}
                  </div>
                )}
              </div>

              {/* Text Info */}
              <div className="flex flex-col gap-1.5 min-w-0 w-full text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground text-left">
                    {profile.fullName}
                  </h1>
                  <span className="flex items-center gap-1 bg-success/10 text-success border border-success/20 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full select-none shrink-0" title="Verified Profile">
                    <ShieldCheck className="size-3 text-success" />
                    Verified
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-0.5 text-xs text-muted font-medium select-none">
                  <span>@{profile.username}</span>
                  {profile.headline && (
                    <>
                      <span className="text-separator">•</span>
                      <span>{profile.headline}</span>
                    </>
                  )}
                </div>

                {/* Meta details row */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1.5 mt-2 text-xs text-muted">
                  {profile.company && (
                    <span className="flex items-center gap-1.5 min-w-0">
                      <Briefcase size={14} className="text-muted/60 shrink-0" />
                      <span className="truncate">{profile.company}</span>
                    </span>
                  )}
                  {profile.location && (
                    <span className="flex items-center gap-1.5 min-w-0">
                      <MapPin size={14} className="text-muted/60 shrink-0" />
                      <span className="truncate">{profile.location}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Badges/Status Block */}
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 shrink-0 select-none max-w-xs">
              <span className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-full bg-default text-default-foreground border border-border">
                Public Profile
              </span>
              {hasAudited && (
                <span className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-full bg-success/10 text-success border border-success/20">
                  AI Audited
                </span>
              )}
              {githubConnected && (
                <span className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-full bg-accent/10 text-accent border border-accent/20">
                  GitHub Connected
                </span>
              )}
              {linkedinConnected && (
                <span className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-full bg-accent/10 text-accent border border-accent/20">
                  LinkedIn Connected
                </span>
              )}
            </div>
          </div>

          {/* Bio & Social Links */}
          {(profile.bio || (profile.socialLinks && profile.socialLinks.length > 0)) && (
            <div className="flex flex-col gap-4 pb-6 border-b border-separator text-left">
              {profile.bio && (
                <p className="text-muted text-sm leading-relaxed whitespace-pre-line max-w-4xl">
                  {profile.bio}
                </p>
              )}
              {profile.socialLinks && profile.socialLinks.length > 0 && (
                <div className="flex flex-wrap gap-2.5 items-center mt-2 text-left">
                  <span className="text-[10px] text-muted/60 uppercase font-bold tracking-wider select-none pr-1">Verified Links:</span>
                  {profile.socialLinks.map((url, idx) => {
                    let displayUrl = url.replace(/https?:\/\/(www\.)?/, '');
                    if (displayUrl.length > 30) displayUrl = displayUrl.substring(0, 28) + '...';
                    return (
                      <a
                        key={idx}
                        href={url.startsWith('http') ? url : `https://${url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-secondary/50 hover:bg-surface-secondary hover:border-border transition-colors text-xs font-semibold text-foreground/80 hover:text-foreground"
                        style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                      >
                        <LinkIcon size={12} className="text-muted shrink-0" />
                        {displayUrl}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. HeroUI Tabs Navigation (Vertical or Horizontal? Horizontal is cleaner for public page) */}
          <Tabs
            selectedKey={activeTab}
            onSelectionChange={(key) => setActiveTab(key as TabId)}
            variant="secondary"
            className="w-full gap-6 text-left"
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label="Profile Sections" className="flex gap-4 border-b border-border/60 pb-1.5">
                <Tabs.Tab id="overview" className="pb-2 font-bold text-sm cursor-pointer select-none">
                  Overview & Portfolio
                  <Tabs.Indicator className="bottom-0" />
                </Tabs.Tab>
                <Tabs.Tab id="assessment" className="pb-2 font-bold text-sm cursor-pointer select-none">
                  AI Verified Assessment
                  <Tabs.Indicator className="bottom-0" />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>

            {/* Tab 1: Overview & Portfolio Panel */}
            <Tabs.Panel id="overview" className="pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
                {/* Left Column - Verification & Technical Snapshot */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                  {/* Verification Status Card */}
                  <div className="p-5 border border-border rounded-xl bg-surface-secondary/30 flex flex-col gap-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground/80 select-none">
                      Verification Status
                    </span>
                    <div className="flex flex-col gap-3">
                      {[
                        { label: "Identity Verification", status: true },
                        { label: "Connected Links Audited", status: profile.socialLinks && profile.socialLinks.length > 0 },
                        { label: "Career Preferences Declared", status: !!cp },
                        { label: "Open for Hire", status: cp?.availableForHire ?? false },
                      ].map((item, index) => (
                        <div key={index} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0 select-none">
                          <span className="text-muted font-medium">{item.label}</span>
                          {item.status ? (
                            <span className="flex items-center gap-1 font-bold text-success bg-success/10 px-1.5 py-0.5 rounded-full border border-success/20 text-[9px] uppercase">
                              <ShieldCheck className="size-2.5 text-success" />
                              Verified
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 font-bold text-muted bg-default px-1.5 py-0.5 rounded-full border border-border text-[9px] uppercase">
                              Inactive
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick Facts Card */}
                  {cp && (
                    <div className="p-5 border border-border rounded-xl bg-surface-secondary/30 flex flex-col gap-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-foreground/80 select-none">
                        Quick Facts
                      </span>
                      <div className="flex flex-col gap-2.5 text-xs">
                        <div className="flex justify-between py-1 border-b border-border/40">
                          <span className="text-muted font-medium">Availability</span>
                          <span className="font-semibold text-foreground/80">{cp.availableForHire ? "Available for Hire" : "Not Active"}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/40">
                          <span className="text-muted font-medium">Preferred Language</span>
                          <span className="font-semibold text-foreground/80 capitalize">{cp.preferredLanguage === 'en' ? "English" : "Tiếng Việt"}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/40">
                          <span className="text-muted font-medium">Relocation Willingness</span>
                          <span className="font-semibold text-foreground/80">{cp.preferredLocations && cp.preferredLocations.length > 0 ? "Yes" : "No"}</span>
                        </div>
                        <div className="flex justify-between py-1 last:border-0">
                          <span className="text-muted font-medium">Salary Negotiable</span>
                          <span className="font-semibold text-foreground/80">{cp.expectedSalaryNegotiable ? "Yes" : "No"}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Technical Snapshot Card */}
                  <div className="p-5 border border-border rounded-xl bg-surface-secondary/30 flex flex-col gap-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground/80 select-none">
                      Technical Snapshot
                    </span>
                    {verifiedSkills.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {verifiedSkills.map((skill) => (
                          <span key={skill} className="px-2 py-0.5 text-[10px] font-bold bg-success/10 text-success border border-success/20 rounded-md">
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted italic">No repository skill evidence available yet</p>
                    )}
                  </div>
                </div>

                {/* Right Column - Overview content */}
                <div className="lg:col-span-8 flex flex-col gap-6 text-left">
                  {/* Overall Trust Score card */}
                  <div className="p-5 sm:p-6 border border-border rounded-xl bg-surface-secondary/30 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
                    <div className="flex flex-col gap-2 min-w-0 text-center sm:text-left">
                      <div className="flex items-center justify-center sm:justify-start gap-2 select-none">
                        <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase bg-default text-default-foreground border border-border">
                          AI Trust Score
                        </span>
                        {isEvaluated && (
                          <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase bg-success/10 text-success border border-success/20 rounded-full">
                            AI Audited
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-foreground mt-1">
                        {isEvaluated ? "Repository-based Trust Score" : "Not Yet Analyzed"}
                      </h3>
                      <p className="text-xs text-muted leading-relaxed max-w-md">
                        {isEvaluated
                          ? "This score represents a repository-analysis-based trust score, indicating the level of verification of the candidate's public source code contributions and technical configurations."
                          : "This profile has not yet undergone a completed AI CV Analysis. AI-based trust scores and insights will be generated once the candidate initiates a talent assessment."}
                      </p>
                    </div>

                    {/* Visual Circle Score */}
                    {isEvaluated ? (
                      <div className="flex flex-col items-center gap-1 select-none shrink-0">
                        <div className="w-20 h-20 rounded-full border-4 border-accent text-accent flex flex-col items-center justify-center bg-surface shadow-xs">
                          <span className="text-2xl font-black font-outfit leading-none">{normalizeScore(profile.trustScore)}</span>
                          <span className="text-[8px] font-bold text-muted uppercase tracking-widest mt-0.5">SCORE</span>
                        </div>
                        <span className="text-[10px] font-bold text-success uppercase tracking-wider mt-1">AI Evaluated</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-3 border border-dashed border-border rounded-xl bg-default/50 shrink-0 select-none text-center max-w-[200px]">
                        <span className="text-[10px] font-semibold text-muted">Awaiting AI CV Analysis</span>
                      </div>
                    )}
                  </div>

                  {/* Stats Cards Row */}
                  {(() => {
                    const stats = [
                      { label: "Desired Roles", value: desiredJobPositions.length },
                      { label: "Preferred Locations", value: preferredLocations.length },
                      { label: "Connected Links", value: profile.socialLinks.length },
                      { label: "Employment Prefs", value: cp?.employmentPreferences?.length || 0 },
                      { label: "Analyzed Repositories", value: completedRepos.length },
                    ].filter(stat => stat.value > 0);

                    if (stats.length === 0) return null;

                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {stats.map((stat, idx) => (
                          <div key={idx} className="p-3 border border-border rounded-xl bg-surface flex flex-col gap-0.5 select-none shadow-xs">
                            <span className="text-[9px] text-muted uppercase font-bold tracking-wider">{stat.label}</span>
                            <span className="text-lg font-black text-foreground font-outfit">{stat.value}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Projects Portfolio */}
                  {portfolioProjects.length > 0 && (
                    <div className="flex flex-col gap-4 border-t border-separator pt-6">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-1">
                        Projects Portfolio
                      </h3>
                      <div className="flex flex-col gap-4">
                        {portfolioProjects.map((proj) => (
                          <div key={proj.id} className="p-5 border border-border rounded-xl bg-surface shadow-xs flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex flex-col gap-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-base font-bold text-foreground truncate">
                                    {proj.name}
                                  </h4>
                                  {renderPublicVerificationBadge(proj.verificationLevel, proj.verificationStatus)}
                                </div>
                                {proj.role && (
                                  <p className="text-xs text-muted font-semibold">
                                    {proj.role}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0 select-none">
                                {(proj.startDate || proj.endDate) && (
                                  <span className="text-[10px] text-muted font-medium mt-0.5">
                                    {proj.startDate ? formatMonthYear(proj.startDate) : ""} - {proj.isCurrentlyWorking ? "Present" : (proj.endDate ? formatMonthYear(proj.endDate) : "")}
                                  </span>
                                )}
                              </div>
                            </div>

                            {proj.description && (
                              <p className="text-xs text-muted leading-relaxed">
                                {proj.description}
                              </p>
                            )}

                            {proj.contributions && proj.contributions.length > 0 && (
                              <div className="flex flex-col gap-1.5 mt-1">
                                <span className="text-[10px] text-foreground font-bold uppercase tracking-wider select-none">Key Highlights</span>
                                <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground">
                                  {proj.contributions.map((con: string, idx: number) => (
                                    <li key={idx} className="leading-relaxed">
                                      {con}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-separator text-xs">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {proj.technologies && proj.technologies.map((tech: string) => (
                                  <span key={tech} className="text-muted font-semibold bg-default px-2 py-0.5 rounded text-[10px]">
                                    {tech}
                                  </span>
                                ))}
                              </div>
                              {proj.repositoryLinks && proj.repositoryLinks.length > 0 && (
                                <div className="flex items-center gap-3">
                                  {proj.repositoryLinks.map((link: any) => (
                                    <a
                                      key={link.id}
                                      href={link.htmlUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-foreground font-semibold hover:underline text-xs flex items-center gap-1"
                                    >
                                      <span>{link.name}</span>
                                      <span>→</span>
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Work Experience */}
                  {profile.experiences && profile.experiences.length > 0 && (
                    <div className="flex flex-col gap-4 border-t border-separator pt-6">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-1 flex items-center gap-2">
                        <Briefcase className="size-4 text-muted/80 shrink-0" />
                        Work Experience
                      </h3>
                      <div className="flex flex-col gap-4">
                        {profile.experiences.map((exp) => (
                          <div key={exp.id} className="p-5 border border-border rounded-xl bg-surface shadow-xs flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex flex-col gap-1 min-w-0">
                                <h4 className="text-base font-bold text-foreground truncate">
                                  {exp.jobTitle}
                                </h4>
                                <p className="text-xs text-muted font-semibold">
                                  {exp.company}{exp.location ? ` • ${exp.location}` : ""}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0 select-none">
                                <span className="text-[10px] text-muted font-medium mt-0.5">
                                  {formatMonthYear(exp.startDate)} - {exp.isCurrentlyWorking ? "Present" : formatMonthYear(exp.endDate)}
                                </span>
                              </div>
                            </div>

                            {exp.description && (
                              <p className="text-xs text-muted leading-relaxed whitespace-pre-line">
                                {exp.description}
                              </p>
                            )}

                            {exp.achievements && exp.achievements.length > 0 && (
                              <div className="flex flex-col gap-1.5 mt-1">
                                <span className="text-[10px] text-foreground font-bold uppercase tracking-wider select-none">Key Accomplishments</span>
                                <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground">
                                  {exp.achievements.map((ach: any, idx: number) => (
                                    <li key={idx} className="leading-relaxed">
                                      <span className="font-semibold text-foreground/85">{ach.title}:</span> {ach.description}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {exp.technologies && exp.technologies.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                {exp.technologies.map((tech: string) => (
                                  <span key={tech} className="text-muted font-semibold bg-default px-2 py-0.5 rounded text-[10px]">
                                    {tech}
                                  </span>
                                ))}
                              </div>
                            )}

                            {exp.links && exp.links.length > 0 && (
                              <div className="flex flex-wrap gap-2.5 mt-2 pt-2 border-t border-separator text-xs">
                                {exp.links.map((link: any, idx: number) => (
                                  <a
                                    key={idx}
                                    href={link.url.startsWith("http") ? link.url : `https://${link.url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-foreground font-semibold hover:underline text-xs flex items-center gap-1"
                                  >
                                    <span>{link.url.replace(/^(https?:\/\/)?(www\.)?/, "")}</span>
                                    <span>→</span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Education */}
                  {profile.educations && profile.educations.length > 0 && (
                    <div className="flex flex-col gap-4 border-t border-separator pt-6">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-1 flex items-center gap-2">
                        <GraduationCap className="size-4 text-muted/80 shrink-0" />
                        Education
                      </h3>
                      <div className="flex flex-col gap-4">
                        {profile.educations.map((edu) => (
                          <div key={edu.id} className="p-5 border border-border rounded-xl bg-surface shadow-xs flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex flex-col gap-1 min-w-0">
                                <h4 className="text-base font-bold text-foreground truncate">
                                  {edu.schoolName}
                                </h4>
                                <p className="text-xs text-muted font-semibold">
                                  {edu.degree || ""}{edu.major ? `${edu.degree ? " in " : ""}${edu.major}` : ""}
                                  {edu.gpa && ` • GPA: ${edu.gpa}/${edu.gpaScale || 4.0}`}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0 select-none">
                                <span className="text-[10px] text-muted font-medium mt-0.5">
                                  {formatMonthYear(edu.startDate)} - {edu.isCurrentlyStudying ? "Present" : formatMonthYear(edu.endDate)}
                                </span>
                              </div>
                            </div>

                            {edu.description && (
                              <p className="text-xs text-muted leading-relaxed whitespace-pre-line">
                                {edu.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Achievements & Certificates */}
                  {profile.achievements && profile.achievements.length > 0 && (
                    <div className="flex flex-col gap-4 border-t border-separator pt-6">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-1 flex items-center gap-2">
                        <Award className="size-4 text-muted/80 shrink-0" />
                        Achievements & Certificates
                      </h3>
                      <div className="flex flex-col gap-4">
                        {profile.achievements.map((ach) => (
                          <div key={ach.id} className="p-5 border border-border rounded-xl bg-surface shadow-xs flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex flex-col gap-1 min-w-0">
                                <h4 className="text-base font-bold text-foreground truncate">
                                  {ach.title}
                                </h4>
                                <p className="text-xs text-muted font-semibold">
                                  Issued by: {ach.issuer}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0 select-none">
                                <span className="text-[10px] text-muted font-medium mt-0.5">
                                  {formatMonthYear(ach.issueDate)}
                                </span>
                              </div>
                            </div>

                            {ach.description && (
                              <p className="text-xs text-muted leading-relaxed whitespace-pre-line">
                                {ach.description}
                              </p>
                            )}

                            {(ach.credentialUrl || ach.attachment) && (
                              <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-separator text-xs">
                                {ach.credentialUrl && (
                                  <a
                                    key="cred"
                                    href={ach.credentialUrl.startsWith("http") ? ach.credentialUrl : `https://${ach.credentialUrl}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-foreground font-semibold hover:underline text-xs flex items-center gap-1"
                                  >
                                    <span>Credential URL</span>
                                    <span>→</span>
                                  </a>
                                )}
                                {ach.attachment && (
                                  <a
                                    key="attach"
                                    href={ach.attachment.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-foreground font-semibold hover:underline text-xs flex items-center gap-1"
                                  >
                                    <span>Download Attachment ({ach.attachment.fileName})</span>
                                    <span>↓</span>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Career Preferences Section */}
                  {hasPreferences && (
                    <div className="flex flex-col gap-4 border-t border-separator pt-6">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-1">
                        Career Preferences
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {desiredJobPositions.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Desired Job Positions</span>
                            <div className="flex flex-wrap gap-1.5">
                              {desiredJobPositions.map((pos: string) => (
                                <span key={pos} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-default text-default-foreground border border-border/80">
                                  {pos}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {preferredLocations.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Preferred Locations</span>
                            <div className="flex flex-wrap gap-1.5">
                              {preferredLocations.map((loc: string) => (
                                <span key={loc} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-default text-default-foreground border border-border/80">
                                  {loc}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {preferredWorkEnvironments.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Preferred Work Environment</span>
                            <div className="flex flex-wrap gap-1.5">
                              {preferredWorkEnvironments.map((env: string) => (
                                <span key={env} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-default text-default-foreground border border-border/80">
                                  {env}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {workStyles.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Work Style</span>
                            <div className="flex flex-wrap gap-1.5">
                              {workStyles.map((style: string) => (
                                <span key={style} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-default text-default-foreground border border-border/80">
                                  {style}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {companyValues.length > 0 && (
                          <div className="flex flex-col gap-1.5 sm:col-span-2">
                            <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Preferred Company Values</span>
                            <div className="flex flex-wrap gap-1.5">
                              {companyValues.map((val: string) => (
                                <span key={val} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-default text-default-foreground border border-border/80">
                                  {val}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {salaryText && (
                          <div className="flex flex-col gap-1 sm:col-span-2">
                            <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Expected Salary Range</span>
                            <span className="text-xs font-semibold text-foreground/80 mt-0.5">{salaryText}</span>
                          </div>
                        )}

                        {notes && notes.trim().length > 0 && (
                          <div className="flex flex-col gap-1 sm:col-span-2">
                            <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Work Preference Notes</span>
                            <p className="text-xs text-muted leading-relaxed whitespace-pre-line mt-0.5">{notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Tabs.Panel>

            {/* Tab 2: AI Verified Assessment Panel */}
            <Tabs.Panel id="assessment" className="pt-6">
              {profile.hasCompletedAssessment && assessment ? (
                <AiAssessmentTab assessmentDetail={assessment} fullName={profile.fullName || ""} />
              ) : (
                <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-xl text-center max-w-lg mx-auto gap-4 mt-6 select-none">
                  <ShieldCheck className="size-12 text-muted/40" />
                  <h3 className="text-base font-bold text-foreground">Not Yet Analyzed</h3>
                  <p className="text-xs text-muted leading-relaxed">
                    This candidate has not generated their public AI Verified Assessment yet. AI Assessments require manually linking GitHub repositories and initiating verification.
                  </p>
                </div>
              )}
            </Tabs.Panel>
          </Tabs>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 h-16 flex items-center justify-center border-t border-border text-xs text-muted bg-surface/50 select-none">
        &copy; {new Date().getFullYear()} CVerify. All rights reserved.
      </footer>
    </div>
  );
}
