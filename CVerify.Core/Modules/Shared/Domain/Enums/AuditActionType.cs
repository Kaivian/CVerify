namespace CVerify.API.Modules.Shared.Domain.Enums;

public enum AuditActionType
{
    // Identity & Access
    UserRegistered,
    UserEmailVerified,
    UserDeleted,
    UserDeletedInitiated,
    UserDeletedCancelled,
    ProviderLinked,
    ProviderUnlinked,

    // Roles & Permissions
    RoleCreated,
    RoleUpdated,
    RoleDeleted,
    RoleAssigned,
    RoleRevoked,
    MemberInvited,
    MemberJoined,
    MemberUpdated,
    MemberRemoved,
    InvitationCancelled,

    // Workspace Management
    WorkspaceCreated,
    WorkspaceUpdated,
    WorkspaceDeleted,
    WorkspaceArchived,
    WorkspaceRestored,
    WorkspaceOwnershipTransferred,
    WorkspaceMemberAdded,
    WorkspaceMemberRoleUpdated,
    WorkspaceMemberRemoved,

    // Verification Operations
    RecoveryClaimSubmitted,
    RecoveryClaimFirstApproval,
    RecoveryClaimApproved,
    RecoveryClaimRejected,
    RecoveryDocumentDownloaded,
    ReclaimClaimSubmitted,
    ReclaimClaimFirstApproval,
    ReclaimClaimApproved,
    ReclaimClaimRejected,
    ReclaimDocumentDownloaded,
    Level2RotationRequestSubmitted,
    Level2RotationCallRecorded,
    Level2RotationSupportRejected,
    Level2RotationSupportApproved,
    Level2RotationAdminRejected,
    Level2RotationAdminApproved,
    Level2RotationExecuted,

    // Repository Administration
    RepositoryConnected,
    RepositoryRemoved,
    RepositoryAnalyzed,
    RepositoryReset,

    // Portal Configuration & Rules
    PortalSettingsUpdated,
    SecurityRuleUpdated,
    SystemConfigurationChanged,

    // Data Governance
    DataExported,

    // Profile Updates
    UpdateProfile,
    UpdateUsername,
    SyncAvatar,
    DeleteAvatar
}
