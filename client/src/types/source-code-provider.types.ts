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
  createdAtUtc: string;
  lastSyncedAt: string;
}

export interface RepositorySyncJobStatus {
  jobId: string;
  userId: string;
  authProviderId: string | null;
  status: 'Pending' | 'Syncing' | 'Completed' | 'Failed';
  progress: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryFilterParams {
  providerId?: string;
  search?: string;
  visibility?: string;
  language?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}
