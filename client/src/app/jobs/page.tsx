"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  jobsApi,
  type PublicJobDto,
  type JobApplicationDto,
  type ExplainableMatchReportDto,
  type JobApplicantDto
} from "@/services/jobs.service";
import {
  Input,
  Button,
  Chip,
  Tabs,
  Spinner,
  Switch,
  Modal
} from "@heroui/react";
import { Card } from "@/components/ui/card";
import {
  Briefcase,
  Bookmark,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  Info,
  Copy,
  XCircle,
  X
} from "lucide-react";
import { PublicNavigationHeader } from "@/components/ui/public-navigation-header";
import { JobCard } from "./_components/job-card";
import { JobCompatibilityCard } from "./_components/job-compatibility-card";
import { JobRequirementsCard } from "./_components/job-requirements-card";
import { useSavedJobsStore } from "@/stores/use-saved-jobs-store";

export default function JobsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  // Search & Filters State
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [workplaceType, setWorkplaceType] = useState<string>("");
  const [employmentType, setEmploymentType] = useState<string>("");
  const [seniority, setSeniority] = useState<string>("");

  // Pagination & Lists State
  const [activeTab, setActiveTab] = useState<string>("explore");
  const [jobs, setJobs] = useState<PublicJobDto[]>([]);
  const [recommendedJobs, setRecommendedJobs] = useState<PublicJobDto[]>([]);
  const [appliedJobs, setAppliedJobs] = useState<JobApplicationDto[]>([]);

  const [totalJobs, setTotalJobs] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Split-screen selected job details state
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const savedJobs = useSavedJobsStore((state) => state.savedJobs);
  const selectedIsSaved = useSavedJobsStore((state) => state.savedJobIds.has(selectedJobId || ""));

  const [selectedJob, setSelectedJob] = useState<PublicJobDto | null>(null);
  const [selectedReport, setSelectedReport] = useState<ExplainableMatchReportDto | null>(null);
  const [selectedApplied, setSelectedApplied] = useState(false);
  const [selectedApplicants, setSelectedApplicants] = useState<JobApplicantDto[]>([]);
  const [selectedIsRecruiter, setSelectedIsRecruiter] = useState(false);
  const [selectedJobStatus, setSelectedJobStatus] = useState("Published");
  const [selectedJobActive, setSelectedJobActive] = useState(true);
  const [selectedApplying, setSelectedApplying] = useState(false);
  const [selectedApplyError, setSelectedApplyError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedRecruiterActiveTab, setSelectedRecruiterActiveTab] = useState<string>("management");
  const [selectedUpdateLoading, setSelectedUpdateLoading] = useState(false);
  const [isJdModalOpen, setIsJdModalOpen] = useState(false);

  // Fetch Jobs function
  const fetchExploreJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await jobsApi.searchJobs({
        query: query || undefined,
        location: location || undefined,
        workplaceType: workplaceType || undefined,
        employmentType: employmentType || undefined,
        seniority: seniority || undefined,
        page,
        pageSize,
      });
      setJobs(result.items || []);
      setTotalJobs(result.total || 0);
    } catch (err: any) {
      setError(err?.message || "Failed to load jobs.");
    } finally {
      setLoading(false);
    }
  }, [query, location, workplaceType, employmentType, seniority, page, pageSize]);

  // Fetch other tabs depending on authentication
  const fetchSavedJobs = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      await useSavedJobsStore.getState().fetchSavedJobs();
    } catch (err) {
      console.error("Failed to fetch saved jobs:", err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchAppliedJobs = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await jobsApi.getApplications();
      setAppliedJobs(data);
    } catch (err) {
      console.error("Failed to fetch applications:", err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchRecommendations = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await jobsApi.getRecommendations();
      setRecommendedJobs(data);
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Handle Tab Switch
  useEffect(() => {
    if (activeTab === "explore") {
      fetchExploreJobs();
    } else if (activeTab === "recommended") {
      fetchRecommendations();
    } else if (activeTab === "saved") {
      fetchSavedJobs();
    } else if (activeTab === "applied") {
      fetchAppliedJobs();
    }
  }, [activeTab, fetchExploreJobs, fetchRecommendations, fetchSavedJobs, fetchAppliedJobs]);

  // Auto-select first job on list load
  useEffect(() => {
    let currentList: any[] = [];
    if (activeTab === "explore") {
      currentList = jobs;
    } else if (activeTab === "recommended") {
      currentList = recommendedJobs;
    } else if (activeTab === "saved") {
      currentList = savedJobs;
    } else if (activeTab === "applied") {
      currentList = appliedJobs;
    }

    if (currentList.length > 0) {
      const ids = currentList.map((item) => (activeTab === "applied" ? item.job.id : item.id));
      if (!selectedJobId || !ids.includes(selectedJobId)) {
        setSelectedJobId(ids[0]);
      }
    } else {
      setSelectedJobId(null);
    }
  }, [activeTab, jobs, recommendedJobs, savedJobs, appliedJobs, selectedJobId]);

  // Pre-fetch saved jobs when authenticated to populate the ID set
  useEffect(() => {
    if (isAuthenticated) {
      useSavedJobsStore.getState().fetchSavedJobs();
    } else {
      useSavedJobsStore.getState().clearStore();
    }
  }, [isAuthenticated]);

  // Fetch detail for selected job
  useEffect(() => {
    setIsJdModalOpen(false);
    if (!selectedJobId) {
      setSelectedJob(null);
      setSelectedReport(null);
      setSelectedApplied(false);
      setSelectedApplicants([]);
      setSelectedIsRecruiter(false);
      return;
    }

    const fetchSelectedJobDetail = async () => {
      setLoadingDetail(true);
      setSelectedApplyError(null);
      try {
        // Fetch public details
        const jobData = await jobsApi.getDetails(selectedJobId);
        setSelectedJob(jobData);
        setSelectedJobStatus(jobData.status);
        setSelectedJobActive(jobData.isActive);

        if (isAuthenticated) {
          // Fetch eligibility
          try {
            const reportData = await jobsApi.getEligibility(selectedJobId);
            setSelectedReport(reportData);
          } catch (elErr) {
            console.warn("User may not be a candidate or profile incomplete for match assessment:", elErr);
            setSelectedReport(null);
          }

          // Check if applied
          try {
            const apps = await jobsApi.getApplications();
            setSelectedApplied(apps.some(a => a.jobVacancyId === selectedJobId));
          } catch (err) {
            console.error("Failed to fetch applications:", err);
          }



          // Check if recruiter
          try {
            const applicantsData = await jobsApi.getApplicants(selectedJobId);
            setSelectedApplicants(applicantsData);
            setSelectedIsRecruiter(true);
          } catch (reqErr) {
            setSelectedIsRecruiter(false);
          }
        }
      } catch (err) {
        console.error("Failed to load selected job details:", err);
      } finally {
        setLoadingDetail(false);
      }
    };

    fetchSelectedJobDetail();
  }, [selectedJobId, isAuthenticated]);

  // Handle select job without full navigation on desktop
  const handleSelectJob = (jobId: string, event: React.MouseEvent) => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      event.preventDefault();
      setSelectedJobId(jobId);
    }
  };

  // Actions for selected job
  const handleApplySelected = async () => {
    if (!selectedJobId) return;
    if (!isAuthenticated) {
      router.push(`/login?callbackUrl=/jobs`);
      return;
    }
    setSelectedApplying(true);
    setSelectedApplyError(null);
    try {
      await jobsApi.apply(selectedJobId);
      setSelectedApplied(true);
      const reportData = await jobsApi.getEligibility(selectedJobId);
      setSelectedReport(reportData);
      if (activeTab === "applied") {
        fetchAppliedJobs();
      }
    } catch (err: any) {
      setSelectedApplyError(err?.response?.data?.message || err?.message || "Failed to submit application.");
    } finally {
      setSelectedApplying(false);
    }
  };

  const handleToggleSaveSelected = async () => {
    if (!selectedJobId) return;
    if (!isAuthenticated) {
      router.push(`/login?callbackUrl=/jobs`);
      return;
    }
    try {
      await useSavedJobsStore.getState().toggleSaveJob(selectedJobId, selectedJob || undefined);
    } catch (err) {
      console.error("Failed to toggle save:", err);
    }
  };

  const handleUpdateStatusSelected = async (status: string, active: boolean) => {
    if (!selectedJobId) return;
    setSelectedUpdateLoading(true);
    try {
      const updated = await jobsApi.updateStatus(selectedJobId, status, active);
      setSelectedJobStatus(updated.status);
      setSelectedJobActive(updated.isActive);
      setSelectedJob(updated);
      if (activeTab === "explore") fetchExploreJobs();
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setSelectedUpdateLoading(false);
    }
  };

  const handleDuplicateSelected = async () => {
    if (!selectedJobId) return;
    try {
      const duplicated = await jobsApi.duplicate(selectedJobId);
      setSelectedJobId(duplicated.id);
      if (activeTab === "explore") fetchExploreJobs();
    } catch (err) {
      console.error("Failed to duplicate job:", err);
    }
  };

  // Trigger search on filter changes or manual submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    if (activeTab === "explore") {
      fetchExploreJobs();
    } else {
      setActiveTab("explore");
    }
  };

  const handleResetFilters = () => {
    setQuery("");
    setLocation("");
    setWorkplaceType("");
    setEmploymentType("");
    setSeniority("");
    setPage(1);
  };

  const toggleSaveJob = async (jobId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isAuthenticated) {
      router.push("/login?callbackUrl=/jobs");
      return;
    }
    const jobObj = jobs.find(j => j.id === jobId) || 
                   recommendedJobs.find(j => j.id === jobId) || 
                   savedJobs.find(j => j.id === jobId) || 
                   (selectedJob && selectedJob.id === jobId ? selectedJob : undefined);
    try {
      await useSavedJobsStore.getState().toggleSaveJob(jobId, jobObj);
    } catch (err) {
      console.error("Failed to toggle save job:", err);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans select-none pb-12 transition-colors duration-300">
      {/* Navigation Header */}
      <PublicNavigationHeader />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-6 md:px-12 mt-8 flex flex-col gap-6">

        {/* Banner Title */}
        <div className="flex flex-col gap-2 text-left">
          <h1 className="text-3xl font-extrabold tracking-tight font-outfit text-foreground" id="page-title">
            Trust-Based Job Discovery
          </h1>
          <p className="text-muted text-sm max-w-2xl leading-relaxed">
            Browse job postings aligned with the CVerify Capability Graph. Apply with verified skill evidence, credentials, and real repository signals.
          </p>
        </div>

        {/* Horizontal Filters Bar */}
        <Card glow={false} className="w-full bg-surface border border-border/60 rounded-xl p-4 shadow-sm select-none">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-end gap-4 w-full">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 w-full">
              <div className="flex flex-col text-left">
                <label htmlFor="filter-query" className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1 block">Keywords</label>
                <Input
                  id="filter-query"
                  placeholder="Title, company, skill..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full text-xs font-semibold rounded-xl border border-border bg-field-background"
                />
              </div>

              <div className="flex flex-col text-left">
                <label htmlFor="filter-location" className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1 block">Location</label>
                <Input
                  id="filter-location"
                  placeholder="City or remote"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full text-xs font-semibold rounded-xl border border-border bg-field-background"
                />
              </div>

              <div className="flex flex-col text-left">
                <label htmlFor="filter-workplace" className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1 block">Workplace Mode</label>
                <select
                  id="filter-workplace"
                  value={workplaceType}
                  onChange={(e) => setWorkplaceType(e.target.value)}
                  className="w-full bg-field-background border border-border rounded-xl px-3 py-2 text-xs font-semibold text-foreground outline-hidden focus:border-focus h-[40px] cursor-pointer"
                >
                  <option value="">All Modes</option>
                  <option value="Onsite">Onsite</option>
                  <option value="Remote">Remote</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>

              <div className="flex flex-col text-left">
                <label htmlFor="filter-employment" className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1 block">Job Type</label>
                <select
                  id="filter-employment"
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value)}
                  className="w-full bg-field-background border border-border rounded-xl px-3 py-2 text-xs font-semibold text-foreground outline-hidden focus:border-focus h-[40px] cursor-pointer"
                >
                  <option value="">All Types</option>
                  <option value="FullTime">Full Time</option>
                  <option value="PartTime">Part Time</option>
                  <option value="Contract">Contract</option>
                  <option value="Internship">Internship</option>
                </select>
              </div>

              <div className="flex flex-col text-left">
                <label htmlFor="filter-seniority" className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1 block">Seniority</label>
                <select
                  id="filter-seniority"
                  value={seniority}
                  onChange={(e) => setSeniority(e.target.value)}
                  className="w-full bg-field-background border border-border rounded-xl px-3 py-2 text-xs font-semibold text-foreground outline-hidden focus:border-focus h-[40px] cursor-pointer"
                >
                  <option value="">All Seniorities</option>
                  <option value="Junior">Junior</option>
                  <option value="Mid">Mid Level</option>
                  <option value="Senior">Senior</option>
                  <option value="Lead">Lead / Staff</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto shrink-0 mt-4 md:mt-0 md:h-10 self-end">
              <Button type="submit" className="bg-accent text-accent-foreground font-bold rounded-xl px-5 py-2.5 text-xs cursor-pointer hover:opacity-90 flex-1 md:flex-none h-10" id="btn-apply-filters">
                Search
              </Button>
              <Button variant="ghost" className="font-semibold text-muted rounded-xl px-4 py-2.5 text-xs cursor-pointer hover:bg-surface-secondary flex-1 md:flex-none h-10" onClick={handleResetFilters} id="btn-clear-filters">
                Reset
              </Button>
            </div>
          </form>
        </Card>

        {/* 2-Column Split-Screen Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start mt-2 relative">

          {/* Column 2: Job Feed Feed (Scrollable on desktop) */}
          {/* Column 2: Job Feed Feed (Scrollable on desktop) */}
          <section className="w-full flex flex-col gap-4 lg:h-[calc(100vh-190px)] lg:overflow-y-auto lg:pr-2">
            <Tabs
              selectedKey={activeTab}
              onSelectionChange={(key) => {
                setActiveTab(key.toString());
                setPage(1);
              }}
              variant="secondary"
              className="w-full sticky top-0 bg-background/95 backdrop-blur-xs z-10 pb-2"
            >
              <Tabs.ListContainer className="w-full overflow-x-hidden">
                <Tabs.List aria-label="Job Feed Navigation" className="w-full flex border-b border-border select-none">
                  <Tabs.Tab id="explore" className="flex-1 pb-2 text-xs font-semibold select-none cursor-pointer whitespace-nowrap flex justify-center">
                    Explore
                    <Tabs.Indicator className="h-0.5 bg-accent" />
                  </Tabs.Tab>
                  {isAuthenticated && (
                    <>
                      <Tabs.Tab id="recommended" className="flex-1 pb-2 text-xs font-semibold select-none cursor-pointer whitespace-nowrap flex justify-center">
                        Recommended
                        <Tabs.Indicator className="h-0.5 bg-accent" />
                      </Tabs.Tab>
                      <Tabs.Tab id="saved" className="flex-1 pb-2 text-xs font-semibold select-none cursor-pointer whitespace-nowrap flex justify-center">
                        Saved
                        <Tabs.Indicator className="h-0.5 bg-accent" />
                      </Tabs.Tab>
                      <Tabs.Tab id="applied" className="flex-1 pb-2 text-xs font-semibold select-none cursor-pointer whitespace-nowrap flex justify-center">
                        Applied
                        <Tabs.Indicator className="h-0.5 bg-accent" />
                      </Tabs.Tab>
                    </>
                  )}
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 select-none">
                <Spinner size="sm" color="warning" />
                <span className="text-muted text-xs mt-2 font-medium">Loading jobs feed...</span>
              </div>
            ) : error ? (
              <Card glow={false} className="border border-danger/20 bg-danger-foreground/20 rounded-xl p-6 text-center select-none">
                <span className="text-danger font-semibold text-sm block mb-1">Error fetching jobs</span>
                <span className="text-muted text-xs block mb-4">{error}</span>
                <Button variant="ghost" className="text-danger border border-danger/40 rounded-xl px-4 py-2 text-xs cursor-pointer font-semibold" onClick={fetchExploreJobs}>
                  Retry
                </Button>
              </Card>
            ) : activeTab === "explore" && jobs.length === 0 ? (
              <div className="text-center py-16 bg-surface border border-border border-dashed rounded-xl select-none">
                <Briefcase size={36} className="text-muted mx-auto mb-3" />
                <h3 className="font-bold text-base text-foreground mb-1">No Jobs Found</h3>
                <p className="text-muted text-xs max-w-sm mx-auto">
                  We couldn't find any job openings matching your query. Try broadening your filter settings.
                </p>
              </div>
            ) : activeTab === "recommended" && recommendedJobs.length === 0 ? (
              <div className="text-center py-16 bg-surface border border-border border-dashed rounded-xl select-none">
                <Sparkles size={36} className="text-muted mx-auto mb-3" />
                <h3 className="font-bold text-base text-foreground mb-1">No Recommendations Yet</h3>
                <p className="text-muted text-xs max-w-sm mx-auto">
                  Complete your capability assessments or update your search profile to receive custom job recommendations.
                </p>
              </div>
            ) : activeTab === "saved" && savedJobs.length === 0 ? (
              <div className="text-center py-16 bg-surface border border-border border-dashed rounded-xl select-none">
                <Bookmark size={36} className="text-muted mx-auto mb-3" />
                <h3 className="font-bold text-base text-foreground mb-1">No Saved Jobs</h3>
                <p className="text-muted text-xs max-w-sm mx-auto">
                  Jobs you bookmark or save will appear here for easy access.
                </p>
              </div>
            ) : activeTab === "applied" && appliedJobs.length === 0 ? (
              <div className="text-center py-16 bg-surface border border-border border-dashed rounded-xl select-none">
                <CheckCircle2 size={36} className="text-muted mx-auto mb-3" />
                <h3 className="font-bold text-base text-foreground mb-1">No Applications Yet</h3>
                <p className="text-muted text-xs max-w-sm mx-auto">
                  You haven't submitted any job applications yet. Keep searching to find your next opportunity!
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* List Explore/Recommended/Saved Jobs */}
                {activeTab !== "applied" &&
                  (activeTab === "explore" ? jobs : activeTab === "recommended" ? recommendedJobs : savedJobs).map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      isSaved={activeTab === "saved" || savedJobs.some((sj) => sj.id === job.id)}
                      onToggleSave={toggleSaveJob}
                      isAuthenticated={isAuthenticated}
                      isSelected={selectedJobId === job.id}
                      onClick={(e) => handleSelectJob(job.id, e)}
                    />
                  ))}

                {/* List Applied Applications */}
                {activeTab === "applied" &&
                  appliedJobs.map((app) => (
                    <JobCard
                      key={app.id}
                      job={app.job}
                      isSaved={false}
                      onToggleSave={toggleSaveJob}
                      isAuthenticated={isAuthenticated}
                      status={app.status}
                      isSelected={selectedJobId === app.job.id}
                      onClick={(e) => handleSelectJob(app.job.id, e)}
                    />
                  ))}
              </div>
            )}
          </section>

          {/* Column 3: Selected Job Detail (Sticky & Scrollable on desktop) */}
          <section className="hidden lg:flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
            {loadingDetail ? (
              <Card glow={false} className="border border-border/60 bg-surface rounded-xl p-8 flex flex-col items-center justify-center h-full min-h-[300px] select-none">
                <Spinner size="sm" color="warning" />
                <span className="text-muted text-xs mt-2 font-medium">Loading details...</span>
              </Card>
            ) : selectedJob ? (
              <div className="flex flex-col gap-6">

                {/* Recruiter Console (if owner) */}
                {selectedIsRecruiter && (
                  <Card glow={false} className="border border-border/60 bg-surface rounded-xl p-5 flex flex-col gap-4 text-left">
                    <div className="flex items-center justify-between select-none">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Recruiter Console</h2>
                      <Chip size="sm" variant="soft" className="text-xs font-bold bg-surface-secondary text-foreground">
                        Owner View
                      </Chip>
                    </div>

                    <Tabs
                      selectedKey={selectedRecruiterActiveTab}
                      onSelectionChange={(key) => setSelectedRecruiterActiveTab(key.toString())}
                      variant="secondary"
                      className="w-full"
                    >
                      <Tabs.ListContainer>
                        <Tabs.List aria-label="Recruiter Actions" className="w-full justify-start gap-4 border-b border-border mb-4 select-none">
                          <Tabs.Tab id="management" className="pb-2 text-xs font-semibold select-none cursor-pointer whitespace-nowrap">
                            Details
                            <Tabs.Indicator className="h-0.5 bg-accent" />
                          </Tabs.Tab>
                          <Tabs.Tab id="applicants" className="pb-2 text-xs font-semibold select-none cursor-pointer whitespace-nowrap">
                            {`Applicants (${selectedApplicants.length})`}
                            <Tabs.Indicator className="h-0.5 bg-accent" />
                          </Tabs.Tab>
                        </Tabs.List>
                      </Tabs.ListContainer>
                    </Tabs>

                    {selectedRecruiterActiveTab === "management" && (
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between select-none">
                          <span className="text-xs font-bold text-foreground">Publishing Status</span>
                          <span className="text-xs font-bold text-muted">{selectedJobStatus}</span>
                        </div>

                        <div className="flex gap-2 select-none">
                          <Button
                            size="sm"
                            className="bg-default text-default-foreground font-bold flex-1 rounded-xl py-2 cursor-pointer"
                            isDisabled={selectedUpdateLoading}
                            onClick={() => handleUpdateStatusSelected(selectedJobStatus === "Published" ? "Draft" : "Published", selectedJobActive)}
                          >
                            {selectedUpdateLoading && <Spinner size="sm" color="current" className="mr-1.5 size-3.5" />}
                            {selectedJobStatus === "Published" ? "Unpublish" : "Publish"}
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="font-bold flex-1 border border-border/60 rounded-xl py-2 cursor-pointer"
                            onClick={handleDuplicateSelected}
                          >
                            <Copy size={14} className="mr-1" />
                            Duplicate
                          </Button>
                        </div>

                        <div className="h-px bg-border/40 w-full select-none" />

                        <div className="flex flex-col gap-1 select-none">
                          <label className="text-[11px] font-bold text-foreground mb-1">Quick Update Status</label>
                          <select
                            value={selectedJobStatus}
                            onChange={(e) => handleUpdateStatusSelected(e.target.value, selectedJobActive)}
                            className="bg-background border border-border text-xs rounded-md p-2 text-foreground outline-hidden focus:border-focus"
                          >
                            <option value="Draft">Draft</option>
                            <option value="Published">Published</option>
                            <option value="Archived">Archived</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-between text-xs font-semibold text-foreground select-none">
                          <span>Visible in Search Feed</span>
                          <Switch
                            isSelected={selectedJobActive}
                            onChange={(val: boolean) => handleUpdateStatusSelected(selectedJobStatus, val)}
                            aria-label="Visible in search feed toggle"
                            className="cursor-pointer"
                          >
                            {({ isSelected }) => (
                              <Switch.Control>
                                <Switch.Thumb />
                              </Switch.Control>
                            )}
                          </Switch>
                        </div>
                      </div>
                    )}

                    {selectedRecruiterActiveTab === "applicants" && (
                      <div className="flex flex-col gap-3">
                        {selectedApplicants.length === 0 ? (
                          <span className="text-xs text-muted text-center py-4 block select-none">
                            No candidates have applied to this job opening yet.
                          </span>
                        ) : (
                          <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-1">
                            {selectedApplicants.map((app) => (
                              <div key={app.id} className="p-3 bg-background border border-border/40 rounded-lg flex flex-col gap-1 text-left">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-foreground">{app.fullName}</span>
                                  <Chip size="sm" variant="soft" className="text-[10px] font-bold">
                                    {app.status}
                                  </Chip>
                                </div>
                                <span className="text-[10px] text-muted">{app.email}</span>
                                <span className="text-[9px] text-muted mt-1 select-none">
                                  Applied: {new Date(app.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                )}

                {/* Compatibility Analysis Card */}
                <JobCompatibilityCard
                  id={selectedJob.id}
                  job={selectedJob}
                  isAuthenticated={isAuthenticated}
                  report={selectedReport}
                  applied={selectedApplied}
                  applying={selectedApplying}
                  applyError={selectedApplyError}
                  onApply={handleApplySelected}
                  onRedirectToLogin={() => router.push(`/login?callbackUrl=/jobs`)}
                  onViewDetails={() => setIsJdModalOpen(true)}
                />
              </div>
            ) : (
              <Card glow={false} className="border border-border/60 bg-surface rounded-xl p-8 flex flex-col items-center justify-center h-full min-h-[300px] text-center select-none">
                <Briefcase size={36} className="text-muted mb-3" />
                <span className="text-foreground font-bold text-sm">Select a job to view details</span>
                <span className="text-muted text-xs mt-1">Choose a role from the feed to view its compatibility score, requirement checklist, and complete description.</span>
              </Card>
            )}
          </section>

        </div>
      </main>

      {/* Job Details Modal */}
      {selectedJob && (
        <Modal.Backdrop
          isOpen={isJdModalOpen}
          onOpenChange={setIsJdModalOpen}
          className="bg-background/80 backdrop-blur-xs animate-in fade-in duration-200 z-50"
        >
          <Modal.Container size="lg">
            <Modal.Dialog className="w-full max-w-5xl bg-surface border border-border rounded-2xl shadow-modal p-8 text-left relative focus-visible:outline-hidden focus:outline-hidden overflow-y-auto max-h-[90vh]">
              <Modal.CloseTrigger
                aria-label="Close dialog"
                className="absolute right-5 top-5 p-1.5 rounded-lg hover:bg-surface-secondary text-muted hover:text-foreground cursor-pointer z-10"
              >
                <X size={16} />
              </Modal.CloseTrigger>

              <Modal.Header className="sr-only">
                <Modal.Heading className="outline-hidden">
                  Job Description Details
                </Modal.Heading>
              </Modal.Header>

              <Modal.Body>
                <JobRequirementsCard job={selectedJob} />
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}
    </div>
  );
}

