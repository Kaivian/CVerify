-- =========================================================
-- CVERIFY DATABASE INITIALIZATION SCRIPT (UUID v7 Standards)
-- =========================================================

-- WARNING: DESTRUCTIVE CLEANUP (Development / Guarded Manual Reset)
-- To execute a completely clean reset, uncomment the following block:
/*
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS outbox_messages CASCADE;
DROP TABLE IF EXISTS reset_password_tokens CASCADE;
DROP TABLE IF EXISTS verification_tokens CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS artifact_registry_entries CASCADE;
DROP TABLE IF EXISTS pipeline_tasks CASCADE;
DROP TABLE IF EXISTS pipeline_jobs CASCADE;
DROP TABLE IF EXISTS prompt_deployments CASCADE;
DROP TYPE IF EXISTS user_status CASCADE;
*/

-- =========================================================
-- 1. EXTENSIONS
-- =========================================================
-- Enable cryptographic functions for password hashing (e.g., bcrypt/blowfish)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- Enable case-insensitive text data type, ideal for unique email addresses
CREATE EXTENSION IF NOT EXISTS "citext";

-- =========================================================
-- 2. FUNCTIONS & TRIGGERS
-- =========================================================
-- Generic trigger function to automatically update the 'updated_at' column on row modification
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- 3. ENUMS & TYPES
-- =========================================================
-- Defines the lifecycle states of a user account
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM (
            'EMAIL_VERIFY_PENDING', -- Account created but email not yet confirmed
            'ACTIVE',               -- Fully functional account
            'SUSPENDED',            -- Temporarily disabled (e.g., by admin)
            'BANNED',               -- Permanently restricted
            'DELETION_PENDING',     -- Soft-deleted account pending grace reactivation
            'DELETED'               -- Hard-purged account
        );
    END IF;
END $$;

-- =========================================================
-- 4. ROLES TABLE
-- =========================================================
-- Stores user roles for the Role-Based Access Control (RBAC) system
CREATE TABLE roles (
    id UUID PRIMARY KEY,
    name VARCHAR(50) NOT NULL,          -- Internal identifier (e.g., 'SUPER_ADMIN')
    display_name VARCHAR(100) NOT NULL,        -- User-friendly name
    description TEXT,
    domain VARCHAR(30) NOT NULL DEFAULT 'SYSTEM',
    tenant_id UUID NULL,
    parent_role_id UUID NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,  -- Prevents deletion of core system roles
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE        -- Support for soft deletion
);
CREATE UNIQUE INDEX idx_roles_tenant_id_name ON roles(tenant_id, name);
CREATE UNIQUE INDEX idx_roles_name_system ON roles(name) WHERE tenant_id IS NULL;

