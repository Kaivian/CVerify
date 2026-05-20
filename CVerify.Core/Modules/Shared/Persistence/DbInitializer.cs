using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using CVerify.API.Modules.AiChat.Entities;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Exceptions.Catalogs;
using CVerify.API.Modules.Shared.Security;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Shared.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace CVerify.API.Modules.Shared.Persistence;

/// <summary>
/// A utility class responsible for automatic, idempotent database schema initialization and patching.
/// This ensures that the Postgres database matches our EF Core entities without manual database operations.
/// </summary>
public static class DbInitializer
{
    public static async Task InitializeAsync(
        ApplicationDbContext context,
        IServiceProvider? serviceProvider = null,
        IUsernameService? usernameService = null,
        EnvConfiguration? envConfig = null,
        Microsoft.Extensions.Hosting.IHostEnvironment? hostEnvironment = null)
    {
        if (context == null)
        {
            throw new ArgumentNullException(nameof(context));
        }

        var config = envConfig ?? context.GetService<EnvConfiguration>() ?? throw new InvalidOperationException("Fatal: EnvConfiguration service is not registered in the DI container.");

        // 1. Ensure database exists
        var databaseCreator = context.Database.GetService<IRelationalDatabaseCreator>();
        if (!await databaseCreator.ExistsAsync())
        {
            await databaseCreator.CreateAsync();
        }

        // 1b. Fail fast if we cannot connect to the database
        if (!await context.Database.CanConnectAsync())
        {
            throw new InvalidOperationException("Database connectivity check failed. Please ensure PostgreSQL is running and the connection string is correct.");
        }

        // Temporary fix to mark AddNotificationSystem and other existing tables migrations as applied
        try
        {
            await context.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""__EFMigrationsHistory"" (
                    migration_id character varying(150) NOT NULL,
                    product_version character varying(32) NOT NULL,
                    CONSTRAINT pk___ef_migrations_history PRIMARY KEY (migration_id)
                );
                INSERT INTO ""__EFMigrationsHistory"" (migration_id, product_version)
                VALUES 
                ('20260611091911_AddNotificationSystem', '8.0.0'),
                ('20260614071252_AddWorkspacePostsTable', '10.0.0'),
                ('20260614100549_AddJobVacanciesTable', '10.0.0'),
                ('20260615093611_AddCandidateAssessments', '10.0.0'),
                ('20260615141609_AddExternalOrganizations', '10.0.0'),
                ('20260615152001_AddProjectEntriesAndLinks', '10.0.0'),
                ('20260615171115_AddRepositoryAssessments', '10.0.0'),
                ('20260616080806_AddRepositoryIntelligenceTables', '10.0.0'),
                ('20260616082519_AddCandidateIntelligenceTablesPhase2', '10.0.0')
                ON CONFLICT (migration_id) DO NOTHING;
            ");
        }
        catch (Exception)
        {
            // Ignore if anything fails
        }


        // 1b. Environment-guarded destructive reset (Development or specific environments only)
        var resetDbEnv = Environment.GetEnvironmentVariable("RESET_DATABASE");
        bool shouldReset = string.Equals(resetDbEnv, "true", StringComparison.OrdinalIgnoreCase);
        if (shouldReset)
        {
            const string dropSql = @"
                DROP TABLE IF EXISTS candidate_strengths_weaknesses CASCADE;
                DROP TABLE IF EXISTS candidate_best_fit_roles CASCADE;
                DROP TABLE IF EXISTS candidate_intelligence_signals CASCADE;
                DROP TABLE IF EXISTS candidate_domain_profiles CASCADE;
                DROP TABLE IF EXISTS candidate_skills CASCADE;
                DROP TABLE IF EXISTS artifact_registry_entries CASCADE;
                DROP TABLE IF EXISTS pipeline_tasks CASCADE;
                DROP TABLE IF EXISTS pipeline_jobs CASCADE;
                DROP TABLE IF EXISTS prompt_deployments CASCADE;
                DROP TABLE IF EXISTS repository_skill_attributions CASCADE;
                DROP TABLE IF EXISTS repository_intelligence_signals CASCADE;
                DROP TABLE IF EXISTS repository_domains CASCADE;
                DROP TABLE IF EXISTS repository_capabilities CASCADE;

                DROP TABLE IF EXISTS admin_audit_logs CASCADE;

                DROP TABLE IF EXISTS notification_preferences CASCADE;
                DROP TABLE IF EXISTS in_app_notifications CASCADE;
                DROP TABLE IF EXISTS activity_events CASCADE;
                DROP TABLE IF EXISTS admin_invitation_roles CASCADE;
                DROP TABLE IF EXISTS admin_invitations CASCADE;
                DROP TABLE IF EXISTS admin_role_assignments CASCADE;
                DROP TABLE IF EXISTS admin_members CASCADE;
                DROP TABLE IF EXISTS admin_role_permissions CASCADE;
                DROP TABLE IF EXISTS admin_roles CASCADE;

                DROP TABLE IF EXISTS analysis_task_events CASCADE;
                DROP TABLE IF EXISTS analysis_task_results CASCADE;
                DROP TABLE IF EXISTS analysis_tasks CASCADE;
                DROP TABLE IF EXISTS analysis_reports CASCADE;
                DROP TABLE IF EXISTS analysis_job_events CASCADE;
                DROP TABLE IF EXISTS analysis_jobs CASCADE;
                DROP TABLE IF EXISTS external_organizations CASCADE;
                DROP TABLE IF EXISTS source_code_repositories CASCADE;

                DROP TABLE IF EXISTS profile_activity_logs CASCADE;
                DROP TABLE IF EXISTS profile_attachments CASCADE;
                DROP TABLE IF EXISTS social_links CASCADE;
                DROP TABLE IF EXISTS user_skills CASCADE;
                DROP TABLE IF EXISTS user_preferred_locations CASCADE;
                DROP TABLE IF EXISTS user_employment_preferences CASCADE;
                DROP TABLE IF EXISTS career_preferences CASCADE;
                DROP TABLE IF EXISTS ai_inferred_preferences CASCADE;
                
                DROP TABLE IF EXISTS academic_achievements CASCADE;
                DROP TABLE IF EXISTS education_entries CASCADE;
                DROP TABLE IF EXISTS work_experience_links CASCADE;
                DROP TABLE IF EXISTS work_experience_technologies CASCADE;
                DROP TABLE IF EXISTS work_experience_achievements CASCADE;
                DROP TABLE IF EXISTS work_experience_entries CASCADE;
                DROP TABLE IF EXISTS user_profiles CASCADE;

                DROP TABLE IF EXISTS representative_approval_votes CASCADE;
                DROP TABLE IF EXISTS representative_rotation_requests CASCADE;
                DROP TABLE IF EXISTS representative_authority_histories CASCADE;
                DROP TABLE IF EXISTS recovery_execution_locks CASCADE;
                DROP TABLE IF EXISTS workspace_archive_snapshots CASCADE;
                DROP TABLE IF EXISTS recovery_claim_documents CASCADE;
                DROP TABLE IF EXISTS organization_recovery_claims CASCADE;
                DROP TABLE IF EXISTS approved_recovery_sessions CASCADE;
                DROP TABLE IF EXISTS workspace_members CASCADE;
                DROP TABLE IF EXISTS pending_organization_ownerships CASCADE;
                DROP TABLE IF EXISTS workspace_invitations CASCADE;
                DROP TABLE IF EXISTS organization_invitation_roles CASCADE;
                DROP TABLE IF EXISTS organization_invitations CASCADE;
                DROP TABLE IF EXISTS organization_credentials CASCADE;
                DROP TABLE IF EXISTS workspaces CASCADE;
                DROP TABLE IF EXISTS messages CASCADE;
                DROP TABLE IF EXISTS conversations CASCADE;
                DROP TABLE IF EXISTS audit_logs CASCADE;
                DROP TABLE IF EXISTS outbox_messages CASCADE;
                DROP TABLE IF EXISTS recovery_tokens CASCADE;
                DROP TABLE IF EXISTS reset_password_tokens CASCADE;
                DROP TABLE IF EXISTS verification_tokens CASCADE;
                DROP TABLE IF EXISTS refresh_tokens CASCADE;
                DROP TABLE IF EXISTS role_assignments CASCADE;
                DROP TABLE IF EXISTS organization_role_assignments CASCADE;
                DROP TABLE IF EXISTS organization_role_permissions CASCADE;
                DROP TABLE IF EXISTS organization_business_roles CASCADE;
                DROP TABLE IF EXISTS business_permissions CASCADE;
                DROP TABLE IF EXISTS role_permissions CASCADE;
                DROP TABLE IF EXISTS permissions CASCADE;
                DROP TABLE IF EXISTS user_roles CASCADE;
                DROP TABLE IF EXISTS verification_links CASCADE;
                DROP TABLE IF EXISTS otp_verifications CASCADE;
                DROP TABLE IF EXISTS organization_verifications CASCADE;
                DROP TABLE IF EXISTS organization_authorities CASCADE;
                DROP TABLE IF EXISTS organization_memberships CASCADE;
                DROP TABLE IF EXISTS organization_followers CASCADE;
                DROP TABLE IF EXISTS organization_members CASCADE;
                DROP TABLE IF EXISTS workspace_posts CASCADE;
                DROP TABLE IF EXISTS job_vacancies CASCADE;
                DROP TABLE IF EXISTS organizations CASCADE;
                DROP TABLE IF EXISTS pending_auth_providers CASCADE;
                DROP TABLE IF EXISTS auth_providers CASCADE;
                DROP TABLE IF EXISTS user_emails CASCADE;
                DROP TABLE IF EXISTS users CASCADE;
                DROP TABLE IF EXISTS roles CASCADE;
                DROP TYPE IF EXISTS user_status CASCADE;
            ";
            await context.Database.ExecuteSqlRawAsync(dropSql);
        }

        // 2. Execute idempotent PostgreSQL schema updates
        const string sql = @"
            -- Enable cryptographic functions for UUID generation and password hashing
            CREATE EXTENSION IF NOT EXISTS ""pgcrypto"";
            -- Enable case-insensitive text data type, ideal for unique email addresses
            CREATE EXTENSION IF NOT EXISTS ""citext"";

            -- Generic trigger function to automatically update the 'updated_at' column on row modification
            CREATE OR REPLACE FUNCTION fn_update_timestamp()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            -- Defines the lifecycle states of a user account
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
                    CREATE TYPE user_status AS ENUM (
                        'EMAIL_VERIFY_PENDING',
                        'ACTIVE',
                        'SUSPENDED',
                        'BANNED',
                        'DELETION_PENDING',
                        'DELETED'
                    );
                END IF;
            END $$;

            -- Safely provision columns to existing tables for backward-compatibility prior to table/index definition
            DO $$
            BEGIN
                -- If users exists but lacks username/last_username_change_at/version, add them
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'username') THEN
                        ALTER TABLE users ADD COLUMN username CITEXT;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_username_change_at') THEN
                        ALTER TABLE users ADD COLUMN last_username_change_at TIMESTAMP WITH TIME ZONE;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'version') THEN
                        ALTER TABLE users ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'linked_emails') THEN
                        ALTER TABLE users ADD COLUMN linked_emails JSONB NOT NULL DEFAULT '[]'::jsonb;
                    ELSE
                        UPDATE users SET linked_emails = '[]'::jsonb WHERE linked_emails IS NULL;
                        ALTER TABLE users ALTER COLUMN linked_emails SET DEFAULT '[]'::jsonb;
                        ALTER TABLE users ALTER COLUMN linked_emails SET NOT NULL;
                    END IF;
                END IF;

                -- If organizations exists but lacks username, add it with a non-null default
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'username') THEN
                        ALTER TABLE organizations ADD COLUMN username VARCHAR(100);
                        UPDATE organizations SET username = 'org-' || substring(id::text, 1, 8) WHERE username IS NULL;
                        ALTER TABLE organizations ALTER COLUMN username SET NOT NULL;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'banner_url') THEN
                        ALTER TABLE organizations ADD COLUMN banner_url VARCHAR(2048);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'logo_url') THEN
                        ALTER TABLE organizations ADD COLUMN logo_url VARCHAR(2048);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'description') THEN
                        ALTER TABLE organizations ADD COLUMN description TEXT;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'company_type') THEN
                        ALTER TABLE organizations ADD COLUMN company_type VARCHAR(100);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'company_size') THEN
                        ALTER TABLE organizations ADD COLUMN company_size VARCHAR(100);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'branch_count') THEN
                        ALTER TABLE organizations ADD COLUMN branch_count INTEGER NOT NULL DEFAULT 0;
                    END IF;
                    -- industry_tags
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'industry_tags') THEN
                        ALTER TABLE organizations ADD COLUMN industry_tags VARCHAR(100)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[];
                    ELSE
                        UPDATE organizations SET industry_tags = ARRAY[]::VARCHAR[] WHERE industry_tags IS NULL;
                        ALTER TABLE organizations ALTER COLUMN industry_tags SET DEFAULT ARRAY[]::VARCHAR[];
                        ALTER TABLE organizations ALTER COLUMN industry_tags SET NOT NULL;
                    END IF;

                    -- benefit_tags
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'benefit_tags') THEN
                        ALTER TABLE organizations ADD COLUMN benefit_tags VARCHAR(100)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[];
                    ELSE
                        UPDATE organizations SET benefit_tags = ARRAY[]::VARCHAR[] WHERE benefit_tags IS NULL;
                        ALTER TABLE organizations ALTER COLUMN benefit_tags SET DEFAULT ARRAY[]::VARCHAR[];
                        ALTER TABLE organizations ALTER COLUMN benefit_tags SET NOT NULL;
                    END IF;

                    -- gallery_urls
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'gallery_urls') THEN
                        ALTER TABLE organizations ADD COLUMN gallery_urls VARCHAR(2048)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[];
                    ELSE
                        UPDATE organizations SET gallery_urls = ARRAY[]::VARCHAR[] WHERE gallery_urls IS NULL;
                        ALTER TABLE organizations ALTER COLUMN gallery_urls SET DEFAULT ARRAY[]::VARCHAR[];
                        ALTER TABLE organizations ALTER COLUMN gallery_urls SET NOT NULL;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'contact_name') THEN
                        ALTER TABLE organizations ADD COLUMN contact_name VARCHAR(255);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'contact_phone') THEN
                        ALTER TABLE organizations ADD COLUMN contact_phone VARCHAR(100);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'contact_email') THEN
                        ALTER TABLE organizations ADD COLUMN contact_email VARCHAR(255);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'city') THEN
                        ALTER TABLE organizations ADD COLUMN city VARCHAR(255);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'detail_address') THEN
                        ALTER TABLE organizations ADD COLUMN detail_address VARCHAR(500);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'google_maps_embed_url') THEN
                        ALTER TABLE organizations ADD COLUMN google_maps_embed_url VARCHAR(2048);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'linkedin_url') THEN
                        ALTER TABLE organizations ADD COLUMN linkedin_url VARCHAR(2048);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'facebook_url') THEN
                        ALTER TABLE organizations ADD COLUMN facebook_url VARCHAR(2048);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'twitter_url') THEN
                        ALTER TABLE organizations ADD COLUMN twitter_url VARCHAR(2048);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'website') THEN
                        ALTER TABLE organizations ADD COLUMN website VARCHAR(2048);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'mission') THEN
                        ALTER TABLE organizations ADD COLUMN mission TEXT;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'vision') THEN
                        ALTER TABLE organizations ADD COLUMN vision TEXT;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'core_values') THEN
                        ALTER TABLE organizations ADD COLUMN core_values TEXT;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'founded') THEN
                        ALTER TABLE organizations ADD COLUMN founded VARCHAR(50);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'follower_count') THEN
                        ALTER TABLE organizations ADD COLUMN follower_count INTEGER NOT NULL DEFAULT 0;
                    END IF;
                END IF;

                -- If user_profiles exists but lacks username, add it
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'username') THEN
                        ALTER TABLE user_profiles ADD COLUMN username CITEXT;
                    END IF;
                END IF;

                -- If source_code_repositories exists, add external_organization_id, classification and authenticity_type columns if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'source_code_repositories') THEN
                    -- Ensure external_organizations table is created first if it does not exist
                    CREATE TABLE IF NOT EXISTS external_organizations (
                        id UUID PRIMARY KEY,
                        auth_provider_id UUID NOT NULL,
                        external_id VARCHAR(255) NOT NULL,
                        name VARCHAR(255) NOT NULL,
                        login VARCHAR(255) NOT NULL,
                        type VARCHAR(50) NOT NULL,
                        avatar_url VARCHAR(1000),
                        html_url VARCHAR(1000),
                        description VARCHAR(2000),
                        is_active BOOLEAN NOT NULL DEFAULT TRUE,
                        last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL,
                        CONSTRAINT fk_external_organizations_auth_provider FOREIGN KEY (auth_provider_id) REFERENCES auth_providers(id) ON DELETE CASCADE
                    );
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_external_organizations_provider_external_active ON external_organizations(auth_provider_id, external_id);

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'source_code_repositories' AND column_name = 'external_organization_id') THEN
                        ALTER TABLE source_code_repositories ADD COLUMN external_organization_id UUID NULL REFERENCES external_organizations(id) ON DELETE SET NULL;
                        CREATE INDEX IF NOT EXISTS ix_source_code_repositories_external_organization_id ON source_code_repositories(external_organization_id);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'source_code_repositories' AND column_name = 'classification') THEN
                        ALTER TABLE source_code_repositories ADD COLUMN classification VARCHAR(255);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'source_code_repositories' AND column_name = 'authenticity_type') THEN
                        ALTER TABLE source_code_repositories ADD COLUMN authenticity_type VARCHAR(255);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'source_code_repositories' AND column_name = 'latest_risk_score') THEN
                        ALTER TABLE source_code_repositories ADD COLUMN latest_risk_score DOUBLE PRECISION NOT NULL DEFAULT 0.0;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'source_code_repositories' AND column_name = 'latest_risk_level') THEN
                        ALTER TABLE source_code_repositories ADD COLUMN latest_risk_level VARCHAR(50) NOT NULL DEFAULT 'Low';
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'source_code_repositories' AND column_name = 'latest_analysis_status') THEN
                        ALTER TABLE source_code_repositories ADD COLUMN latest_analysis_status VARCHAR(50) NOT NULL DEFAULT 'NeverAnalyzed';
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'source_code_repositories' AND column_name = 'latest_analysis_completed_at_utc') THEN
                        ALTER TABLE source_code_repositories ADD COLUMN latest_analysis_completed_at_utc TIMESTAMP WITH TIME ZONE;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'source_code_repositories' AND column_name = 'latest_risk_factors_json') THEN
                        ALTER TABLE source_code_repositories ADD COLUMN latest_risk_factors_json JSONB;
                    END IF;
                END IF;

                -- If organization_recovery_claims exists, ensure documents column is present, NOT NULL and defaulted
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_recovery_claims') THEN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_recovery_claims' AND column_name = 'documents') THEN
                        ALTER TABLE organization_recovery_claims ADD COLUMN documents JSONB NOT NULL DEFAULT '[]'::jsonb;
                    ELSE
                        UPDATE organization_recovery_claims SET documents = '[]'::jsonb WHERE documents IS NULL;
                        ALTER TABLE organization_recovery_claims ALTER COLUMN documents SET DEFAULT '[]'::jsonb;
                        ALTER TABLE organization_recovery_claims ALTER COLUMN documents SET NOT NULL;
                    END IF;
                END IF;

                -- Ensure organization_invitations has declined_at, declined_reason, and discovery_notified_at
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_invitations') THEN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_invitations' AND column_name = 'declined_at') THEN
                        ALTER TABLE organization_invitations ADD COLUMN declined_at TIMESTAMP WITH TIME ZONE;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_invitations' AND column_name = 'declined_reason') THEN
                        ALTER TABLE organization_invitations ADD COLUMN declined_reason VARCHAR(500);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_invitations' AND column_name = 'discovery_notified_at') THEN
                        ALTER TABLE organization_invitations ADD COLUMN discovery_notified_at TIMESTAMP WITH TIME ZONE;
                    END IF;
                END IF;

                -- Ensure pending_organization_ownerships has discovery_notified_at
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pending_organization_ownerships') THEN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pending_organization_ownerships' AND column_name = 'discovery_notified_at') THEN
                        ALTER TABLE pending_organization_ownerships ADD COLUMN discovery_notified_at TIMESTAMP WITH TIME ZONE;
                    END IF;
                END IF;

                -- Ensure candidate_assessments has cv_id, model_version, and prompt_version
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'candidate_assessments') THEN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidate_assessments' AND column_name = 'cv_id') THEN
                        ALTER TABLE candidate_assessments ADD COLUMN cv_id UUID;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidate_assessments' AND column_name = 'model_version') THEN
                        ALTER TABLE candidate_assessments ADD COLUMN model_version VARCHAR(100);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidate_assessments' AND column_name = 'prompt_version') THEN
                        ALTER TABLE candidate_assessments ADD COLUMN prompt_version VARCHAR(50);
                    END IF;
                END IF;

                -- Ensure artifact_registry_entries table has the correct foreign key constraint to analysis_jobs
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'artifact_registry_entries') THEN
                    -- Check if constraint fk_artifact_registry_pipeline_jobs_job_id exists, drop it
                    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_artifact_registry_pipeline_jobs_job_id') THEN
                        ALTER TABLE artifact_registry_entries DROP CONSTRAINT fk_artifact_registry_pipeline_jobs_job_id;
                    END IF;
                    -- Also check if default PostgreSQL name was used, e.g. artifact_registry_entries_job_id_fkey
                    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'artifact_registry_entries_job_id_fkey') THEN
                        ALTER TABLE artifact_registry_entries DROP CONSTRAINT artifact_registry_entries_job_id_fkey;
                    END IF;

                    -- Add the correct foreign key constraint referencing analysis_jobs(id)
                    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_artifact_registry_analysis_jobs_job_id') THEN
                        ALTER TABLE artifact_registry_entries ADD CONSTRAINT fk_artifact_registry_analysis_jobs_job_id FOREIGN KEY (job_id) REFERENCES analysis_jobs(id) ON DELETE CASCADE;
                    END IF;
                END IF;
            END $$;

            -- Migrate and clean up legacy database tables and columns
            DO $$
            BEGIN
                -- 1. Migrate user_emails to users.linked_emails
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_emails') THEN
                    -- Ensure users table has linked_emails column
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'linked_emails') THEN
                        ALTER TABLE users ADD COLUMN linked_emails JSONB NOT NULL DEFAULT '[]'::jsonb;
                    END IF;
                    
                    -- Migrate data by aggregating emails per user
                    UPDATE users u
                    SET linked_emails = (
                        SELECT json_agg(json_build_object(
                            'Id', ue.id,
                            'Email', ue.email,
                            'IsVerified', ue.is_verified,
                            'VerifiedAt', ue.verified_at,
                            'CreatedAt', ue.created_at
                        ))
                        FROM user_emails ue
                        WHERE ue.user_id = u.id
                    )
                    WHERE EXISTS (SELECT 1 FROM user_emails ue WHERE ue.user_id = u.id);
                    
                    -- Drop user_emails table
                    DROP TABLE user_emails CASCADE;
                END IF;

                -- 2. Migrate social_links to user_profiles.social_links
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'social_links') THEN
                    -- Ensure user_profiles table has social_links column
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'social_links') THEN
                        ALTER TABLE user_profiles ADD COLUMN social_links VARCHAR(255)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[];
                    END IF;
                    
                    -- Migrate data by aggregating urls per user
                    UPDATE user_profiles up
                    SET social_links = (
                        SELECT array_agg(sl.url)
                        FROM social_links sl
                        WHERE sl.user_id = up.user_id
                        GROUP BY sl.user_id
                    )
                    WHERE EXISTS (SELECT 1 FROM social_links sl WHERE sl.user_id = up.user_id);
                    
                    -- Drop social_links table
                    DROP TABLE social_links CASCADE;
                END IF;

                -- 3. Migrate user_preferred_locations to career_preferences.preferred_locations
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_preferred_locations') THEN
                    -- Ensure career_preferences has preferred_locations column
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'career_preferences' AND column_name = 'preferred_locations') THEN
                        ALTER TABLE career_preferences ADD COLUMN preferred_locations VARCHAR(100)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[];
                    END IF;
                    
                    -- Migrate data
                    UPDATE career_preferences cp
                    SET preferred_locations = (
                        SELECT array_agg(upl.location)
                        FROM user_preferred_locations upl
                        WHERE upl.user_id = cp.user_id
                        GROUP BY upl.user_id
                    )
                    WHERE EXISTS (SELECT 1 FROM user_preferred_locations upl WHERE upl.user_id = cp.user_id);
                    
                    -- Drop user_preferred_locations table
                    DROP TABLE user_preferred_locations CASCADE;
                END IF;

                -- 4. Migrate user_employment_preferences to career_preferences.employment_preferences
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_employment_preferences') THEN
                    -- Ensure career_preferences has employment_preferences column
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'career_preferences' AND column_name = 'employment_preferences') THEN
                        ALTER TABLE career_preferences ADD COLUMN employment_preferences VARCHAR(50)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[];
                    END IF;
                    
                    -- Migrate data
                    UPDATE career_preferences cp
                    SET employment_preferences = (
                        SELECT array_agg(uep.preference_name)
                        FROM user_employment_preferences uep
                        WHERE uep.user_id = cp.user_id
                        GROUP BY uep.user_id
                    )
                    WHERE EXISTS (SELECT 1 FROM user_employment_preferences uep WHERE uep.user_id = cp.user_id);
                    
                    -- Drop user_employment_preferences table
                    DROP TABLE user_employment_preferences CASCADE;
                END IF;

                -- 5. Migrate recovery_claim_documents to organization_recovery_claims.documents
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recovery_claim_documents') THEN
                    -- Ensure organization_recovery_claims has documents column
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_recovery_claims' AND column_name = 'documents') THEN
                        ALTER TABLE organization_recovery_claims ADD COLUMN documents JSONB NOT NULL DEFAULT '[]'::jsonb;
                    END IF;
                    
                    -- Migrate data
                    UPDATE organization_recovery_claims orc
                    SET documents = (
                        SELECT json_agg(json_build_object(
                            'Id', rcd.id,
                            'StoragePath', rcd.storage_path,
                            'FileName', rcd.file_name,
                            'ContentType', rcd.content_type,
                            'EncryptionIv', rcd.encryption_iv,
                            'OcrResultText', rcd.ocr_result_text,
                            'VirusScanStatus', rcd.virus_scan_status,
                            'RetentionExpiryDate', rcd.retention_expiry_date,
                            'CreatedAt', rcd.created_at
                        ))
                        FROM recovery_claim_documents rcd
                        WHERE rcd.recovery_claim_id = orc.id
                    )
                    WHERE EXISTS (SELECT 1 FROM recovery_claim_documents rcd WHERE rcd.recovery_claim_id = orc.id);
                    
                    -- Drop recovery_claim_documents table
                    DROP TABLE recovery_claim_documents CASCADE;
                END IF;

                -- 6. Ensure audit_logs has the unified columns before migrating other logs
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'actor_user_id') THEN
                        ALTER TABLE audit_logs ADD COLUMN actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'target_user_id') THEN
                        ALTER TABLE audit_logs ADD COLUMN target_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'organization_id') THEN
                        ALTER TABLE audit_logs ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'target_role_name') THEN
                        ALTER TABLE audit_logs ADD COLUMN target_role_name VARCHAR(50);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'scope_type') THEN
                        ALTER TABLE audit_logs ADD COLUMN scope_type VARCHAR(30);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'scope_id') THEN
                        ALTER TABLE audit_logs ADD COLUMN scope_id UUID;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'details_json') THEN
                        ALTER TABLE audit_logs ADD COLUMN details_json JSONB;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'old_state_json') THEN
                        ALTER TABLE audit_logs ADD COLUMN old_state_json JSONB;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'new_state_json') THEN
                        ALTER TABLE audit_logs ADD COLUMN new_state_json JSONB;
                    END IF;
                END IF;

                -- 7. Migrate profile_activity_logs to audit_logs
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profile_activity_logs') THEN
                    INSERT INTO audit_logs (id, user_id, event_type, description, ip_address, user_agent, old_state_json, new_state_json, created_at)
                    SELECT id, user_id, action_type, 'Profile activity log: ' || action_type, ip_address, user_agent, old_state_json::jsonb, new_state_json::jsonb, created_at
                    FROM profile_activity_logs;
                    
                    DROP TABLE profile_activity_logs CASCADE;
                END IF;

                -- 8. Migrate admin_audit_logs to audit_logs
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_audit_logs') THEN
                    INSERT INTO audit_logs (id, actor_user_id, event_type, description, target_role_name, target_user_id, details_json, created_at)
                    SELECT id, actor_user_id, action, 'Admin action: ' || action, target_role_name, target_user_id, details_json, timestamp
                    FROM admin_audit_logs;
                    
                    DROP TABLE admin_audit_logs CASCADE;
                END IF;

                -- 9. Migrate business_role_audit_logs to audit_logs
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'business_role_audit_logs') THEN
                    INSERT INTO audit_logs (id, organization_id, actor_user_id, event_type, description, target_role_name, target_user_id, scope_type, scope_id, details_json, created_at)
                    SELECT id, organization_id, actor_user_id, action, 'Business role action: ' || action, target_role_name, target_user_id, scope_type, scope_id, details_json, timestamp
                    FROM business_role_audit_logs;
                    
                    DROP TABLE business_role_audit_logs CASCADE;
                END IF;
            END $$;

             -- Greenfield Pipeline and AI subsystem tables
             CREATE TABLE IF NOT EXISTS pipeline_jobs (
                 id UUID PRIMARY KEY,
                 pipeline_type VARCHAR(50) NOT NULL,
                 reference_id UUID NOT NULL,
                 status VARCHAR(30) NOT NULL DEFAULT 'Queued',
                 progress NUMERIC NOT NULL DEFAULT 0.00,
                 started_at TIMESTAMP WITH TIME ZONE NULL,
                 completed_at TIMESTAMP WITH TIME ZONE NULL,
                 error_message VARCHAR(2000) NULL,
                 retry_count INT NOT NULL DEFAULT 0,
                 max_budget_usd NUMERIC NOT NULL DEFAULT 5.00,
                 cumulative_cost_usd NUMERIC NOT NULL DEFAULT 0.00,
                 created_at_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                 last_updated_at_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
             );

             CREATE TABLE IF NOT EXISTS pipeline_tasks (
                 id UUID PRIMARY KEY,
                 job_id UUID NOT NULL REFERENCES pipeline_jobs(id) ON DELETE CASCADE,
                 task_identifier VARCHAR(50) NOT NULL,
                 task_name VARCHAR(100) NOT NULL,
                 status VARCHAR(30) NOT NULL DEFAULT 'Pending',
                 started_at TIMESTAMP WITH TIME ZONE NULL,
                 completed_at TIMESTAMP WITH TIME ZONE NULL,
                 retry_count INT NOT NULL DEFAULT 0,
                 lease_expires_at TIMESTAMP WITH TIME ZONE NULL,
                 worker_id VARCHAR(100) NULL,
                 error_details TEXT NULL,
                 cost_usd NUMERIC NOT NULL DEFAULT 0.000000,
                 created_at_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                 last_updated_at_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
             );
             CREATE UNIQUE INDEX IF NOT EXISTS idx_job_task_identifier ON pipeline_tasks(job_id, task_identifier);
             CREATE INDEX IF NOT EXISTS ix_pipeline_tasks_job_id ON pipeline_tasks(job_id);

             CREATE TABLE IF NOT EXISTS prompt_deployments (
                 prompt_id VARCHAR(50) PRIMARY KEY,
                 active_version VARCHAR(30) NOT NULL,
                 sha256hash VARCHAR(64) NOT NULL,
                 updated_at_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
             );


            -- Stores user roles for the Role-Based Access Control (RBAC) system
            CREATE TABLE IF NOT EXISTS roles (
                id UUID PRIMARY KEY,
                name VARCHAR(50) NOT NULL,
                display_name VARCHAR(100) NOT NULL,
                description TEXT,
                domain VARCHAR(30) NOT NULL DEFAULT 'SYSTEM',
                tenant_id UUID NULL,
                parent_role_id UUID NULL REFERENCES roles(id) ON DELETE RESTRICT,
                is_system BOOLEAN NOT NULL DEFAULT FALSE,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                deleted_at TIMESTAMP WITH TIME ZONE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_tenant_id_name ON roles(tenant_id, name);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_name_system ON roles(name) WHERE tenant_id IS NULL;

            -- Core table storing user credentials, profile data, and security logs
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY,
                email CITEXT NOT NULL,
                username CITEXT,
                last_username_change_at TIMESTAMP WITH TIME ZONE,
                password_hash TEXT,
                password_changed_at TIMESTAMP WITH TIME ZONE,
                full_name VARCHAR(255) NOT NULL,
                avatar_url TEXT,
                avatar_source INTEGER NOT NULL DEFAULT 0,
                status user_status NOT NULL DEFAULT 'EMAIL_VERIFY_PENDING',
                email_verified_at TIMESTAMP WITH TIME ZONE,
                last_login_at TIMESTAMP WITH TIME ZONE,
                last_login_ip INET,
                failed_attempts INT DEFAULT 0,
                last_failed_at TIMESTAMP WITH TIME ZONE,
                lock_until TIMESTAMP WITH TIME ZONE,
                session_version INTEGER NOT NULL DEFAULT 1,
                is_legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
                linked_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
                version INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                deleted_at TIMESTAMP WITH TIME ZONE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_active ON users(email) WHERE (deleted_at IS NULL OR status = 'DELETION_PENDING');
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_active ON users(username) WHERE (deleted_at IS NULL OR status = 'DELETION_PENDING');

            -- Stores authentication provider linkage information
            CREATE TABLE IF NOT EXISTS auth_providers (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL,
                provider_name VARCHAR(50) NOT NULL,
                provider_key VARCHAR(255) NOT NULL,
                provider_account_id VARCHAR(100),
                provider_username VARCHAR(255),
                provider_avatar_url VARCHAR(500),
                granted_scopes VARCHAR(500),
                last_scope_validation_at TIMESTAMP WITH TIME ZONE,
                scope_validation_status INTEGER NOT NULL DEFAULT 0,
                last_successful_refresh_at TIMESTAMP WITH TIME ZONE,
                refresh_failure_count INTEGER NOT NULL DEFAULT 0,
                last_provider_sync_at TIMESTAMP WITH TIME ZONE,
                sync_status VARCHAR(50) NOT NULL DEFAULT 'Pending',
                sync_error TEXT,
                encrypted_access_token VARCHAR(1000),
                encrypted_refresh_token VARCHAR(1000),
                expires_at TIMESTAMP WITH TIME ZONE,
                token_updated_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                deleted_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT fk_auth_providers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_providers_key_active ON auth_providers(provider_name, provider_key) WHERE deleted_at IS NULL;
            
            DROP INDEX IF EXISTS idx_auth_providers_user_type_active;
            CREATE UNIQUE INDEX idx_auth_providers_user_type_active ON auth_providers(user_id, provider_name) WHERE deleted_at IS NULL AND provider_name = 'google';
            CREATE INDEX IF NOT EXISTS idx_auth_providers_user_type_lookup ON auth_providers(user_id, provider_name) WHERE deleted_at IS NULL;

            -- Stores pending authorization provider links (expires in 10 minutes)
            CREATE TABLE IF NOT EXISTS pending_auth_providers (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL,
                provider_name VARCHAR(50) NOT NULL,
                provider_key VARCHAR(255) NOT NULL,
                provider_account_id VARCHAR(100),
                provider_username VARCHAR(255),
                provider_display_name VARCHAR(255),
                provider_avatar_url VARCHAR(500),
                provider_profile_url VARCHAR(500),
                encrypted_access_token VARCHAR(1000) NOT NULL,
                encrypted_refresh_token VARCHAR(1000),
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_pending_auth_providers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_pending_auth_providers_expiry ON pending_auth_providers(expires_at);

            -- Stores external organizations/groups profile metadata linked to auth providers
            CREATE TABLE IF NOT EXISTS external_organizations (
                id UUID PRIMARY KEY,
                auth_provider_id UUID NOT NULL,
                external_id VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                login VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL,
                avatar_url VARCHAR(1000),
                html_url VARCHAR(1000),
                description VARCHAR(2000),
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT fk_external_organizations_auth_providers FOREIGN KEY (auth_provider_id) REFERENCES auth_providers(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_external_organizations_provider_external_active ON external_organizations(auth_provider_id, external_id);

            -- Stores repositories associated with auth providers
            CREATE TABLE IF NOT EXISTS source_code_repositories (
                id UUID PRIMARY KEY,
                auth_provider_id UUID NOT NULL,
                external_organization_id UUID NULL,
                external_repository_id VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                owner VARCHAR(255) NOT NULL,
                description VARCHAR(1000),
                html_url VARCHAR(1000),
                default_branch VARCHAR(100),
                owner_login VARCHAR(255) NOT NULL,
                owner_type VARCHAR(50) NOT NULL,
                is_private BOOLEAN NOT NULL DEFAULT FALSE,
                primary_language VARCHAR(100),
                stars_count INTEGER NOT NULL DEFAULT 0,
                forks_count INTEGER NOT NULL DEFAULT 0,
                open_issues_count INTEGER NOT NULL DEFAULT 0,
                watchers_count INTEGER NOT NULL DEFAULT 0,
                last_commit_at TIMESTAMP WITH TIME ZONE,
                last_updated_utc TIMESTAMP WITH TIME ZONE NOT NULL,
                last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                is_accessible BOOLEAN NOT NULL DEFAULT TRUE,
                archived_externally BOOLEAN NOT NULL DEFAULT FALSE,
                is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                is_verified BOOLEAN NOT NULL DEFAULT FALSE,
                trust_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                custom_settings_json TEXT,
                classification VARCHAR(255),
                authenticity_type VARCHAR(255),
                latest_risk_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                latest_risk_level VARCHAR(50) NOT NULL DEFAULT 'Low',
                latest_analysis_status VARCHAR(50) NOT NULL DEFAULT 'NeverAnalyzed',
                latest_analysis_completed_at_utc TIMESTAMP WITH TIME ZONE,
                latest_risk_factors_json JSONB,
                created_at_utc TIMESTAMP WITH TIME ZONE NOT NULL,
                last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_source_code_repositories_auth_provider FOREIGN KEY (auth_provider_id) REFERENCES auth_providers(id) ON DELETE CASCADE,
                CONSTRAINT fk_source_code_repositories_external_organization FOREIGN KEY (external_organization_id) REFERENCES external_organizations(id) ON DELETE SET NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_source_code_repositories_external_active ON source_code_repositories(auth_provider_id, external_repository_id);
            CREATE INDEX IF NOT EXISTS ix_source_code_repositories_external_organization_id ON source_code_repositories(external_organization_id);
            CREATE INDEX IF NOT EXISTS idx_source_code_repositories_owner_login ON source_code_repositories(owner_login);
            CREATE INDEX IF NOT EXISTS idx_source_code_repositories_language ON source_code_repositories(primary_language) WHERE primary_language IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_source_code_repositories_updated ON source_code_repositories(last_updated_utc DESC);
            CREATE INDEX IF NOT EXISTS idx_source_code_repositories_stars ON source_code_repositories(stars_count DESC);
            CREATE INDEX IF NOT EXISTS idx_source_code_repositories_accessible ON source_code_repositories(is_accessible) WHERE is_accessible = TRUE;
            CREATE INDEX IF NOT EXISTS idx_source_code_repositories_classification ON source_code_repositories(classification) WHERE classification IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_source_code_repositories_authenticity_type ON source_code_repositories(authenticity_type) WHERE authenticity_type IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_source_code_repositories_latest_risk_score ON source_code_repositories(latest_risk_score);
            CREATE INDEX IF NOT EXISTS idx_source_code_repositories_latest_analysis_status ON source_code_repositories(latest_analysis_status);

            CREATE TABLE IF NOT EXISTS organizations (
                id UUID PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                tax_code VARCHAR(50) NOT NULL,
                email VARCHAR(255) NOT NULL,
                username VARCHAR(100) NOT NULL,
                is_verified BOOLEAN NOT NULL DEFAULT FALSE,
                verification_level INTEGER NOT NULL DEFAULT 0,
                registration_number VARCHAR(50),
                initial_admin_assigned_at TIMESTAMP WITH TIME ZONE,
                representative_name VARCHAR(255),
                representative_email VARCHAR(255),
                representative_phone VARCHAR(50),
                recovery_authority VARCHAR(255),
                representative_identity VARCHAR(255),
                banner_url VARCHAR(2048),
                logo_url VARCHAR(2048),
                description TEXT,
                company_type VARCHAR(100),
                company_size VARCHAR(100),
                branch_count INTEGER NOT NULL DEFAULT 0,
                industry_tags VARCHAR(100)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[],
                benefit_tags VARCHAR(100)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[],
                gallery_urls VARCHAR(2048)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[],
                contact_name VARCHAR(255),
                contact_phone VARCHAR(100),
                contact_email VARCHAR(255),
                city VARCHAR(255),
                detail_address VARCHAR(500),
                google_maps_embed_url VARCHAR(2048),
                linkedin_url VARCHAR(2048),
                facebook_url VARCHAR(2048),
                twitter_url VARCHAR(2048),
                website VARCHAR(2048),
                mission TEXT NULL,
                vision TEXT NULL,
                core_values TEXT NULL,
                founded VARCHAR(50) NULL,
                follower_count INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                deleted_at TIMESTAMP WITH TIME ZONE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_username_active ON organizations(username) WHERE deleted_at IS NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_tax_code_active ON organizations(tax_code) WHERE deleted_at IS NULL;

            -- Stores organization credentials for company-level workspace logins
            CREATE TABLE IF NOT EXISTS organization_credentials (
                organization_id UUID PRIMARY KEY,
                username CITEXT NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                failed_login_attempts INTEGER NOT NULL DEFAULT 0,
                lockout_end TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                deleted_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT fk_organization_credentials_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_credentials_username_active ON organization_credentials(username) WHERE deleted_at IS NULL;


            -- Stores organization verification records
            CREATE TABLE IF NOT EXISTS organization_verifications (
                id UUID PRIMARY KEY,
                organization_id UUID NOT NULL,
                verification_type VARCHAR(50) NOT NULL,
                is_verified BOOLEAN NOT NULL DEFAULT FALSE,
                verified_value VARCHAR(255),
                verified_at TIMESTAMP WITH TIME ZONE,
                verified_by VARCHAR(100),
                metadata TEXT,
                CONSTRAINT fk_organization_verifications_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_organization_verifications_org_id ON organization_verifications(organization_id);

            -- Stores organization workspace authority records (Legal ownership/control layer)
            CREATE TABLE IF NOT EXISTS organization_authorities (
                id UUID PRIMARY KEY,
                organization_id UUID NOT NULL,
                user_id UUID NOT NULL,
                role VARCHAR(50) NOT NULL,
                joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_organization_authorities_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                CONSTRAINT fk_organization_authorities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            -- Stores organization memberships (Organization Membership Layer)
            CREATE TABLE IF NOT EXISTS organization_memberships (
                id UUID PRIMARY KEY,
                organization_id UUID NOT NULL,
                user_id UUID NOT NULL,
                role VARCHAR(50) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'active',
                joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_organization_memberships_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                CONSTRAINT fk_organization_memberships_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_memberships_org_user ON organization_memberships(organization_id, user_id);

            -- Stores organization followers (Organization Followers Layer)
            CREATE TABLE IF NOT EXISTS organization_followers (
                user_id UUID NOT NULL,
                organization_id UUID NOT NULL,
                followed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                PRIMARY KEY (user_id, organization_id),
                CONSTRAINT fk_organization_followers_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                CONSTRAINT fk_organization_followers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_organization_followers_org_id ON organization_followers(organization_id);

            -- Stores workspaces (Workspace Identity Layer)
            CREATE TABLE IF NOT EXISTS workspaces (
                id UUID PRIMARY KEY,
                organization_id UUID NOT NULL,
                display_name VARCHAR(255) NOT NULL,
                slug VARCHAR(100) NOT NULL,
                branding TEXT,
                status VARCHAR(50) NOT NULL DEFAULT 'active',
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                deleted_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT fk_workspaces_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_slug_active ON workspaces(slug) WHERE deleted_at IS NULL;

            -- Stores workspace memberships (Workspace Membership Layer)
            CREATE TABLE IF NOT EXISTS workspace_members (
                id UUID PRIMARY KEY,
                workspace_id UUID NOT NULL,
                user_id UUID NOT NULL,
                role VARCHAR(50) NOT NULL,
                joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_workspace_members_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
                CONSTRAINT fk_workspace_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_members_workspace_user ON workspace_members(workspace_id, user_id);

            -- Stores pending organization ownerships
            CREATE TABLE IF NOT EXISTS pending_organization_ownerships (
                id UUID PRIMARY KEY,
                organization_id UUID NOT NULL,
                owner_email CITEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                consumed_at TIMESTAMP WITH TIME ZONE,
                consumed_by_user_id UUID,
                discovery_notified_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT fk_pending_organization_ownerships_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                CONSTRAINT fk_pending_organization_ownerships_user FOREIGN KEY (consumed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_org_ownership_unique ON pending_organization_ownerships(organization_id, owner_email) WHERE consumed_at IS NULL;

            -- Stores organization recovery claims
            CREATE TABLE IF NOT EXISTS organization_recovery_claims (
                id UUID PRIMARY KEY,
                organization_id UUID NOT NULL,
                representative_full_name VARCHAR(255) NOT NULL,
                representative_position VARCHAR(255) NOT NULL,
                phone_number VARCHAR(50) NOT NULL,
                recovery_email VARCHAR(255) NOT NULL,
                risk_score INTEGER NOT NULL,
                risk_level VARCHAR(50) NOT NULL,
                suggested_recovery_strategy VARCHAR(50) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'Pending',
                rejection_reason TEXT,
                reviewed_by VARCHAR(100),
                second_reviewer_by VARCHAR(100),
                reviewed_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                document_ocr_metadata TEXT,
                document_suspicious_metadata TEXT,
                workspace_activity_flags TEXT,
                ip_device_flags TEXT,
                historical_claim_flags TEXT,
                documents JSONB NOT NULL DEFAULT '[]'::jsonb,
                CONSTRAINT fk_recovery_claims_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            );

            -- Stores approved recovery sessions
            CREATE TABLE IF NOT EXISTS approved_recovery_sessions (
                id UUID PRIMARY KEY,
                organization_id UUID NOT NULL,
                approved_representative VARCHAR(255) NOT NULL,
                verified_recovery_email VARCHAR(255) NOT NULL,
                recovery_token_hash VARCHAR(255) NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                approved_by VARCHAR(100) NOT NULL,
                suggested_strategy VARCHAR(50) NOT NULL,
                is_consumed BOOLEAN NOT NULL DEFAULT FALSE,
                used_at TIMESTAMP WITH TIME ZONE,
                used_by_ip VARCHAR(45),
                used_by_device VARCHAR(500),
                revoked_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_recovery_sessions_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_approved_recovery_sessions_token_hash ON approved_recovery_sessions(recovery_token_hash);

            -- Stores workspace archive snapshots before rebuilt strategy
            CREATE TABLE IF NOT EXISTS workspace_archive_snapshots (
                id UUID PRIMARY KEY,
                workspace_id UUID NOT NULL,
                organization_id UUID NOT NULL,
                snapshot_data_json TEXT NOT NULL,
                archived_by VARCHAR(100) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_archive_snapshots_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            );

            -- Stores recovery execution locks for idempotency
            CREATE TABLE IF NOT EXISTS recovery_execution_locks (
                id UUID PRIMARY KEY,
                recovery_session_id UUID NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'Locked',
                acquired_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                completed_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT fk_execution_locks_session FOREIGN KEY (recovery_session_id) REFERENCES approved_recovery_sessions(id) ON DELETE CASCADE
            );

            -- Stores representative rotation requests for Level 2 organizations
            CREATE TABLE IF NOT EXISTS representative_rotation_requests (
                id UUID PRIMARY KEY,
                organization_id UUID NOT NULL,
                current_representative VARCHAR(255),
                requested_representative VARCHAR(255) NOT NULL,
                requested_email VARCHAR(255) NOT NULL,
                requested_phone VARCHAR(50) NOT NULL,
                reason TEXT NOT NULL,
                support_approval_status VARCHAR(50) NOT NULL DEFAULT 'pending_review',
                admin_approval_status VARCHAR(50) NOT NULL DEFAULT 'pending_review',
                final_decision VARCHAR(50) NOT NULL DEFAULT 'pending_review',
                verification_call_status VARCHAR(50) NOT NULL DEFAULT 'not_started',
                verification_call_notes TEXT,
                optional_supporting_message TEXT,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT fk_rotation_requests_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            );

            -- Stores admin votes for representative rotation requests
            CREATE TABLE IF NOT EXISTS representative_approval_votes (
                id UUID PRIMARY KEY,
                request_id UUID NOT NULL,
                approver_user_id UUID NOT NULL,
                approver_role VARCHAR(50) NOT NULL,
                decision VARCHAR(50) NOT NULL,
                timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_approval_votes_request FOREIGN KEY (request_id) REFERENCES representative_rotation_requests(id) ON DELETE CASCADE,
                CONSTRAINT fk_approval_votes_user FOREIGN KEY (approver_user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            -- Stores representative rotation history
            CREATE TABLE IF NOT EXISTS representative_authority_histories (
                id UUID PRIMARY KEY,
                organization_id UUID NOT NULL,
                previous_representative VARCHAR(255),
                new_representative VARCHAR(255) NOT NULL,
                rotated_by VARCHAR(255) NOT NULL,
                support_reviewer VARCHAR(255) NOT NULL,
                effective_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_authority_histories_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            );

            -- Stores challenge-based OTP verifications
            CREATE TABLE IF NOT EXISTS otp_verifications (
                id UUID PRIMARY KEY,
                challenge_id UUID NOT NULL,
                email VARCHAR(255) NOT NULL,
                otp_hash VARCHAR(255) NOT NULL,
                purpose VARCHAR(100) NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                consumed_at TIMESTAMP WITH TIME ZONE,
                attempts INTEGER DEFAULT 0,
                last_attempt_at TIMESTAMP WITH TIME ZONE,
                resend_count INTEGER DEFAULT 0,
                last_sent_at TIMESTAMP WITH TIME ZONE,
                last_resent_at TIMESTAMP WITH TIME ZONE,
                status INTEGER NOT NULL DEFAULT 0,
                cooldown_until TIMESTAMP WITH TIME ZONE,
                invalidated_at TIMESTAMP WITH TIME ZONE
            );
            CREATE INDEX IF NOT EXISTS idx_otp_verifications_challenge_id ON otp_verifications(challenge_id);
            CREATE INDEX IF NOT EXISTS idx_otp_verifications_email ON otp_verifications(email);

            -- Stores telemetry-tracked verification links for company email ownership
            CREATE TABLE IF NOT EXISTS verification_links (
                id UUID PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                tax_code VARCHAR(50),
                company_name VARCHAR(255),
                token_hash VARCHAR(255) NOT NULL,
                purpose VARCHAR(100) NOT NULL,
                user_id UUID,
                organization_id UUID,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                consumed_at TIMESTAMP WITH TIME ZONE,
                consumed_by_ip VARCHAR(45),
                consumed_by_user_agent VARCHAR(500),
                deleted_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT fk_verification_links_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                CONSTRAINT fk_verification_links_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS idx_verification_links_active ON verification_links(token_hash) WHERE deleted_at IS NULL AND consumed_at IS NULL;

            -- Maps users to roles (Many-to-Many relationship)
            CREATE TABLE IF NOT EXISTS user_roles (
                user_id UUID NOT NULL,
                role_id UUID NOT NULL,
                assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                PRIMARY KEY (user_id, role_id),
                CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
            );

            -- Backward-compatibility patch block: migrate old single user role layout if detected
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'role_id'
                ) THEN
                    -- Copy existing single-role relations to junction table
                    INSERT INTO user_roles (user_id, role_id)
                    SELECT id, role_id FROM users
                    ON CONFLICT DO NOTHING;

                    -- Drop foreign key constraint on users table
                    IF EXISTS (
                        SELECT 1 FROM information_schema.table_constraints 
                        WHERE constraint_name = 'fk_users_role'
                    ) THEN
                        ALTER TABLE users DROP CONSTRAINT fk_users_role;
                    END IF;

                    -- Safely drop the old role_id column
                    ALTER TABLE users DROP COLUMN role_id;
                END IF;

                -- Safely provision session_version column if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'session_version'
                ) THEN
                    ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 1;
                END IF;

                -- Safely provision is_legal_hold column if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'is_legal_hold'
                ) THEN
                    ALTER TABLE users ADD COLUMN is_legal_hold BOOLEAN NOT NULL DEFAULT FALSE;
                END IF;

                -- Safely provision failed_attempts column if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'failed_attempts'
                ) THEN
                    ALTER TABLE users ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0;
                END IF;

                -- Safely provision last_failed_at column if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'last_failed_at'
                ) THEN
                    ALTER TABLE users ADD COLUMN last_failed_at TIMESTAMP WITH TIME ZONE;
                END IF;

                -- Safely provision lock_until column if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'lock_until'
                ) THEN
                    ALTER TABLE users ADD COLUMN lock_until TIMESTAMP WITH TIME ZONE;
                END IF;

                -- Safely provision email_verified_at column if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'email_verified_at'
                ) THEN
                    ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP WITH TIME ZONE;
                END IF;

                -- Safely provision last_login_at column if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'last_login_at'
                ) THEN
                    ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE;
                END IF;

                -- Safely provision last_login_ip column if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'last_login_ip'
                ) THEN
                    ALTER TABLE users ADD COLUMN last_login_ip INET;
                END IF;

                -- Safely provision avatar_url column if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'avatar_url'
                ) THEN
                    ALTER TABLE users ADD COLUMN avatar_url TEXT;
                END IF;

                -- Safely provision anonymized_actor_hash column to audit_logs if missing
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs'
                ) AND NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'audit_logs' AND column_name = 'anonymized_actor_hash'
                ) THEN
                    ALTER TABLE audit_logs ADD COLUMN anonymized_actor_hash VARCHAR(64);
                END IF;

                -- Safely provision assigned_at column to role_permissions junction table if missing
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name = 'role_permissions'
                ) AND NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'role_permissions' AND column_name = 'assigned_at'
                ) THEN
                    ALTER TABLE role_permissions ADD COLUMN assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
                END IF;

                -- Safely provision assigned_at column to user_roles junction table if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'user_roles' AND column_name = 'assigned_at'
                ) THEN
                    ALTER TABLE user_roles ADD COLUMN assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
                END IF;

                -- Safely provision verification_level column to organizations if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'organizations' AND column_name = 'verification_level'
                ) THEN
                    ALTER TABLE organizations ADD COLUMN verification_level INTEGER NOT NULL DEFAULT 0;
                END IF;

                -- Safely provision registration_number column to organizations if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'organizations' AND column_name = 'registration_number'
                ) THEN
                    ALTER TABLE organizations ADD COLUMN registration_number VARCHAR(50);
                END IF;

                -- Safely provision status column to organizations if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'organizations' AND column_name = 'status'
                ) THEN
                    ALTER TABLE organizations ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active';
                END IF;

                -- Safely provision representative columns to organizations if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'organizations' AND column_name = 'representative_name'
                ) THEN
                    ALTER TABLE organizations ADD COLUMN representative_name VARCHAR(255);
                    ALTER TABLE organizations ADD COLUMN representative_email VARCHAR(255);
                    ALTER TABLE organizations ADD COLUMN representative_phone VARCHAR(50);
                    ALTER TABLE organizations ADD COLUMN recovery_authority VARCHAR(255);
                    ALTER TABLE organizations ADD COLUMN representative_identity VARCHAR(255);
                END IF;

                -- Safely provision initial_admin_assigned_at column to organizations if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'organizations' AND column_name = 'initial_admin_assigned_at'
                ) THEN
                    ALTER TABLE organizations ADD COLUMN initial_admin_assigned_at TIMESTAMP WITH TIME ZONE;
                END IF;


                -- Safely rename organization_members to organization_authorities if it exists
                IF EXISTS (
                    SELECT 1 
                    FROM information_schema.tables 
                    WHERE table_name = 'organization_members'
                ) AND NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.tables 
                    WHERE table_name = 'organization_authorities'
                ) THEN
                    ALTER TABLE organization_members RENAME TO organization_authorities;
                END IF;

                -- Safely provision status column to otp_verifications if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'otp_verifications' AND column_name = 'status'
                ) THEN
                    ALTER TABLE otp_verifications ADD COLUMN status INTEGER NOT NULL DEFAULT 0;
                END IF;

                -- Safely provision cooldown_until column to otp_verifications if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'otp_verifications' AND column_name = 'cooldown_until'
                ) THEN
                    ALTER TABLE otp_verifications ADD COLUMN cooldown_until TIMESTAMP WITH TIME ZONE;
                END IF;

                -- Safely provision invalidated_at column to otp_verifications if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'otp_verifications' AND column_name = 'invalidated_at'
                ) THEN
                    ALTER TABLE otp_verifications ADD COLUMN invalidated_at TIMESTAMP WITH TIME ZONE;
                END IF;

                -- Safely provision ai_talent_discovery column to user_profiles if missing
                IF EXISTS (
                    SELECT 1 
                    FROM information_schema.tables 
                    WHERE table_name = 'user_profiles'
                ) THEN
                    IF NOT EXISTS (
                        SELECT 1 
                        FROM information_schema.columns 
                        WHERE table_name = 'user_profiles' AND column_name = 'ai_talent_discovery'
                    ) THEN
                        ALTER TABLE user_profiles ADD COLUMN ai_talent_discovery VARCHAR(20) NOT NULL DEFAULT 'disabled';
                    END IF;
                END IF;

                -- Safely provision last_profile_update_at column to user_profiles if missing
                IF EXISTS (
                    SELECT 1 
                    FROM information_schema.tables 
                    WHERE table_name = 'user_profiles'
                ) THEN
                    IF NOT EXISTS (
                        SELECT 1 
                        FROM information_schema.columns 
                        WHERE table_name = 'user_profiles' AND column_name = 'last_profile_update_at'
                    ) THEN
                        ALTER TABLE user_profiles ADD COLUMN last_profile_update_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();
                    END IF;
                END IF;

                -- Safely provision version column to user_profiles if missing
                IF EXISTS (
                    SELECT 1 
                    FROM information_schema.tables 
                    WHERE table_name = 'user_profiles'
                ) THEN
                    IF NOT EXISTS (
                        SELECT 1 
                        FROM information_schema.columns 
                        WHERE table_name = 'user_profiles' AND column_name = 'version'
                    ) THEN
                        ALTER TABLE user_profiles ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
                    END IF;
                END IF;

                -- Safely provision version column to career_preferences if missing
                IF EXISTS (
                    SELECT 1 
                    FROM information_schema.tables 
                    WHERE table_name = 'career_preferences'
                ) THEN
                    IF NOT EXISTS (
                        SELECT 1 
                        FROM information_schema.columns 
                        WHERE table_name = 'career_preferences' AND column_name = 'version'
                    ) THEN
                        ALTER TABLE career_preferences ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
                    END IF;
                END IF;

                -- Safely provision version column to ai_inferred_preferences if missing
                IF EXISTS (
                    SELECT 1 
                    FROM information_schema.tables 
                    WHERE table_name = 'ai_inferred_preferences'
                ) THEN
                    IF NOT EXISTS (
                        SELECT 1 
                        FROM information_schema.columns 
                        WHERE table_name = 'ai_inferred_preferences' AND column_name = 'version'
                    ) THEN
                        ALTER TABLE ai_inferred_preferences ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
                    END IF;
                END IF;

                 -- Safely provision username column to users if missing
                 IF NOT EXISTS (
                     SELECT 1 
                     FROM information_schema.columns 
                     WHERE table_name = 'users' AND column_name = 'username'
                 ) THEN
                     ALTER TABLE users ADD COLUMN username CITEXT;
                 END IF;

                 -- Safely provision last_username_change_at column to users if missing
                 IF NOT EXISTS (
                     SELECT 1 
                     FROM information_schema.columns 
                     WHERE table_name = 'users' AND column_name = 'last_username_change_at'
                 ) THEN
                     ALTER TABLE users ADD COLUMN last_username_change_at TIMESTAMP WITH TIME ZONE;
                 END IF;

                 CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_active ON users(username) WHERE (deleted_at IS NULL OR status = 'DELETION_PENDING');

                -- Safely provision provider_account_id column to auth_providers if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'auth_providers' AND column_name = 'provider_account_id'
                ) THEN
                    ALTER TABLE auth_providers ADD COLUMN provider_account_id VARCHAR(100);
                END IF;

                -- Safely provision provider_username column to auth_providers if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'auth_providers' AND column_name = 'provider_username'
                ) THEN
                    ALTER TABLE auth_providers ADD COLUMN provider_username VARCHAR(255);
                END IF;

                -- Safely provision provider_avatar_url column to auth_providers if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'auth_providers' AND column_name = 'provider_avatar_url'
                ) THEN
                    ALTER TABLE auth_providers ADD COLUMN provider_avatar_url VARCHAR(500);
                END IF;

                -- Safely provision granted_scopes column to auth_providers if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'auth_providers' AND column_name = 'granted_scopes'
                ) THEN
                    ALTER TABLE auth_providers ADD COLUMN granted_scopes VARCHAR(500);
                END IF;

                -- Safely provision last_scope_validation_at column to auth_providers if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'auth_providers' AND column_name = 'last_scope_validation_at'
                ) THEN
                    ALTER TABLE auth_providers ADD COLUMN last_scope_validation_at TIMESTAMP WITH TIME ZONE;
                END IF;

                -- Safely provision scope_validation_status column to auth_providers if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'auth_providers' AND column_name = 'scope_validation_status'
                ) THEN
                    ALTER TABLE auth_providers ADD COLUMN scope_validation_status INTEGER NOT NULL DEFAULT 0;
                END IF;

                -- Safely provision last_successful_refresh_at column to auth_providers if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'auth_providers' AND column_name = 'last_successful_refresh_at'
                ) THEN
                    ALTER TABLE auth_providers ADD COLUMN last_successful_refresh_at TIMESTAMP WITH TIME ZONE;
                END IF;

                -- Safely provision refresh_failure_count column to auth_providers if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'auth_providers' AND column_name = 'refresh_failure_count'
                ) THEN
                    ALTER TABLE auth_providers ADD COLUMN refresh_failure_count INTEGER NOT NULL DEFAULT 0;
                END IF;

                -- Safely provision last_provider_sync_at column to auth_providers if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'auth_providers' AND column_name = 'last_provider_sync_at'
                ) THEN
                    ALTER TABLE auth_providers ADD COLUMN last_provider_sync_at TIMESTAMP WITH TIME ZONE;
                END IF;

                -- Safely provision provider_display_name column if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'auth_providers' AND column_name = 'provider_display_name'
                ) THEN
                    ALTER TABLE auth_providers ADD COLUMN provider_display_name VARCHAR(255);
                END IF;

                -- Safely provision provider_profile_url column if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'auth_providers' AND column_name = 'provider_profile_url'
                ) THEN
                    ALTER TABLE auth_providers ADD COLUMN provider_profile_url VARCHAR(500);
                END IF;

                -- Safely provision sync_status column if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'auth_providers' AND column_name = 'sync_status'
                ) THEN
                    ALTER TABLE auth_providers ADD COLUMN sync_status VARCHAR(50) NOT NULL DEFAULT 'Pending';
                END IF;

                -- Safely provision sync_error column if missing
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'auth_providers' AND column_name = 'sync_error'
                ) THEN
                    ALTER TABLE auth_providers ADD COLUMN sync_error TEXT;
                END IF;

                -- Safely provision is_leadership column to work_experience_entries if missing
                IF EXISTS (
                    SELECT 1 
                    FROM information_schema.tables 
                    WHERE table_name = 'work_experience_entries'
                ) THEN
                    IF NOT EXISTS (
                        SELECT 1 
                        FROM information_schema.columns 
                        WHERE table_name = 'work_experience_entries' AND column_name = 'is_leadership'
                    ) THEN
                        ALTER TABLE work_experience_entries ADD COLUMN is_leadership BOOLEAN NOT NULL DEFAULT FALSE;
                    END IF;
                END IF;

            END $$;

            -- Safely provision avatar_source column and perform backfills
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'avatar_source'
                ) THEN
                    ALTER TABLE users ADD COLUMN avatar_source INTEGER NOT NULL DEFAULT 0;
                END IF;

                -- Backfill Step 1: If avatar_url is null or empty, it is Default (0)
                UPDATE users 
                SET avatar_source = 0 
                WHERE avatar_url IS NULL OR avatar_url = '';

                -- Backfill Step 2: If avatar_url is a local key (no http prefix), it is Uploaded (1)
                UPDATE users 
                SET avatar_source = 1 
                WHERE avatar_url IS NOT NULL 
                  AND avatar_url <> '' 
                  AND avatar_url NOT LIKE 'http://%' 
                  AND avatar_url NOT LIKE 'https://%';

                -- Backfill Step 3: Match http URLs against active linked provider keys (Google = 2)
                UPDATE users u
                SET avatar_source = 2
                FROM auth_providers ap
                WHERE u.id = ap.user_id 
                  AND ap.provider_name = 'google'
                  AND ap.deleted_at IS NULL
                  AND u.avatar_url LIKE 'https://%.googleusercontent.com/%'
                  AND u.avatar_source = 0;

                -- Backfill Step 4: Match http URLs against active linked provider keys (GitHub = 3)
                UPDATE users u
                SET avatar_source = 3
                FROM auth_providers ap
                WHERE u.id = ap.user_id 
                  AND ap.provider_name = 'github'
                  AND ap.deleted_at IS NULL
                  AND u.avatar_url LIKE 'https://avatars.githubusercontent.com/%'
                  AND u.avatar_source = 0;

                -- Backfill Step 5: Fallback remaining http avatar URLs to Uploaded (1)
                UPDATE users 
                SET avatar_source = 1 
                WHERE avatar_url IS NOT NULL 
                  AND avatar_url <> '' 
                  AND avatar_url LIKE 'http%' 
                  AND avatar_source = 0;

                -- Backfill legacy Google Provider avatar URLs from users if null
                UPDATE auth_providers ap
                SET provider_avatar_url = u.avatar_url
                FROM users u
                WHERE ap.user_id = u.id 
                  AND ap.provider_name = 'google' 
                  AND ap.provider_avatar_url IS NULL 
                  AND u.avatar_url LIKE 'https://%.googleusercontent.com/%';
            END $$;

            -- Granular permissions using a hierarchical naming convention
            CREATE TABLE IF NOT EXISTS permissions (
                id UUID PRIMARY KEY,
                name VARCHAR(150) NOT NULL UNIQUE,
                display_name VARCHAR(150) NOT NULL,
                description TEXT,
                module VARCHAR(50) NOT NULL,
                is_system BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );

            -- Maps permissions to roles (Many-to-Many relationship)
            CREATE TABLE IF NOT EXISTS role_permissions (
                role_id UUID NOT NULL,
                permission_id UUID NOT NULL,
                assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                PRIMARY KEY (role_id, permission_id),
                CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
                CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
            );

            -- Manages long-lived refresh tokens for maintaining user sessions securely
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id UUID PRIMARY KEY,
                user_id UUID,
                organization_id UUID,
                token VARCHAR(255) NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                revoked_at TIMESTAMP WITH TIME ZONE,
                replaced_by_token VARCHAR(255),
                user_agent VARCHAR(500),
                ip_address VARCHAR(45),
                session_id UUID NOT NULL,
                remember_me BOOLEAN NOT NULL DEFAULT FALSE,
                replaced_by_token_id UUID,
                CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_refresh_tokens_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            );

            -- Ensure ip_address column exists on refresh_tokens (in case table was created from older schema)
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name='refresh_tokens' AND column_name='ip_address'
                ) THEN
                    ALTER TABLE refresh_tokens ADD COLUMN ip_address VARCHAR(45);
                END IF;
            END $$;

            -- Ensure user_agent column exists on refresh_tokens
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name='refresh_tokens' AND column_name='user_agent'
                ) THEN
                    ALTER TABLE refresh_tokens ADD COLUMN user_agent VARCHAR(500);
                END IF;
            END $$;

            -- Ensure session_id column exists on refresh_tokens
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name='refresh_tokens' AND column_name='session_id'
                ) THEN
                    ALTER TABLE refresh_tokens ADD COLUMN session_id UUID NOT NULL;
                END IF;
            END $$;

            -- Ensure remember_me column exists on refresh_tokens
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name='refresh_tokens' AND column_name='remember_me'
                ) THEN
                    ALTER TABLE refresh_tokens ADD COLUMN remember_me BOOLEAN NOT NULL DEFAULT FALSE;
                END IF;
            END $$;

            -- Ensure replaced_by_token_id column exists on refresh_tokens
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name='refresh_tokens' AND column_name='replaced_by_token_id'
                ) THEN
                    ALTER TABLE refresh_tokens ADD COLUMN replaced_by_token_id UUID;
                END IF;
            END $$;

            -- Ensure user_id is nullable on refresh_tokens
            ALTER TABLE refresh_tokens ALTER COLUMN user_id DROP NOT NULL;

            -- Ensure organization_id column exists on refresh_tokens
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name='refresh_tokens' AND column_name='organization_id'
                ) THEN
                    ALTER TABLE refresh_tokens ADD COLUMN organization_id UUID;
                    ALTER TABLE refresh_tokens ADD CONSTRAINT fk_refresh_tokens_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
                END IF;
            END $$;

            -- Create explicit indexes for high performance query lookups
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session_id ON refresh_tokens(session_id);
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

            -- Manages one-time-use email verification tokens
            CREATE TABLE IF NOT EXISTS verification_tokens (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL,
                token_hash VARCHAR(255) NOT NULL UNIQUE,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                consumed_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT fk_verification_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            -- Manages one-time-use password reset tokens
            CREATE TABLE IF NOT EXISTS reset_password_tokens (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL,
                token_hash VARCHAR(255) NOT NULL UNIQUE,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                consumed_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT fk_reset_password_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            -- Unified Recovery Tokens table for Candidate, Organization OTP, reset, and Reclaim bootstrap
            CREATE TABLE IF NOT EXISTS recovery_tokens (
                id UUID PRIMARY KEY,
                user_id UUID,
                organization_id UUID,
                token_hash VARCHAR(255) NOT NULL,
                token_type INTEGER NOT NULL,
                purpose VARCHAR(100) NOT NULL,
                metadata_json TEXT,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                consumed_at TIMESTAMP WITH TIME ZONE,
                revoked_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_recovery_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_recovery_tokens_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_recovery_tokens_active ON recovery_tokens(token_hash) WHERE consumed_at IS NULL AND revoked_at IS NULL;
            CREATE INDEX IF NOT EXISTS idx_recovery_tokens_user_id ON recovery_tokens(user_id);
            CREATE INDEX IF NOT EXISTS idx_recovery_tokens_organization_id ON recovery_tokens(organization_id);

            -- Outbox Pattern Table for reliable asynchronous email delivery
            CREATE TABLE IF NOT EXISTS outbox_messages (
                id UUID PRIMARY KEY,
                type VARCHAR(100) NOT NULL,
                payload TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                processed_at TIMESTAMP WITH TIME ZONE,
                error TEXT
            );

            -- Security Audit Logs Table for tracking major events
            CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY,
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                event_type VARCHAR(100) NOT NULL,
                description TEXT NOT NULL,
                ip_address VARCHAR(45),
                anonymized_actor_hash VARCHAR(64),
                user_agent VARCHAR(500),
                actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
                target_role_name VARCHAR(50),
                scope_type VARCHAR(30),
                scope_id UUID,
                details_json JSONB,
                old_state_json JSONB,
                new_state_json JSONB,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON audit_logs(actor_user_id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user_id ON audit_logs(target_user_id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);

            -- Manages chat conversation sessions with the AI Assistant
            CREATE TABLE IF NOT EXISTS conversations (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL,
                title VARCHAR(255) NOT NULL DEFAULT 'New Conversation',
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_conversations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            -- Stores individual messages in a conversation
            CREATE TABLE IF NOT EXISTS messages (
                id UUID PRIMARY KEY,
                conversation_id UUID NOT NULL,
                role VARCHAR(50) NOT NULL,
                content TEXT NOT NULL,
                streaming_state VARCHAR(50) NOT NULL DEFAULT 'Pending',
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            );

            -- User Profile table for storing bio, location, pronouns, unique username
            CREATE TABLE IF NOT EXISTS user_profiles (
                user_id UUID PRIMARY KEY,
                username CITEXT UNIQUE,
                bio VARCHAR(160),
                location VARCHAR(50),
                phone_number VARCHAR(15),
                birth_date TIMESTAMP WITH TIME ZONE,
                headline VARCHAR(50),
                company VARCHAR(50),
                pronouns VARCHAR(20),
                custom_pronouns VARCHAR(30),
                public_email VARCHAR(255),
                profile_visibility VARCHAR(20) NOT NULL DEFAULT 'public',
                recruiter_visibility BOOLEAN NOT NULL DEFAULT TRUE,
                ai_talent_discovery VARCHAR(20) NOT NULL DEFAULT 'disabled',
                social_links VARCHAR(255)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[],
                last_profile_update_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                version INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                deleted_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username_active ON user_profiles(username) WHERE deleted_at IS NULL;

            -- Career Preferences table for job hunting status, expected salary, and models
            CREATE TABLE IF NOT EXISTS career_preferences (
                user_id UUID PRIMARY KEY,
                available_for_hire BOOLEAN NOT NULL DEFAULT TRUE,
                preferred_language VARCHAR(10) NOT NULL DEFAULT 'en',
                job_title_preferences VARCHAR(255),
                salary_expectations DECIMAL(18,2),
                remote_preference VARCHAR(20),
                open_to_work_status VARCHAR(20),
                preferred_locations VARCHAR(100)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[],
                employment_preferences VARCHAR(50)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[],
                preferred_work_environments VARCHAR(100)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[],
                work_styles VARCHAR(100)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[],
                company_values VARCHAR(100)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[],
                desired_job_positions VARCHAR(100)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[],
                expected_salary_min DECIMAL(18,2),
                expected_salary_max DECIMAL(18,2),
                expected_salary_currency VARCHAR(10),
                expected_salary_type VARCHAR(20),
                expected_salary_negotiable BOOLEAN NOT NULL DEFAULT FALSE,
                is_expected_salary_visible BOOLEAN NOT NULL DEFAULT FALSE,
                work_preference_notes TEXT,
                version INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                deleted_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT fk_career_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'career_preferences' AND column_name = 'preferred_work_environments') THEN
                    ALTER TABLE career_preferences ADD COLUMN preferred_work_environments TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'career_preferences' AND column_name = 'work_styles') THEN
                    ALTER TABLE career_preferences ADD COLUMN work_styles TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'career_preferences' AND column_name = 'company_values') THEN
                    ALTER TABLE career_preferences ADD COLUMN company_values TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'career_preferences' AND column_name = 'desired_job_positions') THEN
                    ALTER TABLE career_preferences ADD COLUMN desired_job_positions TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'career_preferences' AND column_name = 'expected_salary_min') THEN
                    ALTER TABLE career_preferences ADD COLUMN expected_salary_min DECIMAL(18,2);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'career_preferences' AND column_name = 'expected_salary_max') THEN
                    ALTER TABLE career_preferences ADD COLUMN expected_salary_max DECIMAL(18,2);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'career_preferences' AND column_name = 'expected_salary_currency') THEN
                    ALTER TABLE career_preferences ADD COLUMN expected_salary_currency VARCHAR(10);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'career_preferences' AND column_name = 'expected_salary_type') THEN
                    ALTER TABLE career_preferences ADD COLUMN expected_salary_type VARCHAR(20);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'career_preferences' AND column_name = 'expected_salary_negotiable') THEN
                    ALTER TABLE career_preferences ADD COLUMN expected_salary_negotiable BOOLEAN NOT NULL DEFAULT FALSE;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'career_preferences' AND column_name = 'is_expected_salary_visible') THEN
                    ALTER TABLE career_preferences ADD COLUMN is_expected_salary_visible BOOLEAN NOT NULL DEFAULT FALSE;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'career_preferences' AND column_name = 'work_preference_notes') THEN
                    ALTER TABLE career_preferences ADD COLUMN work_preference_notes TEXT;
                END IF;
            END $$;

            -- Safely migrate career_preferences columns to native arrays and add new columns
            DO $$
            BEGIN
                -- 1. Check if preferred_work_environments is text
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'career_preferences' 
                      AND column_name = 'preferred_work_environments' 
                      AND data_type = 'text'
                ) THEN
                    ALTER TABLE career_preferences RENAME COLUMN preferred_work_environments TO preferred_work_environments_old;
                    ALTER TABLE career_preferences ADD COLUMN preferred_work_environments VARCHAR(100)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[];
                    UPDATE career_preferences SET preferred_work_environments = ARRAY(
                        SELECT json_array_elements_text(preferred_work_environments_old::json)
                    ) WHERE preferred_work_environments_old IS NOT NULL 
                      AND preferred_work_environments_old <> '' 
                      AND preferred_work_environments_old LIKE '[%';
                    ALTER TABLE career_preferences DROP COLUMN preferred_work_environments_old;
                END IF;

                -- 2. Check if work_styles is text
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'career_preferences' 
                      AND column_name = 'work_styles' 
                      AND data_type = 'text'
                ) THEN
                    ALTER TABLE career_preferences RENAME COLUMN work_styles TO work_styles_old;
                    ALTER TABLE career_preferences ADD COLUMN work_styles VARCHAR(100)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[];
                    UPDATE career_preferences SET work_styles = ARRAY(
                        SELECT json_array_elements_text(work_styles_old::json)
                    ) WHERE work_styles_old IS NOT NULL 
                      AND work_styles_old <> '' 
                      AND work_styles_old LIKE '[%';
                    ALTER TABLE career_preferences DROP COLUMN work_styles_old;
                END IF;

                -- 3. Check if company_values is text
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'career_preferences' 
                      AND column_name = 'company_values' 
                      AND data_type = 'text'
                ) THEN
                    ALTER TABLE career_preferences RENAME COLUMN company_values TO company_values_old;
                    ALTER TABLE career_preferences ADD COLUMN company_values VARCHAR(100)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[];
                    UPDATE career_preferences SET company_values = ARRAY(
                        SELECT json_array_elements_text(company_values_old::json)
                    ) WHERE company_values_old IS NOT NULL 
                      AND company_values_old <> '' 
                      AND company_values_old LIKE '[%';
                    ALTER TABLE career_preferences DROP COLUMN company_values_old;
                END IF;

                -- 4. Check if desired_job_positions is text
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'career_preferences' 
                      AND column_name = 'desired_job_positions' 
                      AND data_type = 'text'
                ) THEN
                    ALTER TABLE career_preferences RENAME COLUMN desired_job_positions TO desired_job_positions_old;
                    ALTER TABLE career_preferences ADD COLUMN desired_job_positions VARCHAR(100)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[];
                    UPDATE career_preferences SET desired_job_positions = ARRAY(
                        SELECT json_array_elements_text(desired_job_positions_old::json)
                    ) WHERE desired_job_positions_old IS NOT NULL 
                      AND desired_job_positions_old <> '' 
                      AND desired_job_positions_old LIKE '[%';
                    ALTER TABLE career_preferences DROP COLUMN desired_job_positions_old;
                END IF;

                -- 5. Add open_to_work_status if missing or not default
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'career_preferences' AND column_name = 'open_to_work_status'
                ) THEN
                    ALTER TABLE career_preferences ADD COLUMN open_to_work_status VARCHAR(20) DEFAULT 'casual' NOT NULL;
                ELSE
                    ALTER TABLE career_preferences ALTER COLUMN open_to_work_status SET DEFAULT 'casual';
                    UPDATE career_preferences SET open_to_work_status = 'casual' WHERE open_to_work_status IS NULL;
                    ALTER TABLE career_preferences ALTER COLUMN open_to_work_status SET NOT NULL;
                END IF;

                -- 6. Add open_to_relocation if missing
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'career_preferences' AND column_name = 'open_to_relocation'
                ) THEN
                    ALTER TABLE career_preferences ADD COLUMN open_to_relocation BOOLEAN DEFAULT FALSE NOT NULL;
                END IF;

                -- 7. Add leadership_track if missing
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'career_preferences' AND column_name = 'leadership_track'
                ) THEN
                    ALTER TABLE career_preferences ADD COLUMN leadership_track VARCHAR(30) DEFAULT 'undecided' NOT NULL;
                END IF;

                -- 8. Add company_stage_preferences if missing
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'career_preferences' AND column_name = 'company_stage_preferences'
                ) THEN
                    ALTER TABLE career_preferences ADD COLUMN company_stage_preferences VARCHAR(50)[] DEFAULT ARRAY[]::VARCHAR[] NOT NULL;
                END IF;

                -- 9. Add preferred_industries if missing
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'career_preferences' AND column_name = 'preferred_industries'
                ) THEN
                    ALTER TABLE career_preferences ADD COLUMN preferred_industries VARCHAR(100)[] DEFAULT ARRAY[]::VARCHAR[] NOT NULL;
                END IF;

                -- 10. Add target_skills if missing
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'career_preferences' AND column_name = 'target_skills'
                ) THEN
                    ALTER TABLE career_preferences ADD COLUMN target_skills VARCHAR(100)[] DEFAULT ARRAY[]::VARCHAR[] NOT NULL;
                END IF;
            END $$;

            -- AI Inferred Preferences table
            CREATE TABLE IF NOT EXISTS ai_inferred_preferences (
                user_id UUID PRIMARY KEY,
                inferred_primary_role VARCHAR(100),
                inferred_seniority VARCHAR(50),
                inferred_skills VARCHAR(100)[] DEFAULT ARRAY[]::VARCHAR[] NOT NULL,
                inferred_salary_min DECIMAL(18,2),
                inferred_salary_max DECIMAL(18,2),
                inferred_salary_currency VARCHAR(10) DEFAULT 'USD',
                inferred_industries VARCHAR(100)[] DEFAULT ARRAY[]::VARCHAR[] NOT NULL,
                confidence_score DECIMAL(5,2) DEFAULT 0.00 NOT NULL,
                synthesis_rationale TEXT,
                version INTEGER NOT NULL DEFAULT 1,
                last_analyzed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                deleted_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT fk_ai_inferred_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_career_prefs_desired_roles ON career_preferences USING gin (desired_job_positions);
            CREATE INDEX IF NOT EXISTS idx_career_prefs_target_skills ON career_preferences USING gin (target_skills);
            CREATE INDEX IF NOT EXISTS idx_ai_inferred_skills ON ai_inferred_preferences USING gin (inferred_skills);

            -- Normalized User Skills
            CREATE TABLE IF NOT EXISTS user_skills (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL,
                skill VARCHAR(100) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_user_skills_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON user_skills(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_skills_name ON user_skills(skill);



            -- Education history entry details
            CREATE TABLE IF NOT EXISTS education_entries (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL,
                label VARCHAR(255) NOT NULL,
                school_name VARCHAR(255) NOT NULL,
                degree VARCHAR(255),
                major VARCHAR(255),
                gpa DECIMAL(4,2),
                gpa_scale DECIMAL(4,2),
                description TEXT,
                start_date TIMESTAMP WITH TIME ZONE,
                end_date TIMESTAMP WITH TIME ZONE,
                is_currently_studying BOOLEAN NOT NULL DEFAULT FALSE,
                display_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                deleted_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT fk_education_entries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_education_entries_user_id ON education_entries(user_id);

            -- Academic Achievements certificates and award distinctions
            CREATE TABLE IF NOT EXISTS academic_achievements (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL,
                title VARCHAR(255) NOT NULL,
                issuer VARCHAR(255) NOT NULL,
                issue_date TIMESTAMP WITH TIME ZONE NOT NULL,
                description TEXT NOT NULL,
                credential_url VARCHAR(255),
                display_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                deleted_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT fk_academic_achievements_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_academic_achievements_user_id ON academic_achievements(user_id);

            -- Work Experience & Achievements normalized tables
            CREATE TABLE IF NOT EXISTS work_experience_entries (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL,
                job_title VARCHAR(255) NOT NULL,
                company VARCHAR(255) NOT NULL,
                experience_category INTEGER NOT NULL,
                employment_type INTEGER NOT NULL,
                location VARCHAR(255),
                start_date TIMESTAMP WITH TIME ZONE NOT NULL,
                end_date TIMESTAMP WITH TIME ZONE,
                is_currently_working BOOLEAN NOT NULL DEFAULT FALSE,
                is_leadership BOOLEAN NOT NULL DEFAULT FALSE,
                description TEXT NOT NULL,
                display_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                deleted_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT fk_work_experience_entries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_work_experience_entries_user_id ON work_experience_entries(user_id);

            CREATE TABLE IF NOT EXISTS work_experience_achievements (
                id UUID PRIMARY KEY,
                work_experience_id UUID NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_work_experience_achievements_entry FOREIGN KEY (work_experience_id) REFERENCES work_experience_entries(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_work_experience_achievements_entry ON work_experience_achievements(work_experience_id);

            CREATE TABLE IF NOT EXISTS work_experience_technologies (
                id UUID PRIMARY KEY,
                work_experience_id UUID NOT NULL,
                name VARCHAR(100) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_work_experience_technologies_entry FOREIGN KEY (work_experience_id) REFERENCES work_experience_entries(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_work_experience_technologies_entry ON work_experience_technologies(work_experience_id);

            CREATE TABLE IF NOT EXISTS work_experience_links (
                id UUID PRIMARY KEY,
                work_experience_id UUID NOT NULL,
                link_type INTEGER NOT NULL,
                url VARCHAR(500) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_work_experience_links_entry FOREIGN KEY (work_experience_id) REFERENCES work_experience_entries(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_work_experience_links_entry ON work_experience_links(work_experience_id);

            -- Generic polymorphic uploads/attachments
            CREATE TABLE IF NOT EXISTS profile_attachments (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL,
                entity_type VARCHAR(50) NOT NULL,
                entity_id UUID,
                file_name VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                file_size BIGINT NOT NULL,
                file_type VARCHAR(100) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                deleted_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT fk_profile_attachments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_profile_attachments_user_id ON profile_attachments(user_id);
            CREATE INDEX IF NOT EXISTS idx_profile_attachments_entity ON profile_attachments(entity_type, entity_id);



            -- Stores background analysis jobs
            CREATE TABLE IF NOT EXISTS analysis_jobs (
                id UUID PRIMARY KEY,
                repository_id UUID NOT NULL,
                user_id UUID NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'Queued',
                progress DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                current_step VARCHAR(100),
                commit_sha VARCHAR(100),
                started_at TIMESTAMP WITH TIME ZONE,
                completed_at TIMESTAMP WITH TIME ZONE,
                error_message VARCHAR(2000),
                created_at_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                last_updated_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_analysis_jobs_repository FOREIGN KEY (repository_id) REFERENCES source_code_repositories(id) ON DELETE CASCADE,
                CONSTRAINT fk_analysis_jobs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_analysis_jobs_repository_id ON analysis_jobs(repository_id);
            CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_id ON analysis_jobs(user_id);

            -- Stores detailed events for active analysis jobs
            CREATE TABLE IF NOT EXISTS analysis_job_events (
                id UUID PRIMARY KEY,
                job_id UUID NOT NULL,
                step VARCHAR(100) NOT NULL,
                progress DOUBLE PRECISION NOT NULL,
                message VARCHAR(2000) NOT NULL,
                created_at_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_analysis_job_events_job FOREIGN KEY (job_id) REFERENCES analysis_jobs(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_analysis_job_events_job_id ON analysis_job_events(job_id);

            -- Stores final analysis reports
            CREATE TABLE IF NOT EXISTS analysis_reports (
                id UUID PRIMARY KEY,
                job_id UUID NOT NULL UNIQUE,
                repository_id UUID NOT NULL,
                report_data JSONB NOT NULL,
                created_at_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_analysis_reports_job FOREIGN KEY (job_id) REFERENCES analysis_jobs(id) ON DELETE CASCADE,
                CONSTRAINT fk_analysis_reports_repository FOREIGN KEY (repository_id) REFERENCES source_code_repositories(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_analysis_reports_repository_id ON analysis_reports(repository_id);

            -- Stores background analysis tasks
            CREATE TABLE IF NOT EXISTS analysis_tasks (
                id UUID PRIMARY KEY,
                job_id UUID NOT NULL,
                task_type VARCHAR(50) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'Queued',
                progress DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                started_at TIMESTAMP WITH TIME ZONE,
                completed_at TIMESTAMP WITH TIME ZONE,
                duration_ms BIGINT,
                retry_count INTEGER NOT NULL DEFAULT 0,
                error_message VARCHAR(2000),
                prompt_tokens INTEGER,
                completion_tokens INTEGER,
                cache_read_tokens INTEGER,
                cache_write_tokens INTEGER,
                estimated_cost_usd NUMERIC(10, 6),
                model_name VARCHAR(100),
                metadata JSONB,
                created_at_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                last_updated_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_analysis_tasks_job FOREIGN KEY (job_id) REFERENCES analysis_jobs(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_analysis_tasks_job_id ON analysis_tasks(job_id);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_analysis_tasks_job_id_task_type ON analysis_tasks(job_id, task_type);

            -- Stores results of completed analysis tasks
            CREATE TABLE IF NOT EXISTS analysis_task_results (
                task_id UUID PRIMARY KEY,
                schema_version VARCHAR(50) NOT NULL DEFAULT '2.0.0',
                result_data JSONB NOT NULL,
                created_at_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_analysis_task_results_task FOREIGN KEY (task_id) REFERENCES analysis_tasks(id) ON DELETE CASCADE
            );

            -- Stores detailed executions for AI/tool tasks
            CREATE TABLE IF NOT EXISTS analysis_executions (
                id UUID PRIMARY KEY,
                job_id UUID NOT NULL,
                task_id UUID NOT NULL,
                user_id UUID NOT NULL,
                execution_type VARCHAR(50) NOT NULL DEFAULT 'LLM_CALL',
                provider VARCHAR(50) NOT NULL,
                model VARCHAR(100) NOT NULL,
                prompt_tokens INTEGER NOT NULL,
                completion_tokens INTEGER NOT NULL,
                total_tokens INTEGER NOT NULL,
                cached_tokens INTEGER NOT NULL,
                estimated_cost_usd NUMERIC(10, 6) NOT NULL,
                duration_ms BIGINT NOT NULL,
                created_at_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_analysis_executions_task FOREIGN KEY (task_id) REFERENCES analysis_tasks(id) ON DELETE CASCADE,
                CONSTRAINT fk_analysis_executions_job FOREIGN KEY (job_id) REFERENCES analysis_jobs(id) ON DELETE CASCADE,
                CONSTRAINT fk_analysis_executions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_analysis_executions_task_id ON analysis_executions(task_id);
            CREATE INDEX IF NOT EXISTS idx_analysis_executions_job_id ON analysis_executions(job_id);
            CREATE INDEX IF NOT EXISTS idx_analysis_executions_user_id ON analysis_executions(user_id);

            -- Stores detailed events for active analysis tasks
            CREATE TABLE IF NOT EXISTS analysis_task_events (
                id UUID PRIMARY KEY,
                task_id UUID NOT NULL,
                timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                level VARCHAR(20) NOT NULL DEFAULT 'Info',
                event_type VARCHAR(50) NOT NULL,
                message VARCHAR(2000) NOT NULL,
                metadata JSONB,
                CONSTRAINT fk_analysis_task_events_task FOREIGN KEY (task_id) REFERENCES analysis_tasks(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_analysis_task_events_task_id ON analysis_task_events(task_id);

            -- Artifact Registry (stores analysis job task outputs/artifacts metadata)
            CREATE TABLE IF NOT EXISTS artifact_registry_entries (
                id UUID PRIMARY KEY,
                job_id UUID NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
                artifact_id TEXT NOT NULL,
                name TEXT NOT NULL,
                checksum TEXT NOT NULL,
                storage_path TEXT NOT NULL,
                metadata_json TEXT NOT NULL,
                created_at_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_job_artifact ON artifact_registry_entries(job_id, artifact_id);
            CREATE INDEX IF NOT EXISTS ix_artifact_registry_entries_job_id ON artifact_registry_entries(job_id);

            -- Optimized Indexes
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
            CREATE INDEX IF NOT EXISTS idx_verification_tokens_active ON verification_tokens(token_hash) WHERE consumed_at IS NULL;
            CREATE INDEX IF NOT EXISTS idx_reset_password_tokens_active ON reset_password_tokens(token_hash) WHERE consumed_at IS NULL;
            CREATE INDEX IF NOT EXISTS idx_outbox_messages_pending ON outbox_messages(created_at) WHERE processed_at IS NULL;
            CREATE INDEX IF NOT EXISTS idx_users_active ON users(status) WHERE deleted_at IS NULL;
            CREATE INDEX IF NOT EXISTS idx_permissions_hierarchy ON permissions (name varchar_pattern_ops);
            CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
            CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at ON messages(conversation_id, created_at);

            -- Triggers Registration
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_roles_timestamp') THEN
                    CREATE TRIGGER tr_roles_timestamp BEFORE UPDATE ON roles 
                        FOR EACH ROW EXECUTE PROCEDURE fn_update_timestamp();
                END IF;
            END $$;

            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_users_timestamp') THEN
                    CREATE TRIGGER tr_users_timestamp BEFORE UPDATE ON users 
                        FOR EACH ROW EXECUTE PROCEDURE fn_update_timestamp();
                END IF;
            END $$;

            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_permissions_timestamp') THEN
                    CREATE TRIGGER tr_permissions_timestamp BEFORE UPDATE ON permissions 
                        FOR EACH ROW EXECUTE PROCEDURE fn_update_timestamp();
                END IF;
            END $$;

            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_conversations_timestamp') THEN
                    CREATE TRIGGER tr_conversations_timestamp BEFORE UPDATE ON conversations 
                        FOR EACH ROW EXECUTE PROCEDURE fn_update_timestamp();
                END IF;
            END $$;

            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_user_profiles_timestamp') THEN
                    CREATE TRIGGER tr_user_profiles_timestamp BEFORE UPDATE ON user_profiles 
                        FOR EACH ROW EXECUTE PROCEDURE fn_update_timestamp();
                END IF;
            END $$;

            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_career_preferences_timestamp') THEN
                    CREATE TRIGGER tr_career_preferences_timestamp BEFORE UPDATE ON career_preferences 
                        FOR EACH ROW EXECUTE PROCEDURE fn_update_timestamp();
                END IF;
            END $$;



            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_education_entries_timestamp') THEN
                    CREATE TRIGGER tr_education_entries_timestamp BEFORE UPDATE ON education_entries 
                        FOR EACH ROW EXECUTE PROCEDURE fn_update_timestamp();
                END IF;
            END $$;

            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_academic_achievements_timestamp') THEN
                    CREATE TRIGGER tr_academic_achievements_timestamp BEFORE UPDATE ON academic_achievements 
                        FOR EACH ROW EXECUTE PROCEDURE fn_update_timestamp();
                END IF;
            END $$;

            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_profile_attachments_timestamp') THEN
                    CREATE TRIGGER tr_profile_attachments_timestamp BEFORE UPDATE ON profile_attachments 
                        FOR EACH ROW EXECUTE PROCEDURE fn_update_timestamp();
                END IF;
            END $$;

            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_work_experience_entries_timestamp') THEN
                    CREATE TRIGGER tr_work_experience_entries_timestamp BEFORE UPDATE ON work_experience_entries 
                        FOR EACH ROW EXECUTE PROCEDURE fn_update_timestamp();
                END IF;
            END $$;

            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_work_experience_achievements_timestamp') THEN
                    CREATE TRIGGER tr_work_experience_achievements_timestamp BEFORE UPDATE ON work_experience_achievements 
                        FOR EACH ROW EXECUTE PROCEDURE fn_update_timestamp();
                END IF;
            END $$;

            -- Admin Members table
            CREATE TABLE IF NOT EXISTS admin_members (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(50) NOT NULL DEFAULT 'Active',
                session_version INTEGER NOT NULL DEFAULT 1,
                joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                assigned_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
            );

            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_admin_members_timestamp') THEN
                    CREATE TRIGGER tr_admin_members_timestamp BEFORE UPDATE ON admin_members 
                        FOR EACH ROW EXECUTE PROCEDURE fn_update_timestamp();
                END IF;
            END $$;

            -- Admin Invitations table
            CREATE TABLE IF NOT EXISTS admin_invitations (
                id UUID PRIMARY KEY,
                invitee_email CITEXT NOT NULL,
                token_hash VARCHAR(64) NOT NULL,
                invited_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'Pending',
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                accepted_at TIMESTAMP WITH TIME ZONE,
                consumed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_invitations_token_hash ON admin_invitations(token_hash);

            -- Admin Invitation Roles junction table
            CREATE TABLE IF NOT EXISTS admin_invitation_roles (
                id UUID PRIMARY KEY,
                invitation_id UUID NOT NULL REFERENCES admin_invitations(id) ON DELETE CASCADE,
                role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE
            );



            -- Role Assignments Table (Polymorphic scoping)
            CREATE TABLE IF NOT EXISTS role_assignments (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
                scope_type VARCHAR(30) NOT NULL,
                scope_id UUID NOT NULL,
                assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_role_assignments_unique ON role_assignments(user_id, role_id, scope_type, scope_id);



            -- Stores organization invitations
            CREATE TABLE IF NOT EXISTS organization_invitations (
                id UUID PRIMARY KEY,
                organization_id UUID NOT NULL,
                invitee_email CITEXT NOT NULL,
                token_hash VARCHAR(64) NOT NULL,
                invited_by_user_id UUID,
                status VARCHAR(30) NOT NULL DEFAULT 'Pending',
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                accepted_at TIMESTAMP WITH TIME ZONE,
                declined_at TIMESTAMP WITH TIME ZONE,
                declined_reason VARCHAR(500),
                consumed_by_user_id UUID,
                discovery_notified_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT fk_organization_invitations_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                CONSTRAINT fk_organization_invitations_invited_by FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
                CONSTRAINT fk_organization_invitations_consumed_by FOREIGN KEY (consumed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS idx_org_invitations_email_status ON organization_invitations(invitee_email, status);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_org_invitations_token_hash ON organization_invitations(token_hash);

            -- Stores organization invitation roles
            CREATE TABLE IF NOT EXISTS organization_invitation_roles (
                id UUID PRIMARY KEY,
                invitation_id UUID NOT NULL,
                role_id UUID NOT NULL,
                scope_type VARCHAR(30) NOT NULL DEFAULT 'ORGANIZATION',
                scope_id UUID NOT NULL,
                CONSTRAINT fk_org_invitation_roles_invitation FOREIGN KEY (invitation_id) REFERENCES organization_invitations(id) ON DELETE CASCADE,
                CONSTRAINT fk_org_invitation_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
            );

            -- Stores activity events for the notification and audit pipeline
            CREATE TABLE IF NOT EXISTS activity_events (
                id UUID PRIMARY KEY,
                correlation_id UUID NOT NULL,
                causation_id UUID,
                organization_id UUID,
                actor_user_id UUID,
                event_type VARCHAR(100) NOT NULL,
                resource_type VARCHAR(50) NOT NULL,
                resource_id UUID,
                visibility VARCHAR(30) NOT NULL,
                is_projected BOOLEAN NOT NULL,
                payload_json JSONB,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_activity_events_organizations_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                CONSTRAINT fk_activity_events_users_actor_user_id FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS idx_activity_events_correlation ON activity_events(correlation_id);
            CREATE INDEX IF NOT EXISTS idx_activity_events_org_created ON activity_events(organization_id, created_at);
            CREATE INDEX IF NOT EXISTS ix_activity_events_actor_user_id ON activity_events(actor_user_id);

            -- Stores user notification channel preferences
            CREATE TABLE IF NOT EXISTS notification_preferences (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL,
                notification_type VARCHAR(100) NOT NULL,
                channel VARCHAR(20) NOT NULL,
                is_enabled BOOLEAN NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_notification_preferences_users_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_user_notification_prefs ON notification_preferences(user_id, notification_type, channel);

            -- Stores in-app user notifications
            CREATE TABLE IF NOT EXISTS in_app_notifications (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL,
                activity_event_id UUID,
                notification_type VARCHAR(100) NOT NULL,
                resource_type VARCHAR(50) NOT NULL,
                resource_id UUID,
                payload_json JSONB,
                is_read BOOLEAN NOT NULL,
                is_aggregated BOOLEAN NOT NULL,
                aggregate_key VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                read_at TIMESTAMP WITH TIME ZONE,
                deleted_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT fk_in_app_notifications_activity_events_activity_event_id FOREIGN KEY (activity_event_id) REFERENCES activity_events(id) ON DELETE SET NULL,
                CONSTRAINT fk_in_app_notifications_users_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user_id ON in_app_notifications(user_id);
            CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user_unread ON in_app_notifications(user_id, is_read) WHERE deleted_at IS NULL;
            CREATE INDEX IF NOT EXISTS idx_in_app_notifications_aggregate ON in_app_notifications(user_id, aggregate_key) WHERE is_read = FALSE AND deleted_at IS NULL;
            CREATE INDEX IF NOT EXISTS ix_in_app_notifications_activity_event_id ON in_app_notifications(activity_event_id);

            -- Stores job vacancies listed by organizations
            CREATE TABLE IF NOT EXISTS job_vacancies (
                id UUID PRIMARY KEY,
                organization_id UUID NOT NULL,
                title VARCHAR(255) NOT NULL,
                department VARCHAR(100) NOT NULL,
                workplace_type VARCHAR(50) NOT NULL,
                city VARCHAR(100) NOT NULL,
                type VARCHAR(50) NOT NULL,
                salary VARCHAR(100) NOT NULL,
                salary_min_max VARCHAR(100) NOT NULL,
                headcount INTEGER NOT NULL,
                gender VARCHAR(50) NOT NULL,
                experience VARCHAR(100) NOT NULL,
                degree VARCHAR(100) NOT NULL,
                category VARCHAR(200) NOT NULL,
                description TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
                requirements TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
                benefits TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
                tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
                skills TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
                cover_url VARCHAR(2048) NOT NULL,
                images TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
                is_active BOOLEAN NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT fk_job_vacancies_organizations_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS ix_job_vacancies_organization_id ON job_vacancies(organization_id);

            -- Stores workspace posts listed by organizations
            CREATE TABLE IF NOT EXISTS workspace_posts (
                id UUID PRIMARY KEY,
                organization_id UUID NOT NULL,
                created_by_user_id UUID NOT NULL,
                category VARCHAR(100) NOT NULL,
                content TEXT NOT NULL,
                images TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
                likes INTEGER NOT NULL,
                shares_count INTEGER NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT fk_workspace_posts_organizations_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                CONSTRAINT fk_workspace_posts_users_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS ix_workspace_posts_created_by_user_id ON workspace_posts(created_by_user_id);
            CREATE INDEX IF NOT EXISTS ix_workspace_posts_organization_id ON workspace_posts(organization_id);

            -- Stores candidate assessment records
            CREATE TABLE IF NOT EXISTS candidate_assessments (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL,
                cv_id UUID,
                status VARCHAR(50) NOT NULL,
                overall_score DOUBLE PRECISION NOT NULL,
                career_level VARCHAR(20),
                career_level_label VARCHAR(50),
                primary_tendency VARCHAR(50),
                primary_working_style VARCHAR(50),
                summary_headline VARCHAR(500),
                summary_paragraph VARCHAR(2000),
                pipeline_version VARCHAR(20) NOT NULL,
                assessment_schema_version VARCHAR(20) NOT NULL,
                prompt_version VARCHAR(50),
                model_version VARCHAR(100),
                last_profile_update_at TIMESTAMP WITH TIME ZONE NOT NULL,
                last_repository_analysis_at TIMESTAMP WITH TIME ZONE NOT NULL,
                last_assessment_at TIMESTAMP WITH TIME ZONE,
                failed_stage VARCHAR(100),
                failure_reason TEXT,
                version INTEGER NOT NULL,
                created_at_utc TIMESTAMP WITH TIME ZONE NOT NULL,
                completed_at_utc TIMESTAMP WITH TIME ZONE,
                execution_strength DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                leadership_potential DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                technical_breadth DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                technical_depth DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                trust_level DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                CONSTRAINT fk_candidate_assessments_users_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_candidate_assessments_user_id ON candidate_assessments(user_id);
            CREATE UNIQUE INDEX IF NOT EXISTS ux_candidate_assessments_user_version ON candidate_assessments(user_id, version);

            -- Patch candidate_assessments to add new columns if table exists but columns are missing
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidate_assessments' AND column_name = 'execution_strength') THEN
                    ALTER TABLE candidate_assessments ADD COLUMN execution_strength DOUBLE PRECISION NOT NULL DEFAULT 0.0;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidate_assessments' AND column_name = 'leadership_potential') THEN
                    ALTER TABLE candidate_assessments ADD COLUMN leadership_potential DOUBLE PRECISION NOT NULL DEFAULT 0.0;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidate_assessments' AND column_name = 'technical_breadth') THEN
                    ALTER TABLE candidate_assessments ADD COLUMN technical_breadth DOUBLE PRECISION NOT NULL DEFAULT 0.0;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidate_assessments' AND column_name = 'technical_depth') THEN
                    ALTER TABLE candidate_assessments ADD COLUMN technical_depth DOUBLE PRECISION NOT NULL DEFAULT 0.0;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidate_assessments' AND column_name = 'trust_level') THEN
                    ALTER TABLE candidate_assessments ADD COLUMN trust_level DOUBLE PRECISION NOT NULL DEFAULT 0.0;
                END IF;
            END $$;

            -- Stores candidate assessment artifact details
            CREATE TABLE IF NOT EXISTS candidate_assessment_artifacts (
                id UUID PRIMARY KEY,
                assessment_id UUID NOT NULL,
                artifact_type VARCHAR(100) NOT NULL,
                json_data TEXT NOT NULL,
                created_at_utc TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT fk_candidate_assessment_artifacts_candidate_assessments_assess FOREIGN KEY (assessment_id) REFERENCES candidate_assessments(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_candidate_assessment_artifacts_assessment_id ON candidate_assessment_artifacts(assessment_id);
            CREATE UNIQUE INDEX IF NOT EXISTS ux_candidate_assessment_artifacts_type ON candidate_assessment_artifacts(assessment_id, artifact_type);

            -- Stores repository assessment records
            CREATE TABLE IF NOT EXISTS repository_assessments (
                id UUID PRIMARY KEY,
                repository_id UUID NOT NULL,
                analysis_job_id UUID NOT NULL,
                status VARCHAR(30) NOT NULL,
                commit_sha VARCHAR(100) NOT NULL,
                overall_score DOUBLE PRECISION NOT NULL,
                tech_stack JSONB,
                patterns JSONB,
                quality_metrics JSONB,
                json_data JSONB,
                model_version VARCHAR(100),
                prompt_version VARCHAR(50),
                assessment_schema_version VARCHAR(20),
                pipeline_version VARCHAR(20),
                created_at_utc TIMESTAMP WITH TIME ZONE NOT NULL,
                completed_at_utc TIMESTAMP WITH TIME ZONE
            );
            CREATE INDEX IF NOT EXISTS idx_repository_assessments_job_id ON repository_assessments(analysis_job_id);
            CREATE INDEX IF NOT EXISTS idx_repository_assessments_repo_id ON repository_assessments(repository_id);
            CREATE INDEX IF NOT EXISTS ux_repository_assessments_repo_sha ON repository_assessments(repository_id, commit_sha);

            -- Stores repository capability records
            CREATE TABLE IF NOT EXISTS repository_capabilities (
                id UUID PRIMARY KEY,
                repository_assessment_id UUID NOT NULL REFERENCES repository_assessments(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                category VARCHAR(50) NOT NULL,
                confidence DOUBLE PRECISION NOT NULL,
                maturity VARCHAR(30) NOT NULL,
                difficulty_score DOUBLE PRECISION NOT NULL,
                score DOUBLE PRECISION NOT NULL,
                evidence_json JSONB,
                assessment_version VARCHAR(20) NOT NULL,
                analysis_version VARCHAR(20) NOT NULL,
                model_version VARCHAR(100) NOT NULL,
                prompt_version VARCHAR(50) NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_repository_capabilities_assessment_id ON repository_capabilities(repository_assessment_id);
            CREATE UNIQUE INDEX IF NOT EXISTS ux_repository_capabilities_assessment_id_name ON repository_capabilities(repository_assessment_id, name);

            -- Stores repository domain records
            CREATE TABLE IF NOT EXISTS repository_domains (
                id UUID PRIMARY KEY,
                repository_assessment_id UUID NOT NULL REFERENCES repository_assessments(id) ON DELETE CASCADE,
                domain_name VARCHAR(100) NOT NULL,
                weight DOUBLE PRECISION NOT NULL,
                confidence DOUBLE PRECISION NOT NULL,
                evidence_count INTEGER NOT NULL,
                supporting_signals JSONB,
                assessment_version VARCHAR(20) NOT NULL,
                analysis_version VARCHAR(20) NOT NULL,
                model_version VARCHAR(100) NOT NULL,
                prompt_version VARCHAR(50) NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_repository_domains_assessment_id ON repository_domains(repository_assessment_id);
            CREATE UNIQUE INDEX IF NOT EXISTS ux_repository_domains_assessment_id_domain ON repository_domains(repository_assessment_id, domain_name);

            -- Stores repository intelligence signal records
            CREATE TABLE IF NOT EXISTS repository_intelligence_signals (
                id UUID PRIMARY KEY,
                repository_assessment_id UUID NOT NULL REFERENCES repository_assessments(id) ON DELETE CASCADE,
                scope_signal DOUBLE PRECISION NOT NULL,
                complexity_signal DOUBLE PRECISION NOT NULL,
                ownership_signal DOUBLE PRECISION NOT NULL,
                leadership_signal DOUBLE PRECISION NOT NULL,
                consistency_signal DOUBLE PRECISION NOT NULL,
                last_updated_utc TIMESTAMP WITH TIME ZONE NOT NULL,
                assessment_version VARCHAR(20) NOT NULL,
                analysis_version VARCHAR(20) NOT NULL,
                model_version VARCHAR(100) NOT NULL,
                prompt_version VARCHAR(50) NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ux_repository_intelligence_signals_assessment_id ON repository_intelligence_signals(repository_assessment_id);

            -- Stores repository skill attribution records
            CREATE TABLE IF NOT EXISTS repository_skill_attributions (
                id UUID PRIMARY KEY,
                repository_assessment_id UUID NOT NULL REFERENCES repository_assessments(id) ON DELETE CASCADE,
                skill_name VARCHAR(100) NOT NULL,
                contribution_weight DOUBLE PRECISION NOT NULL,
                confidence DOUBLE PRECISION NOT NULL,
                verification_level VARCHAR(30) NOT NULL,
                assessment_version VARCHAR(20) NOT NULL,
                analysis_version VARCHAR(20) NOT NULL,
                model_version VARCHAR(100) NOT NULL,
                prompt_version VARCHAR(50) NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_repository_skill_attributions_assessment_id ON repository_skill_attributions(repository_assessment_id);
            CREATE UNIQUE INDEX IF NOT EXISTS ux_repository_skill_attributions_assessment_id_skill ON repository_skill_attributions(repository_assessment_id, skill_name);

            -- Stores candidate skill records
            CREATE TABLE IF NOT EXISTS candidate_skills (
                id UUID PRIMARY KEY,
                candidate_assessment_id UUID NOT NULL REFERENCES candidate_assessments(id) ON DELETE CASCADE,
                skill_name VARCHAR(100) NOT NULL,
                score DOUBLE PRECISION NOT NULL,
                confidence DOUBLE PRECISION NOT NULL,
                level VARCHAR(50) NOT NULL,
                evidence_sources JSONB
            );
            CREATE INDEX IF NOT EXISTS ix_candidate_skills_candidate_assessment_id ON candidate_skills(candidate_assessment_id);

            -- Stores candidate domain profile records
            CREATE TABLE IF NOT EXISTS candidate_domain_profiles (
                id UUID PRIMARY KEY,
                candidate_assessment_id UUID NOT NULL REFERENCES candidate_assessments(id) ON DELETE CASCADE,
                domain_name VARCHAR(100) NOT NULL,
                score DOUBLE PRECISION NOT NULL,
                confidence DOUBLE PRECISION NOT NULL,
                seniority VARCHAR(50) NOT NULL,
                supporting_evidence JSONB
            );
            CREATE INDEX IF NOT EXISTS ix_candidate_domain_profiles_candidate_assessment_id ON candidate_domain_profiles(candidate_assessment_id);

            -- Stores candidate intelligence signal records
            CREATE TABLE IF NOT EXISTS candidate_intelligence_signals (
                id UUID PRIMARY KEY,
                candidate_assessment_id UUID NOT NULL REFERENCES candidate_assessments(id) ON DELETE CASCADE,
                scope_signal DOUBLE PRECISION NOT NULL,
                complexity_signal DOUBLE PRECISION NOT NULL,
                ownership_signal DOUBLE PRECISION NOT NULL,
                leadership_signal DOUBLE PRECISION NOT NULL,
                consistency_signal DOUBLE PRECISION NOT NULL,
                delivery_signal DOUBLE PRECISION NOT NULL,
                engineering_maturity_signal DOUBLE PRECISION NOT NULL,
                problem_solving_signal DOUBLE PRECISION NOT NULL,
                last_updated_utc TIMESTAMP WITH TIME ZONE NOT NULL
            );
            CREATE INDEX IF NOT EXISTS ix_candidate_intelligence_signals_candidate_assessment_id ON candidate_intelligence_signals(candidate_assessment_id);

            -- Stores candidate best fit role records
            CREATE TABLE IF NOT EXISTS candidate_best_fit_roles (
                id UUID PRIMARY KEY,
                candidate_assessment_id UUID NOT NULL REFERENCES candidate_assessments(id) ON DELETE CASCADE,
                role_title VARCHAR(100) NOT NULL,
                match_score DOUBLE PRECISION NOT NULL,
                confidence DOUBLE PRECISION NOT NULL,
                rank INTEGER NOT NULL,
                matching_engine_version VARCHAR(20) NOT NULL,
                evidence JSONB,
                engine_metadata JSONB
            );
            CREATE INDEX IF NOT EXISTS ix_candidate_best_fit_roles_candidate_assessment_id ON candidate_best_fit_roles(candidate_assessment_id);

            -- Stores candidate strengths and weaknesses findings
            CREATE TABLE IF NOT EXISTS candidate_strengths_weaknesses (
                id UUID PRIMARY KEY,
                candidate_assessment_id UUID NOT NULL REFERENCES candidate_assessments(id) ON DELETE CASCADE,
                finding_type VARCHAR(20) NOT NULL,
                topic VARCHAR(150) NOT NULL,
                description VARCHAR(1000) NOT NULL,
                evidence JSONB
            );
            CREATE INDEX IF NOT EXISTS ix_candidate_strengths_weaknesses_candidate_assessment_id ON candidate_strengths_weaknesses(candidate_assessment_id);

            -- Stores manual/AI-analyzed project entries linked to a CV
            CREATE TABLE IF NOT EXISTS project_entries (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL,
                name VARCHAR(255) NOT NULL,
                role VARCHAR(255),
                description VARCHAR(2000) NOT NULL,
                start_date TIMESTAMP WITH TIME ZONE,
                end_date TIMESTAMP WITH TIME ZONE,
                is_currently_working BOOLEAN NOT NULL,
                verification_level INTEGER NOT NULL,
                verification_status INTEGER NOT NULL,
                verified_at TIMESTAMP WITH TIME ZONE,
                verification_metadata_json JSONB,
                display_order INTEGER NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
                deleted_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT fk_project_entries_users_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_project_entries_user_id ON project_entries(user_id);

            -- Stores key contributions/findings for project entries
            CREATE TABLE IF NOT EXISTS project_contributions (
                id UUID PRIMARY KEY,
                project_entry_id UUID NOT NULL,
                content VARCHAR(1000) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT fk_project_contributions_project_entries_project_entry_id FOREIGN KEY (project_entry_id) REFERENCES project_entries(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_project_contributions_project_id ON project_contributions(project_entry_id);

            -- Links project entries to specific repository analysis profiles
            CREATE TABLE IF NOT EXISTS project_repository_links (
                id UUID PRIMARY KEY,
                project_entry_id UUID NOT NULL,
                source_code_repository_id UUID NOT NULL,
                linked_at TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT fk_project_repository_links_project_entries_project_entry_id FOREIGN KEY (project_entry_id) REFERENCES project_entries(id) ON DELETE CASCADE,
                CONSTRAINT fk_project_repository_links_source_code_repositories_source_co FOREIGN KEY (source_code_repository_id) REFERENCES source_code_repositories(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_project_repo_links_unique ON project_repository_links(project_entry_id, source_code_repository_id);
            CREATE INDEX IF NOT EXISTS ix_project_repository_links_source_code_repository_id ON project_repository_links(source_code_repository_id);

            -- Stores technologies mapped to project entries
            CREATE TABLE IF NOT EXISTS project_technologies (
                id UUID PRIMARY KEY,
                project_entry_id UUID NOT NULL,
                name VARCHAR(100) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT fk_project_technologies_project_entries_project_entry_id FOREIGN KEY (project_entry_id) REFERENCES project_entries(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_project_technologies_project_id ON project_technologies(project_entry_id);

            -- Table storing global system metadata and environmental markers
            CREATE TABLE IF NOT EXISTS system_metadata (
                key VARCHAR(100) PRIMARY KEY,
                value VARCHAR(255) NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );

            -- DDL schema script completed
        ";

        await context.Database.ExecuteSqlRawAsync(sql);

        // Safely alter user_status enum to add DELETION_PENDING for backward compatibility
        try
        {
            var typeExists = await context.Database.SqlQueryRaw<int>(@"
                SELECT COUNT(*)::int AS ""Value""
                FROM pg_type 
                WHERE typname = 'user_status'
            ").FirstOrDefaultAsync();

            if (typeExists > 0)
            {
                await context.Database.ExecuteSqlRawAsync("ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'DELETION_PENDING';");
            }
        }
        catch (Exception)
        {
            // Ignore if type doesn't exist yet (first-time boot runs the script to create it with DELETION_PENDING)
        }



        // Migrate analysis_executions to include user_id if missing
        try
        {
            await context.Database.ExecuteSqlRawAsync(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'analysis_executions' AND column_name = 'user_id'
                    ) THEN
                        ALTER TABLE analysis_executions ADD COLUMN user_id UUID;
                        
                        UPDATE analysis_executions ae
                        SET user_id = aj.user_id
                        FROM analysis_jobs aj
                        WHERE ae.job_id = aj.id;
                        
                        DELETE FROM analysis_executions WHERE user_id IS NULL;

                        ALTER TABLE analysis_executions ALTER COLUMN user_id SET NOT NULL;
                        
                        ALTER TABLE analysis_executions ADD CONSTRAINT fk_analysis_executions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
                        CREATE INDEX IF NOT EXISTS idx_analysis_executions_user_id ON analysis_executions(user_id);
                    END IF;
                END $$;");
        }
        catch (Exception)
        {
            // Ignore migration conflicts
        }

        // Apply updated idx_users_email_active unique index constraint to existing databases
        try
        {
            await context.Database.ExecuteSqlRawAsync("DROP INDEX IF EXISTS idx_users_email_active;");
            await context.Database.ExecuteSqlRawAsync("CREATE UNIQUE INDEX idx_users_email_active ON users(email) WHERE (deleted_at IS NULL OR status = 'DELETION_PENDING');");
        }
        catch (Exception)
        {
            // Ignore index creation conflicts
        }

        // Clear Npgsql connection pools to force reload of system types (like citext and user_status enum) 
        // created during database initialization, preventing System.NotSupportedException.
        Npgsql.NpgsqlConnection.ClearAllPools();

        // Force Npgsql to reload database types globally for the current connection string.
        var dbConnection = context.Database.GetDbConnection();
        if (dbConnection is Npgsql.NpgsqlConnection npgsqlConnection)
        {
            if (npgsqlConnection.State != global::System.Data.ConnectionState.Open)
            {
                await npgsqlConnection.OpenAsync();
            }
            npgsqlConnection.ReloadTypes();
        }

        // Resolve seeding policy
        var resolvedEnv = hostEnvironment ?? serviceProvider?.GetService<Microsoft.Extensions.Hosting.IHostEnvironment>();
        var seedingPolicy = SeedingPolicyResolver.Resolve(resolvedEnv);

        // Check system_metadata environment marker
        try
        {
            var storedEnv = await context.Database.SqlQueryRaw<string>(@"
                SELECT value AS ""Value"" FROM system_metadata WHERE key = 'database_environment'
            ").FirstOrDefaultAsync();

            var currentEnv = resolvedEnv?.EnvironmentName ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");

            if (!string.IsNullOrEmpty(storedEnv) && 
                string.Equals(currentEnv, "Production", StringComparison.OrdinalIgnoreCase) && 
                !string.Equals(storedEnv, "Production", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException($"Fatal Safeguard Check: Accidental database promotion detected! The current hosting environment is Production, but this database is classified as '{storedEnv}' in system_metadata.");
            }

            if (string.IsNullOrEmpty(storedEnv) && !string.IsNullOrEmpty(currentEnv))
            {
                await context.Database.ExecuteSqlRawAsync(
                    "INSERT INTO system_metadata (key, value) VALUES ('database_environment', @env)",
                    new NpgsqlParameter("@env", currentEnv));
            }
        }
        catch (Exception ex) when (ex is not InvalidOperationException)
        {
            // Ignore other DB errors at this stage (e.g. if database is completely fresh, table might not exist yet)
        }

        // Invoke modular seeders
        await SuperAdminSeeder.SeedAsync(context, config.SuperAdmin, seedingPolicy);
        await PermissionSeeder.SeedAsync(context, seedingPolicy);
        await RoleSeeder.SeedAsync(context, seedingPolicy);
        await MembershipMigrationSeeder.SeedAsync(context, seedingPolicy);
        await BusinessAccountSeeder.SeedAsync(context, config.Seeding, seedingPolicy);

        global::System.Collections.Generic.IEnumerable<IPublicWorkspaceModuleSeeder> moduleSeeders;
        Microsoft.Extensions.Logging.ILoggerFactory loggerFactory;

        if (serviceProvider != null)
        {
            moduleSeeders = serviceProvider.GetService<global::System.Collections.Generic.IEnumerable<IPublicWorkspaceModuleSeeder>>() 
                ?? global::System.Linq.Enumerable.Empty<IPublicWorkspaceModuleSeeder>();
            loggerFactory = serviceProvider.GetService<Microsoft.Extensions.Logging.ILoggerFactory>() 
                ?? Microsoft.Extensions.Logging.Abstractions.NullLoggerFactory.Instance;
        }
        else
        {
            moduleSeeders = context.GetService<global::System.Collections.Generic.IEnumerable<IPublicWorkspaceModuleSeeder>>() 
                ?? global::System.Linq.Enumerable.Empty<IPublicWorkspaceModuleSeeder>();
            loggerFactory = context.GetService<Microsoft.Extensions.Logging.ILoggerFactory>() 
                ?? Microsoft.Extensions.Logging.Abstractions.NullLoggerFactory.Instance;
        }

        var seederLogger = loggerFactory.CreateLogger("PublicWorkspaceSeeder");
        await PublicWorkspaceSeeder.SeedAsync(context, config.Seeding, moduleSeeders, seederLogger, seedingPolicy);

        // One-time compatibility migration for Google OAuth users created under the old normalization rules
        await MigrateLegacyGoogleEmailsAsync(context);

        // One-time compatibility migration to generate unique usernames for legacy users
        var serviceToUse = usernameService ?? new UsernameService(context, TimeProvider.System, Microsoft.Extensions.Logging.Abstractions.NullLogger<UsernameService>.Instance, new DbInitializerRateLimitPolicyService());
        await MigrateLegacyUsernamesAsync(context, serviceToUse);

        // One-time compatibility migration to backfill repository classification & authenticity columns
        await MigrateLegacyRepositoryMetadataAsync(context);
    }

    private static async Task MigrateLegacyGoogleEmailsAsync(ApplicationDbContext context)
    {
        var usersToMigrate = await context.Users
            .Include(u => u.AuthProviders)
            .Where(u => u.AuthProviders.Any(ap => 
                ap.ProviderName == "Google" && 
                ap.ProviderAccountId != null && 
                ap.ProviderAccountId.Contains("@") &&
                ap.ProviderAccountId != u.Email))
            .ToListAsync();

        foreach (var user in usersToMigrate)
        {
            var googleProvider = user.AuthProviders.First(ap => ap.ProviderName == "Google");
            var originalEmail = googleProvider.ProviderAccountId!.Trim().ToLowerInvariant();

            // Conflict Protection: check if another user already has the original email
            var conflictExists = await context.Users.AnyAsync(u => u.Id != user.Id && u.Email == originalEmail);
            if (conflictExists)
            {
                Console.WriteLine($"[Migration Warning] Cannot migrate user {user.Id} from email '{user.Email}' to original Google email '{originalEmail}' because another user account with that email already exists. Skipping.");
                continue;
            }

            Console.WriteLine($"[Migration] Migrating user {user.Id} email from '{user.Email}' to original Google email '{originalEmail}'.");
            user.Email = originalEmail;
            user.UpdatedAt = DateTime.UtcNow;
        }

        if (usersToMigrate.Any())
        {
            await context.SaveChangesAsync();
        }
    }

    private static async Task MigrateLegacyUsernamesAsync(ApplicationDbContext context, IUsernameService usernameService)
    {
        var usersToMigrate = await context.Users
            .Where(u => u.Username == null || u.Username == "")
            .ToListAsync();

        if (!usersToMigrate.Any())
        {
            return;
        }

        foreach (var user in usersToMigrate)
        {
            // First check if there is a legacy username in user_profiles
            var legacyProfileUsername = await context.UserProfiles
                .Where(up => up.UserId == user.Id && up.Username != null && up.Username != "")
                .Select(up => up.Username)
                .FirstOrDefaultAsync();

            string baseCandidate = !string.IsNullOrEmpty(legacyProfileUsername)
                ? usernameService.Normalize(legacyProfileUsername)
                : usernameService.GenerateBaseUsername(user.Email);

            // Generate unique username using sequential suffix check
            var uniqueUsername = await usernameService.GenerateUniqueUsernameAsync(baseCandidate);

            user.Username = uniqueUsername;
            user.UpdatedAt = DateTime.UtcNow;

            // Sync with profile
            var profile = await context.UserProfiles.FirstOrDefaultAsync(up => up.UserId == user.Id);
            if (profile != null)
            {
                profile.Username = uniqueUsername;
                profile.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                // Auto-provision profile if missing
                profile = new UserProfile
                {
                    UserId = user.Id,
                    Username = uniqueUsername,
                    ProfileVisibility = "public",
                    RecruiterVisibility = true,
                    AiTalentDiscovery = "disabled",
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                };
                context.UserProfiles.Add(profile);
            }
        }

        await context.SaveChangesAsync();
    }

    private static async Task MigrateLegacyRepositoryMetadataAsync(ApplicationDbContext context)
    {
        try
        {
            var repos = await context.SourceCodeRepositories
                .Where(r => r.Classification == null || r.AuthenticityType == null || r.LatestAnalysisStatus == "NeverAnalyzed")
                .ToListAsync();

            if (!repos.Any())
            {
                return;
            }

            Console.WriteLine($"[Migration] Found {repos.Count} repositories requiring classification & authenticity backfill.");

            foreach (var repo in repos)
            {
                var latestReport = await context.AnalysisReports
                    .Where(rep => rep.RepositoryId == repo.Id)
                    .OrderByDescending(rep => rep.CreatedAtUtc)
                    .FirstOrDefaultAsync();

                if (latestReport != null && !string.IsNullOrEmpty(latestReport.ReportData))
                {
                    try
                    {
                        using var doc = global::System.Text.Json.JsonDocument.Parse(latestReport.ReportData);
                        if (doc.RootElement.TryGetProperty("ai_conclusions", out var aiConclusionsProp))
                        {
                            if (repo.Classification == null &&
                                aiConclusionsProp.TryGetProperty("classification", out var classificationProp) &&
                                classificationProp.TryGetProperty("primary_type", out var primaryTypeProp))
                            {
                                repo.Classification = primaryTypeProp.GetString();
                            }

                            if (repo.AuthenticityType == null &&
                                aiConclusionsProp.TryGetProperty("authenticity", out var authenticityProp) &&
                                authenticityProp.TryGetProperty("type", out var typeProp))
                            {
                                repo.AuthenticityType = typeProp.GetString();
                            }

                            if (aiConclusionsProp.TryGetProperty("risk_assessment", out var riskAssessmentProp))
                            {
                                if (riskAssessmentProp.TryGetProperty("risk_score", out var scoreProp))
                                {
                                    repo.LatestRiskScore = scoreProp.GetDouble();
                                }
                                if (riskAssessmentProp.TryGetProperty("risk_level", out var levelProp))
                                {
                                    repo.LatestRiskLevel = levelProp.GetString() ?? "Low";
                                }
                                if (riskAssessmentProp.TryGetProperty("top_factors", out var factorsProp))
                                {
                                    repo.LatestRiskFactorsJson = factorsProp.ToString();
                                }
                            }
                            repo.LatestAnalysisStatus = "Completed";
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[Migration] Failed to parse report data for repository {repo.Id}: {ex.Message}");
                    }
                }
            }

            await context.SaveChangesAsync();
            Console.WriteLine("[Migration] Repository classification & authenticity backfill migration completed successfully.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Migration] Error running MigrateLegacyRepositoryMetadataAsync: {ex.Message}");
        }
    }

    private class DbInitializerRateLimitPolicyService : CVerify.API.Modules.Shared.System.Services.IRateLimitPolicyService
    {
        public bool DisableRateLimits => false;
        public bool ShouldEnforceCooldowns() => true;
        public void LogBypass(string actionName, string? endpoint = null, string? identifier = null) { }
    }
}
