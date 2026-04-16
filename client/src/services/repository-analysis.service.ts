import mockAiData from "./mock-ai-data.json";
import { RepositoryAnalysis } from "../types/repository-analysis.types";

export const repositoryAnalysisApi = {
  analyzeRepository: async (
    repositoryId: string,
    repoName?: string,
    repoOwner?: string
  ): Promise<RepositoryAnalysis> => {
    // Simulated failure for testing error flows
    if (repositoryId.startsWith("fail-") || repoName?.toLowerCase().includes("fail")) {
      return new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Simulated analysis engine error: connection timeout to source providers."));
        }, 2500);
      });
    }

    // Simulate realistic processing time (2 to 4 seconds)
    const delay = 2000 + Math.random() * 2000;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Deep clone mock data to avoid mutations
    const analysis: RepositoryAnalysis = JSON.parse(JSON.stringify(mockAiData));

    // Dynamic metadata mapping to future-proof contract and make responses repository-specific
    analysis.repo.id = repositoryId;
    if (repoName) {
      analysis.repo.name = repoName;
      if (repoOwner) {
        analysis.repo.full_name = `${repoOwner}/${repoName}`;
        analysis.repo.url = `https://github.com/${repoOwner}/${repoName}`;
      } else {
        analysis.repo.full_name = `mock-owner/${repoName}`;
        analysis.repo.url = `https://github.com/mock-owner/${repoName}`;
      }
    }

    return analysis;
  },
};
