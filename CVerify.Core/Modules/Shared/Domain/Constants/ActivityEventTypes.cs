namespace CVerify.API.Modules.Shared.Domain.Constants;

public static class ActivityEventTypes
{
    public const string MemberInvited = "MEMBER_INVITED";
    public const string MemberJoined = "MEMBER_JOINED";
    public const string MemberLeft = "MEMBER_LEFT";
    public const string MemberRemoved = "MEMBER_REMOVED";
    public const string MemberSuspended = "MEMBER_SUSPENDED";
    public const string MemberActivated = "MEMBER_ACTIVATED";
    public const string RoleAssigned = "ROLE_ASSIGNED";
    public const string RoleUpdated = "ROLE_UPDATED";
    
    public const string WorkspaceUpdated = "WORKSPACE_UPDATED";
    
    public const string ProjectCreated = "PROJECT_CREATED";
    public const string ProjectUpdated = "PROJECT_UPDATED";
    
    public const string RepositoryConnected = "REPOSITORY_CONNECTED";
    public const string RepositoryRemoved = "REPOSITORY_REMOVED";
    public const string RepositoryAnalyzed = "REPOSITORY_ANALYZED";
    
    public const string VerificationStarted = "VERIFICATION_STARTED";
    public const string VerificationCompleted = "VERIFICATION_COMPLETED";
    public const string VerificationFailed = "VERIFICATION_FAILED";
    
    public const string InterviewCreated = "INTERVIEW_CREATED";
    public const string InterviewCompleted = "INTERVIEW_COMPLETED";
    
    public const string PasswordChanged = "PASSWORD_CHANGED";
    public const string IpVerified = "IP_VERIFIED";
}
