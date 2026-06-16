export interface SourceCodeProvider {
  id: string;
  providerName: string;
  providerEmail: string | null;
  providerUsername: string | null;
  providerDisplayName: string | null;
  providerAvatarUrl: string | null;
  providerProfileUrl: string | null;
  connected: boolean;
  scopeValidationStatus: string;
  lastProviderSyncAt: string | null;
  syncStatus: string;
  syncError: string | null;
}

export interface SourceCodeRepository {
  id: string;
  authProviderId: string;
  externalOrganizationId: string | null;
  externalRepositoryId: string;
  name: string;
  owner: string;
  description: string | null;
  htmlUrl: string | null;
  defaultBranch: string | null;
  ownerLogin: string;
  ownerType: string;
  isPrivate: boolean;
  primaryLanguage: string | null;
  starsCount: number;
  forksCount: number;
  openIssuesCount: number;
  watchersCount: number;
  lastCommitAt: string | null;
  lastUpdatedUtc: string;
  lastSeenAt: string;
  isAccessible: boolean;
  archivedExternally: boolean;
  isEnabled: boolean;
  isVerified: boolean;
  trustScore: number;
  customSettingsJson: string | null;
  classification: string | null;
  authenticityType: string | null;
  latestRiskScore: number;
  latestRiskLevel: string;
  latestAnalysisStatus: "NeverAnalyzed" | "Pending" | "Completed" | "Failed" | "Cancelled" | "TimedOut";
  latestAnalysisCompletedAtUtc: string | null;
  latestRiskFactorsJson: string | null;
  createdAtUtc: string;
  lastSyncedAt: string;
}

export interface ExternalOrganization {
  id: string;
  authProviderId: string;
  externalId: string;
  name: string;
  login: string;
  type: string;
  avatarUrl: string | null;
  htmlUrl: string | null;
  description: string | null;
  isActive: boolean;
}

export interface RepositorySyncJobStatus {
  jobId: string;
  userId: string;
  authProviderId: string | null;
  status: 'Pending' | 'Syncing' | 'Completed' | 'Failed';
  progress: number;
  error: string | null;
  maxPages: number;
  pageSize: number;
  totalSyncedCount: number;
  isPartial: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryFilterParams {
  providerId?: string;
  search?: string;
  visibility?: string;
  language?: string;
  sort?: string;
  category?: string;
  ownerType?: string;
  organizationId?: string;
  mode?: 'all' | 'cv_linked';
  page?: number;
  pageSize?: number;
}
