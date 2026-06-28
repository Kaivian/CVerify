using Microsoft.EntityFrameworkCore;
using Npgsql;
using CVerify.API.Modules.AiChat.Entities;
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Recovery.Entities;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Email.Entities;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.SourceCode.Entities;

namespace CVerify.API.Modules.Shared.Persistence;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        EnforceImmutableAuditLogs();
        IncrementConcurrencyVersions();
        try
        {
            return await base.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pgEx && pgEx.SqlState == "23505")
        {
            if (pgEx.ConstraintName?.Contains("users_email") == true || pgEx.ConstraintName?.Contains("user_emails_email") == true || pgEx.Message.Contains("users") || pgEx.Detail?.Contains("email") == true)
            {
                throw new DuplicateEmailException("A user with this email address already exists.", ex);
            }
            throw;
        }
    }

    public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        EnforceImmutableAuditLogs();
        IncrementConcurrencyVersions();
        try
        {
            return await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pgEx && pgEx.SqlState == "23505")
        {
            if (pgEx.ConstraintName?.Contains("users_email") == true || pgEx.ConstraintName?.Contains("user_emails_email") == true || pgEx.Message.Contains("users") || pgEx.Detail?.Contains("email") == true)
            {
                throw new DuplicateEmailException("A user with this email address already exists.", ex);
            }
            throw;
        }
    }

    private void EnforceImmutableAuditLogs()
    {
        var auditLogEntries = ChangeTracker.Entries<AuditLog>()
            .Where(e => e.State == EntityState.Modified || e.State == EntityState.Deleted);
        
        if (auditLogEntries.Any())
        {
            throw new InvalidOperationException("Audit logs are strictly immutable and cannot be updated or deleted.");
        }
    }

    private void IncrementConcurrencyVersions()
    {
        var entries = ChangeTracker.Entries()
            .Where(e => e.State == EntityState.Modified);
        
        foreach (var entry in entries)
        {
            if (entry.Entity is User u)
            {
                u.Version++;
            }
            else if (entry.Entity is UserProfile up)
            {
                up.Version++;
            }
            else if (entry.Entity is CareerPreference cp)
            {
                cp.Version++;
            }
            else if (entry.Entity is AiInferredPreference ap)
            {
                ap.Version++;
            }
        }
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<VerificationToken> VerificationTokens => Set<VerificationToken>();
    public DbSet<ResetPasswordToken> ResetPasswordTokens => Set<ResetPasswordToken>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<AuthProvider> AuthProviders => Set<AuthProvider>();
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<OrganizationAuthority> OrganizationAuthorities => Set<OrganizationAuthority>();
    public DbSet<OrganizationMembership> OrganizationMemberships => Set<OrganizationMembership>();
    public DbSet<OrganizationFollower> OrganizationFollowers => Set<OrganizationFollower>();
    public DbSet<OtpVerification> OtpVerifications => Set<OtpVerification>();
    public DbSet<VerificationLink> VerificationLinks => Set<VerificationLink>();
    public DbSet<OrganizationVerification> OrganizationVerifications => Set<OrganizationVerification>();
    public DbSet<Workspace> Workspaces => Set<Workspace>();
    public DbSet<WorkspaceMember> WorkspaceMembers => Set<WorkspaceMember>();
    public DbSet<WorkspaceArchiveSnapshot> WorkspaceArchiveSnapshots => Set<WorkspaceArchiveSnapshot>();
    public DbSet<RecoveryExecutionLock> RecoveryExecutionLocks => Set<RecoveryExecutionLock>();
    public DbSet<OrganizationRecoveryClaim> OrganizationRecoveryClaims => Set<OrganizationRecoveryClaim>();
    public DbSet<ApprovedRecoverySession> ApprovedRecoverySessions => Set<ApprovedRecoverySession>();
    public DbSet<RecoveryToken> RecoveryTokens => Set<RecoveryToken>();
    public DbSet<RepresentativeRotationRequest> RepresentativeRotationRequests => Set<RepresentativeRotationRequest>();
    public DbSet<RepresentativeApprovalVote> RepresentativeApprovalVotes => Set<RepresentativeApprovalVote>();
    public DbSet<RepresentativeAuthorityHistory> RepresentativeAuthorityHistories => Set<RepresentativeAuthorityHistory>();
    public DbSet<OrganizationCredential> OrganizationCredentials => Set<OrganizationCredential>();
    public DbSet<PendingOrganizationOwnership> PendingOrganizationOwnerships => Set<PendingOrganizationOwnership>();
    public DbSet<OrganizationInvitation> OrganizationInvitations => Set<OrganizationInvitation>();
    public DbSet<OrganizationInvitationRole> OrganizationInvitationRoles => Set<OrganizationInvitationRole>();
    public DbSet<RoleAssignment> RoleAssignments => Set<RoleAssignment>();
    public DbSet<WorkspacePost> WorkspacePosts => Set<WorkspacePost>();
    public DbSet<JobVacancy> JobVacancies => Set<JobVacancy>();
    public DbSet<HiringRequirement> HiringRequirements => Set<HiringRequirement>();
    public DbSet<BusinessOutcome> BusinessOutcomes => Set<BusinessOutcome>();
    public DbSet<Responsibility> Responsibilities => Set<Responsibility>();
    public DbSet<RequirementCapability> RequirementCapabilities => Set<RequirementCapability>();
    public DbSet<CapabilityCatalogItem> CapabilityCatalogItems => Set<CapabilityCatalogItem>();
    public DbSet<TechnologyRequirement> TechnologyRequirements => Set<TechnologyRequirement>();
    public DbSet<EvidenceSignal> EvidenceSignals => Set<EvidenceSignal>();
    public DbSet<EvaluationRubric> EvaluationRubrics => Set<EvaluationRubric>();
    public DbSet<InterviewBlueprint> InterviewBlueprints => Set<InterviewBlueprint>();
    public DbSet<RequirementArtifact> RequirementArtifacts => Set<RequirementArtifact>();
    public DbSet<RequirementSnapshot> RequirementSnapshots => Set<RequirementSnapshot>();
    public DbSet<EvaluationRubricSnapshot> EvaluationRubricSnapshots => Set<EvaluationRubricSnapshot>();
    public DbSet<InterviewBlueprintSnapshot> InterviewBlueprintSnapshots => Set<InterviewBlueprintSnapshot>();
    public DbSet<RequirementArtifactSnapshot> RequirementArtifactSnapshots => Set<RequirementArtifactSnapshot>();
    public DbSet<RequirementVectorSnapshot> RequirementVectorSnapshots => Set<RequirementVectorSnapshot>();
    public DbSet<CandidateDiscoveryRun> CandidateDiscoveryRuns => Set<CandidateDiscoveryRun>();
    public DbSet<CapabilityRegistry> CapabilityRegistries => Set<CapabilityRegistry>();
    public DbSet<CapabilityHierarchy> CapabilityHierarchies => Set<CapabilityHierarchy>();
    public DbSet<CapabilityAlias> CapabilityAliases => Set<CapabilityAlias>();

    // CVerify Talent Intelligence Graph & Search Projection DbSets
    public DbSet<CapabilityNode> CapabilityNodes => Set<CapabilityNode>();
    public DbSet<CapabilityEdge> CapabilityEdges => Set<CapabilityEdge>();
    public DbSet<CandidateCapability> CandidateCapabilities => Set<CandidateCapability>();
    public DbSet<CandidateCapabilityEvidence> CandidateCapabilityEvidences => Set<CandidateCapabilityEvidence>();
    public DbSet<CandidateCapabilityScore> CandidateCapabilityScores => Set<CandidateCapabilityScore>();
    public DbSet<CandidateCapabilityHistory> CandidateCapabilityHistories => Set<CandidateCapabilityHistory>();
    public DbSet<EvidenceSource> EvidenceSources => Set<EvidenceSource>();
    public DbSet<EvidenceArtifact> EvidenceArtifacts => Set<EvidenceArtifact>();
    public DbSet<EvidenceClaim> EvidenceClaims => Set<EvidenceClaim>();
    public DbSet<EvidenceVerification> EvidenceVerifications => Set<EvidenceVerification>();
    public DbSet<TrustProfile> TrustProfiles => Set<TrustProfile>();
    public DbSet<TrustComponent> TrustComponents => Set<TrustComponent>();
    public DbSet<TrustCalculation> TrustCalculations => Set<TrustCalculation>();
    public DbSet<CandidateTrustProjection> CandidateTrustProjections => Set<CandidateTrustProjection>();
    public DbSet<CandidateSearchProfile> CandidateSearchProfiles => Set<CandidateSearchProfile>();
    public DbSet<UserFollower> UserFollowers => Set<UserFollower>();
    public DbSet<CandidateRankingProjection> CandidateRankingProjections => Set<CandidateRankingProjection>();
    public DbSet<CandidateMatchProjection> CandidateMatchProjections => Set<CandidateMatchProjection>();
    public DbSet<CandidateEvaluationSnapshot> CandidateEvaluationSnapshots => Set<CandidateEvaluationSnapshot>();
    public DbSet<CandidateCapabilityProjection> CandidateCapabilityProjections => Set<CandidateCapabilityProjection>();
    public DbSet<MatchingEvaluation> MatchingEvaluations => Set<MatchingEvaluation>();
    public DbSet<MatchingFactor> MatchingFactors => Set<MatchingFactor>();
    public DbSet<MatchingExplanation> MatchingExplanations => Set<MatchingExplanation>();
    public DbSet<JobApplication> JobApplications => Set<JobApplication>();
    public DbSet<JobInteraction> JobInteractions => Set<JobInteraction>();

    public DbSet<ActivityEvent> ActivityEvents => Set<ActivityEvent>();
    public DbSet<InAppNotification> InAppNotifications => Set<InAppNotification>();
    public DbSet<NotificationPreference> NotificationPreferences => Set<NotificationPreference>();

    public DbSet<AdminMember> AdminMembers => Set<AdminMember>();
    public DbSet<AdminInvitation> AdminInvitations => Set<AdminInvitation>();
    public DbSet<AdminInvitationRole> AdminInvitationRoles => Set<AdminInvitationRole>();

    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<PendingAuthProvider> PendingAuthProviders => Set<PendingAuthProvider>();
    public DbSet<ExternalOrganization> ExternalOrganizations => Set<ExternalOrganization>();
    public DbSet<SourceCodeRepository> SourceCodeRepositories => Set<SourceCodeRepository>();
    public DbSet<AnalysisJob> AnalysisJobs => Set<AnalysisJob>();
    public DbSet<AnalysisJobEvent> AnalysisJobEvents => Set<AnalysisJobEvent>();
    public DbSet<AnalysisReport> AnalysisReports => Set<AnalysisReport>();
    public DbSet<AnalysisTask> AnalysisTasks => Set<AnalysisTask>();
    public DbSet<AnalysisTaskResult> AnalysisTaskResults => Set<AnalysisTaskResult>();
    public DbSet<AnalysisTaskEvent> AnalysisTaskEvents => Set<AnalysisTaskEvent>();
    public DbSet<AnalysisExecution> AnalysisExecutions => Set<AnalysisExecution>();
    public DbSet<CVerify.API.Pipelines.Shared.Orchestration.Entities.PipelineJob> PipelineJobs => Set<CVerify.API.Pipelines.Shared.Orchestration.Entities.PipelineJob>();
    public DbSet<CVerify.API.Pipelines.Shared.Orchestration.Entities.PipelineTask> PipelineTasks => Set<CVerify.API.Pipelines.Shared.Orchestration.Entities.PipelineTask>();
    public DbSet<CVerify.API.Pipelines.Shared.AI.Entities.PromptDeployment> PromptDeployments => Set<CVerify.API.Pipelines.Shared.AI.Entities.PromptDeployment>();
    public DbSet<CVerify.API.Pipelines.Shared.Artifacts.Entities.ArtifactRegistryEntry> ArtifactRegistryEntries => Set<CVerify.API.Pipelines.Shared.Artifacts.Entities.ArtifactRegistryEntry>();
    public DbSet<CareerPreference> CareerPreferences => Set<CareerPreference>();
    public DbSet<AiInferredPreference> AiInferredPreferences => Set<AiInferredPreference>();
    public DbSet<UserSkill> UserSkills => Set<UserSkill>();
    public DbSet<EducationEntry> EducationEntries => Set<EducationEntry>();
    public DbSet<AcademicAchievement> AcademicAchievements => Set<AcademicAchievement>();
    public DbSet<ProfileAttachment> ProfileAttachments => Set<ProfileAttachment>();
    public DbSet<WorkExperienceEntry> WorkExperiences => Set<WorkExperienceEntry>();
    public DbSet<WorkExperienceAchievement> WorkExperienceAchievements => Set<WorkExperienceAchievement>();
    public DbSet<WorkExperienceTechnology> WorkExperienceTechnologies => Set<WorkExperienceTechnology>();
    public DbSet<WorkExperienceLink> WorkExperienceLinks => Set<WorkExperienceLink>();
    public DbSet<CandidateAssessment> CandidateAssessments => Set<CandidateAssessment>();
    public DbSet<CandidateAssessmentArtifact> CandidateAssessmentArtifacts => Set<CandidateAssessmentArtifact>();
    public DbSet<RepositoryAssessment> RepositoryAssessments => Set<RepositoryAssessment>();
    public DbSet<RepositoryCapability> RepositoryCapabilities => Set<RepositoryCapability>();
    public DbSet<RepositorySkillAttribution> RepositorySkillAttributions => Set<RepositorySkillAttribution>();
    public DbSet<RepositoryDomain> RepositoryDomains => Set<RepositoryDomain>();
    public DbSet<RepositoryIntelligenceSignal> RepositoryIntelligenceSignals => Set<RepositoryIntelligenceSignal>();
    public DbSet<CandidateSkill> CandidateSkills => Set<CandidateSkill>();
    public DbSet<CandidateDomainProfile> CandidateDomainProfiles => Set<CandidateDomainProfile>();
    public DbSet<CandidateIntelligenceSignal> CandidateIntelligenceSignals => Set<CandidateIntelligenceSignal>();
    public DbSet<CandidateBestFitRole> CandidateBestFitRoles => Set<CandidateBestFitRole>();
    public DbSet<CandidateStrengthWeakness> CandidateStrengthsWeaknesses => Set<CandidateStrengthWeakness>();
    public DbSet<CandidateSkillTreeNode> CandidateSkillTreeNodes => Set<CandidateSkillTreeNode>();


    public DbSet<ProjectEntry> ProjectEntries => Set<ProjectEntry>();
    public DbSet<ProjectRepositoryLink> ProjectRepositoryLinks => Set<ProjectRepositoryLink>();
    public DbSet<CvRepositoryMapping> CvRepositoryMappings => Set<CvRepositoryMapping>();
    public DbSet<ProjectTechnology> ProjectTechnologies => Set<ProjectTechnology>();
    public DbSet<ProjectContribution> ProjectContributions => Set<ProjectContribution>();


    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Explicitly declare that primary keys are client-generated UUID v7s and not auto-generated by the database
        modelBuilder.Entity<User>().Property(u => u.Id).ValueGeneratedNever();
        modelBuilder.Entity<Role>().Property(r => r.Id).ValueGeneratedNever();
        modelBuilder.Entity<Permission>().Property(p => p.Id).ValueGeneratedNever();
        modelBuilder.Entity<RefreshToken>().Property(rt => rt.Id).ValueGeneratedNever();
        modelBuilder.Entity<VerificationToken>().Property(vt => vt.Id).ValueGeneratedNever();

        modelBuilder.Entity<UserProfile>().Property(up => up.UserId).ValueGeneratedNever();
        modelBuilder.Entity<CareerPreference>().Property(cp => cp.UserId).ValueGeneratedNever();
        modelBuilder.Entity<AiInferredPreference>().Property(ap => ap.UserId).ValueGeneratedNever();
        modelBuilder.Entity<UserSkill>().Property(us => us.Id).ValueGeneratedNever();
        modelBuilder.Entity<EducationEntry>().Property(ee => ee.Id).ValueGeneratedNever();
        modelBuilder.Entity<AcademicAchievement>().Property(aa => aa.Id).ValueGeneratedNever();
        modelBuilder.Entity<ProfileAttachment>().Property(pa => pa.Id).ValueGeneratedNever();
        modelBuilder.Entity<WorkExperienceEntry>().Property(we => we.Id).ValueGeneratedNever();
        modelBuilder.Entity<WorkExperienceAchievement>().Property(wa => wa.Id).ValueGeneratedNever();
        modelBuilder.Entity<WorkExperienceTechnology>().Property(wt => wt.Id).ValueGeneratedNever();
        modelBuilder.Entity<WorkExperienceLink>().Property(wl => wl.Id).ValueGeneratedNever();
        modelBuilder.Entity<CandidateAssessment>().Property(ca => ca.Id).ValueGeneratedNever();
        modelBuilder.Entity<CandidateAssessmentArtifact>().Property(caa => caa.Id).ValueGeneratedNever();
        modelBuilder.Entity<RepositoryAssessment>().Property(ra => ra.Id).ValueGeneratedNever();
        modelBuilder.Entity<ResetPasswordToken>().Property(rt => rt.Id).ValueGeneratedNever();
        modelBuilder.Entity<OutboxMessage>().Property(om => om.Id).ValueGeneratedNever();
        modelBuilder.Entity<AuditLog>().Property(al => al.Id).ValueGeneratedNever();
        modelBuilder.Entity<Conversation>().Property(c => c.Id).ValueGeneratedNever();
        modelBuilder.Entity<Message>().Property(m => m.Id).ValueGeneratedNever();
        modelBuilder.Entity<AuthProvider>().Property(ap => ap.Id).ValueGeneratedNever();
        modelBuilder.Entity<Organization>().Property(o => o.Id).ValueGeneratedNever();

        // OrganizationFollower â€” composite PK, no auto-generated key
        modelBuilder.Entity<OrganizationFollower>(entity =>
        {
            entity.HasKey(of => new { of.UserId, of.OrganizationId });
            entity.HasOne(of => of.Organization)
                  .WithMany()
                  .HasForeignKey(of => of.OrganizationId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<OrganizationAuthority>().Property(oa => oa.Id).ValueGeneratedNever();
        modelBuilder.Entity<OrganizationMembership>().Property(om => om.Id).ValueGeneratedNever();
        modelBuilder.Entity<OtpVerification>().Property(ov => ov.Id).ValueGeneratedNever();
        modelBuilder.Entity<VerificationLink>().Property(vl => vl.Id).ValueGeneratedNever();
        modelBuilder.Entity<OrganizationVerification>().Property(ov => ov.Id).ValueGeneratedNever();
        modelBuilder.Entity<Workspace>().Property(w => w.Id).ValueGeneratedNever();
        modelBuilder.Entity<WorkspaceMember>().Property(wm => wm.Id).ValueGeneratedNever();
        modelBuilder.Entity<RoleAssignment>().Property(ra => ra.Id).ValueGeneratedNever();
        modelBuilder.Entity<WorkspacePost>().Property(wp => wp.Id).ValueGeneratedNever();
        modelBuilder.Entity<JobVacancy>().Property(jv => jv.Id).ValueGeneratedNever();
        modelBuilder.Entity<JobVacancy>()
            .HasOne(jv => jv.HiringRequirement)
            .WithMany()
            .HasForeignKey(jv => jv.HiringRequirementId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<JobVacancy>()
            .HasOne(jv => jv.RequirementSnapshot)
            .WithMany()
            .HasForeignKey(jv => jv.RequirementSnapshotId)
            .OnDelete(DeleteBehavior.SetNull);
        modelBuilder.Entity<JobVacancy>()
            .HasIndex(jv => new { jv.Status, jv.IsActive })
            .HasDatabaseName("idx_job_vacancies_published_active")
            .HasFilter("status = 'Published' AND is_active = TRUE");

        modelBuilder.Entity<JobApplication>(entity =>
        {
            entity.Property(ja => ja.Id).ValueGeneratedNever();
            entity.HasIndex(ja => new { ja.JobVacancyId, ja.CandidateId }).IsUnique();
            entity.HasOne(ja => ja.JobVacancy)
                  .WithMany()
                  .HasForeignKey(ja => ja.JobVacancyId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(ja => ja.Candidate)
                  .WithMany()
                  .HasForeignKey(ja => ja.CandidateId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<JobInteraction>(entity =>
        {
            entity.Property(ji => ji.Id).ValueGeneratedNever();
            entity.HasIndex(ji => new { ji.UserId, ji.JobVacancyId, ji.InteractionType }).IsUnique();
            entity.HasIndex(ji => new { ji.UserId, ji.InteractionType });
            entity.HasOne(ji => ji.User)
                  .WithMany()
                  .HasForeignKey(ji => ji.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(ji => ji.JobVacancy)
                  .WithMany()
                  .HasForeignKey(ji => ji.JobVacancyId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AdminMember>().Property(am => am.Id).ValueGeneratedNever();
        modelBuilder.Entity<AdminInvitation>().Property(ai => ai.Id).ValueGeneratedNever();
        modelBuilder.Entity<AdminInvitationRole>().Property(air => air.Id).ValueGeneratedNever();
        modelBuilder.Entity<WorkspaceArchiveSnapshot>().Property(was => was.Id).ValueGeneratedNever();
        modelBuilder.Entity<RecoveryExecutionLock>().Property(rel => rel.Id).ValueGeneratedNever();
        modelBuilder.Entity<OrganizationRecoveryClaim>().Property(orc => orc.Id).ValueGeneratedNever();
        modelBuilder.Entity<ApprovedRecoverySession>().Property(ars => ars.Id).ValueGeneratedNever();
        modelBuilder.Entity<RecoveryToken>().Property(rt => rt.Id).ValueGeneratedNever();
        modelBuilder.Entity<RepresentativeRotationRequest>().Property(r => r.Id).ValueGeneratedNever();
        modelBuilder.Entity<RepresentativeApprovalVote>().Property(v => v.Id).ValueGeneratedNever();
        modelBuilder.Entity<OrganizationCredential>().Property(oc => oc.OrganizationId).ValueGeneratedNever();
        modelBuilder.Entity<PendingOrganizationOwnership>().Property(po => po.Id).ValueGeneratedNever();
        modelBuilder.Entity<OrganizationInvitation>().Property(oi => oi.Id).ValueGeneratedNever();
        modelBuilder.Entity<OrganizationInvitationRole>().Property(oir => oir.Id).ValueGeneratedNever();
        modelBuilder.Entity<AnalysisJob>().Property(j => j.Id).ValueGeneratedNever();
        modelBuilder.Entity<AnalysisJobEvent>().Property(e => e.Id).ValueGeneratedNever();
        modelBuilder.Entity<AnalysisReport>().Property(r => r.Id).ValueGeneratedNever();
        modelBuilder.Entity<AnalysisTask>().Property(t => t.Id).ValueGeneratedNever();
        modelBuilder.Entity<AnalysisTaskResult>().Property(r => r.TaskId).ValueGeneratedNever();
        modelBuilder.Entity<AnalysisTaskEvent>().Property(e => e.Id).ValueGeneratedNever();
        modelBuilder.Entity<CVerify.API.Pipelines.Shared.Orchestration.Entities.PipelineJob>().Property(j => j.Id).ValueGeneratedNever();
        modelBuilder.Entity<CVerify.API.Pipelines.Shared.Orchestration.Entities.PipelineTask>().Property(t => t.Id).ValueGeneratedNever();
        modelBuilder.Entity<CVerify.API.Pipelines.Shared.Artifacts.Entities.ArtifactRegistryEntry>().Property(a => a.Id).ValueGeneratedNever();
        modelBuilder.Entity<RepositoryCapability>().Property(x => x.Id).ValueGeneratedNever();
        modelBuilder.Entity<RepositorySkillAttribution>().Property(x => x.Id).ValueGeneratedNever();
        modelBuilder.Entity<RepositoryDomain>().Property(x => x.Id).ValueGeneratedNever();
        modelBuilder.Entity<RepositoryIntelligenceSignal>().Property(x => x.Id).ValueGeneratedNever();

        modelBuilder.Entity<CandidateDiscoveryRun>(entity =>
        {
            entity.Property(cdr => cdr.Id).ValueGeneratedNever();
            entity.HasOne(cdr => cdr.HiringRequirement)
                  .WithMany(hr => hr.DiscoveryRuns)
                  .HasForeignKey(cdr => cdr.HiringRequirementId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(cdr => cdr.TriggeredBy)
                  .WithMany()
                  .HasForeignKey(cdr => cdr.TriggeredById)
                  .OnDelete(DeleteBehavior.SetNull);
            entity.HasIndex(cdr => cdr.HiringRequirementId)
                  .HasDatabaseName("idx_candidate_discovery_runs_requirement_id");
            entity.HasIndex(cdr => cdr.TriggeredById)
                  .HasDatabaseName("idx_candidate_discovery_runs_triggered_by_id");
        });

        // Capability Nodes and Graph Edges
        modelBuilder.Entity<CapabilityNode>(entity =>
        {
            entity.Property(cn => cn.Id).ValueGeneratedNever();
            entity.HasIndex(cn => cn.Slug).IsUnique();
        });

        modelBuilder.Entity<CapabilityEdge>(entity =>
        {
            entity.HasKey(ce => new { ce.SourceNodeId, ce.TargetNodeId, ce.RelationshipType });
            entity.HasOne(ce => ce.SourceNode)
                  .WithMany(cn => cn.OutgoingEdges)
                  .HasForeignKey(ce => ce.SourceNodeId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(ce => ce.TargetNode)
                  .WithMany(cn => cn.IncomingEdges)
                  .HasForeignKey(ce => ce.TargetNodeId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Candidate Capabilities
        modelBuilder.Entity<CandidateCapability>(entity =>
        {
            entity.Property(cc => cc.Id).ValueGeneratedNever();
            entity.HasIndex(cc => new { cc.CandidateId, cc.CapabilityNodeId }).IsUnique();
        });

        modelBuilder.Entity<CandidateCapabilityEvidence>(entity =>
        {
            entity.HasKey(cce => new { cce.CandidateCapabilityId, cce.EvidenceArtifactId });
            entity.HasOne(cce => cce.CandidateCapability)
                  .WithMany(cc => cc.EvidenceLinks)
                  .HasForeignKey(cce => cce.CandidateCapabilityId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(cce => cce.EvidenceArtifact)
                  .WithMany()
                  .HasForeignKey(cce => cce.EvidenceArtifactId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CandidateCapabilityHistory>(entity =>
        {
            entity.Property(cch => cch.Id).ValueGeneratedNever();
            entity.HasIndex(cch => new { cch.CandidateCapabilityId, cch.RecordedAt });
        });

        // Evidence Graph
        modelBuilder.Entity<EvidenceSource>(entity =>
        {
            entity.Property(es => es.Id).ValueGeneratedNever();
        });

        modelBuilder.Entity<EvidenceArtifact>(entity =>
        {
            entity.Property(ea => ea.Id).ValueGeneratedNever();
            entity.HasIndex(ea => new { ea.SourceId, ea.ExternalIdentifier });
        });

        modelBuilder.Entity<EvidenceClaim>(entity =>
        {
            entity.Property(ec => ec.Id).ValueGeneratedNever();
            entity.HasIndex(ec => new { ec.CandidateId, ec.EvidenceArtifactId }).IsUnique();
        });

        modelBuilder.Entity<EvidenceVerification>(entity =>
        {
            entity.Property(ev => ev.Id).ValueGeneratedNever();
            entity.HasIndex(ev => ev.EvidenceClaimId);
        });

        // Trust Profile and Components
        modelBuilder.Entity<TrustProfile>(entity =>
        {
            entity.Property(tp => tp.Id).ValueGeneratedNever();
            entity.HasIndex(tp => new { tp.TargetEntityId, tp.TargetType });
        });

        modelBuilder.Entity<TrustComponent>(entity =>
        {
            entity.Property(tc => tc.Id).ValueGeneratedNever();
            entity.HasIndex(tc => tc.TrustProfileId);
        });

        modelBuilder.Entity<TrustCalculation>(entity =>
        {
            entity.Property(tc => tc.Id).ValueGeneratedNever();
            entity.HasIndex(tc => tc.TrustProfileId);
        });

        modelBuilder.Entity<CandidateTrustProjection>(entity =>
        {
            entity.HasKey(ctp => ctp.CandidateId);
            entity.HasOne(ctp => ctp.Candidate)
                  .WithOne()
                  .HasForeignKey<CandidateTrustProjection>(ctp => ctp.CandidateId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CandidateSearchProfile>(entity =>
        {
            entity.HasKey(csp => csp.CandidateId);
            entity.HasOne(csp => csp.Candidate)
                  .WithOne()
                  .HasForeignKey<CandidateSearchProfile>(csp => csp.CandidateId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CandidateRankingProjection>(entity =>
        {
            entity.HasKey(crp => crp.CandidateId);
            entity.HasOne(crp => crp.Candidate)
                  .WithOne()
                  .HasForeignKey<CandidateRankingProjection>(crp => crp.CandidateId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserFollower>(entity =>
        {
            entity.HasKey(uf => new { uf.FollowerId, uf.FolloweeId });

            entity.HasOne(uf => uf.Follower)
                  .WithMany()
                  .HasForeignKey(uf => uf.FollowerId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(uf => uf.Followee)
                  .WithMany()
                  .HasForeignKey(uf => uf.FolloweeId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CandidateMatchProjection>(entity =>
        {
            entity.HasKey(cmp => cmp.CandidateId);
            entity.HasOne(cmp => cmp.Candidate)
                  .WithOne()
                  .HasForeignKey<CandidateMatchProjection>(cmp => cmp.CandidateId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CandidateEvaluationSnapshot>(entity =>
        {
            entity.HasKey(ces => ces.CandidateId);
            entity.HasOne(ces => ces.Candidate)
                  .WithOne()
                  .HasForeignKey<CandidateEvaluationSnapshot>(ces => ces.CandidateId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CandidateCapabilityProjection>(entity =>
        {
            entity.HasKey(ccp => ccp.CandidateId);
            entity.HasOne(ccp => ccp.Candidate)
                  .WithOne()
                  .HasForeignKey<CandidateCapabilityProjection>(ccp => ccp.CandidateId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Matching Engine
        modelBuilder.Entity<MatchingEvaluation>(entity =>
        {
            entity.Property(me => me.Id).ValueGeneratedNever();
            entity.HasIndex(me => new { me.JobVacancyId, me.CandidateId }).IsUnique();
        });

        modelBuilder.Entity<MatchingFactor>(entity =>
        {
            entity.Property(mf => mf.Id).ValueGeneratedNever();
            entity.HasIndex(mf => mf.MatchingEvaluationId);
        });

        modelBuilder.Entity<MatchingExplanation>(entity =>
        {
            entity.Property(me => me.Id).ValueGeneratedNever();
            entity.HasIndex(me => me.MatchingEvaluationId);
        });

        modelBuilder.Entity<CandidateSkillTreeNode>(entity =>
        {
            entity.Property(n => n.Id).ValueGeneratedNever();
            
            entity.HasOne(n => n.Assessment)
                  .WithMany(a => a.SkillTreeNodes)
                  .HasForeignKey(n => n.CandidateAssessmentId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(n => n.Parent)
                  .WithMany()
                  .HasForeignKey(n => n.ParentId)
                  .OnDelete(DeleteBehavior.Restrict);
        });


        // Enable PostgreSQL Extensions
        modelBuilder.HasPostgresExtension("citext");
        modelBuilder.HasPostgresExtension("pgcrypto");

        // Map Enum
        modelBuilder.HasPostgresEnum<UserStatus>();

        // Configure User <-> Role (Many-to-Many via user_roles junction table)
        modelBuilder.Entity<User>()
            .HasMany(u => u.Roles)
            .WithMany(r => r.Users)
            .UsingEntity<Dictionary<string, object>>(
                "user_roles",
                j => j.HasOne<Role>().WithMany().HasForeignKey("role_id"),
                j => j.HasOne<User>().WithMany().HasForeignKey("user_id"),
                j =>
                {
                    j.Property<DateTimeOffset>("assigned_at").HasDefaultValueSql("NOW()");
                });

        // Configure Role <-> Permission (Many-to-Many)
        modelBuilder.Entity<Role>()
            .HasMany(r => r.Permissions)
            .WithMany(p => p.Roles)
            .UsingEntity<Dictionary<string, object>>(
                "role_permissions",
                j => j.HasOne<Permission>().WithMany().HasForeignKey("permission_id"),
                j => j.HasOne<Role>().WithMany().HasForeignKey("role_id"),
                j =>
                {
                    j.Property<DateTimeOffset>("assigned_at").HasDefaultValueSql("NOW()");
                });

        // Configure VerificationToken -> User (Many-to-One Cascade)
        modelBuilder.Entity<VerificationToken>()
            .HasOne(vt => vt.User)
            .WithMany()
            .HasForeignKey(vt => vt.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Configure ResetPasswordToken -> User (Many-to-One Cascade)
        modelBuilder.Entity<ResetPasswordToken>()
            .HasOne(rt => rt.User)
            .WithMany()
            .HasForeignKey(rt => rt.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Configure RecoveryToken -> User (Many-to-One Cascade)
        modelBuilder.Entity<RecoveryToken>()
            .HasOne(rt => rt.User)
            .WithMany()
            .HasForeignKey(rt => rt.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Configure RecoveryToken -> Organization (Many-to-One Cascade)
        modelBuilder.Entity<RecoveryToken>()
            .HasOne(rt => rt.Organization)
            .WithMany()
            .HasForeignKey(rt => rt.OrganizationId)
            .OnDelete(DeleteBehavior.Cascade);

        // Configure AuditLog relations
        modelBuilder.Entity<AuditLog>()
            .HasOne(al => al.User)
            .WithMany()
            .HasForeignKey(al => al.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<AuditLog>()
            .HasOne(al => al.ActorUser)
            .WithMany()
            .HasForeignKey(al => al.ActorUserId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<AuditLog>()
            .HasOne(al => al.TargetUser)
            .WithMany()
            .HasForeignKey(al => al.TargetUserId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<AuditLog>()
            .HasOne(al => al.Organization)
            .WithMany()
            .HasForeignKey(al => al.OrganizationId)
            .OnDelete(DeleteBehavior.Cascade);


        // Optimistic Concurrency Control mapping utilizing standard version column
        modelBuilder.Entity<User>()
            .Property(u => u.Version)
            .HasColumnName("version")
            .HasDefaultValue(1u)
            .IsConcurrencyToken();

        modelBuilder.Entity<User>()
            .Property(u => u.AvatarSource)
            .HasDefaultValue(AvatarSource.Default);

        modelBuilder.Entity<User>()
            .Property(u => u.SessionVersion)
            .HasColumnName("session_version")
            .HasDefaultValue(1)
            .IsRequired();

        modelBuilder.Entity<Role>()
            .Property(r => r.Version)
            .HasColumnName("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();

        modelBuilder.Entity<VerificationToken>()
            .Property(vt => vt.Version)
            .HasColumnName("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();

        modelBuilder.Entity<ResetPasswordToken>()
            .Property(rt => rt.Version)
            .HasColumnName("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();

        modelBuilder.Entity<RecoveryToken>()
            .Property(rt => rt.Version)
            .HasColumnName("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();

        // Indexes
        modelBuilder.Entity<User>().HasIndex(u => u.Email).IsUnique().HasFilter("deleted_at IS NULL OR status = 'DELETION_PENDING'");
        modelBuilder.Entity<User>().HasIndex(u => u.Username).IsUnique().HasFilter("deleted_at IS NULL OR status = 'DELETION_PENDING'");
        modelBuilder.Entity<Role>().HasIndex(r => r.Name).IsUnique().HasFilter("tenant_id IS NULL");
        modelBuilder.Entity<Permission>().HasIndex(p => p.Name).IsUnique();

        // Optimized Hierarchy Index
        modelBuilder.Entity<Permission>()
            .HasIndex(p => p.Name)
            .HasMethod("btree") // default, but for hierarchy we might use varchar_pattern_ops in SQL
            .HasOperators("varchar_pattern_ops");
            
        // Status filter index
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Status)
            .HasFilter("deleted_at IS NULL")
            .HasDatabaseName("idx_users_active");

        // Optimized partial indexes for active tokens only (keeping indexes compact)
        modelBuilder.Entity<VerificationToken>()
            .HasIndex(vt => vt.TokenHash)
            .HasFilter("consumed_at IS NULL")
            .HasDatabaseName("idx_verification_tokens_active");

        modelBuilder.Entity<ResetPasswordToken>()
            .HasIndex(rt => rt.TokenHash)
            .HasFilter("consumed_at IS NULL")
            .HasDatabaseName("idx_reset_password_tokens_active");

        modelBuilder.Entity<RecoveryToken>()
            .HasIndex(rt => rt.TokenHash)
            .HasFilter("consumed_at IS NULL AND revoked_at IS NULL")
            .HasDatabaseName("idx_recovery_tokens_active");

        modelBuilder.Entity<OutboxMessage>()
            .HasIndex(om => om.CreatedAt)
            .HasFilter("processed_at IS NULL")
            .HasDatabaseName("idx_outbox_messages_pending");

        // Explicit Foreign Key indexes for optimized join queries and delete cascades
        modelBuilder.Entity<VerificationToken>()
            .HasIndex(vt => vt.UserId)
            .HasDatabaseName("idx_verification_tokens_user_id");

        modelBuilder.Entity<ResetPasswordToken>()
            .HasIndex(rt => rt.UserId)
            .HasDatabaseName("idx_reset_password_tokens_user_id");

        modelBuilder.Entity<RecoveryToken>()
            .HasIndex(rt => rt.UserId)
            .HasDatabaseName("idx_recovery_tokens_user_id");

        modelBuilder.Entity<RecoveryToken>()
            .HasIndex(rt => rt.OrganizationId)
            .HasDatabaseName("idx_recovery_tokens_organization_id");

        modelBuilder.Entity<AuditLog>()
            .HasIndex(al => al.UserId)
            .HasDatabaseName("idx_audit_logs_user_id");

        modelBuilder.Entity<AuditLog>()
            .HasIndex(al => al.ActorUserId)
            .HasDatabaseName("idx_audit_logs_actor_user_id");

        modelBuilder.Entity<AuditLog>()
            .HasIndex(al => al.TargetUserId)
            .HasDatabaseName("idx_audit_logs_target_user_id");

        modelBuilder.Entity<AuditLog>()
            .HasIndex(al => al.OrganizationId)
            .HasDatabaseName("idx_audit_logs_organization_id");

        // Configure RefreshToken mapping and indexes explicitly
        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.ToTable("refresh_tokens");
            entity.Property(t => t.SessionId)
                .HasColumnName("session_id")
                .IsRequired();
            entity.Property(t => t.RememberMe)
                .HasColumnName("remember_me")
                .HasDefaultValue(false)
                .IsRequired();
            entity.Property(t => t.ReplacedByTokenId)
                .HasColumnName("replaced_by_token_id");

            entity.HasIndex(t => t.UserId).HasDatabaseName("idx_refresh_tokens_user_id");
            entity.HasIndex(t => t.OrganizationId).HasDatabaseName("idx_refresh_tokens_organization_id");
            entity.HasIndex(t => t.SessionId).HasDatabaseName("idx_refresh_tokens_session_id");
            entity.HasIndex(t => t.ExpiresAt).HasDatabaseName("idx_refresh_tokens_expires_at");

            entity.HasOne(t => t.User)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(t => t.Organization)
                .WithMany()
                .HasForeignKey(t => t.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Configure Conversations
        modelBuilder.Entity<Conversation>(entity =>
        {
            entity.ToTable("conversations");
            entity.HasIndex(c => c.UserId).HasDatabaseName("idx_conversations_user_id");
            
            entity.HasOne(c => c.User)
                .WithMany()
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Configure Messages
        modelBuilder.Entity<Message>(entity =>
        {
            entity.ToTable("messages");
            entity.Property(m => m.Role).HasConversion<string>();
            entity.Property(m => m.StreamingState).HasConversion<string>();
            
            entity.HasIndex(m => new { m.ConversationId, m.CreatedAt }).HasDatabaseName("idx_messages_conversation_id_created_at");
            
            entity.HasOne(m => m.Conversation)
                .WithMany(c => c.Messages)
                .HasForeignKey(m => m.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // AuthProvider configurations
        modelBuilder.Entity<AuthProvider>(entity =>
        {
            entity.ToTable("auth_providers");
            entity.HasQueryFilter(ap => ap.DeletedAt == null);
            entity.HasIndex(ap => new { ap.ProviderName, ap.ProviderKey })
                  .IsUnique()
                  .HasFilter("deleted_at IS NULL")
                  .HasDatabaseName("idx_auth_providers_key_active");
            entity.HasIndex(ap => new { ap.UserId, ap.ProviderName })
                  .IsUnique()
                  .HasFilter("deleted_at IS NULL AND provider_name = 'google'")
                  .HasDatabaseName("idx_auth_providers_user_type_active");
            entity.HasIndex(ap => new { ap.UserId, ap.ProviderName })
                  .HasFilter("deleted_at IS NULL")
                  .HasDatabaseName("idx_auth_providers_user_type_lookup");
        });

        // PendingAuthProvider configurations
        modelBuilder.Entity<PendingAuthProvider>(entity =>
        {
            entity.ToTable("pending_auth_providers");
            entity.HasKey(pap => pap.Id);
            entity.HasIndex(pap => pap.ExpiresAt)
                  .HasDatabaseName("idx_pending_auth_providers_expiry");
            entity.HasOne(pap => pap.User)
                  .WithMany()
                  .HasForeignKey(pap => pap.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ExternalOrganization configurations
        modelBuilder.Entity<ExternalOrganization>(entity =>
        {
            entity.ToTable("external_organizations");
            entity.HasKey(eo => eo.Id);
            entity.Property(eo => eo.Id).ValueGeneratedNever();
            entity.HasIndex(eo => new { eo.AuthProviderId, eo.ExternalId })
                  .IsUnique()
                  .HasDatabaseName("idx_external_organizations_provider_external_active");
            entity.HasOne(eo => eo.AuthProvider)
                  .WithMany()
                  .HasForeignKey(eo => eo.AuthProviderId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // SourceCodeRepository configurations
        modelBuilder.Entity<SourceCodeRepository>(entity =>
        {
            entity.ToTable("source_code_repositories");
            entity.HasKey(r => r.Id);
            entity.Property(r => r.Id).ValueGeneratedNever();
            entity.HasIndex(r => new { r.AuthProviderId, r.ExternalRepositoryId })
                  .IsUnique()
                  .HasDatabaseName("idx_source_code_repositories_external_active");
            entity.HasOne(r => r.AuthProvider)
                  .WithMany()
                  .HasForeignKey(r => r.AuthProviderId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(r => r.ExternalOrganization)
                  .WithMany()
                  .HasForeignKey(r => r.ExternalOrganizationId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // CvRepositoryMapping configurations
        modelBuilder.Entity<CvRepositoryMapping>(entity =>
        {
            entity.ToTable("cv_repository_mappings");
            entity.HasKey(m => m.Id);
            entity.Property(m => m.Id).ValueGeneratedNever();
            entity.HasOne(m => m.SourceCodeRepository)
                  .WithMany()
                  .HasForeignKey(m => m.SourceCodeRepositoryId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(m => m.UserId).HasDatabaseName("idx_cv_repository_mappings_user_id");
            entity.HasIndex(m => m.SourceCodeRepositoryId).HasDatabaseName("idx_cv_repository_mappings_repo_id");
        });

        // AnalysisJob configurations
        modelBuilder.Entity<AnalysisJob>(entity =>
        {
            entity.ToTable("analysis_jobs");
            entity.HasKey(j => j.Id);
            entity.Property(j => j.Id).ValueGeneratedNever();
            entity.HasIndex(j => j.RepositoryId).HasDatabaseName("idx_analysis_jobs_repository_id");
            entity.HasIndex(j => j.UserId).HasDatabaseName("idx_analysis_jobs_user_id");

            entity.HasOne(j => j.Repository)
                  .WithMany()
                  .HasForeignKey(j => j.RepositoryId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(j => j.User)
                  .WithMany()
                  .HasForeignKey(j => j.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // AnalysisJobEvent configurations
        modelBuilder.Entity<AnalysisJobEvent>(entity =>
        {
            entity.ToTable("analysis_job_events");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.HasIndex(e => e.JobId).HasDatabaseName("idx_analysis_job_events_job_id");

            entity.HasOne(e => e.Job)
                  .WithMany()
                  .HasForeignKey(e => e.JobId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // AnalysisReport configurations
        modelBuilder.Entity<AnalysisReport>(entity =>
        {
            entity.ToTable("analysis_reports");
            entity.HasKey(r => r.Id);
            entity.Property(r => r.Id).ValueGeneratedNever();
            entity.HasIndex(r => r.JobId).IsUnique().HasDatabaseName("idx_analysis_reports_job_id");
            entity.HasIndex(r => r.RepositoryId).HasDatabaseName("idx_analysis_reports_repository_id");

            entity.HasOne(r => r.Job)
                  .WithOne()
                  .HasForeignKey<AnalysisReport>(r => r.JobId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(r => r.Repository)
                  .WithMany()
                  .HasForeignKey(r => r.RepositoryId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // AnalysisTask configurations
        modelBuilder.Entity<AnalysisTask>(entity =>
        {
            entity.ToTable("analysis_tasks");
            entity.HasKey(t => t.Id);
            entity.Property(t => t.Id).ValueGeneratedNever();
            entity.HasIndex(t => t.JobId).HasDatabaseName("idx_analysis_tasks_job_id");
            entity.HasIndex(t => new { t.JobId, t.TaskType }).IsUnique().HasDatabaseName("idx_analysis_tasks_job_id_task_type");

            entity.HasOne(t => t.Job)
                  .WithMany()
                  .HasForeignKey(t => t.JobId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // AnalysisTaskResult configurations
        modelBuilder.Entity<AnalysisTaskResult>(entity =>
        {
            entity.ToTable("analysis_task_results");
            entity.HasKey(r => r.TaskId);
            entity.Property(r => r.TaskId).ValueGeneratedNever();

            entity.HasOne(r => r.Task)
                  .WithOne()
                  .HasForeignKey<AnalysisTaskResult>(r => r.TaskId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // AnalysisTaskEvent configurations
        modelBuilder.Entity<AnalysisTaskEvent>(entity =>
        {
            entity.ToTable("analysis_task_events");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.HasIndex(e => e.TaskId).HasDatabaseName("idx_analysis_task_events_task_id");

            entity.HasOne(e => e.Task)
                  .WithMany()
                  .HasForeignKey(e => e.TaskId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // AnalysisExecution configurations
        modelBuilder.Entity<AnalysisExecution>(entity =>
        {
            entity.ToTable("analysis_executions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.HasIndex(e => e.TaskId).HasDatabaseName("idx_analysis_executions_task_id");
            entity.HasIndex(e => e.JobId).HasDatabaseName("idx_analysis_executions_job_id");
            entity.HasIndex(e => e.UserId).HasDatabaseName("idx_analysis_executions_user_id");

            entity.HasOne(e => e.Task)
                .WithMany()
                .HasForeignKey(e => e.TaskId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Job)
                .WithMany()
                .HasForeignKey(e => e.JobId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Organization configurations
        modelBuilder.Entity<Organization>(entity =>
        {
            entity.ToTable("organizations");
            entity.HasQueryFilter(o => o.DeletedAt == null);
            entity.HasIndex(o => o.Username)
                  .IsUnique()
                  .HasFilter("deleted_at IS NULL")
                  .HasDatabaseName("idx_organizations_username_active");
            entity.HasIndex(o => o.TaxCode)
                  .IsUnique()
                  .HasFilter("deleted_at IS NULL")
                  .HasDatabaseName("idx_organizations_tax_code_active");
        });

        // OrganizationAuthority configurations
        modelBuilder.Entity<OrganizationAuthority>(entity =>
        {
            entity.ToTable("organization_authorities");
            entity.HasQueryFilter(oa => oa.Organization.DeletedAt == null);
            entity.HasOne(oa => oa.Organization)
                  .WithMany(o => o.Members)
                  .HasForeignKey(oa => oa.OrganizationId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(oa => oa.User)
                  .WithMany()
                  .HasForeignKey(oa => oa.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // OrganizationMembership configurations
        modelBuilder.Entity<OrganizationMembership>(entity =>
        {
            entity.ToTable("organization_memberships");
            entity.HasOne(om => om.Organization)
                  .WithMany()
                  .HasForeignKey(om => om.OrganizationId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(om => om.User)
                  .WithMany()
                  .HasForeignKey(om => om.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(om => new { om.OrganizationId, om.UserId }).IsUnique();
        });

        // Workspace configurations
        modelBuilder.Entity<Workspace>(entity =>
        {
            entity.ToTable("workspaces");
            entity.HasQueryFilter(w => w.DeletedAt == null);
            entity.HasOne(w => w.Organization)
                  .WithMany()
                  .HasForeignKey(w => w.OrganizationId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(w => w.Slug)
                  .IsUnique()
                  .HasFilter("deleted_at IS NULL")
                  .HasDatabaseName("idx_workspaces_slug_active");
        });

        // WorkspaceMember configurations
        modelBuilder.Entity<WorkspaceMember>(entity =>
        {
            entity.ToTable("workspace_members");
            entity.HasOne(wm => wm.Workspace)
                  .WithMany()
                  .HasForeignKey(wm => wm.WorkspaceId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(wm => wm.User)
                  .WithMany()
                  .HasForeignKey(wm => wm.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(wm => new { wm.WorkspaceId, wm.UserId }).IsUnique();
        });

        // Role configurations
        modelBuilder.Entity<Role>(entity =>
        {
            entity.ToTable("roles");
            entity.HasOne(r => r.ParentRole)
                  .WithMany(r => r.ChildRoles)
                  .HasForeignKey(r => r.ParentRoleId)
                  .OnDelete(DeleteBehavior.Restrict);
            entity.Property(r => r.Version)
                  .HasColumnName("xmin")
                  .HasColumnType("xid")
                  .ValueGeneratedOnAddOrUpdate()
                  .IsConcurrencyToken();
            entity.HasIndex(r => new { r.TenantId, r.Name })
                  .IsUnique()
                  .HasDatabaseName("idx_roles_tenant_id_name");
        });

        // RoleAssignment configurations
        modelBuilder.Entity<RoleAssignment>(entity =>
        {
            entity.ToTable("role_assignments");
            entity.HasOne(ra => ra.User)
                  .WithMany(u => u.RoleAssignments)
                  .HasForeignKey(ra => ra.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(ra => ra.Role)
                  .WithMany()
                  .HasForeignKey(ra => ra.RoleId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(ra => new { ra.UserId, ra.RoleId, ra.ScopeType, ra.ScopeId })
                  .IsUnique()
                  .HasDatabaseName("idx_role_assignments_unique");
        });



        // WorkspaceArchiveSnapshot configurations
        modelBuilder.Entity<WorkspaceArchiveSnapshot>(entity =>
        {
            entity.ToTable("workspace_archive_snapshots");
            entity.HasOne<Workspace>()
                  .WithMany()
                  .HasForeignKey(was => was.WorkspaceId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // AdminMember configurations
        modelBuilder.Entity<AdminMember>(entity =>
        {
            entity.ToTable("admin_members");
            entity.HasOne(am => am.User)
                  .WithMany()
                  .HasForeignKey(am => am.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(am => am.AssignedByUser)
                  .WithMany()
                  .HasForeignKey(am => am.AssignedByUserId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // AdminInvitation configurations
        modelBuilder.Entity<AdminInvitation>(entity =>
        {
            entity.ToTable("admin_invitations");
            entity.HasOne(ai => ai.InvitedByUser)
                  .WithMany()
                  .HasForeignKey(ai => ai.InvitedByUserId)
                  .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(ai => ai.ConsumedByUser)
                  .WithMany()
                  .HasForeignKey(ai => ai.ConsumedByUserId)
                  .OnDelete(DeleteBehavior.SetNull);
            entity.HasIndex(ai => ai.TokenHash)
                  .IsUnique()
                  .HasDatabaseName("idx_admin_invitations_token_hash");
        });

        // AdminInvitationRole configurations
        modelBuilder.Entity<AdminInvitationRole>(entity =>
        {
            entity.ToTable("admin_invitation_roles");
            entity.HasOne(air => air.Invitation)
                  .WithMany(ai => ai.PreAssignedRoles)
                  .HasForeignKey(air => air.InvitationId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(air => air.Role)
                  .WithMany()
                  .HasForeignKey(air => air.RoleId)
                  .OnDelete(DeleteBehavior.Cascade);
        });



        // RecoveryExecutionLock configurations
        modelBuilder.Entity<RecoveryExecutionLock>(entity =>
        {
            entity.ToTable("recovery_execution_locks");
            entity.HasOne<ApprovedRecoverySession>()
                  .WithMany()
                  .HasForeignKey(rel => rel.RecoverySessionId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // OrganizationRecoveryClaim configurations
        modelBuilder.Entity<OrganizationRecoveryClaim>(entity =>
        {
            entity.ToTable("organization_recovery_claims");
            entity.HasOne(orc => orc.Organization)
                  .WithMany()
                  .HasForeignKey(orc => orc.OrganizationId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ApprovedRecoverySession configurations
        modelBuilder.Entity<ApprovedRecoverySession>(entity =>
        {
            entity.ToTable("approved_recovery_sessions");
            entity.HasOne(ars => ars.Organization)
                  .WithMany()
                  .HasForeignKey(ars => ars.OrganizationId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(ars => ars.RecoveryTokenHash).IsUnique();
        });

        // OtpVerification configurations
        modelBuilder.Entity<OtpVerification>(entity =>
        {
            entity.ToTable("otp_verifications");
            entity.HasIndex(ov => ov.ChallengeId)
                  .HasDatabaseName("idx_otp_verifications_challenge_id");
            entity.HasIndex(ov => ov.Email)
                  .HasDatabaseName("idx_otp_verifications_email");
        });

        // VerificationLink configurations
        modelBuilder.Entity<VerificationLink>(entity =>
        {
            entity.ToTable("verification_links");
            entity.HasQueryFilter(vl => vl.DeletedAt == null);
            entity.HasIndex(vl => vl.TokenHash)
                  .HasFilter("deleted_at IS NULL AND consumed_at IS NULL")
                  .HasDatabaseName("idx_verification_links_active");
        });

        // OrganizationVerification configurations
        modelBuilder.Entity<OrganizationVerification>(entity =>
        {
            entity.ToTable("organization_verifications");
            entity.HasOne(ov => ov.Organization)
                  .WithMany()
                  .HasForeignKey(ov => ov.OrganizationId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(ov => ov.OrganizationId)
                  .HasDatabaseName("idx_organization_verifications_org_id");
        });

        // RepresentativeRotationRequest configurations
        modelBuilder.Entity<RepresentativeRotationRequest>(entity =>
        {
            entity.ToTable("representative_rotation_requests");
            entity.HasOne(r => r.Organization)
                  .WithMany()
                  .HasForeignKey(r => r.OrganizationId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // RepresentativeApprovalVote configurations
        modelBuilder.Entity<RepresentativeApprovalVote>(entity =>
        {
            entity.ToTable("representative_approval_votes");
            entity.HasOne(v => v.Request)
                  .WithMany(r => r.Votes)
                  .HasForeignKey(v => v.RequestId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(v => v.ApproverUser)
                  .WithMany()
                  .HasForeignKey(v => v.ApproverUserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // RepresentativeAuthorityHistory configurations
        modelBuilder.Entity<RepresentativeAuthorityHistory>(entity =>
        {
            entity.ToTable("representative_authority_histories");
            entity.HasOne(h => h.Organization)
                  .WithMany()
                  .HasForeignKey(h => h.OrganizationId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // UserProfile configurations
        modelBuilder.Entity<UserProfile>(entity =>
        {
            entity.ToTable("user_profiles");
            entity.HasQueryFilter(up => up.DeletedAt == null);
            entity.HasIndex(up => up.Username)
                  .IsUnique()
                  .HasFilter("deleted_at IS NULL")
                  .HasDatabaseName("idx_user_profiles_username_active");
            entity.Property(up => up.Version)
                  .HasColumnName("version")
                  .HasDefaultValue(1u)
                  .IsConcurrencyToken();
            entity.HasOne(up => up.User)
                  .WithOne()
                  .HasForeignKey<UserProfile>(up => up.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // CareerPreference configurations
        modelBuilder.Entity<CareerPreference>(entity =>
        {
            entity.ToTable("career_preferences");
            entity.HasQueryFilter(cp => cp.DeletedAt == null);
            entity.Property(cp => cp.Version)
                  .HasColumnName("version")
                  .HasDefaultValue(1u)
                  .IsConcurrencyToken();
            entity.HasOne(cp => cp.User)
                  .WithOne()
                  .HasForeignKey<CareerPreference>(cp => cp.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(cp => cp.DesiredJobPositions).HasMethod("gin");
            entity.HasIndex(cp => cp.TargetSkills).HasMethod("gin");
        });

        // AiInferredPreference configurations
        modelBuilder.Entity<AiInferredPreference>(entity =>
        {
            entity.ToTable("ai_inferred_preferences");
            entity.HasQueryFilter(ap => ap.DeletedAt == null);
            entity.Property(ap => ap.Version)
                  .HasColumnName("version")
                  .HasDefaultValue(1u)
                  .IsConcurrencyToken();
            entity.HasOne(ap => ap.User)
                  .WithOne()
                  .HasForeignKey<AiInferredPreference>(ap => ap.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(ap => ap.InferredSkills).HasMethod("gin");
        });

        // UserSkill configurations
        modelBuilder.Entity<UserSkill>(entity =>
        {
            entity.ToTable("user_skills");
            entity.HasOne(us => us.User)
                  .WithMany()
                  .HasForeignKey(us => us.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(us => us.UserId).HasDatabaseName("idx_user_skills_user_id");
            entity.HasIndex(us => us.Skill).HasDatabaseName("idx_user_skills_name");
        });

        // UserProfile.SocialLinks configuration (native varchar array)
        modelBuilder.Entity<UserProfile>()
            .Property(up => up.SocialLinks)
            .HasColumnType("varchar(255)[]");

        // CareerPreference location and employment preferences configuration (native varchar arrays)
        modelBuilder.Entity<CareerPreference>(entity =>
        {
            entity.Property(cp => cp.PreferredLocations)
                .HasColumnType("varchar(100)[]");
            entity.Property(cp => cp.EmploymentPreferences)
                .HasColumnType("varchar(50)[]");
        });

        // EducationEntry configurations
        modelBuilder.Entity<EducationEntry>(entity =>
        {
            entity.ToTable("education_entries");
            entity.HasQueryFilter(ee => ee.DeletedAt == null);
            entity.HasOne(ee => ee.User)
                  .WithMany()
                  .HasForeignKey(ee => ee.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(ee => ee.UserId).HasDatabaseName("idx_education_entries_user_id");
        });

        // AcademicAchievement configurations
        modelBuilder.Entity<AcademicAchievement>(entity =>
        {
            entity.ToTable("academic_achievements");
            entity.HasQueryFilter(aa => aa.DeletedAt == null);
            entity.HasOne(aa => aa.User)
                  .WithMany()
                  .HasForeignKey(aa => aa.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(aa => aa.UserId).HasDatabaseName("idx_academic_achievements_user_id");
        });

        // WorkExperience configurations
        modelBuilder.Entity<WorkExperienceEntry>(entity =>
        {
            entity.ToTable("work_experience_entries");
            entity.HasQueryFilter(we => we.DeletedAt == null);
            entity.HasOne(we => we.User)
                  .WithMany()
                  .HasForeignKey(we => we.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(we => we.UserId).HasDatabaseName("idx_work_experience_entries_user_id");
        });

        modelBuilder.Entity<WorkExperienceAchievement>(entity =>
        {
            entity.ToTable("work_experience_achievements");
            entity.HasOne(wa => wa.WorkExperienceEntry)
                  .WithMany(we => we.Achievements)
                  .HasForeignKey(wa => wa.WorkExperienceId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(wa => wa.WorkExperienceId).HasDatabaseName("idx_work_experience_achievements_entry");
        });

        modelBuilder.Entity<WorkExperienceTechnology>(entity =>
        {
            entity.ToTable("work_experience_technologies");
            entity.HasOne(wt => wt.WorkExperienceEntry)
                  .WithMany(we => we.Technologies)
                  .HasForeignKey(wt => wt.WorkExperienceId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(wt => wt.WorkExperienceId).HasDatabaseName("idx_work_experience_technologies_entry");
        });

        modelBuilder.Entity<WorkExperienceLink>(entity =>
        {
            entity.ToTable("work_experience_links");
            entity.HasOne(wl => wl.WorkExperienceEntry)
                  .WithMany(we => we.Links)
                  .HasForeignKey(wl => wl.WorkExperienceId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(wl => wl.WorkExperienceId).HasDatabaseName("idx_work_experience_links_entry");
        });

        modelBuilder.Entity<CandidateAssessment>(entity =>
        {
            entity.ToTable("candidate_assessments");
            entity.HasOne(ca => ca.User)
                  .WithMany()
                  .HasForeignKey(ca => ca.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(ca => ca.UserId).HasDatabaseName("idx_candidate_assessments_user_id");
            entity.HasIndex(ca => new { ca.UserId, ca.Version }).IsUnique().HasDatabaseName("ux_candidate_assessments_user_version");
        });

        modelBuilder.Entity<CandidateAssessmentArtifact>(entity =>
        {
            entity.ToTable("candidate_assessment_artifacts");
            entity.HasOne(caa => caa.Assessment)
                  .WithMany(ca => ca.Artifacts)
                  .HasForeignKey(caa => caa.AssessmentId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(caa => caa.AssessmentId).HasDatabaseName("idx_candidate_assessment_artifacts_assessment_id");
            entity.HasIndex(caa => new { caa.AssessmentId, caa.ArtifactType }).IsUnique().HasDatabaseName("ux_candidate_assessment_artifacts_type");
        });

        modelBuilder.Entity<RepositoryAssessment>(entity =>
        {
            entity.ToTable("repository_assessments");
            entity.HasIndex(ra => ra.RepositoryId).HasDatabaseName("idx_repository_assessments_repo_id");
            entity.HasIndex(ra => ra.AnalysisJobId).HasDatabaseName("idx_repository_assessments_job_id");
            entity.HasIndex(ra => new { ra.RepositoryId, ra.CommitSha }).HasDatabaseName("ux_repository_assessments_repo_sha");
        });

        modelBuilder.Entity<RepositoryCapability>(entity =>
        {
            entity.ToTable("repository_capabilities");
            entity.HasIndex(x => x.RepositoryAssessmentId).HasDatabaseName("idx_repository_capabilities_assessment_id");
            entity.HasIndex(x => new { x.RepositoryAssessmentId, x.Name }).IsUnique().HasDatabaseName("ux_repository_capabilities_assessment_id_name");
        });

        modelBuilder.Entity<RepositorySkillAttribution>(entity =>
        {
            entity.ToTable("repository_skill_attributions");
            entity.HasIndex(x => x.RepositoryAssessmentId).HasDatabaseName("idx_repository_skill_attributions_assessment_id");
            entity.HasIndex(x => new { x.RepositoryAssessmentId, x.SkillName }).IsUnique().HasDatabaseName("ux_repository_skill_attributions_assessment_id_skill");
        });

        modelBuilder.Entity<RepositoryDomain>(entity =>
        {
            entity.ToTable("repository_domains");
            entity.HasIndex(x => x.RepositoryAssessmentId).HasDatabaseName("idx_repository_domains_assessment_id");
            entity.HasIndex(x => new { x.RepositoryAssessmentId, x.DomainName }).IsUnique().HasDatabaseName("ux_repository_domains_assessment_id_domain");
        });

        modelBuilder.Entity<RepositoryIntelligenceSignal>(entity =>
        {
            entity.ToTable("repository_intelligence_signals");
            entity.HasIndex(x => x.RepositoryAssessmentId).IsUnique().HasDatabaseName("ux_repository_intelligence_signals_assessment_id");
        });



        // ProfileAttachment configurations
        modelBuilder.Entity<ProfileAttachment>(entity =>
        {
            entity.ToTable("profile_attachments");
            entity.HasQueryFilter(pa => pa.DeletedAt == null);
            entity.HasOne(pa => pa.User)
                  .WithMany()
                  .HasForeignKey(pa => pa.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(pa => pa.UserId).HasDatabaseName("idx_profile_attachments_user_id");
            entity.HasIndex(pa => new { pa.EntityType, pa.EntityId }).HasDatabaseName("idx_profile_attachments_entity");
        });

        // User.LinkedEmails JSONB serialization converter
        modelBuilder.Entity<User>(entity =>
        {
            var options = new global::System.Text.Json.JsonSerializerOptions
            {
                PropertyNamingPolicy = global::System.Text.Json.JsonNamingPolicy.SnakeCaseLower
            };
            var comparer = new Microsoft.EntityFrameworkCore.ChangeTracking.ValueComparer<List<LinkedEmail>>(
                (c1, c2) => global::System.Text.Json.JsonSerializer.Serialize(c1, options) == global::System.Text.Json.JsonSerializer.Serialize(c2, options),
                c => c == null ? 0 : global::System.Text.Json.JsonSerializer.Serialize(c, options).GetHashCode(),
                c => global::System.Text.Json.JsonSerializer.Deserialize<List<LinkedEmail>>(global::System.Text.Json.JsonSerializer.Serialize(c, options), options) ?? new List<LinkedEmail>()
            );
            entity.Property(u => u.LinkedEmails)
                .HasColumnType("jsonb")
                .HasConversion(
                    v => global::System.Text.Json.JsonSerializer.Serialize(v, options),
                    v => global::System.Text.Json.JsonSerializer.Deserialize<List<LinkedEmail>>(v, options) ?? new List<LinkedEmail>(),
                    comparer
                );
        });

        // OrganizationRecoveryClaim.Documents JSONB serialization converter
        modelBuilder.Entity<OrganizationRecoveryClaim>(entity =>
        {
            var options = new global::System.Text.Json.JsonSerializerOptions
            {
                PropertyNamingPolicy = global::System.Text.Json.JsonNamingPolicy.SnakeCaseLower
            };
            var comparer = new Microsoft.EntityFrameworkCore.ChangeTracking.ValueComparer<List<ClaimDocument>>(
                (c1, c2) => global::System.Text.Json.JsonSerializer.Serialize(c1, options) == global::System.Text.Json.JsonSerializer.Serialize(c2, options),
                c => c == null ? 0 : global::System.Text.Json.JsonSerializer.Serialize(c, options).GetHashCode(),
                c => global::System.Text.Json.JsonSerializer.Deserialize<List<ClaimDocument>>(global::System.Text.Json.JsonSerializer.Serialize(c, options), options) ?? new List<ClaimDocument>()
            );
            entity.Property(orc => orc.Documents)
                .HasColumnType("jsonb")
                .HasConversion(
                    v => global::System.Text.Json.JsonSerializer.Serialize(v, options),
                    v => global::System.Text.Json.JsonSerializer.Deserialize<List<ClaimDocument>>(v, options) ?? new List<ClaimDocument>(),
                    comparer
                );
        });

        // OrganizationCredential configurations
        modelBuilder.Entity<OrganizationCredential>(entity =>
        {
            entity.ToTable("organization_credentials");
            entity.HasKey(oc => oc.OrganizationId);
            entity.HasQueryFilter(oc => oc.DeletedAt == null);
            entity.HasOne(oc => oc.Organization)
                  .WithMany()
                  .HasForeignKey(oc => oc.OrganizationId)
                  .OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(oc => oc.Username)
                  .IsUnique()
                  .HasFilter("deleted_at IS NULL")
                  .HasDatabaseName("idx_organization_credentials_username_active");
        });

        // PendingOrganizationOwnership configurations
        modelBuilder.Entity<PendingOrganizationOwnership>(entity =>
        {
            entity.ToTable("pending_organization_ownerships");
            entity.HasKey(po => po.Id);
            entity.Property(po => po.Id).ValueGeneratedNever();
            entity.HasOne(po => po.Organization)
                  .WithMany()
                  .HasForeignKey(po => po.OrganizationId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(po => po.ConsumedByUser)
                  .WithMany()
                  .HasForeignKey(po => po.ConsumedByUserId)
                  .OnDelete(DeleteBehavior.SetNull);
            entity.HasIndex(po => new { po.OrganizationId, po.OwnerEmail })
                  .IsUnique()
                  .HasFilter("consumed_at IS NULL")
                  .HasDatabaseName("idx_pending_org_ownership_unique");
        });

        // OrganizationInvitation configurations
        modelBuilder.Entity<OrganizationInvitation>(entity =>
        {
            entity.ToTable("organization_invitations");
            entity.HasKey(oi => oi.Id);
            entity.Property(oi => oi.Id).ValueGeneratedNever();
            entity.HasOne(oi => oi.Organization)
                  .WithMany()
                  .HasForeignKey(oi => oi.OrganizationId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(oi => oi.InvitedByUser)
                  .WithMany()
                  .HasForeignKey(oi => oi.InvitedByUserId)
                  .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(oi => oi.ConsumedByUser)
                  .WithMany()
                  .HasForeignKey(oi => oi.ConsumedByUserId)
                  .OnDelete(DeleteBehavior.SetNull);
            entity.HasIndex(oi => new { oi.InviteeEmail, oi.Status })
                  .HasDatabaseName("idx_org_invitations_email_status");
            entity.HasIndex(oi => oi.TokenHash)
                  .IsUnique()
                  .HasDatabaseName("idx_org_invitations_token_hash");
        });

        // OrganizationInvitationRole configurations
        modelBuilder.Entity<OrganizationInvitationRole>(entity =>
        {
            entity.ToTable("organization_invitation_roles");
            entity.HasKey(oir => oir.Id);
            entity.Property(oir => oir.Id).ValueGeneratedNever();
            entity.HasOne(oir => oir.Invitation)
                  .WithMany(oi => oi.PreAssignedRoles)
                  .HasForeignKey(oir => oir.InvitationId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(oir => oir.Role)
                  .WithMany()
                  .HasForeignKey(oir => oir.RoleId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(oir => oir.InvitationId)
                  .HasDatabaseName("idx_org_invitation_roles_invite");
        });

        // ActivityEvent configurations
        modelBuilder.Entity<ActivityEvent>(entity =>
        {
            entity.ToTable("activity_events");
            entity.HasKey(ae => ae.Id);
            entity.Property(ae => ae.Id).ValueGeneratedNever();
            entity.HasOne(ae => ae.Organization)
                  .WithMany()
                  .HasForeignKey(ae => ae.OrganizationId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(ae => ae.ActorUser)
                  .WithMany()
                  .HasForeignKey(ae => ae.ActorUserId)
                  .OnDelete(DeleteBehavior.SetNull);
            entity.HasIndex(ae => new { ae.OrganizationId, ae.CreatedAt })
                  .HasDatabaseName("idx_activity_events_org_created");
            entity.HasIndex(ae => ae.CorrelationId)
                  .HasDatabaseName("idx_activity_events_correlation");
        });

        // InAppNotification configurations
        modelBuilder.Entity<InAppNotification>(entity =>
        {
            entity.ToTable("in_app_notifications");
            entity.HasKey(ian => ian.Id);
            entity.Property(ian => ian.Id).ValueGeneratedNever();
            entity.HasOne(ian => ian.User)
                  .WithMany()
                  .HasForeignKey(ian => ian.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(ian => ian.ActivityEvent)
                  .WithMany()
                  .HasForeignKey(ian => ian.ActivityEventId)
                  .OnDelete(DeleteBehavior.SetNull);
            entity.HasIndex(ian => ian.UserId)
                  .HasDatabaseName("idx_in_app_notifications_user_id");
            entity.HasIndex(ian => new { ian.UserId, ian.IsRead })
                  .HasFilter("deleted_at IS NULL")
                  .HasDatabaseName("idx_in_app_notifications_user_unread");
            entity.HasIndex(ian => new { ian.UserId, ian.AggregateKey })
                  .HasFilter("is_read = FALSE AND deleted_at IS NULL")
                  .HasDatabaseName("idx_in_app_notifications_aggregate");
        });

        // NotificationPreference configurations
        modelBuilder.Entity<NotificationPreference>(entity =>
        {
            entity.ToTable("notification_preferences");
            entity.HasKey(np => np.Id);
            entity.Property(np => np.Id).ValueGeneratedNever();
            entity.HasOne(np => np.User)
                  .WithMany()
                  .HasForeignKey(np => np.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(np => new { np.UserId, np.NotificationType, np.Channel })
                  .IsUnique()
                  .HasDatabaseName("idx_user_notification_prefs");
        });

        // ProjectEntry configurations
        modelBuilder.Entity<ProjectEntry>(entity =>
        {
            entity.ToTable("project_entries");
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Id).ValueGeneratedNever();
            entity.HasQueryFilter(p => p.DeletedAt == null);

            entity.HasOne(p => p.User)
                  .WithMany()
                  .HasForeignKey(p => p.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(p => p.UserId)
                  .HasDatabaseName("idx_project_entries_user_id");
        });

        // ProjectRepositoryLink configurations
        modelBuilder.Entity<ProjectRepositoryLink>(entity =>
        {
            entity.ToTable("project_repository_links");
            entity.HasKey(prl => prl.Id);
            entity.Property(prl => prl.Id).ValueGeneratedNever();

            entity.HasOne(prl => prl.ProjectEntry)
                  .WithMany(p => p.RepositoryLinks)
                  .HasForeignKey(prl => prl.ProjectEntryId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(prl => prl.SourceCodeRepository)
                  .WithMany()
                  .HasForeignKey(prl => prl.SourceCodeRepositoryId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(prl => new { prl.ProjectEntryId, prl.SourceCodeRepositoryId })
                  .IsUnique()
                  .HasDatabaseName("idx_project_repo_links_unique");
        });

        // ProjectTechnology configurations
        modelBuilder.Entity<ProjectTechnology>(entity =>
        {
            entity.ToTable("project_technologies");
            entity.HasKey(pt => pt.Id);
            entity.Property(pt => pt.Id).ValueGeneratedNever();

            entity.HasOne(pt => pt.ProjectEntry)
                  .WithMany(p => p.Technologies)
                  .HasForeignKey(pt => pt.ProjectEntryId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(pt => pt.ProjectEntryId)
                  .HasDatabaseName("idx_project_technologies_project_id");
        });

        // ProjectContribution configurations
        modelBuilder.Entity<ProjectContribution>(entity =>
        {
            entity.ToTable("project_contributions");
            entity.HasKey(pc => pc.Id);
            entity.Property(pc => pc.Id).ValueGeneratedNever();

            entity.HasOne(pc => pc.ProjectEntry)
                  .WithMany(p => p.Contributions)
                  .HasForeignKey(pc => pc.ProjectEntryId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(pc => pc.ProjectEntryId)
                  .HasDatabaseName("idx_project_contributions_project_id");
        });

        // Hiring Requirement configurations
        modelBuilder.Entity<HiringRequirement>(entity =>
        {
            entity.ToTable("hiring_requirements");
            entity.HasKey(hr => hr.Id);
            entity.Property(hr => hr.Id).ValueGeneratedNever();

            entity.HasOne(hr => hr.Organization)
                  .WithMany()
                  .HasForeignKey(hr => hr.OrganizationId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(hr => hr.Workspace)
                  .WithMany()
                  .HasForeignKey(hr => hr.WorkspaceId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(hr => hr.BusinessOutcomes)
                  .WithOne(bo => bo.HiringRequirement)
                  .HasForeignKey(bo => bo.HiringRequirementId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(hr => hr.Responsibilities)
                  .WithOne(r => r.HiringRequirement)
                  .HasForeignKey(r => r.HiringRequirementId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(hr => hr.Capabilities)
                  .WithOne(c => c.HiringRequirement)
                  .HasForeignKey(c => c.HiringRequirementId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(hr => hr.TechnologyRequirements)
                  .WithOne(tr => tr.HiringRequirement)
                  .HasForeignKey(tr => tr.HiringRequirementId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(hr => hr.EvaluationRubrics)
                  .WithOne(er => er.HiringRequirement)
                  .HasForeignKey(er => er.HiringRequirementId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(hr => hr.InterviewBlueprints)
                  .WithOne(ib => ib.HiringRequirement)
                  .HasForeignKey(ib => ib.HiringRequirementId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(hr => hr.Snapshots)
                  .WithOne(s => s.HiringRequirement)
                  .HasForeignKey(s => s.HiringRequirementId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(hr => hr.OrganizationId).HasDatabaseName("idx_hiring_requirements_org_id");
            entity.HasIndex(hr => hr.WorkspaceId).HasDatabaseName("idx_hiring_requirements_workspace_id");
        });

        modelBuilder.Entity<BusinessOutcome>(entity =>
        {
            entity.ToTable("business_outcomes");
            entity.HasKey(bo => bo.Id);
            entity.Property(bo => bo.Id).ValueGeneratedNever();
            entity.HasIndex(bo => bo.HiringRequirementId).HasDatabaseName("idx_business_outcomes_hr_id");
        });

        modelBuilder.Entity<Responsibility>(entity =>
        {
            entity.ToTable("responsibilities");
            entity.HasKey(r => r.Id);
            entity.Property(r => r.Id).ValueGeneratedNever();
            entity.Property(r => r.Priority).HasConversion<string>();
            entity.Property(r => r.OwnershipLevel).HasConversion<string>();
            entity.HasIndex(r => r.HiringRequirementId).HasDatabaseName("idx_responsibilities_hr_id");
        });

        modelBuilder.Entity<RequirementCapability>(entity =>
        {
            entity.ToTable("requirement_capabilities");
            entity.HasKey(rc => rc.Id);
            entity.Property(rc => rc.Id).ValueGeneratedNever();
            entity.Property(rc => rc.Priority).HasConversion<string>();
            entity.Property(rc => rc.OwnershipLevel).HasConversion<string>();
            entity.HasIndex(rc => rc.HiringRequirementId).HasDatabaseName("idx_requirement_capabilities_hr_id");

            entity.HasMany(rc => rc.EvidenceSignals)
                  .WithOne(es => es.RequirementCapability)
                  .HasForeignKey(es => es.RequirementCapabilityId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TechnologyRequirement>(entity =>
        {
            entity.ToTable("technology_requirements");
            entity.HasKey(tr => tr.Id);
            entity.Property(tr => tr.Id).ValueGeneratedNever();
            entity.Property(tr => tr.Priority).HasConversion<string>();
            entity.HasIndex(tr => tr.HiringRequirementId).HasDatabaseName("idx_technology_requirements_hr_id");
        });

        modelBuilder.Entity<EvidenceSignal>(entity =>
        {
            entity.ToTable("evidence_signals");
            entity.HasKey(es => es.Id);
            entity.Property(es => es.Id).ValueGeneratedNever();
            entity.HasIndex(es => es.RequirementCapabilityId).HasDatabaseName("idx_evidence_signals_cap_id");
        });

        modelBuilder.Entity<EvaluationRubric>(entity =>
        {
            entity.ToTable("evaluation_rubrics");
            entity.HasKey(er => er.Id);
            entity.Property(er => er.Id).ValueGeneratedNever();
            entity.HasIndex(er => er.HiringRequirementId).HasDatabaseName("idx_evaluation_rubrics_hr_id");
        });

        modelBuilder.Entity<InterviewBlueprint>(entity =>
        {
            entity.ToTable("interview_blueprints");
            entity.HasKey(ib => ib.Id);
            entity.Property(ib => ib.Id).ValueGeneratedNever();
            entity.HasIndex(ib => ib.HiringRequirementId).HasDatabaseName("idx_interview_blueprints_hr_id");
        });

        // Snapshots configurations
        modelBuilder.Entity<RequirementSnapshot>(entity =>
        {
            entity.ToTable("requirement_snapshots");
            entity.HasKey(rs => rs.Id);
            entity.Property(rs => rs.Id).ValueGeneratedNever();
            entity.HasIndex(rs => rs.HiringRequirementId).HasDatabaseName("idx_requirement_snapshots_hr_id");

            entity.HasOne(rs => rs.EvaluationRubricSnapshot)
                  .WithOne(ers => ers.RequirementSnapshot)
                  .HasForeignKey<EvaluationRubricSnapshot>(ers => ers.RequirementSnapshotId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(rs => rs.InterviewBlueprintSnapshot)
                  .WithOne(ibs => ibs.RequirementSnapshot)
                  .HasForeignKey<InterviewBlueprintSnapshot>(ibs => ibs.RequirementSnapshotId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(rs => rs.ArtifactSnapshots)
                  .WithOne(asnp => asnp.RequirementSnapshot)
                  .HasForeignKey(asnp => asnp.RequirementSnapshotId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(rs => rs.RequirementVectorSnapshot)
                  .WithOne(rvs => rvs.RequirementSnapshot)
                  .HasForeignKey<RequirementVectorSnapshot>(rvs => rvs.RequirementSnapshotId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<EvaluationRubricSnapshot>(entity =>
        {
            entity.ToTable("evaluation_rubric_snapshots");
        });

        modelBuilder.Entity<InterviewBlueprintSnapshot>(entity =>
        {
            entity.ToTable("interview_blueprint_snapshots");
        });

        modelBuilder.Entity<RequirementArtifactSnapshot>(entity =>
        {
            entity.ToTable("requirement_artifact_snapshots");
        });

        modelBuilder.Entity<RequirementArtifact>(entity =>
        {
            entity.ToTable("requirement_artifacts");
            entity.HasOne(ra => ra.HiringRequirement)
                  .WithMany(hr => hr.RequirementArtifacts)
                  .HasForeignKey(ra => ra.HiringRequirementId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RequirementVectorSnapshot>(entity =>
        {
            entity.ToTable("requirement_vector_snapshots");
        });

        modelBuilder.Entity<CapabilityRegistry>(entity =>
        {
            entity.ToTable("capability_registries");
            entity.Property(cr => cr.CapabilityId).ValueGeneratedNever();
            entity.HasOne(cr => cr.DeprecatedBy)
                  .WithMany()
                  .HasForeignKey(cr => cr.DeprecatedById)
                  .OnDelete(DeleteBehavior.SetNull);
            entity.HasIndex(cr => cr.Status);
            entity.HasIndex(cr => cr.TaxonomyVersion);
        });

        modelBuilder.Entity<CapabilityHierarchy>(entity =>
        {
            entity.ToTable("capability_hierarchies");
            entity.HasKey(ch => new { ch.ParentId, ch.ChildId });
            entity.HasOne(ch => ch.Parent)
                  .WithMany()
                  .HasForeignKey(ch => ch.ParentId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(ch => ch.Child)
                  .WithMany()
                  .HasForeignKey(ch => ch.ChildId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CapabilityAlias>(entity =>
        {
            entity.ToTable("capability_aliases");
            entity.HasKey(ca => ca.AliasName);
            entity.HasOne(ca => ca.CanonicalCapability)
                  .WithMany()
                  .HasForeignKey(ca => ca.CanonicalId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
    }

    public async Task<User?> FindUserByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        var normalized = email.Trim().ToLowerInvariant();
        if (Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory")
        {
            await Task.CompletedTask;
            return Users
                .AsEnumerable()
                .FirstOrDefault(u => (u.Email != null && u.Email.ToLower() == normalized) || (u.LinkedEmails != null && u.LinkedEmails.Any(le => le.Email != null && le.Email.ToLower() == normalized)));
        }
        var jsonContainment = $"[{{\"email\": \"{normalized}\"}}]";
        return await Users
            .FromSqlRaw("SELECT * FROM users WHERE email = {0} OR (linked_emails IS NOT NULL AND linked_emails @> {1}::jsonb)", normalized, jsonContainment)
            .OrderBy(u => u.Id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<User?> FindUserByVerifiedEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        var normalized = email.Trim().ToLowerInvariant();
        if (Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory")
        {
            await Task.CompletedTask;
            return Users
                .AsEnumerable()
                .FirstOrDefault(u => (u.Email != null && u.Email.ToLower() == normalized) || (u.LinkedEmails != null && u.LinkedEmails.Any(le => le.Email != null && le.Email.ToLower() == normalized && le.IsVerified)));
        }
        var jsonContainment = $"[{{\"email\": \"{normalized}\", \"is_verified\": true}}]";
        return await Users
            .FromSqlRaw("SELECT * FROM users WHERE email = {0} OR (linked_emails IS NOT NULL AND linked_emails @> {1}::jsonb)", normalized, jsonContainment)
            .OrderBy(u => u.Id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<bool> CheckEmailExistsAsync(string email, CancellationToken cancellationToken = default)
    {
        var normalized = email.Trim().ToLowerInvariant();
        if (Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory")
        {
            await Task.CompletedTask;
            return Users
                .AsEnumerable()
                .Any(u => u.DeletedAt == null && ((u.Email != null && u.Email.ToLower() == normalized) || (u.LinkedEmails != null && u.LinkedEmails.Any(le => le.Email != null && le.Email.ToLower() == normalized))));
        }
        var jsonContainment = $"[{{\"email\": \"{normalized}\"}}]";
        return await Users
            .FromSqlRaw("SELECT * FROM users WHERE (email = {0} OR (linked_emails IS NOT NULL AND linked_emails @> {1}::jsonb)) AND deleted_at IS NULL", normalized, jsonContainment)
            .AnyAsync(cancellationToken);
    }
}
