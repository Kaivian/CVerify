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
            'DELETED'               -- Soft-deleted account
        );
    END IF;
END $$;

-- =========================================================
-- 4. ROLES TABLE
-- =========================================================
-- Stores user roles for the Role-Based Access Control (RBAC) system
CREATE TABLE roles (
    id UUID PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,          -- Internal identifier (e.g., 'SUPER_ADMIN')
    display_name VARCHAR(100) NOT NULL,        -- User-friendly name
    description TEXT,
    
    is_system BOOLEAN NOT NULL DEFAULT FALSE,  -- Prevents deletion of core system roles
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE        -- Support for soft deletion
);

-- =========================================================
-- 5. USERS TABLE
-- =========================================================
-- Core table storing user credentials, profile data, and security logs
CREATE TABLE users (
    id UUID PRIMARY KEY,
    
    -- Identity & Credentials
    email CITEXT NOT NULL UNIQUE,              -- Case-insensitive unique email
    password_hash TEXT,                        -- Hashed password (nullable to support OAuth/SSO)
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    status user_status NOT NULL DEFAULT 'EMAIL_VERIFY_PENDING',

    -- Verification tracking
    email_verified_at TIMESTAMP WITH TIME ZONE,
    
    -- Security & Brute-force protection tracking
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip INET,                        -- Stores IPv4/IPv6 addresses
    failed_attempts INT DEFAULT 0,             -- Counter for consecutive failed logins
    last_failed_at TIMESTAMP WITH TIME ZONE,   -- Timestamp of the last failed attempt
    lock_until TIMESTAMP WITH TIME ZONE,       -- Account lockout expiration time
    session_version INTEGER NOT NULL DEFAULT 1,

    -- Audit trails
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

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
    user_id UUID NOT NULL,
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

    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
    user_id UUID,
    event_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
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
ON CONFLICT (name) DO NOTHING;

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
ON CONFLICT (email) DO NOTHING;

-- Bind user to role in user_roles
INSERT INTO user_roles (user_id, role_id)
VALUES (
    '018fc35b-1c5f-7b8a-9a2d-3e4f5a6b7c8d'::uuid,
    '018fc35b-1c5c-7b8a-9a2d-3e4f5a6b7c8d'::uuid
)
ON CONFLICT DO NOTHING;

-- =========================================================
-- ADDITIONAL DDL FOR TEST BUSINESS RELATION TABLES
-- =========================================================

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
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_username_active ON organizations(username) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_tax_code_active ON organizations(tax_code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS organization_authorities (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_organization_authorities_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_organization_authorities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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