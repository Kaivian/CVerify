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
    public DbSet<OAuthCredential> OAuthCredentials => Set<OAuthCredential>();
    public DbSet<PasswordCredential> PasswordCredentials => Set<PasswordCredential>();
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<OrganizationAuthority> OrganizationAuthorities => Set<OrganizationAuthority>();
    public DbSet<OtpVerification> OtpVerifications => Set<OtpVerification>();
    public DbSet<VerificationLink> VerificationLinks => Set<VerificationLink>();
    public DbSet<OrganizationVerification> OrganizationVerifications => Set<OrganizationVerification>();
    public DbSet<Workspace> Workspaces => Set<Workspace>();
    public DbSet<WorkspaceMember> WorkspaceMembers => Set<WorkspaceMember>();
    public DbSet<RecoveryClaimDocument> RecoveryClaimDocuments => Set<RecoveryClaimDocument>();
    public DbSet<WorkspaceArchiveSnapshot> WorkspaceArchiveSnapshots => Set<WorkspaceArchiveSnapshot>();
    public DbSet<RecoveryExecutionLock> RecoveryExecutionLocks => Set<RecoveryExecutionLock>();
    public DbSet<OrganizationRecoveryClaim> OrganizationRecoveryClaims => Set<OrganizationRecoveryClaim>();
    public DbSet<ApprovedRecoverySession> ApprovedRecoverySessions => Set<ApprovedRecoverySession>();
    public DbSet<RecoveryToken> RecoveryTokens => Set<RecoveryToken>();
    public DbSet<RepresentativeRotationRequest> RepresentativeRotationRequests => Set<RepresentativeRotationRequest>();
    public DbSet<RepresentativeApprovalVote> RepresentativeApprovalVotes => Set<RepresentativeApprovalVote>();
    public DbSet<RepresentativeAuthorityHistory> RepresentativeAuthorityHistories => Set<RepresentativeAuthorityHistory>();
    public DbSet<UserEmail> UserEmails => Set<UserEmail>();

    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<PendingAuthProvider> PendingAuthProviders => Set<PendingAuthProvider>();
    public DbSet<SourceCodeRepository> SourceCodeRepositories => Set<SourceCodeRepository>();
    public DbSet<AnalysisJob> AnalysisJobs => Set<AnalysisJob>();
    public DbSet<AnalysisJobEvent> AnalysisJobEvents => Set<AnalysisJobEvent>();
    public DbSet<AnalysisReport> AnalysisReports => Set<AnalysisReport>();
    public DbSet<AnalysisTask> AnalysisTasks => Set<AnalysisTask>();
    public DbSet<AnalysisTaskResult> AnalysisTaskResults => Set<AnalysisTaskResult>();
    public DbSet<AnalysisTaskEvent> AnalysisTaskEvents => Set<AnalysisTaskEvent>();
    public DbSet<AnalysisExecution> AnalysisExecutions => Set<AnalysisExecution>();
    public DbSet<CareerPreference> CareerPreferences => Set<CareerPreference>();
    public DbSet<UserSkill> UserSkills => Set<UserSkill>();
    public DbSet<UserPreferredLocation> UserPreferredLocations => Set<UserPreferredLocation>();
    public DbSet<UserEmploymentPreference> UserEmploymentPreferences => Set<UserEmploymentPreference>();
    public DbSet<SocialLink> SocialLinks => Set<SocialLink>();
    public DbSet<EducationEntry> EducationEntries => Set<EducationEntry>();
    public DbSet<AcademicAchievement> AcademicAchievements => Set<AcademicAchievement>();
    public DbSet<ProfileAttachment> ProfileAttachments => Set<ProfileAttachment>();
    public DbSet<ProfileActivityLog> ProfileActivityLogs => Set<ProfileActivityLog>();
    public DbSet<WorkExperienceEntry> WorkExperiences => Set<WorkExperienceEntry>();
    public DbSet<WorkExperienceAchievement> WorkExperienceAchievements => Set<WorkExperienceAchievement>();
    public DbSet<WorkExperienceTechnology> WorkExperienceTechnologies => Set<WorkExperienceTechnology>();
    public DbSet<WorkExperienceLink> WorkExperienceLinks => Set<WorkExperienceLink>();


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
        modelBuilder.Entity<UserSkill>().Property(us => us.Id).ValueGeneratedNever();
        modelBuilder.Entity<UserPreferredLocation>().Property(upl => upl.Id).ValueGeneratedNever();
        modelBuilder.Entity<UserEmploymentPreference>().Property(uep => uep.Id).ValueGeneratedNever();
        modelBuilder.Entity<SocialLink>().Property(sl => sl.Id).ValueGeneratedNever();
        modelBuilder.Entity<EducationEntry>().Property(ee => ee.Id).ValueGeneratedNever();
        modelBuilder.Entity<AcademicAchievement>().Property(aa => aa.Id).ValueGeneratedNever();
        modelBuilder.Entity<ProfileAttachment>().Property(pa => pa.Id).ValueGeneratedNever();
        modelBuilder.Entity<ProfileActivityLog>().Property(pal => pal.Id).ValueGeneratedNever();
        modelBuilder.Entity<WorkExperienceEntry>().Property(we => we.Id).ValueGeneratedNever();
        modelBuilder.Entity<WorkExperienceAchievement>().Property(wa => wa.Id).ValueGeneratedNever();
        modelBuilder.Entity<WorkExperienceTechnology>().Property(wt => wt.Id).ValueGeneratedNever();
        modelBuilder.Entity<WorkExperienceLink>().Property(wl => wl.Id).ValueGeneratedNever();
        modelBuilder.Entity<ResetPasswordToken>().Property(rt => rt.Id).ValueGeneratedNever();
        modelBuilder.Entity<OutboxMessage>().Property(om => om.Id).ValueGeneratedNever();
        modelBuilder.Entity<AuditLog>().Property(al => al.Id).ValueGeneratedNever();
        modelBuilder.Entity<Conversation>().Property(c => c.Id).ValueGeneratedNever();
        modelBuilder.Entity<Message>().Property(m => m.Id).ValueGeneratedNever();
        modelBuilder.Entity<AuthProvider>().Property(ap => ap.Id).ValueGeneratedNever();
        modelBuilder.Entity<PasswordCredential>().Property(pc => pc.Id).ValueGeneratedNever();
        modelBuilder.Entity<Organization>().Property(o => o.Id).ValueGeneratedNever();
        modelBuilder.Entity<OrganizationAuthority>().Property(oa => oa.Id).ValueGeneratedNever();
        modelBuilder.Entity<OtpVerification>().Property(ov => ov.Id).ValueGeneratedNever();
        modelBuilder.Entity<VerificationLink>().Property(vl => vl.Id).ValueGeneratedNever();
        modelBuilder.Entity<OrganizationVerification>().Property(ov => ov.Id).ValueGeneratedNever();
        modelBuilder.Entity<Workspace>().Property(w => w.Id).ValueGeneratedNever();
        modelBuilder.Entity<WorkspaceMember>().Property(wm => wm.Id).ValueGeneratedNever();
        modelBuilder.Entity<RecoveryClaimDocument>().Property(rcd => rcd.Id).ValueGeneratedNever();
        modelBuilder.Entity<WorkspaceArchiveSnapshot>().Property(was => was.Id).ValueGeneratedNever();
        modelBuilder.Entity<RecoveryExecutionLock>().Property(rel => rel.Id).ValueGeneratedNever();
        modelBuilder.Entity<OrganizationRecoveryClaim>().Property(orc => orc.Id).ValueGeneratedNever();
        modelBuilder.Entity<ApprovedRecoverySession>().Property(ars => ars.Id).ValueGeneratedNever();
        modelBuilder.Entity<RecoveryToken>().Property(rt => rt.Id).ValueGeneratedNever();
        modelBuilder.Entity<RepresentativeRotationRequest>().Property(r => r.Id).ValueGeneratedNever();
        modelBuilder.Entity<RepresentativeApprovalVote>().Property(v => v.Id).ValueGeneratedNever();
        modelBuilder.Entity<RepresentativeAuthorityHistory>().Property(h => h.Id).ValueGeneratedNever();
        modelBuilder.Entity<UserEmail>().Property(ue => ue.Id).ValueGeneratedNever();
        modelBuilder.Entity<AnalysisJob>().Property(j => j.Id).ValueGeneratedNever();
        modelBuilder.Entity<AnalysisJobEvent>().Property(e => e.Id).ValueGeneratedNever();
        modelBuilder.Entity<AnalysisReport>().Property(r => r.Id).ValueGeneratedNever();
        modelBuilder.Entity<AnalysisTask>().Property(t => t.Id).ValueGeneratedNever();
        modelBuilder.Entity<AnalysisTaskResult>().Property(r => r.TaskId).ValueGeneratedNever();
        modelBuilder.Entity<AnalysisTaskEvent>().Property(e => e.Id).ValueGeneratedNever();

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

        // Configure AuditLog -> User (Many-to-One SetNull)
        modelBuilder.Entity<AuditLog>()
            .HasOne(al => al.User)
            .WithMany()
            .HasForeignKey(al => al.UserId)
            .OnDelete(DeleteBehavior.SetNull);


        // Optimistic Concurrency Control mapping utilizing PostgreSQL xmin system column
        modelBuilder.Entity<User>()
            .Property(u => u.Version)
            .HasColumnName("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
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
        modelBuilder.Entity<Role>().HasIndex(r => r.Name).IsUnique();
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
            entity.HasIndex(t => t.SessionId).HasDatabaseName("idx_refresh_tokens_session_id");
            entity.HasIndex(t => t.ExpiresAt).HasDatabaseName("idx_refresh_tokens_expires_at");
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

        // OAuthCredential configurations
        modelBuilder.Entity<OAuthCredential>(entity =>
        {
            entity.ToTable("oauth_credentials");
            entity.HasKey(oc => oc.AuthProviderId);
            entity.HasOne(oc => oc.AuthProvider)
                  .WithOne(ap => ap.OAuthCredential)
                  .HasForeignKey<OAuthCredential>(oc => oc.AuthProviderId)
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

            entity.HasOne(e => e.Task)
                  .WithMany()
                  .HasForeignKey(e => e.TaskId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Job)
                  .WithMany()
                  .HasForeignKey(e => e.JobId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // PasswordCredential configurations
        modelBuilder.Entity<PasswordCredential>(entity =>
        {
            entity.ToTable("password_credentials");
            entity.HasQueryFilter(pc => pc.DeletedAt == null);
            entity.HasOne(pc => pc.User)
                  .WithMany(u => u.PasswordCredentials)
                  .HasForeignKey(pc => pc.UserId)
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

        // RecoveryClaimDocument configurations
        modelBuilder.Entity<RecoveryClaimDocument>(entity =>
        {
            entity.ToTable("recovery_claim_documents");
            entity.HasOne<OrganizationRecoveryClaim>()
                  .WithMany(orc => orc.Documents)
                  .HasForeignKey(rcd => rcd.RecoveryClaimId)
                  .OnDelete(DeleteBehavior.Cascade);
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
                  .HasColumnName("xmin")
                  .HasColumnType("xid")
                  .ValueGeneratedOnAddOrUpdate()
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
                  .HasColumnName("xmin")
                  .HasColumnType("xid")
                  .ValueGeneratedOnAddOrUpdate()
                  .IsConcurrencyToken();
            entity.HasOne(cp => cp.User)
                  .WithOne()
                  .HasForeignKey<CareerPreference>(cp => cp.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
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

        // UserPreferredLocation configurations
        modelBuilder.Entity<UserPreferredLocation>(entity =>
        {
            entity.ToTable("user_preferred_locations");
            entity.HasOne(upl => upl.User)
                  .WithMany()
                  .HasForeignKey(upl => upl.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(upl => upl.UserId).HasDatabaseName("idx_user_preferred_locations_user_id");
        });

        // UserEmploymentPreference configurations
        modelBuilder.Entity<UserEmploymentPreference>(entity =>
        {
            entity.ToTable("user_employment_preferences");
            entity.HasOne(uep => uep.User)
                  .WithMany()
                  .HasForeignKey(uep => uep.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(uep => uep.UserId).HasDatabaseName("idx_user_employment_preferences_user_id");
        });

        // SocialLink configurations
        modelBuilder.Entity<SocialLink>(entity =>
        {
            entity.ToTable("social_links");
            entity.HasQueryFilter(sl => sl.DeletedAt == null);
            entity.HasOne(sl => sl.User)
                  .WithMany()
                  .HasForeignKey(sl => sl.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(sl => sl.UserId).HasDatabaseName("idx_social_links_user_id");
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

        // ProfileActivityLog configurations
        modelBuilder.Entity<ProfileActivityLog>(entity =>
        {
            entity.ToTable("profile_activity_logs");
            entity.HasOne(pal => pal.User)
                  .WithMany()
                  .HasForeignKey(pal => pal.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(pal => pal.UserId).HasDatabaseName("idx_profile_activity_logs_user_id");
        });

        // UserEmail configurations
        modelBuilder.Entity<UserEmail>(entity =>
        {
            entity.ToTable("user_emails");
            entity.HasOne(ue => ue.User)
                  .WithMany(u => u.LinkedEmails)
                  .HasForeignKey(ue => ue.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(ue => ue.Email).IsUnique();
        });
    }
}
