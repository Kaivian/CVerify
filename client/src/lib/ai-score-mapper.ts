/**
 * Shared frontend utility for AI Score mapping, normalization, and badge visibility rules.
 * Ensures consistent displayed scores across CV Preview, Public profile, and Career Preferences.
 */

import { type PublicRepository } from "@/types/profile.types";

/**
 * Normalizes scores to 0-100 scale:
 * - Maps [0, 1] range to [0, 100] by multiplying by 100
 * - Keeps [1, 100] range as-is
 * - Rounds to the nearest integer
 * - Clamps strictly between 0 and 100
 */
export function normalizeScore(score: number | null | undefined): number | null {
  if (score === null || score === undefined || isNaN(score)) {
    return null;
  }

  let normalized = score;
  if (score >= 0.0 && score <= 1.0) {
    normalized = score * 100;
  }

  normalized = Math.round(normalized);

  // Clamp strictly between 0 and 100
  return Math.max(0, Math.min(100, normalized));
}

/**
 * Normalizes and formats score as a percentage string (e.g., "85%").
 */
export function formatScore(score: number | null | undefined, fallback = "N/A"): string {
  const normalized = normalizeScore(score);
  if (normalized === null) {
    return fallback;
  }
  return `${normalized}%`;
}

/**
 * Checks if at least one repository has a completed AI analysis.
 */
export function hasAiAudit(repos: PublicRepository[] | null | undefined): boolean {
  if (!repos || repos.length === 0) return false;
  return repos.some(r => r.latestAnalysisStatus === "Completed");
}

/**
 * Skills Verified logic: returns true if completed repos exist and have primary languages.
 */
export function isSkillsVerified(repos: PublicRepository[] | null | undefined): boolean {
  if (!repos || repos.length === 0) return false;
  return repos.some(
    r => r.latestAnalysisStatus === "Completed" && !!(r.primaryLanguage || r.classification)
  );
}

/**
 * Extracts a unique list of detected languages or classifications from completed repository analyses.
 */
export function getVerifiedSkills(repos: PublicRepository[] | null | undefined): string[] {
  if (!repos || repos.length === 0) return [];
  const skillsSet = new Set<string>();
  
  repos.forEach(r => {
    if (r.latestAnalysisStatus === "Completed") {
      if (r.primaryLanguage) {
        skillsSet.add(r.primaryLanguage.trim());
      }
      if (r.classification) {
        skillsSet.add(r.classification.trim());
      }
    }
  });

  return Array.from(skillsSet);
}

/**
 * Returns true if a real GitHub or social link exists.
 */
export function isGitHubConnected(socialLinks: string[] | null | undefined): boolean {
  if (!socialLinks) return false;
  return socialLinks.some(link => link.toLowerCase().includes("github.com"));
}

/**
 * Returns true if LinkedIn is connected in the public social links.
 */
export function isLinkedInConnected(socialLinks: string[] | null | undefined): boolean {
  if (!socialLinks) return false;
  return socialLinks.some(link => link.toLowerCase().includes("linkedin.com"));
}

/**
 * Returns true if a valid trust score exists.
 */
export function isTrustScoreEvaluated(trustScore: number | null | undefined): boolean {
  return normalizeScore(trustScore) !== null;
}