-- =========================================================
-- 5. USERS TABLE
-- =========================================================
-- Core table storing user credentials, profile data, and security logs
CREATE TABLE users (
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


-- =========================================================
-- 6. USER_ROLES JUNCTION TABLE
-- =========================================================
-- Maps users to roles (Many-to-Many relationship)
CREATE TABLE user_roles (
    user_id UUID NOT NULL,
    role_id UUID NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- =========================================================
-- 6.5. ROLE_ASSIGNMENTS TABLE
-- =========================================================
-- Scoped assignments mapping users to roles
CREATE TABLE role_assignments (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    scope_type VARCHAR(30) NOT NULL,
    scope_id UUID NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_role_assignments_unique ON role_assignments(user_id, role_id, scope_type, scope_id);

-- =========================================================
-- 7. PERMISSIONS TABLE
-- =========================================================
-- Granular permissions using a hierarchical naming convention
CREATE TABLE permissions (
    id UUID PRIMARY KEY,
    -- Naming convention: module:feature:action (e.g., "auth:user:create")
    name VARCHAR(150) NOT NULL UNIQUE,
    display_name VARCHAR(150) NOT NULL,
    description TEXT,
    
    module VARCHAR(50) NOT NULL,               -- Logical grouping (e.g., 'auth', 'billing')
    is_system BOOLEAN NOT NULL DEFAULT TRUE,   -- Protects core application permissions

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 7.5. ORGANIZATIONS TABLE
-- =========================================================
-- Stores verified organization workspaces
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tax_code VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_level INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    registration_number VARCHAR(50),
    representative_name VARCHAR(255),
    representative_email VARCHAR(255),
    representative_phone VARCHAR(50),
    recovery_authority VARCHAR(255),
    representative_identity VARCHAR(255),
    initial_admin_assigned_at TIMESTAMP WITH TIME ZONE,
    banner_url VARCHAR(2048),
    logo_url VARCHAR(2048),
    description TEXT,
    company_type VARCHAR(100),
    company_size VARCHAR(100),
    branch_count INTEGER NOT NULL DEFAULT 0,
    follower_count INTEGER NOT NULL DEFAULT 0,
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
    mission TEXT,
    vision TEXT,
    core_values TEXT,
    founded VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_username_active ON organizations(username) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_tax_code_active ON organizations(tax_code) WHERE deleted_at IS NULL;

-- =========================================================
-- 8. ROLE_PERMISSIONS JUNCTION TABLE
-- =========================================================
-- Maps permissions to roles (Many-to-Many relationship)
CREATE TABLE role_permissions (
    role_id UUID NOT NULL,
    permission_id UUID NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- =========================================================
-- 9. REFRESH_TOKENS TABLE
-- =========================================================
-- Manages long-lived refresh tokens for maintaining user sessions securely
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY,
    user_id UUID,
    organization_id UUID,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE,       -- Marks token as invalid before expiration
    replaced_by_token VARCHAR(255),            -- Tracks token rotation chains for security
    user_agent VARCHAR(500),
    ip_address VARCHAR(45),
    session_id UUID NOT NULL,
    remember_me BOOLEAN NOT NULL DEFAULT FALSE,
    replaced_by_token_id UUID,

    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_refresh_tokens_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- =========================================================
-- 10. VERIFICATION TOKENS TABLE
-- =========================================================
-- Manages one-time-use email verification tokens
CREATE TABLE verification_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    consumed_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT fk_verification_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =========================================================
-- 11. RESET PASSWORD TOKENS TABLE
-- =========================================================
-- Manages one-time-use password reset tokens
CREATE TABLE reset_password_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    consumed_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT fk_reset_password_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =========================================================
-- 12. OUTBOX MESSAGES TABLE
-- =========================================================
-- Outbox Pattern Table for reliable asynchronous email delivery
CREATE TABLE outbox_messages (
    id UUID PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    payload TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    error TEXT
);

-- =========================================================
-- 13. AUDIT LOGS TABLE
-- =========================================================
-- Security Audit Logs Table for tracking major events
CREATE TABLE audit_logs (
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

-- =========================================================
-- 14. CONVERSATIONS TABLE
-- =========================================================
-- Manages chat conversation sessions with the AI Assistant
CREATE TABLE conversations (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL DEFAULT 'New Conversation',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_conversations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =========================================================
-- 15. MESSAGES TABLE
-- =========================================================
-- Stores individual messages in a conversation
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    streaming_state VARCHAR(50) NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- =========================================================
-- 16. INDEXES & OPTIMIZATIONS
-- =========================================================
-- General Indexes
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_organization_id ON refresh_tokens(organization_id);
CREATE INDEX idx_refresh_tokens_session_id ON refresh_tokens(session_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);


-- Partial Indexes
CREATE INDEX idx_verification_tokens_active ON verification_tokens(token_hash) WHERE consumed_at IS NULL;
CREATE INDEX idx_reset_password_tokens_active ON reset_password_tokens(token_hash) WHERE consumed_at IS NULL;
CREATE INDEX idx_outbox_messages_pending ON outbox_messages(created_at) WHERE processed_at IS NULL;
CREATE INDEX idx_users_active ON users(status) WHERE deleted_at IS NULL;

-- Hierarchy and Pattern Matching Indexes
CREATE INDEX idx_permissions_hierarchy ON permissions (name varchar_pattern_ops);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_messages_conversation_id_created_at ON messages(conversation_id, created_at);

-- Explicit Foreign Key Indexes (Optimizing Cascades and Joins)
CREATE INDEX idx_verification_tokens_user_id ON verification_tokens(user_id);
CREATE INDEX idx_reset_password_tokens_user_id ON reset_password_tokens(user_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_actor_user_id ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_target_user_id ON audit_logs(target_user_id);
CREATE INDEX idx_audit_logs_organization_id ON audit_logs(organization_id);

-- =========================================================
-- 17. TRIGGERS REGISTRATION
-- =========================================================
-- Attach the auto-update timestamp function to relevant tables
CREATE TRIGGER tr_roles_timestamp BEFORE UPDATE ON roles 
    FOR EACH ROW EXECUTE PROCEDURE fn_update_timestamp();

CREATE TRIGGER tr_users_timestamp BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE PROCEDURE fn_update_timestamp();

CREATE TRIGGER tr_permissions_timestamp BEFORE UPDATE ON permissions 
    FOR EACH ROW EXECUTE PROCEDURE fn_update_timestamp();

CREATE TRIGGER tr_conversations_timestamp BEFORE UPDATE ON conversations 
    FOR EACH ROW EXECUTE PROCEDURE fn_update_timestamp();

-- =========================================================
-- 18. INITIAL DATA (SEEDING VIA STATIC SEQUENTIAL UUID v7s)
-- =========================================================

-- Bootstrap essential system roles
INSERT INTO roles (id, name, display_name, description, is_system)
VALUES 
    ('018fc35b-1c5c-7b8a-9a2d-3e4f5a6b7c8d'::uuid, 'SUPER_ADMIN', 'System Administrator', 'Root access to all modules', TRUE),
    ('018fc35b-1c5d-7b8a-9a2d-3e4f5a6b7c8d'::uuid, 'USER', 'General User', 'Basic application access', TRUE)
ON CONFLICT (name) WHERE tenant_id IS NULL DO NOTHING;

-- Bootstrap root wildcard permission
INSERT INTO permissions (id, name, display_name, description, module, is_system)
VALUES 
    ('018fc35b-1c5e-7b8a-9a2d-3e4f5a6b7c8d'::uuid, '*:*:*', 'Global Wildcard', 'Full access to every module and feature', 'system', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Bind wildcard permission to the Super Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'SUPER_ADMIN' AND p.name = '*:*:*'
ON CONFLICT DO NOTHING;

-- Provision the master administrator account
INSERT INTO users (
    id,
    email, 
    password_hash, 
    full_name, 
    status, 
    email_verified_at
)
VALUES (
    '018fc35b-1c5f-7b8a-9a2d-3e4f5a6b7c8d'::uuid,
    'admin@system.com',
    crypt('SuperAdminPassword123', gen_salt('bf', 10)),
    'System Administrator',
    'ACTIVE',
    NOW()
)
ON CONFLICT (email) WHERE (deleted_at IS NULL OR status = 'DELETION_PENDING') DO NOTHING;

-- Bind user to role in user_roles
INSERT INTO user_roles (user_id, role_id)
VALUES (
    '018fc35b-1c5f-7b8a-9a2d-3e4f5a6b7c8d'::uuid,
    '018fc35b-1c5c-7b8a-9a2d-3e4f5a6b7c8d'::uuid
)
ON CONFLICT DO NOTHING;

-- =========================================================
-- 19. PIPELINE AND AI SUBSYSTEM TABLES
-- =========================================================
CREATE TABLE pipeline_jobs (
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

CREATE TABLE pipeline_tasks (
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
CREATE UNIQUE INDEX idx_job_task_identifier ON pipeline_tasks(job_id, task_identifier);
CREATE INDEX ix_pipeline_tasks_job_id ON pipeline_tasks(job_id);

CREATE TABLE prompt_deployments (
    prompt_id VARCHAR(50) PRIMARY KEY,
    active_version VARCHAR(30) NOT NULL,
    sha256hash VARCHAR(64) NOT NULL,
    updated_at_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE artifact_registry_entries (
    id UUID PRIMARY KEY,
    job_id UUID NOT NULL,
    artifact_id TEXT NOT NULL,
    name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    created_at_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_job_artifact ON artifact_registry_entries(job_id, artifact_id);
CREATE INDEX ix_artifact_registry_entries_job_id ON artifact_registry_entries(job_id);

-- =========================================================
-- ADDITIONAL DDL FOR TEST BUSINESS RELATION TABLES
-- =========================================================

CREATE TABLE IF NOT EXISTS organization_authorities (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_organization_authorities_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_organization_authorities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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

-- =========================================================
-- SEED TEST BUSINESS ACCOUNTS (TIER 1 AND TIER 2)
-- =========================================================

-- Seed Tier 1 Organization
INSERT INTO organizations (id, name, tax_code, email, username, is_verified, verification_level, status)
SELECT '01900000-0000-0000-0000-000000000001'::uuid, 'FPT Software Tier 1 Test', '1111111111', 'tier1@testbusiness.com', 'tier1-business', TRUE, 1, 'active'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE tax_code = '1111111111');

-- Seed Tier 1 Owner User
INSERT INTO users (id, email, password_hash, full_name, status, email_verified_at)
SELECT '01900000-0000-0000-0000-000000000002'::uuid, 'owner1@testbusiness.com', crypt('TestPassword123', gen_salt('bf', 10)), 'Tier 1 Business Owner', 'ACTIVE', NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'owner1@testbusiness.com');

-- Seed Tier 1 User-Role
INSERT INTO user_roles (user_id, role_id)
SELECT '01900000-0000-0000-0000-000000000002'::uuid, '018fc35b-1c5d-7b8a-9a2d-3e4f5a6b7c8d'::uuid
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = '01900000-0000-0000-0000-000000000002'::uuid AND role_id = '018fc35b-1c5d-7b8a-9a2d-3e4f5a6b7c8d'::uuid);

-- Seed Tier 1 Organization Authority
INSERT INTO organization_authorities (id, organization_id, user_id, role)
SELECT '01900000-0000-0000-0000-000000000003'::uuid, '01900000-0000-0000-0000-000000000001'::uuid, '01900000-0000-0000-0000-000000000002'::uuid, 'organization_owner'
WHERE NOT EXISTS (SELECT 1 FROM organization_authorities WHERE organization_id = '01900000-0000-0000-0000-000000000001'::uuid AND user_id = '01900000-0000-0000-0000-000000000002'::uuid);

-- Seed Tier 1 Workspace
INSERT INTO workspaces (id, organization_id, display_name, slug, status)
SELECT '01900000-0000-0000-0000-000000000004'::uuid, '01900000-0000-0000-0000-000000000001'::uuid, 'Tier 1 Default Workspace', 'tier1-workspace', 'active'
WHERE NOT EXISTS (SELECT 1 FROM workspaces WHERE slug = 'tier1-workspace');

-- Seed Tier 1 Workspace Member
INSERT INTO workspace_members (id, workspace_id, user_id, role)
SELECT '01900000-0000-0000-0000-000000000005'::uuid, '01900000-0000-0000-0000-000000000004'::uuid, '01900000-0000-0000-0000-000000000002'::uuid, 'workspace_admin'
WHERE NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = '01900000-0000-0000-0000-000000000004'::uuid AND user_id = '01900000-0000-0000-0000-000000000002'::uuid);

-- Seed Tier 2 Organization
INSERT INTO organizations (id, name, tax_code, email, username, is_verified, verification_level, status)
SELECT '01900000-0000-0000-0000-000000000011'::uuid, 'FPT Software Tier 2 Test', '2222222222', 'tier2@testbusiness.com', 'tier2-business', TRUE, 2, 'active'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE tax_code = '2222222222');

-- Seed Tier 2 Owner User
INSERT INTO users (id, email, password_hash, full_name, status, email_verified_at)
SELECT '01900000-0000-0000-0000-000000000012'::uuid, 'owner2@testbusiness.com', crypt('TestPassword123', gen_salt('bf', 10)), 'Tier 2 Business Owner', 'ACTIVE', NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'owner2@testbusiness.com');

-- Seed Tier 2 User-Role
INSERT INTO user_roles (user_id, role_id)
SELECT '01900000-0000-0000-0000-000000000012'::uuid, '018fc35b-1c5d-7b8a-9a2d-3e4f5a6b7c8d'::uuid
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = '01900000-0000-0000-0000-000000000012'::uuid AND role_id = '018fc35b-1c5d-7b8a-9a2d-3e4f5a6b7c8d'::uuid);

-- Seed Tier 2 Organization Authority
INSERT INTO organization_authorities (id, organization_id, user_id, role)
SELECT '01900000-0000-0000-0000-000000000013'::uuid, '01900000-0000-0000-0000-000000000011'::uuid, '01900000-0000-0000-0000-000000000012'::uuid, 'organization_owner'
WHERE NOT EXISTS (SELECT 1 FROM organization_authorities WHERE organization_id = '01900000-0000-0000-0000-000000000011'::uuid AND user_id = '01900000-0000-0000-0000-000000000012'::uuid);

-- Seed Tier 2 Workspace
INSERT INTO workspaces (id, organization_id, display_name, slug, status)
SELECT '01900000-0000-0000-0000-000000000014'::uuid, '01900000-0000-0000-0000-000000000011'::uuid, 'Tier 2 Default Workspace', 'tier2-workspace', 'active'
WHERE NOT EXISTS (SELECT 1 FROM workspaces WHERE slug = 'tier2-workspace');

-- Seed Tier 2 Workspace Member
INSERT INTO workspace_members (id, workspace_id, user_id, role)
SELECT '01900000-0000-0000-0000-000000000015'::uuid, '01900000-0000-0000-0000-000000000014'::uuid, '01900000-0000-0000-0000-000000000012'::uuid, 'workspace_admin'
WHERE NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = '01900000-0000-0000-0000-000000000014'::uuid AND user_id = '01900000-0000-0000-0000-000000000012'::uuid);

-- Seed Tier 1 Organization Membership (Owner)
INSERT INTO organization_memberships (id, organization_id, user_id, role, status)
SELECT '01900000-0000-0000-0000-000000000006'::uuid, '01900000-0000-0000-0000-000000000001'::uuid, '01900000-0000-0000-0000-000000000002'::uuid, 'OWNER', 'active'
WHERE NOT EXISTS (SELECT 1 FROM organization_memberships WHERE organization_id = '01900000-0000-0000-0000-000000000001'::uuid AND user_id = '01900000-0000-0000-0000-000000000002'::uuid);

-- Seed Tier 1 HR User
INSERT INTO users (id, email, password_hash, full_name, status, email_verified_at)
SELECT '01900000-0000-0000-0000-000000000007'::uuid, 'hr1@testbusiness.com', crypt('TestPassword123', gen_salt('bf', 10)), 'Tier 1 HR Manager', 'ACTIVE', NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'hr1@testbusiness.com');

-- Seed Tier 1 HR Organization Membership
INSERT INTO organization_memberships (id, organization_id, user_id, role, status)
SELECT '01900000-0000-0000-0000-000000000008'::uuid, '01900000-0000-0000-0000-000000000001'::uuid, '01900000-0000-0000-0000-000000000007'::uuid, 'HR', 'active'
WHERE NOT EXISTS (SELECT 1 FROM organization_memberships WHERE organization_id = '01900000-0000-0000-0000-000000000001'::uuid AND user_id = '01900000-0000-0000-0000-000000000007'::uuid);

-- Seed Tier 1 Representative User
INSERT INTO users (id, email, password_hash, full_name, status, email_verified_at)
SELECT '01900000-0000-0000-0000-000000000009'::uuid, 'rep1@testbusiness.com', crypt('TestPassword123', gen_salt('bf', 10)), 'Tier 1 Representative', 'ACTIVE', NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'rep1@testbusiness.com');

-- Seed Tier 1 Representative Organization Membership
INSERT INTO organization_memberships (id, organization_id, user_id, role, status)
SELECT '01900000-0000-0000-0000-00000000001a'::uuid, '01900000-0000-0000-0000-000000000001'::uuid, '01900000-0000-0000-0000-000000000009'::uuid, 'REPRESENTATIVE', 'active'
WHERE NOT EXISTS (SELECT 1 FROM organization_memberships WHERE organization_id = '01900000-0000-0000-0000-000000000001'::uuid AND user_id = '01900000-0000-0000-0000-000000000009'::uuid);

-- Seed Tier 1 Standard Member User
INSERT INTO users (id, email, password_hash, full_name, status, email_verified_at)
SELECT '01900000-0000-0000-0000-00000000001b'::uuid, 'member1@testbusiness.com', crypt('TestPassword123', gen_salt('bf', 10)), 'Tier 1 Staff Member', 'ACTIVE', NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'member1@testbusiness.com');

-- Seed Tier 1 Standard Member Organization Membership
INSERT INTO organization_memberships (id, organization_id, user_id, role, status)
SELECT '01900000-0000-0000-0000-00000000001c'::uuid, '01900000-0000-0000-0000-000000000001'::uuid, '01900000-0000-0000-0000-00000000001b'::uuid, 'MEMBER', 'active'
WHERE NOT EXISTS (SELECT 1 FROM organization_memberships WHERE organization_id = '01900000-0000-0000-0000-000000000001'::uuid AND user_id = '01900000-0000-0000-0000-00000000001b'::uuid);

-- Seed Tier 2 Organization Membership (Owner)
INSERT INTO organization_memberships (id, organization_id, user_id, role, status)
SELECT '01900000-0000-0000-0000-000000000016'::uuid, '01900000-0000-0000-0000-000000000011'::uuid, '01900000-0000-0000-0000-000000000012'::uuid, 'OWNER', 'active'
WHERE NOT EXISTS (SELECT 1 FROM organization_memberships WHERE organization_id = '01900000-0000-0000-0000-000000000011'::uuid AND user_id = '01900000-0000-0000-0000-000000000012'::uuid);

-- Seed Tier 2 Organization Membership for Tier 1 Owner (as MEMBER)
INSERT INTO organization_memberships (id, organization_id, user_id, role, status)
SELECT '01900000-0000-0000-0000-00000000001d'::uuid, '01900000-0000-0000-0000-000000000011'::uuid, '01900000-0000-0000-0000-000000000002'::uuid, 'MEMBER', 'active'
WHERE NOT EXISTS (SELECT 1 FROM organization_memberships WHERE organization_id = '01900000-0000-0000-0000-000000000011'::uuid AND user_id = '01900000-0000-0000-0000-000000000002'::uuid);