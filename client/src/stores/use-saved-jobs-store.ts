"use client";

import { create } from "zustand";
import { jobsApi, type PublicJobDto } from "@/services/jobs.service";

interface SavedJobsState {
  savedJobIds: Set<string>;
  savedJobs: PublicJobDto[];
  loading: boolean;
  error: string | null;

  fetchSavedJobs: () => Promise<void>;
  toggleSaveJob: (jobId: string, job?: PublicJobDto) => Promise<void>;
  isSaved: (jobId: string) => boolean;
  clearStore: () => void;
}

export const useSavedJobsStore = create<SavedJobsState>((set, get) => ({
  savedJobIds: new Set<string>(),
  savedJobs: [],
  loading: false,
  error: null,

  fetchSavedJobs: async () => {
    set({ loading: true, error: null });
    try {
      const data = await jobsApi.getInteractions("Saved");
      const ids = new Set(data.map((j) => j.id));
      set({ savedJobs: data, savedJobIds: ids, loading: false });
    } catch (err: any) {
      set({
        error: err?.message || "Failed to fetch saved jobs.",
        loading: false,
      });
    }
  },

  toggleSaveJob: async (jobId: string, job?: PublicJobDto) => {
    const { savedJobIds, savedJobs } = get();
    
    // Save previous state for rollback
    const prevIds = new Set(savedJobIds);
    const prevJobs = [...savedJobs];

    const nextIds = new Set(savedJobIds);
    let nextJobs = [...savedJobs];

    const wasSaved = prevIds.has(jobId);

    if (wasSaved) {
      nextIds.delete(jobId);
      nextJobs = nextJobs.filter((j) => j.id !== jobId);
    } else {
      nextIds.add(jobId);
      if (job) {
        if (!nextJobs.some((j) => j.id === jobId)) {
          nextJobs.push(job);
        }
      }
    }

    // Optimistically update the store
    set({ savedJobIds: nextIds, savedJobs: nextJobs });

    try {
      await jobsApi.interact(jobId, "Saved");
    } catch (err: any) {
      console.error(`Failed to toggle save for job ${jobId}, rolling back:`, err);
      // Rollback to previous state on failure
      set({ savedJobIds: prevIds, savedJobs: prevJobs, error: err?.message || "Failed to save job." });
    }
  },

  isSaved: (jobId: string) => {
    return get().savedJobIds.has(jobId);
  },

  clearStore: () => {
    set({
      savedJobIds: new Set<string>(),
      savedJobs: [],
      loading: false,
      error: null,
    });
  },
}));
