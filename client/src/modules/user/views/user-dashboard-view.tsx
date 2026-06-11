"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useAssessment } from '@/providers/assessment-provider';
import { jobsApi } from '@/services/jobs.service';
import { forumApi } from '@/services/forum.service';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrustScoreDial, TrustScoreBadge } from '@/components/ui/cverify/trust-score-indicator';
import {
  User,
  ShieldCheck,
  Sparkles,
  FileText,
  GitFork,
  AlertCircle,
  Terminal,
  Award,
  Briefcase,
  MessageCircle,
  Calendar
} from 'lucide-react';
import { Typography, ProgressBar, Chip, Spinner, Tabs } from '@heroui/react';

export function UserDashboardView() {
  const { user } = useAuth();
  const router = useRouter();

  const {
    latestAssessment,
    parsedProfile,
    parsedImprovementPlan,
    isTriggering,
    streamStatus,
    streamProgress,
    streamStep,
    streamMessage,
    triggerAssessment,
  } = useAssessment();

  const [recommendedJobs, setRecommendedJobs] = React.useState<any[]>([]);
  const [appliedJobs, setAppliedJobs] = React.useState<any[]>([]);
  const [forumProfile, setForumProfile] = React.useState<any | null>(null);
  const [isLoadingJobs, setIsLoadingJobs] = React.useState(true);
  const [activeJobTab, setActiveJobTab] = React.useState('recommended');

  React.useEffect(() => {
    let active = true;
    async function loadDashboardData() {
      try {
        const [recs, apps, forum] = await Promise.all([
          jobsApi.getRecommendations().catch(() => []),
          jobsApi.getApplications().catch(() => []),
          forumApi.getCurrentUserProfile().catch(() => null)
        ]);
        if (active) {
          setRecommendedJobs(recs || []);
          setAppliedJobs(apps || []);
          setForumProfile(forum);
          setIsLoadingJobs(false);
        }
      } catch (err) {
        if (active) {
          setIsLoadingJobs(false);
        }
      }
    }
    loadDashboardData();
    return () => {
      active = false;
    };
  }, []);

  const handleRunAssessment = async () => {
    try {
      await triggerAssessment();
    } catch (err) {
      // Error handled by store/provider toast
    }
  };

  // Extract skills
  const skillsList = parsedProfile?.skills || [];
  const verifiedSkills = skillsList.filter((s: any) => s.level !== "Unverified");
  const unverifiedSkills = skillsList.filter((s: any) => s.level === "Unverified");

  // Determine trust score
  const trustScoreRaw = latestAssessment?.trustLevel ?? parsedProfile?.trustScoreMetrics?.candidateTrustScore ?? 0;
  const trustScore = trustScoreRaw <= 1 ? Math.round(trustScoreRaw * 100) : Math.round(trustScoreRaw);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed": return "success";
      case "Failed": return "danger";
      case "Running":
      case "Queued": return "warning";
      default: return "default";
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner Message */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-accent-soft">
        <div className="space-y-1">
          <Typography type="h2" className="text-xl font-bold flex items-center gap-2 text-accent">
            Welcome back, {user?.fullName || 'Developer'}!{' '}
            <Sparkles size={18} className="text-accent" />
          </Typography>
          <Typography type="body-xs" className="text-accent font-light mt-0.5">
            Analyze repositories, track match eligibility, and optimize your verified Developer Profile.
          </Typography>
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            onClick={() => router.push('/cv')}
          >
            <FileText size={16} />
            Manage CV
          </Button>
        </div>
      </div>

      {/* Top Row Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">

        {/* Card 1: Developer Profile (spans 6/10) */}
        <Card className="lg:col-span-6" glow={false}>
          <div className="flex items-center gap-3 mb-6 select-none">
            <div className="w-10 h-10 rounded-full bg-surface-secondary flex items-center justify-center text-foreground">
              <User size={20} />
            </div>
            <div>
              <Typography type="h3" className="font-bold text-foreground">
                Developer Profile
              </Typography>
              <Typography type="body-xs" className="text-muted">
                Account credentials and authorization role
              </Typography>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-sm select-none font-sans">
            <div>
              <Typography type="body-xs" className="text-muted uppercase font-extrabold tracking-wider block mb-0.5">
                Full Name
              </Typography>
              <Typography type="body-sm" className="font-semibold text-foreground">
                {user?.fullName}
              </Typography>
            </div>
            <div>
              <Typography type="body-xs" className="text-muted uppercase font-extrabold tracking-wider block mb-0.5">
                Email Address
              </Typography>
              <Typography type="body-sm" className="font-semibold text-foreground truncate block max-w-full">
                {user?.email}
              </Typography>
            </div>
            <div>
              <Typography type="body-xs" className="text-muted uppercase font-extrabold tracking-wider block mb-0.5">
                Verification Status
              </Typography>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-success/10 text-success border border-success/20 select-none mt-0.5">
                {user?.isEmailVerified ? "Verified" : "Pending"}
              </span>
            </div>
            <div>
              <Typography type="body-xs" className="text-muted uppercase font-extrabold tracking-wider block mb-0.5">
                Assigned Role
              </Typography>
              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-surface-secondary text-foreground border border-border select-none mt-0.5">
                {user?.role}
              </span>
            </div>
          </div>
        </Card>

        {/* Card 2: Trust Score Dial Widget (spans 4) */}
        <Card className="lg:col-span-4" glow={false}>
          <div className="flex items-center justify-between gap-3 mb-6 select-none">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-surface-secondary flex items-center justify-center text-foreground">
                <ShieldCheck size={20} className="text-accent" />
              </div>
              <div>
                <Typography type="h3" className="font-bold text-foreground">
                  Trust Score
                </Typography>
                <Typography type="body-xs" className="text-muted">
                  Overall developer authenticity index
                </Typography>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2 text-xs select-none">
              <p className="text-muted-foreground leading-normal font-light">
                Calculated by analyzing commit sign-offs, authorship ratios, and identity matches.
              </p>
              <Button
                size="sm"
                variant="primary"
                onClick={() => router.push('/intelligence/trust-score')}
                className="rounded-xl"
              >
                View Detailed Report
              </Button>
            </div>
            <TrustScoreDial score={trustScore} />
          </div>
        </Card>
      </div>

      {/* Row 2: Vetting Progress and Skills breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">

        {/* Vetting Pipeline & Repository Syncs (6/10 grid) */}
        <Card className="lg:col-span-6" glow={false}>
          <div className="flex items-center justify-between pb-4 border-b border-border/20 mb-4 select-none">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-surface-secondary flex items-center justify-center text-foreground">
                <Terminal size={18} className="text-accent" />
              </div>
              <div>
                <Typography type="h3" className="font-bold text-foreground">Codebase Vetting Pipeline</Typography>
                <Typography type="body-xs" className="text-muted">Vetting status and progress metrics</Typography>
              </div>
            </div>
            {latestAssessment && (
              <Chip size="sm" color={getStatusColor(latestAssessment.status)} variant="soft">
                {latestAssessment.status}
              </Chip>
            )}
          </div>

          {/* If streaming/connecting */}
          {streamStatus === 'streaming' || streamStatus === 'connecting' ? (
            <div className="space-y-4 py-2 font-sans select-none">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-2">
                  <Spinner size="sm" color="accent" />
                  {streamStep || "Analyzing codebases..."}
                </span>
                <span className="font-mono text-muted">{streamProgress}%</span>
              </div>
              <ProgressBar aria-label="Streaming Analysis Progress" value={streamProgress} color="accent" size="sm" />
              <div className="p-3 bg-surface-secondary/40 border border-border/30 rounded-xl font-mono text-[10px] text-muted-foreground truncate leading-relaxed">
                {streamMessage || "Establishing connection to API engine..."}
              </div>
            </div>
          ) : latestAssessment ? (
            <div className="space-y-4 select-none">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-sans">
                <div className="p-3 bg-surface-secondary/35 border border-border/20 rounded-xl space-y-0.5">
                  <span className="text-[9px] text-muted font-bold uppercase tracking-wider block">Last Analyzed</span>
                  <span className="font-semibold text-foreground">
                    {latestAssessment.createdAtUtc ? new Date(latestAssessment.createdAtUtc).toLocaleDateString() : "N/A"}
                  </span>
                </div>
                <div className="p-3 bg-surface-secondary/35 border border-border/20 rounded-xl space-y-0.5">
                  <span className="text-[9px] text-muted font-bold uppercase tracking-wider block">Trust Score</span>
                  <span className="font-semibold text-foreground">{trustScore}%</span>
                </div>
                <div className="p-3 bg-surface-secondary/35 border border-border/20 rounded-xl space-y-0.5">
                  <span className="text-[9px] text-muted font-bold uppercase tracking-wider block">Calibrated Level</span>
                  <span className="font-semibold text-foreground">{latestAssessment.careerLevelLabel || "Uncalibrated"}</span>
                </div>
                <div className="p-3 bg-surface-secondary/35 border border-border/20 rounded-xl space-y-0.5">
                  <span className="text-[9px] text-muted font-bold uppercase tracking-wider block">Gate Violations</span>
                  <span className="font-semibold text-foreground">
                    {parsedProfile?.gateViolations?.length || 0}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed font-light">
                {parsedProfile?.summary || "Global profile assessment has been completed. Explore your capability indicators and roadmap actions below."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted min-h-[160px] font-sans">
              <AlertCircle size={28} className="mb-2 text-muted-foreground/60" />
              <p className="text-xs font-semibold text-foreground/80 mb-1">No Profile Assessment Triggered</p>
              <p className="text-[11px] text-muted-foreground max-w-sm mb-4 leading-normal font-light">
                Connect your repositories in settings, build your CV profile details, and trigger an assessment to unlock your developer scorecard.
              </p>
              <Button size="sm" onClick={handleRunAssessment} disabled={isTriggering}>
                Trigger Initial Assessment
              </Button>
            </div>
          )}
        </Card>

        {/* Verified Capabilities & Gaps (4/12 grid) */}
        <Card className="lg:col-span-4" glow={false}>
          <div className="flex items-center justify-between pb-4 border-b border-border/20 mb-4 select-none">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-surface-secondary flex items-center justify-center text-foreground">
                <Award size={18} className="text-accent" />
              </div>
              <div>
                <Typography type="h3" className="font-bold text-foreground">Verified Capabilities</Typography>
                <Typography type="body-xs" className="text-muted">Skills with codebase evidence</Typography>
              </div>
            </div>
            <Link
              href="/cv?tab=skills"
              className="text-[10px] text-accent font-bold hover:underline font-sans"
            >
              Edit Skills
            </Link>
          </div>

          <div className="space-y-4 font-sans select-none">
            {verifiedSkills.length > 0 ? (
              <div className="space-y-3">
                <div>
                  <span className="text-[9px] text-muted font-bold uppercase tracking-wider block mb-2">Verified Skills ({verifiedSkills.length})</span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {verifiedSkills.slice(0, 8).map((s: any, idx: number) => (
                      <Chip key={idx} size="sm" color="success" variant="soft" className="h-5 text-[9px] font-extrabold uppercase">
                        {s.skillName}
                      </Chip>
                    ))}
                  </div>
                </div>

                {unverifiedSkills.length > 0 && (
                  <div>
                    <span className="text-[9px] text-muted font-bold uppercase tracking-wider block mb-2">Unverified Gaps ({unverifiedSkills.length})</span>
                    <div className="flex flex-wrap gap-1.5 overflow-y-auto">
                      {unverifiedSkills.slice(0, 6).map((s: any, idx: number) => (
                        <Chip key={idx} size="sm" color="warning" variant="soft" className="h-5 text-[9px] font-extrabold uppercase">
                          {s.skillName}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted min-h-[140px]">
                <GitFork size={20} className="mb-2 text-muted-foreground/60" />
                <p className="text-xs font-semibold text-foreground/80 mb-0.5">No Skills Indexed</p>
                <p className="text-[10px] text-muted-foreground max-w-xs leading-normal font-light">
                  Add tech capabilities to your CV or trigger an assessment of connected repos to classify skills.
                </p>
              </div>
            )}
          </div>
        </Card>

      </div>

      {/* Row 3: Skill Progression Roadmap */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Skill Progression Roadmap (12/12 grid) */}
        <Card className="lg:col-span-12" glow={false}>
          <div className="flex items-center justify-between pb-4 border-b border-border/20 mb-4 select-none">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-surface-secondary flex items-center justify-center text-foreground">
                <Award size={18} className="text-accent" />
              </div>
              <div>
                <Typography type="h3" className="font-bold text-foreground">Skill Progression Roadmap</Typography>
                <Typography type="body-xs" className="text-muted">Target areas and prioritized actions recommended to boost score potential</Typography>
              </div>
            </div>
            <Link
              href="/intelligence/skill-tree"
              className="text-[10px] text-accent font-bold hover:underline font-sans"
            >
              View Skill Tree
            </Link>
          </div>

          <div className="space-y-4 font-sans select-none">
            {!(parsedImprovementPlan?.recommendations) || parsedImprovementPlan.recommendations.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted min-h-[140px]">
                <AlertCircle size={20} className="mb-2 text-muted-foreground/60" />
                <p className="text-xs font-semibold text-foreground/80 mb-0.5">No Recommendations Yet</p>
                <p className="text-[10px] text-muted-foreground max-w-xs leading-normal font-light">
                  Your assessment has not generated any recommendations, or a scan is currently pending.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {parsedImprovementPlan.recommendations.map((rec: any, idx: number) => (
                  <div key={idx} className="relative pl-6 flex flex-col gap-1 border-l border-border/40 pb-2">
                    {/* Dot */}
                    <div className="absolute left-[-4.5px] top-1.5 size-2 rounded-full bg-accent shrink-0" />
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-bold text-foreground/95">
                        {rec.dimension === "UnverifiedSkills" ? "Verify Skills" : rec.dimension}
                      </span>
                      <Chip
                        size="sm"
                        variant="soft"
                        color={rec.priority === "High" ? "danger" : "warning"}
                        className="h-4 text-[7px] font-black uppercase border-none px-1"
                      >
                        {rec.priority}
                      </Chip>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-normal font-light">
                      <strong>Observation:</strong> {rec.observation}
                    </p>
                    <p className="text-[11px] text-foreground/80 leading-normal font-light bg-surface-secondary/35 p-2.5 rounded-xl border border-border/20 mt-1">
                      <strong>Action:</strong> {rec.action}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

      </div>

      {/* Row 4: Jobs & Community Sync */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">

        {/* Jobs Match Center (6/10 grid) */}
        <Card className="lg:col-span-6" glow={false}>
          <div className="flex items-center justify-between pb-2 border-b border-border/20 mb-4 select-none">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-surface-secondary flex items-center justify-center text-foreground">
                <Briefcase size={18} className="text-accent" />
              </div>
              <div>
                <Typography type="h3" className="font-bold text-foreground">Jobs Match Center</Typography>
                <Typography type="body-xs" className="text-muted">Targeted jobs matching your verified capability stack</Typography>
              </div>
            </div>
            <Link
              href="/jobs"
              className="text-[10px] text-accent font-bold hover:underline font-sans"
            >
              Browse Jobs
            </Link>
          </div>

          <div className="font-sans">
            <Tabs
              selectedKey={activeJobTab}
              onSelectionChange={(key) => setActiveJobTab(key as string)}
              variant="secondary"
              className="mb-4"
            >
              <Tabs.ListContainer>
                <Tabs.List aria-label="Jobs tabs" className="gap-6 border-b border-border/40">
                  <Tabs.Tab id="recommended" className="pb-1.5 text-xs font-semibold select-none cursor-pointer">
                    <span>Recommended Matches</span>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab id="applied" className="pb-1.5 text-xs font-semibold select-none cursor-pointer">
                    <span>Application Pipeline ({appliedJobs.length})</span>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>

            {isLoadingJobs ? (
              <div className="flex items-center justify-center p-8 min-h-[140px]">
                <Spinner color="accent" size="sm" />
              </div>
            ) : activeJobTab === "recommended" ? (
              recommendedJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted min-h-[140px]">
                  <AlertCircle size={20} className="mb-2 text-muted-foreground/60" />
                  <p className="text-xs font-semibold text-foreground/80 mb-0.5">No Matching Jobs</p>
                  <p className="text-[10px] text-muted-foreground max-w-xs leading-normal font-light">
                    We couldn't find matching vacancies. Try updating your target skills in your CV to retrieve semantic matches.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                  {recommendedJobs.map((job: any) => {
                    const matchedCount = job.skills.filter((s: string) =>
                      verifiedSkills.some((vs: any) => vs.skillName.toLowerCase() === s.toLowerCase())
                    ).length;
                    const matchPercentage = job.skills.length > 0
                      ? Math.round((matchedCount / job.skills.length) * 100)
                      : 100;
                    return (
                      <div
                        key={job.id}
                        className="p-3.5 rounded-xl border border-border/30 bg-surface-secondary/20 hover:bg-surface-secondary/40 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span className="font-extrabold text-foreground text-xs leading-snug line-clamp-1">{job.title}</span>
                            <Chip size="sm" variant="soft" color={matchPercentage > 50 ? "success" : "warning"} className="h-4 text-[7px] font-black uppercase border-none px-1">
                              {matchPercentage}% Match
                            </Chip>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-medium block -mt-0.5">{job.organizationName}</span>
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <span className="text-[9px] bg-border/20 text-muted px-1.5 py-0.5 rounded font-bold uppercase">{job.workplaceType}</span>
                            <span className="text-[9px] bg-border/20 text-muted px-1.5 py-0.5 rounded font-bold uppercase">{job.city}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/10">
                          <span className="text-[9px] text-muted-foreground font-semibold">{job.salary || "Salary Undisclosed"}</span>
                          <Link
                            href={`/jobs/${job.id}`}
                            className="text-[9px] text-accent font-bold hover:underline"
                          >
                            View Details &rarr;
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : appliedJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted min-h-[140px]">
                <AlertCircle size={20} className="mb-2 text-muted-foreground/60" />
                <p className="text-xs font-semibold text-foreground/80 mb-0.5">No Applications</p>
                <p className="text-[10px] text-muted-foreground max-w-xs leading-normal font-light">
                  You haven't submitted any job applications yet. Search open vacancies to apply.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                {appliedJobs.map((app: any) => {
                  const getAppStatusColor = (s: string) => {
                    switch (s) {
                      case "Offered": return "success";
                      case "Interviewing":
                      case "Screening": return "warning";
                      case "Rejected": return "danger";
                      default: return "default";
                    }
                  };
                  return (
                    <div
                      key={app.id}
                      className="p-3 rounded-xl border border-border/20 bg-surface-secondary/20 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-surface border border-border/30 text-muted/70">
                          <Briefcase size={14} />
                        </div>
                        <div>
                          <span className="font-extrabold text-foreground text-xs block leading-snug">{app.job?.title}</span>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground font-light">
                            <span>{app.job?.organizationName}</span>
                            <span>&bull;</span>
                            <span className="flex items-center gap-1">
                              <Calendar size={10} />
                              {new Date(app.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Chip size="sm" variant="soft" color={getAppStatusColor(app.status)} className="h-5 text-[8px] font-black uppercase border-none">
                        {app.status}
                      </Chip>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {/* Community Reputation & Badges (4/12 grid) */}
        <Card className="lg:col-span-4" glow={false}>
          <div className="flex items-center justify-between pb-2 border-b border-border/20 mb-4 select-none">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-surface-secondary flex items-center justify-center text-foreground">
                <MessageCircle size={18} className="text-accent" />
              </div>
              <div>
                <Typography type="h3" className="font-bold text-foreground">Community & Badging</Typography>
                <Typography type="body-xs" className="text-muted">Forum reputation and ecosystem status</Typography>
              </div>
            </div>
            <Link
              href="/forum"
              className="text-[10px] text-accent font-bold hover:underline font-sans"
            >
              Enter Forum
            </Link>
          </div>

          <div className="space-y-4 font-sans select-none flex flex-col justify-between h-[230px]">
            <div className="space-y-4">
              {/* Reputation Display */}
              <div className="p-4 rounded-xl border border-border/30 bg-surface-secondary/20 text-center flex flex-col items-center justify-center">
                <span className="text-[9px] text-muted font-black uppercase tracking-widest block mb-1">Forum Reputation Points</span>
                <span className="text-2xl font-black text-foreground">{forumProfile?.reputation ?? 0}</span>
                <span className="text-[10px] text-muted-foreground font-light mt-1">
                  Earn points by posting topics (+5), replies (+2), and receiving upvotes (+10)
                </span>
              </div>

              {/* Achievements & Badges */}
              <div>
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider block mb-2">Ecosystem Badges</span>
                <div className="flex flex-wrap gap-1.5">
                  {(forumProfile?.reputation ?? 0) >= 1000 ? (
                    <Chip size="sm" color="success" variant="soft" className="h-5 text-[8px] font-black uppercase border-none px-2">
                      Top Contributor
                    </Chip>
                  ) : (
                    <Chip size="sm" color="default" variant="soft" className="h-5 text-[8px] font-black uppercase border-none px-2 opacity-50">
                      Top Contributor (LOCKED)
                    </Chip>
                  )}
                  {(forumProfile?.reputation ?? 0) >= 50 ? (
                    <Chip size="sm" color="warning" variant="soft" className="h-5 text-[8px] font-black uppercase border-none px-2">
                      Community Helper
                    </Chip>
                  ) : (
                    <Chip size="sm" color="default" variant="soft" className="h-5 text-[8px] font-black uppercase border-none px-2 opacity-50">
                      Community Helper (LOCKED)
                    </Chip>
                  )}
                  {latestAssessment?.status === "Completed" ? (
                    <Chip size="sm" color="success" variant="soft" className="h-5 text-[8px] font-black uppercase border-none px-2">
                      Verified Dev
                    </Chip>
                  ) : (
                    <Chip size="sm" color="default" variant="soft" className="h-5 text-[8px] font-black uppercase border-none px-2 opacity-50">
                      Verified Dev (LOCKED)
                    </Chip>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[9px] text-muted-foreground leading-normal font-light">
              Badges are synced with blockchain ecosystem nodes and visible on your public developer profile.
            </p>
          </div>
        </Card>

      </div>
    </div>
  );
}
