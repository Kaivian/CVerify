# Modular Database Mermaid Diagrams

This document contains all Mermaid ER and architecture diagrams for the CVerify database system, formatted in strict Mermaid 11 syntax.

## Table of Contents
1. [High-Level Module Architecture Diagram](#high-level-module-architecture-diagram)
2. [1. Identity & Access Management (IAM)](#iam)
2. [2. Organizations & Workspaces](#organizations_workspaces)
2. [3. Candidate Profile & Portfolio](#candidate_profile)
2. [4. Talent Intelligence Graph](#talent_intelligence)
2. [5. Recruitment & Job Vacancy Matching](#recruitment_job_matching)
2. [6. Candidate Assessment & Skill Attribution](#candidate_assessment)
2. [7. Source Code Intelligence & Repository Analysis](#source_code_intelligence)
2. [8. Community Forum](#community_forum)
2. [9. Audit, Security Telemetry & Messaging](#audit_security_messaging)
2. [10. System Administration & Staff](#administration)
2. [11. Platform Orchestration & AI Engine](#platform_orchestration_ai)

---

## High-Level Module Architecture Diagram

```mermaid
flowchart TD
    subgraph Core_Identity [Core Identity & Governance]
        IAM["Identity & Access Management (IAM)<br/>(13 tables)"]
        Admin["System Administration & Staff<br/>(3 tables)"]
        OrgWork["Organizations & Workspaces<br/>(23 tables)"]
    end

    subgraph Candidate_Domain [Candidate Domain]
        Profile["Candidate Profile & Portfolio<br/>(18 tables)"]
        Assmt["Candidate Assessment & Skill Attribution<br/>(15 tables)"]
        TalentGraph["Talent Intelligence Graph<br/>(21 tables)"]
    end

    subgraph Business_Recruitment [Recruitment & Code Analysis]
        SourceCode["Source Code Intelligence<br/>(9 tables)"]
        Recruitment["Recruitment & Job Vacancy Matching<br/>(23 tables)"]
        Forum["Community Forum<br/>(17 tables)"]
    end

    subgraph Platform_Infrastructure [Platform Infrastructure & Telemetry]
        Audit["Audit, Security Telemetry & Messaging<br/>(12 tables)"]
        Engine["Platform Orchestration & AI Engine<br/>(12 tables)"]
    end

    IAM --> Admin
    IAM --> OrgWork
    IAM --> Profile
    IAM --> Forum
    IAM --> Audit

    OrgWork --> Recruitment
    OrgWork --> Audit
    OrgWork --> Forum

    Profile --> Assmt
    Profile --> TalentGraph
    Profile --> Recruitment

    SourceCode --> Assmt
    Assmt --> TalentGraph
    TalentGraph --> Recruitment

    Engine --> SourceCode
    Engine --> Assmt
    Engine --> Audit
```

---

<a id="iam"></a>
## 1. Identity & Access Management (IAM)

*User identities, authentication states, RBAC roles/permissions, OAuth providers, OTP challenges, and JWT session tokens.* (`13 tables`)

```mermaid
erDiagram

    users {
        uuid id PK
        int avatar_source
        string avatar_url
        datetime created_at
        datetime deleted_at
        string email
        datetime email_verified_at
        int failed_attempts
        string full_name
        boolean is_legal_hold
        datetime last_failed_at
        datetime last_login_at
        string last_login_ip
        datetime last_username_change_at
        json linked_emails
        datetime lock_until
        datetime password_changed_at
        string password_hash
        int session_version
        user_status status
        datetime updated_at
        string username
        int version
    }

    roles {
        uuid id PK
        datetime created_at
        datetime deleted_at
        string description
        string display_name
        string domain
        boolean is_active
        boolean is_system
        string name
        uuid parent_role_id
        uuid tenant_id
        datetime updated_at
        xid xmin
    }

    permissions {
        uuid id PK
        datetime created_at
        string description
        string display_name
        boolean is_system
        string module
        string name
        datetime updated_at
    }

    user_roles {
        uuid role_id PK
        uuid user_id PK
        datetime assigned_at
    }

    role_permissions {
        uuid permission_id PK
        uuid role_id PK
        datetime assigned_at
    }

    role_assignments {
        uuid id PK
        datetime assigned_at
        uuid role_id
        uuid scope_id
        string scope_type
        uuid user_id
    }

    refresh_tokens {
        uuid id PK
        datetime created_at
        datetime expires_at
        string ip_address
        uuid organization_id
        boolean remember_me
        string replaced_by_token
        uuid replaced_by_token_id
        datetime revoked_at
        uuid session_id
        string token
        string user_agent
        uuid user_id
    }

    verification_tokens {
        uuid id PK
        datetime consumed_at
        datetime created_at
        datetime expires_at
        string token_hash
        uuid user_id
        xid xmin
    }

    reset_password_tokens {
        uuid id PK
        datetime consumed_at
        datetime created_at
        datetime expires_at
        string token_hash
        uuid user_id
        xid xmin
    }

    auth_providers {
        uuid id PK
        datetime created_at
        datetime deleted_at
        string encrypted_access_token
        string encrypted_refresh_token
        datetime expires_at
        string granted_scopes
        datetime last_provider_sync_at
        datetime last_scope_validation_at
        datetime last_successful_refresh_at
        string provider_account_id
        string provider_avatar_url
        string provider_display_name
        string provider_key
        string provider_name
        string provider_profile_url
        string provider_username
        int refresh_failure_count
        int scope_validation_status
        string sync_error
        string sync_status
        datetime token_updated_at
        uuid user_id
    }

    pending_auth_providers {
        uuid id PK
        datetime created_at
        string encrypted_access_token
        string encrypted_refresh_token
        datetime expires_at
        string provider_account_id
        string provider_avatar_url
        string provider_display_name
        string provider_key
        string provider_name
        string provider_profile_url
        string provider_username
        uuid user_id
    }

    otp_verifications {
        uuid id PK
        int attempts
        uuid challenge_id
        datetime consumed_at
        datetime cooldown_until
        datetime created_at
        string email
        datetime expires_at
        datetime invalidated_at
        datetime last_attempt_at
        datetime last_resent_at
        datetime last_sent_at
        string otp_hash
        string purpose
        int resend_count
        int status
    }

    verification_links {
        uuid id PK
        datetime consumed_at
        string consumed_by_ip
        string consumed_by_user_agent
        datetime created_at
        datetime deleted_at
        string email
        datetime expires_at
        uuid organization_id
        string organization_name
        string purpose
        string tax_code
        string token_hash
        uuid user_id
    }

    users ||--o{ auth_providers : relates_to
    users ||--o{ pending_auth_providers : relates_to
    organizations {
        string id PK
    }

    organizations ||--o{ refresh_tokens : refers_to
    users ||--o{ refresh_tokens : relates_to
    users ||--o{ reset_password_tokens : relates_to
    organizations ||--o{ verification_links : refers_to
    users ||--o{ verification_links : relates_to
    users ||--o{ verification_tokens : relates_to
    roles ||--o{ roles : relates_to
    roles ||--o{ role_assignments : relates_to
    users ||--o{ role_assignments : relates_to
```

---

<a id="organizations_workspaces"></a>
## 2. Organizations & Workspaces

*Multi-tenant enterprise organizations, collaborative workspaces, workspace memberships, and legal authority recovery.* (`23 tables`)

```mermaid
erDiagram

    organizations {
        uuid id PK
        string banner_url
        int branch_count
        string city
        string contact_email
        string contact_name
        string contact_phone
        string core_values
        datetime created_at
        datetime deleted_at
        string description
        string detail_address
        string email
        string facebook_url
        int follower_count
        string founded
        string google_maps_embed_url
        datetime initial_admin_assigned_at
        boolean is_verified
        string linkedin_url
        string logo_url
        string mission
        string name
        string organization_size
        string organization_type
        string recovery_authority
        string registration_number
        string representative_email
        string representative_identity
        string representative_name
        string representative_phone
        string status
        string tax_code
        string twitter_url
        datetime updated_at
        string username
        int verification_level
        string vision
        string website
    }

    organization_authorities {
        uuid id PK
        datetime joined_at
        uuid organization_id
        string role
        uuid user_id
    }

    organization_memberships {
        uuid id PK
        datetime joined_at
        uuid organization_id
        string role
        string status
        uuid user_id
    }

    organization_followers {
        uuid user_id PK
        uuid organization_id PK
        datetime followed_at
    }

    organization_verifications {
        uuid id PK
        boolean is_verified
        string metadata
        uuid organization_id
        string verification_type
        datetime verified_at
        string verified_by
        string verified_value
    }

    organization_credentials {
        uuid organization_id PK
        datetime created_at
        datetime deleted_at
        int failed_login_attempts
        datetime lockout_end
        string password_hash
        datetime updated_at
        string username
    }

    pending_organization_ownerships {
        uuid id PK
        datetime consumed_at
        uuid consumed_by_user_id
        datetime created_at
        datetime discovery_notified_at
        datetime expires_at
        uuid organization_id
        string owner_email
    }

    organization_invitations {
        uuid id PK
        datetime accepted_at
        uuid consumed_by_user_id
        datetime created_at
        datetime declined_at
        string declined_reason
        datetime discovery_notified_at
        datetime expires_at
        uuid invited_by_user_id
        string invitee_email
        uuid organization_id
        string status
        string token_hash
    }

    organization_invitation_roles {
        uuid id PK
        uuid invitation_id
        uuid role_id
        uuid scope_id
        string scope_type
    }

    organization_recovery_claims {
        uuid id PK
        datetime created_at
        string document_ocr_metadata
        string document_suspicious_metadata
        json documents
        string historical_claim_flags
        string ip_device_flags
        uuid organization_id
        string phone_number
        string recovery_email
        string rejection_reason
        string representative_full_name
        string representative_position
        datetime reviewed_at
        string reviewed_by
        string risk_level
        int risk_score
        string second_reviewer_by
        string status
        string suggested_recovery_strategy
        datetime updated_at
        string workspace_activity_flags
    }

    approved_recovery_sessions {
        uuid id PK
        string approved_by
        string approved_representative
        datetime created_at
        datetime expires_at
        boolean is_consumed
        uuid organization_id
        string recovery_token_hash
        datetime revoked_at
        string suggested_strategy
        datetime used_at
        string used_by_device
        string used_by_ip
        string verified_recovery_email
    }

    recovery_execution_locks {
        uuid id PK
        datetime acquired_at
        datetime completed_at
        uuid recovery_session_id
        string status
    }

    recovery_tokens {
        uuid id PK
        datetime consumed_at
        datetime created_at
        datetime expires_at
        string metadata_json
        uuid organization_id
        string purpose
        datetime revoked_at
        string token_hash
        int token_type
        uuid user_id
        xid xmin
    }

    representative_rotation_requests {
        uuid id PK
        string admin_approval_status
        datetime created_at
        string current_representative
        datetime expires_at
        string final_decision
        string optional_supporting_message
        uuid organization_id
        string reason
        string requested_email
        string requested_phone
        string requested_representative
        string support_approval_status
        string verification_call_notes
        string verification_call_status
    }

    representative_approval_votes {
        uuid id PK
        string approver_role
        uuid approver_user_id
        string decision
        uuid request_id
        datetime timestamp
    }

    representative_authority_histories {
        uuid id PK
        datetime effective_at
        string new_representative
        uuid organization_id
        string previous_representative
        string rotated_by
        string support_reviewer
    }

    enterprise_workflow_requests {
        uuid id PK
        datetime assigned_at
        uuid assigned_reviewer_id
        datetime claimed_at
        datetime created_at
        datetime due_at
        uuid escalated_to_user_id
        string metadata_json
        uuid organization_id
        string priority
        string request_type
        datetime resolved_at
        string review_state
        bytea row_version
        string status
        datetime updated_at
    }

    workflow_attachments {
        uuid id PK
        string content_type
        datetime created_at
        string file_name
        string storage_path
        uuid workflow_request_id
    }

    workflow_comments {
        uuid id PK
        uuid author_user_id
        string content
        datetime created_at
        boolean is_internal_only
        uuid workflow_request_id
    }

    workspaces {
        uuid id PK
        string branding
        datetime created_at
        datetime deleted_at
        string description
        string display_name
        uuid organization_id
        uuid owner_id
        string slug
        string status
        datetime updated_at
    }

    workspace_members {
        uuid id PK
        datetime joined_at
        string role
        uuid user_id
        uuid workspace_id
    }

    workspace_archive_snapshots {
        uuid id PK
        string archived_by
        datetime created_at
        uuid organization_id
        string snapshot_data_json
        uuid workspace_id
    }

    workspace_posts {
        uuid id PK
        string category
        string content
        datetime created_at
        uuid created_by_user_id
        int likes
        uuid organization_id
        int shares_count
        datetime updated_at
    }

    organizations ||--o{ organization_credentials : relates_to
    organizations ||--o{ approved_recovery_sessions : relates_to
    organizations ||--o{ organization_recovery_claims : relates_to
    organizations ||--o{ recovery_tokens : relates_to
    users {
        string id PK
    }

    users ||--o{ recovery_tokens : refers_to
    users ||--o{ representative_approval_votes : refers_to
    representative_rotation_requests ||--o{ representative_approval_votes : relates_to
    organizations ||--o{ representative_authority_histories : relates_to
    organizations ||--o{ representative_rotation_requests : relates_to
    users ||--o{ enterprise_workflow_requests : refers_to
    organizations ||--o{ enterprise_workflow_requests : relates_to
    organizations ||--o{ organization_authorities : relates_to
    users ||--o{ organization_authorities : refers_to
    organizations ||--o{ organization_followers : relates_to
    users ||--o{ organization_invitations : refers_to
    organizations ||--o{ organization_invitations : relates_to
    organization_invitations ||--o{ organization_invitation_roles : relates_to
    roles {
        string id PK
    }

    roles ||--o{ organization_invitation_roles : refers_to
    organizations ||--o{ organization_memberships : relates_to
    users ||--o{ organization_memberships : refers_to
    organizations ||--o{ organization_verifications : relates_to
    users ||--o{ pending_organization_ownerships : refers_to
    organizations ||--o{ pending_organization_ownerships : relates_to
    enterprise_workflow_requests ||--o{ workflow_attachments : relates_to
    users ||--o{ workflow_comments : refers_to
    enterprise_workflow_requests ||--o{ workflow_comments : relates_to
    organizations ||--o{ workspaces : relates_to
    users ||--o{ workspaces : refers_to
    users ||--o{ workspace_members : refers_to
    workspaces ||--o{ workspace_members : relates_to
    users ||--o{ workspace_posts : refers_to
    organizations ||--o{ workspace_posts : relates_to
```

---

<a id="candidate_profile"></a>
## 3. Candidate Profile & Portfolio

*Candidate resume profiles, work experiences, educational background, academic achievements, and portfolio project links.* (`18 tables`)

```mermaid
erDiagram

    user_profiles {
        uuid user_id PK
        string ai_suggestions_json
        string ai_talent_discovery
        string bio
        datetime birth_date
        string company
        datetime created_at
        string custom_pronouns
        datetime deleted_at
        string headline
        datetime last_profile_update_at
        string location
        string phone_number
        string profile_visibility
        string pronouns
        string public_email
        boolean recruiter_visibility
        datetime updated_at
        string username
        int version
    }

    career_preferences {
        uuid user_id PK
        boolean available_for_hire
        datetime created_at
        datetime deleted_at
        string expected_salary_currency
        float expected_salary_max
        float expected_salary_min
        boolean expected_salary_negotiable
        string expected_salary_type
        boolean is_expected_salary_visible
        string job_title_preferences
        string leadership_track
        boolean open_to_relocation
        string open_to_work_status
        string preferred_language
        string remote_preference
        float salary_expectations
        datetime updated_at
        int version
        string work_preference_notes
    }

    ai_inferred_preferences {
        uuid user_id PK
        float confidence_score
        datetime created_at
        datetime deleted_at
        string inferred_primary_role
        string inferred_salary_currency
        float inferred_salary_max
        float inferred_salary_min
        string inferred_seniority
        datetime last_analyzed_at
        string synthesis_rationale
        datetime updated_at
        int version
    }

    user_skills {
        uuid id PK
        datetime created_at
        string normalized_name
        string skill
        string skill_id
        uuid user_id
    }

    education_entries {
        uuid id PK
        datetime created_at
        string degree
        datetime deleted_at
        string description
        int display_order
        datetime end_date
        float gpa
        float gpa_scale
        boolean is_currently_studying
        string label
        string major
        string school_name
        datetime start_date
        datetime updated_at
        uuid user_id
    }

    academic_achievements {
        uuid id PK
        datetime created_at
        string credential_url
        datetime deleted_at
        string description
        int display_order
        datetime issue_date
        string issuer
        string title
        datetime updated_at
        uuid user_id
    }

    profile_attachments {
        uuid id PK
        datetime created_at
        datetime deleted_at
        uuid entity_id
        string entity_type
        string file_name
        string file_path
        int file_size
        string file_type
        datetime updated_at
        uuid user_id
    }

    work_experience_entries {
        uuid id PK
        string company
        datetime created_at
        datetime deleted_at
        string description
        int display_order
        int employment_type
        datetime end_date
        int experience_category
        boolean is_currently_working
        boolean is_leadership
        string job_title
        string location
        datetime start_date
        datetime updated_at
        uuid user_id
    }

    work_experience_achievements {
        uuid id PK
        datetime created_at
        string description
        string title
        datetime updated_at
        uuid work_experience_id
    }

    work_experience_technologies {
        uuid id PK
        datetime created_at
        string name
        uuid work_experience_id
    }

    work_experience_links {
        uuid id PK
        datetime created_at
        int link_type
        string url
        uuid work_experience_id
    }

    project_entries {
        uuid id PK
        datetime created_at
        datetime deleted_at
        string description
        int display_order
        datetime end_date
        boolean is_currently_working
        string name
        string role
        datetime start_date
        datetime updated_at
        uuid user_id
        int verification_level
        json verification_metadata_json
        int verification_status
        datetime verified_at
    }

    project_repository_links {
        uuid id PK
        datetime linked_at
        uuid project_entry_id
        uuid source_code_repository_id
    }

    project_technologies {
        uuid id PK
        datetime created_at
        string name
        uuid project_entry_id
    }

    project_contributions {
        uuid id PK
        string content
        datetime created_at
        uuid project_entry_id
    }

    user_cv_settings {
        uuid user_id PK
        datetime created_at
        string cv_layout_config_json
        string cv_template_id
        string cv_theme_color
        boolean is_cv_published
        datetime updated_at
    }

    cv_repository_mappings {
        uuid id PK
        datetime indexed_at_utc
        uuid reference_entity_id
        string reference_source
        uuid source_code_repository_id
        uuid user_id
    }

    user_followers {
        uuid follower_id PK
        uuid followee_id PK
        datetime followed_at
    }

    users {
        string id PK
    }

    users ||--o{ academic_achievements : refers_to
    users ||--|| ai_inferred_preferences : refers_to
    users ||--|| career_preferences : refers_to
    source_code_repositories {
        string id PK
    }

    source_code_repositories ||--o{ cv_repository_mappings : refers_to
    users ||--o{ education_entries : refers_to
    users ||--o{ profile_attachments : refers_to
    project_entries ||--o{ project_contributions : relates_to
    users ||--o{ project_entries : refers_to
    project_entries ||--o{ project_repository_links : relates_to
    source_code_repositories ||--o{ project_repository_links : refers_to
    project_entries ||--o{ project_technologies : relates_to
    users ||--o{ user_cv_settings : refers_to
    users ||--|| user_profiles : refers_to
    users ||--o{ user_skills : refers_to
    work_experience_entries ||--o{ work_experience_achievements : relates_to
    users ||--o{ work_experience_entries : refers_to
    work_experience_entries ||--o{ work_experience_links : relates_to
    work_experience_entries ||--o{ work_experience_technologies : relates_to
    users ||--o{ user_followers : refers_to
```

---

<a id="talent_intelligence"></a>
## 4. Talent Intelligence Graph

*Graph representation of candidate capabilities, evidence claims, trust profiles, and capability search projections.* (`21 tables`)

```mermaid
erDiagram

    capability_nodes {
        uuid id PK
        string category
        datetime created_at
        string description
        string name
        string slug
    }

    capability_edges {
        uuid source_node_id PK
        uuid target_node_id PK
        string relationship_type PK
        float weight
    }

    candidate_capabilities {
        uuid id PK
        uuid candidate_id
        uuid capability_node_id
        datetime created_at
        datetime updated_at
    }

    candidate_capability_evidences {
        uuid candidate_capability_id PK
        uuid evidence_artifact_id PK
        datetime added_at
    }

    candidate_capability_scores {
        uuid candidate_capability_id PK
        datetime calculated_at
        string expertise_level
        float proficiency_score
        float recency_index
    }

    candidate_capability_histories {
        uuid id PK
        uuid candidate_capability_id
        float proficiency_score
        datetime recorded_at
    }

    evidence_sources {
        uuid id PK
        json connection_config
        datetime created_at
        boolean is_active
        string name
        string provider_type
    }

    evidence_artifacts {
        uuid id PK
        string artifact_type
        datetime created_at
        string cryptographic_signature
        string external_identifier
        json payload
        uuid source_id
    }

    evidence_claims {
        uuid id PK
        string assertion_type
        uuid candidate_id
        float confidence_score
        datetime created_at
        uuid evidence_artifact_id
    }

    evidence_verifications {
        uuid id PK
        datetime created_at
        uuid evidence_claim_id
        datetime expires_at
        string status
        json verification_log
        string verification_type
        datetime verified_at
    }

    trust_profiles {
        uuid id PK
        datetime recalculated_at
        uuid target_entity_id
        string target_type
    }

    trust_components {
        uuid id PK
        string component_name
        int component_score
        json explanation_metadata
        uuid trust_profile_id
        datetime updated_at
        float weight
    }

    trust_calculations {
        uuid id PK
        int aggregate_score
        datetime calculated_at
        json calculation_details
        uuid trust_profile_id
    }

    candidate_trust_projections {
        uuid candidate_id PK
        int aggregate_score
        datetime last_updated_at
        uuid trust_profile_id
        string trust_tier
    }

    candidate_search_profiles {
        uuid candidate_id PK
        json capabilities_json
        string full_name
        string headline
        datetime last_projected_at
        string location
        int trust_score
        string trust_tier
    }

    candidate_ranking_projections {
        uuid candidate_id PK
        float ai_score
        boolean available_for_hire
        string avatar_url
        string bio
        string career_level_label
        float composite_score
        float evidence_trust_score
        int followers_count
        int following_count
        string full_name
        int global_rank_position
        string headline
        datetime last_updated_at
        string location
        string open_to_work_status
        int previous_global_rank_position
        string primary_domain
        float profile_completeness
        json top_capabilities_json
        int total_forks_count
        int total_stars_count
        float trust_score
        string username
        int verified_contribution_count
        int verified_repo_count
    }

    candidate_capability_projections {
        uuid candidate_id PK
        json capabilities_json
        datetime projected_at
    }

    capability_catalog_items {
        string capability_id PK
        string category
        datetime created_at
        string description
        string display_name
        boolean is_custom
        string status
        datetime updated_at
        uuid workspace_id
    }

    capability_registries {
        string capability_id PK
        string capability_version
        string category
        datetime created_at
        string deprecated_by_id
        string description
        string display_name
        datetime effective_date
        json migration_mappings
        string status
        string taxonomy_version
        datetime updated_at
    }

    capability_hierarchies {
        string parent_id PK
        string child_id PK
    }

    capability_aliases {
        string alias_name PK
        string canonical_id
    }

    users {
        string id PK
    }

    users ||--o{ candidate_capabilities : refers_to
    capability_nodes ||--o{ candidate_capabilities : relates_to
    candidate_capabilities ||--o{ candidate_capability_evidences : relates_to
    evidence_artifacts ||--o{ candidate_capability_evidences : relates_to
    candidate_capabilities ||--o{ candidate_capability_histories : relates_to
    users ||--|| candidate_capability_projections : refers_to
    candidate_capabilities ||--|| candidate_capability_scores : relates_to
    users ||--|| candidate_ranking_projections : refers_to
    users ||--|| candidate_search_profiles : refers_to
    users ||--|| candidate_trust_projections : refers_to
    trust_profiles ||--o{ candidate_trust_projections : relates_to
    capability_registries ||--o{ capability_aliases : relates_to
    workspaces {
        string id PK
    }

    workspaces ||--o{ capability_catalog_items : refers_to
    capability_nodes ||--o{ capability_edges : relates_to
    capability_nodes ||--o{ capability_edges : relates_to
    capability_registries ||--o{ capability_hierarchies : relates_to
    capability_registries ||--o{ capability_hierarchies : relates_to
    capability_registries ||--o{ capability_registries : relates_to
    evidence_sources ||--o{ evidence_artifacts : relates_to
    users ||--o{ evidence_claims : refers_to
    evidence_artifacts ||--o{ evidence_claims : relates_to
    evidence_claims ||--o{ evidence_verifications : relates_to
    trust_profiles ||--o{ trust_calculations : relates_to
    trust_profiles ||--o{ trust_components : relates_to
```

---

<a id="recruitment_job_matching"></a>
## 5. Recruitment & Job Vacancy Matching

*Hiring requirements, job vacancies, candidate applications, AI matching evaluations, and recommendation runs.* (`23 tables`)

```mermaid
erDiagram

    job_vacancies {
        uuid id PK
        string acquisition_strategy
        string category
        string city
        string cover_url
        datetime created_at
        string degree
        string department
        json discovery_profile_json
        string experience
        string gender
        int headcount
        uuid hiring_requirement_id
        boolean is_active
        string metadata
        uuid organization_id
        uuid requirement_snapshot_id
        string salary
        string salary_min_max
        string status
        string title
        string type
        datetime updated_at
        string workplace_type
    }

    hiring_requirements {
        uuid id PK
        int auto_close_rule
        string business_problem
        int candidates_needed_count
        string city
        datetime created_at
        string currency
        string degree_requirement
        string department
        string employment_type
        datetime end_date
        int headcount
        string hiring_reason
        boolean is_manually_closed
        boolean is_salary_negotiable
        uuid organization_id
        float salary_max
        float salary_min
        int salary_period
        string seniority
        datetime start_date
        string status
        string timezone_range
        string title
        datetime updated_at
        int version
        string workplace_type
        uuid workspace_id
    }

    business_outcomes {
        uuid id PK
        datetime created_at
        uuid hiring_requirement_id
        string text
    }

    responsibilities {
        uuid id PK
        datetime created_at
        uuid hiring_requirement_id
        boolean is_leadership
        string ownership_level
        string priority
        string text
    }

    requirement_capabilities {
        uuid id PK
        string capability_id
        string category
        datetime created_at
        int expected_proficiency
        uuid hiring_requirement_id
        string name
        string ownership_level
        string priority
    }

    technology_requirements {
        uuid id PK
        datetime created_at
        uuid hiring_requirement_id
        string name
        string priority
        int sfia_level
    }

    evidence_signals {
        uuid id PK
        string expected_metric
        json metadata
        string rationale
        uuid requirement_capability_id
        string signal_type
    }

    evaluation_rubrics {
        uuid id PK
        json capability_weights
        datetime created_at
        json evidence_requirements
        uuid hiring_requirement_id
        json scoring_rules
    }

    interview_blueprints {
        uuid id PK
        json capability_questions
        datetime created_at
        json dimensions
        uuid hiring_requirement_id
    }

    requirement_artifacts {
        uuid id PK
        string artifact_type
        datetime created_at
        json generation_metadata_json
        datetime generation_timestamp
        uuid hiring_requirement_id
        string markdown_content
        string model_info
        string prompt_hash
        string prompt_template_id
        string prompt_version
        json regeneration_history_json
        string status
        json structured_content_json
        datetime updated_at
    }

    requirement_snapshots {
        uuid id PK
        int auto_close_rule
        json business_outcomes_json
        string business_problem
        int candidates_needed_count
        json capabilities_json
        string city
        string currency
        string degree_requirement
        string department
        string employment_type
        datetime end_date
        int headcount
        string hiring_reason
        uuid hiring_requirement_id
        boolean is_manually_closed
        boolean is_salary_negotiable
        json responsibilities_json
        float salary_max
        float salary_min
        int salary_period
        string seniority
        datetime snapshotted_at
        datetime start_date
        json technology_requirements_json
        string timezone_range
        string title
        int version
        string workplace_type
    }

    evaluation_rubric_snapshots {
        uuid requirement_snapshot_id PK
        json capability_weights
        json evidence_requirements
        json scoring_rules
        datetime snapshotted_at
    }

    interview_blueprint_snapshots {
        uuid requirement_snapshot_id PK
        json capability_questions
        json dimensions
        datetime snapshotted_at
    }

    requirement_artifact_snapshots {
        uuid id PK
        string artifact_type
        string markdown_content
        uuid requirement_snapshot_id
        datetime snapshotted_at
        json structured_content_json
    }

    requirement_vector_snapshots {
        uuid requirement_snapshot_id PK
        int dimension
        datetime snapshotted_at
    }

    candidate_discovery_runs {
        uuid id PK
        int candidates_found_count
        datetime completed_at
        string error_message
        uuid hiring_requirement_id
        string match_quality_summary
        string raw_results_json
        datetime started_at
        int status
        uuid triggered_by_id
    }

    candidate_match_projections {
        uuid candidate_id PK
        datetime last_projected_at
        string profile_summary
    }

    candidate_evaluation_snapshots {
        uuid candidate_id PK
        datetime evaluated_at
        float evidence_trust_score
        float identity_trust_score
        float profile_completeness
        string verification_state
    }

    matching_evaluations {
        uuid id PK
        int aggregate_score
        uuid candidate_id
        string confidence_level
        datetime created_at
        uuid job_vacancy_id
        datetime updated_at
    }

    matching_factors {
        uuid id PK
        string factor_name
        int factor_score
        uuid matching_evaluation_id
        float weight
    }

    matching_explanations {
        uuid id PK
        string assertion_text
        uuid capability_node_id
        string explanation_type
        uuid matching_evaluation_id
        uuid supporting_artifact_id
    }

    job_applications {
        uuid id PK
        uuid candidate_id
        datetime created_at
        json eligibility_snapshot_json
        json gaps_snapshot_json
        uuid job_vacancy_id
        string status
        datetime updated_at
    }

    job_interactions {
        uuid id PK
        datetime interaction_at
        string interaction_type
        uuid job_vacancy_id
        uuid user_id
    }

    hiring_requirements ||--o{ business_outcomes : relates_to
    hiring_requirements ||--o{ candidate_discovery_runs : relates_to
    users {
        string id PK
    }

    users ||--o{ candidate_discovery_runs : refers_to
    users ||--|| candidate_evaluation_snapshots : refers_to
    users ||--|| candidate_match_projections : refers_to
    hiring_requirements ||--o{ evaluation_rubrics : relates_to
    requirement_snapshots ||--|| evaluation_rubric_snapshots : relates_to
    requirement_capabilities ||--o{ evidence_signals : relates_to
    organizations {
        string id PK
    }

    organizations ||--o{ hiring_requirements : refers_to
    workspaces {
        string id PK
    }

    workspaces ||--o{ hiring_requirements : refers_to
    hiring_requirements ||--o{ interview_blueprints : relates_to
    requirement_snapshots ||--|| interview_blueprint_snapshots : relates_to
    users ||--o{ job_applications : refers_to
    job_vacancies ||--o{ job_applications : relates_to
    job_vacancies ||--o{ job_interactions : relates_to
    users ||--o{ job_interactions : refers_to
    hiring_requirements ||--o{ job_vacancies : relates_to
    organizations ||--o{ job_vacancies : refers_to
    requirement_snapshots ||--o{ job_vacancies : relates_to
    users ||--o{ matching_evaluations : refers_to
    job_vacancies ||--o{ matching_evaluations : relates_to
    capability_nodes {
        string id PK
    }

    capability_nodes ||--o{ matching_explanations : refers_to
    matching_evaluations ||--o{ matching_explanations : relates_to
    evidence_artifacts {
        string id PK
    }

    evidence_artifacts ||--o{ matching_explanations : refers_to
    matching_evaluations ||--o{ matching_factors : relates_to
    hiring_requirements ||--o{ requirement_artifacts : relates_to
    requirement_snapshots ||--o{ requirement_artifact_snapshots : relates_to
    hiring_requirements ||--o{ requirement_capabilities : relates_to
    hiring_requirements ||--o{ requirement_snapshots : relates_to
    requirement_snapshots ||--|| requirement_vector_snapshots : relates_to
    hiring_requirements ||--o{ responsibilities : relates_to
    hiring_requirements ||--o{ technology_requirements : relates_to
```

---

<a id="candidate_assessment"></a>
## 6. Candidate Assessment & Skill Attribution

*Deep automated candidate skill assessments, canonical skill taxonomies, repository attributions, and skill tree breakdowns.* (`15 tables`)

```mermaid
erDiagram

    candidate_assessments {
        uuid id PK
        string assessment_schema_version
        string calculation_mode
        string career_level
        string career_level_label
        string clone_risk_classification
        datetime completed_at_utc
        datetime created_at_utc
        uuid cv_id
        string evidence_completeness
        float execution_strength
        string failed_stage
        string failure_reason
        string input_feature_set_hash
        datetime last_assessment_at
        datetime last_profile_update_at
        datetime last_repository_analysis_at
        float leadership_potential
        string model_version
        float overall_score
        string pipeline_version
        string primary_tendency
        string primary_working_style
        string professional_bio
        string prompt_version
        string status
        string summary_headline
        string summary_paragraph
        float technical_breadth
        float technical_depth
        float trust_level
        uuid user_id
        int version
    }

    candidate_assessment_artifacts {
        uuid id PK
        string artifact_type
        uuid assessment_id
        datetime created_at_utc
        string json_data
    }

    repository_assessments {
        uuid id PK
        uuid analysis_job_id
        string assessment_schema_version
        string commit_sha
        datetime completed_at_utc
        datetime created_at_utc
        json json_data
        string model_version
        float overall_score
        json patterns
        string pipeline_version
        string prompt_version
        json quality_metrics
        uuid repository_id
        string status
        json tech_stack
    }

    repository_capabilities {
        uuid id PK
        string analysis_version
        string assessment_version
        string category
        float confidence
        float difficulty_score
        json evidence_json
        string maturity
        string model_version
        string name
        string prompt_version
        uuid repository_assessment_id
        float score
    }

    repository_skill_attributions {
        uuid id PK
        string analysis_version
        string assessment_version
        float confidence
        float contribution_weight
        string model_version
        string normalization_source
        string original_name
        string pipeline_trace_id
        string prompt_version
        uuid repository_assessment_id
        string skill_id
        string skill_name
        string taxonomy_version
        string verification_level
    }

    canonical_skills {
        string skill_id PK
        string taxonomy_version PK
        datetime created_at
        string display_name
        string onet_code
        string sfia_category
        string status
    }

    canonical_skill_aliases {
        string alias_name PK
        string skill_id
        string taxonomy_version
    }

    repository_domains {
        uuid id PK
        string analysis_version
        string assessment_version
        float confidence
        string domain_name
        int evidence_count
        string model_version
        string prompt_version
        uuid repository_assessment_id
        json supporting_signals
        float weight
    }

    repository_intelligence_signals {
        uuid id PK
        string analysis_version
        string assessment_version
        float complexity_signal
        float consistency_signal
        datetime last_updated_utc
        float leadership_signal
        string model_version
        float ownership_signal
        string prompt_version
        uuid repository_assessment_id
        float scope_signal
    }

    candidate_skills {
        uuid id PK
        uuid candidate_assessment_id
        float confidence
        json evidence_sources
        string level
        string normalization_source
        string original_name
        string pipeline_trace_id
        float score
        string skill_id
        string skill_name
        string taxonomy_version
    }

    candidate_domain_profiles {
        uuid id PK
        uuid candidate_assessment_id
        float confidence
        string domain_name
        float score
        string seniority
        json supporting_evidence
    }

    candidate_intelligence_signals {
        uuid id PK
        uuid candidate_assessment_id
        float complexity_signal
        float consistency_signal
        float delivery_signal
        float engineering_maturity_signal
        datetime last_updated_utc
        float leadership_signal
        float ownership_signal
        float problem_solving_signal
        float scope_signal
    }

    candidate_best_fit_roles {
        uuid id PK
        uuid candidate_assessment_id
        float confidence
        json engine_metadata
        json evidence
        float match_score
        string matching_engine_version
        int rank
        string role_title
    }

    candidate_strengths_weaknesses {
        uuid id PK
        uuid candidate_assessment_id
        string description
        json evidence
        string finding_type
        string topic
    }

    candidate_skill_tree_nodes {
        uuid id PK
        uuid candidate_assessment_id
        string category
        float confidence_score
        string display_name
        float estimated_experience_months
        uuid parent_id
        string proficiency_level
        json supporting_evidence
    }

    users {
        string id PK
    }

    users ||--o{ candidate_assessments : refers_to
    candidate_assessments ||--o{ candidate_assessment_artifacts : relates_to
    candidate_assessments ||--o{ candidate_best_fit_roles : relates_to
    candidate_assessments ||--o{ candidate_domain_profiles : relates_to
    candidate_assessments ||--o{ candidate_intelligence_signals : relates_to
    candidate_assessments ||--o{ candidate_skills : relates_to
    candidate_assessments ||--o{ candidate_skill_tree_nodes : relates_to
    candidate_skill_tree_nodes ||--o{ candidate_skill_tree_nodes : relates_to
    candidate_assessments ||--o{ candidate_strengths_weaknesses : relates_to
```

---

<a id="source_code_intelligence"></a>
## 7. Source Code Intelligence & Repository Analysis

*Linked Git source code repositories, AST code analysis jobs, task executions, and static analysis reports.* (`9 tables`)

```mermaid
erDiagram

    external_organizations {
        uuid id PK
        uuid auth_provider_id
        string avatar_url
        string description
        string external_id
        string html_url
        boolean is_active
        datetime last_synced_at
        string login
        string name
        string type
    }

    source_code_repositories {
        uuid id PK
        boolean archived_externally
        uuid auth_provider_id
        string authenticity_type
        string classification
        datetime created_at_utc
        string custom_settings_json
        string default_branch
        string description
        uuid external_organization_id
        string external_repository_id
        int forks_count
        string html_url
        boolean is_accessible
        boolean is_enabled
        boolean is_private
        boolean is_verified
        datetime last_commit_at
        datetime last_seen_at
        datetime last_synced_at
        datetime last_updated_utc
        datetime latest_analysis_completed_at_utc
        string latest_analysis_status
        json latest_risk_factors_json
        string latest_risk_level
        float latest_risk_score
        string name
        int open_issues_count
        string owner
        string owner_login
        string owner_type
        string primary_language
        int stars_count
        float trust_score
        int watchers_count
    }

    analysis_jobs {
        uuid id PK
        string commit_sha
        datetime completed_at
        datetime created_at_utc
        string current_step
        string error_message
        datetime last_updated_utc
        float progress
        uuid repository_id
        datetime started_at
        string status
        uuid user_id
    }

    analysis_job_events {
        uuid id PK
        datetime created_at_utc
        uuid job_id
        string message
        float progress
        string step
    }

    analysis_reports {
        uuid id PK
        datetime created_at_utc
        uuid job_id
        json report_data
        uuid repository_id
    }

    analysis_tasks {
        uuid id PK
        int cache_read_tokens
        int cache_write_tokens
        datetime completed_at
        int completion_tokens
        datetime created_at_utc
        int duration_ms
        string error_message
        float estimated_cost_usd
        uuid job_id
        datetime last_updated_utc
        json metadata
        string model_name
        float progress
        int prompt_tokens
        int retry_count
        datetime started_at
        string status
        string task_type
    }

    analysis_task_results {
        uuid task_id PK
        datetime created_at_utc
        json result_data
        string schema_version
    }

    analysis_task_events {
        uuid id PK
        string event_type
        string level
        string message
        json metadata
        uuid task_id
        datetime timestamp
    }

    analysis_executions {
        uuid id PK
        int cached_tokens
        int completion_tokens
        datetime created_at_utc
        int duration_ms
        float estimated_cost_usd
        string execution_type
        uuid job_id
        string model
        int prompt_tokens
        string provider
        uuid task_id
        int total_tokens
        uuid user_id
    }

    analysis_jobs ||--o{ analysis_executions : relates_to
    analysis_tasks ||--o{ analysis_executions : relates_to
    users {
        string id PK
    }

    users ||--o{ analysis_executions : refers_to
    source_code_repositories ||--o{ analysis_jobs : relates_to
    users ||--o{ analysis_jobs : refers_to
    analysis_jobs ||--o{ analysis_job_events : relates_to
    analysis_jobs ||--|| analysis_reports : relates_to
    source_code_repositories ||--o{ analysis_reports : relates_to
    analysis_jobs ||--o{ analysis_tasks : relates_to
    analysis_tasks ||--o{ analysis_task_events : relates_to
    analysis_tasks ||--|| analysis_task_results : relates_to
    auth_providers {
        string id PK
    }

    auth_providers ||--o{ external_organizations : refers_to
    auth_providers ||--o{ source_code_repositories : refers_to
    external_organizations ||--o{ source_code_repositories : relates_to
```

---

<a id="community_forum"></a>
## 8. Community Forum

*Discussion categories, topics, replies, moderation queues, gamification badges, and user reputation scores.* (`17 tables`)

```mermaid
erDiagram

    forum_categories {
        uuid id PK
        datetime created_at
        datetime deleted_at
        string description
        int display_order
        string icon_name
        boolean is_archived
        boolean is_private
        string name
        uuid organization_id
        string required_role
        string slug
        datetime updated_at
    }

    forum_category_moderators {
        uuid category_id PK
        uuid user_id PK
        datetime assigned_at
    }

    forum_topics {
        uuid id PK
        string ai_excerpt
        uuid author_id
        uuid category_id
        string content
        datetime created_at
        datetime deleted_at
        boolean is_archived
        boolean is_featured
        boolean is_locked
        boolean is_pending_review
        boolean is_pinned
        boolean is_solved
        datetime last_activity_at
        uuid organization_id
        int reply_count
        int score
        string slug
        string title
        datetime updated_at
        int view_count
    }

    forum_replies {
        uuid id PK
        uuid author_id
        string content
        datetime created_at
        datetime deleted_at
        boolean is_accepted_solution
        uuid parent_reply_id
        string quote_text
        int score
        uuid topic_id
        datetime updated_at
    }

    forum_tags {
        uuid id PK
        datetime created_at
        boolean is_archived
        string name
        string slug
    }

    forum_topic_tags {
        uuid topic_id PK
        uuid tag_id PK
    }

    forum_votes {
        uuid id PK
        datetime created_at
        uuid reply_id
        uuid topic_id
        uuid user_id
        string vote_type
    }

    forum_reactions {
        uuid id PK
        datetime created_at
        string reaction_type
        uuid reply_id
        uuid topic_id
        uuid user_id
    }

    forum_bookmarks {
        uuid topic_id PK
        uuid user_id PK
        datetime created_at
    }

    forum_follows {
        uuid topic_id PK
        uuid user_id PK
        datetime created_at
    }

    forum_reports {
        uuid id PK
        datetime created_at
        string reason
        uuid reply_id
        uuid reported_user_id
        uuid reporter_user_id
        string resolution_notes
        datetime resolved_at
        uuid resolved_by_id
        string status
        uuid topic_id
    }

    forum_reputations {
        uuid user_id PK
        int points
        datetime updated_at
    }

    forum_badges {
        uuid id PK
        datetime created_at
        string criteria_code
        string description
        string icon_name
        string name
    }

    forum_user_badges {
        uuid user_id PK
        uuid badge_id PK
        datetime awarded_at
    }

    forum_moderation_logs {
        uuid id PK
        string action
        datetime created_at
        uuid moderator_id
        string reason
        uuid target_id
        string target_type
    }

    forum_topic_histories {
        uuid id PK
        string content
        datetime edited_at
        uuid edited_by_id
        string title
        uuid topic_id
    }

    forum_reply_histories {
        uuid id PK
        string content
        datetime edited_at
        uuid edited_by_id
        uuid reply_id
    }

    forum_topics ||--o{ forum_bookmarks : relates_to
    users {
        string id PK
    }

    users ||--o{ forum_bookmarks : refers_to
    organizations {
        string id PK
    }

    organizations ||--o{ forum_categories : refers_to
    forum_categories ||--o{ forum_category_moderators : relates_to
    users ||--o{ forum_category_moderators : refers_to
    forum_topics ||--o{ forum_follows : relates_to
    users ||--o{ forum_follows : refers_to
    users ||--o{ forum_moderation_logs : refers_to
    forum_replies ||--o{ forum_reactions : relates_to
    forum_topics ||--o{ forum_reactions : relates_to
    users ||--o{ forum_reactions : refers_to
    users ||--o{ forum_replies : refers_to
    forum_replies ||--o{ forum_replies : relates_to
    forum_topics ||--o{ forum_replies : relates_to
    users ||--o{ forum_reply_histories : refers_to
    forum_replies ||--o{ forum_reply_histories : relates_to
    forum_replies ||--o{ forum_reports : relates_to
    users ||--o{ forum_reports : refers_to
    forum_topics ||--o{ forum_reports : relates_to
    users ||--o{ forum_reputations : refers_to
    users ||--o{ forum_topics : refers_to
    forum_categories ||--o{ forum_topics : relates_to
    organizations ||--o{ forum_topics : refers_to
    users ||--o{ forum_topic_histories : refers_to
    forum_topics ||--o{ forum_topic_histories : relates_to
    forum_tags ||--o{ forum_topic_tags : relates_to
    forum_topics ||--o{ forum_topic_tags : relates_to
    forum_badges ||--o{ forum_user_badges : relates_to
    users ||--o{ forum_user_badges : refers_to
    forum_replies ||--o{ forum_votes : relates_to
    forum_topics ||--o{ forum_votes : relates_to
    users ||--o{ forum_votes : refers_to
```

---

<a id="audit_security_messaging"></a>
## 9. Audit, Security Telemetry & Messaging

*Immutable audit logs, security event telemetry, SOC incidents, in-app notifications, and outbox messaging.* (`12 tables`)

```mermaid
erDiagram

    outbox_messages {
        uuid id PK
        datetime created_at
        string error
        string payload
        datetime processed_at
        string type
    }

    audit_logs {
        uuid id PK
        uuid actor_user_id
        string anonymized_actor_hash
        string browser
        int category
        string client_app
        uuid correlation_id
        datetime created_at
        string description
        json details_json
        string device
        string event_type
        string http_method
        string http_path
        string ip_address
        boolean is_legacy_security_event
        json new_state_json
        json old_state_json
        uuid organization_id
        uuid request_id
        string resource_display_name
        uuid resource_id
        string resource_type
        uuid scope_id
        string scope_type
        string target_role_name
        uuid target_user_id
        string user_agent
        uuid user_id
    }

    conversations {
        uuid id PK
        datetime created_at
        string title
        datetime updated_at
        uuid user_id
    }

    messages {
        uuid id PK
        string content
        uuid conversation_id
        datetime created_at
        string role
        string streaming_state
    }

    activity_events {
        uuid id PK
        uuid actor_user_id
        uuid causation_id
        uuid correlation_id
        datetime created_at
        string event_type
        boolean is_projected
        uuid organization_id
        json payload_json
        uuid resource_id
        string resource_type
        string visibility
    }

    in_app_notifications {
        uuid id PK
        uuid activity_event_id
        string aggregate_key
        datetime created_at
        datetime deleted_at
        boolean is_aggregated
        boolean is_read
        string notification_type
        json payload_json
        datetime read_at
        uuid resource_id
        string resource_type
        uuid user_id
    }

    notification_preferences {
        uuid id PK
        string channel
        boolean is_enabled
        string notification_type
        datetime updated_at
        uuid user_id
    }

    security_events {
        uuid id PK
        uuid actor_user_id
        uuid assigned_to_user_id
        string browser
        string category
        int confidence_score
        uuid correlation_id
        string country_code
        datetime created_at
        string description
        json details_json
        string device
        string event_type
        uuid incident_id
        string ip_address
        int occurrence_count
        uuid organization_id
        int risk_score
        uuid session_id
        string severity
        string status
        uuid target_user_id
        datetime updated_at
    }

    security_incidents {
        uuid id PK
        uuid assigned_to_user_id
        datetime created_at
        string description
        string severity
        string status
        string title
        datetime updated_at
    }

    security_event_comments {
        uuid id PK
        uuid author_user_id
        string comment_text
        datetime created_at
        uuid security_event_id
        uuid security_incident_id
    }

    security_rules {
        uuid id PK
        string code
        json configuration_json
        datetime created_at
        string description
        boolean is_enabled
        string name
        string severity
        datetime updated_at
    }

    seeding_history {
        string module_id PK
        datetime applied_at_utc
        int duration_ms
        string environment_name
        int records_affected
        string version
    }

    users {
        string id PK
    }

    users ||--o{ conversations : refers_to
    conversations ||--o{ messages : relates_to
    users ||--o{ activity_events : refers_to
    organizations {
        string id PK
    }

    organizations ||--o{ activity_events : refers_to
    users ||--o{ audit_logs : refers_to
    organizations ||--o{ audit_logs : refers_to
    activity_events ||--o{ in_app_notifications : relates_to
    users ||--o{ in_app_notifications : refers_to
    users ||--o{ notification_preferences : refers_to
    users ||--o{ security_events : refers_to
    security_incidents ||--o{ security_events : relates_to
    organizations ||--o{ security_events : refers_to
    users ||--o{ security_event_comments : refers_to
    security_events ||--o{ security_event_comments : relates_to
    security_incidents ||--o{ security_event_comments : relates_to
    users ||--o{ security_incidents : refers_to
```

---

<a id="administration"></a>
## 10. System Administration & Staff

*Super-administrative staff accounts, admin invitations, and pre-assigned administrative role mappings.* (`3 tables`)

```mermaid
erDiagram

    admin_members {
        uuid id PK
        uuid assigned_by_user_id
        datetime joined_at
        int session_version
        string status
        datetime updated_at
        uuid user_id
    }

    admin_invitations {
        uuid id PK
        datetime accepted_at
        uuid consumed_by_user_id
        datetime created_at
        datetime expires_at
        uuid invited_by_user_id
        string invitee_email
        string status
        string token_hash
    }

    admin_invitation_roles {
        uuid id PK
        uuid invitation_id
        uuid role_id
    }

    users {
        string id PK
    }

    users ||--o{ admin_invitations : refers_to
    admin_invitations ||--o{ admin_invitation_roles : relates_to
    roles {
        string id PK
    }

    roles ||--o{ admin_invitation_roles : refers_to
    users ||--o{ admin_members : refers_to
```

---

<a id="platform_orchestration_ai"></a>
## 11. Platform Orchestration & AI Engine

*Background pipeline job scheduling, durable workflow tasks, AI prompt deployments, artifact registry, and token streaming.* (`12 tables`)

```mermaid
erDiagram

    pipeline_jobs {
        uuid id PK
        datetime completed_at
        datetime created_at_utc
        float cumulative_cost_usd
        string error_message
        datetime last_updated_at_utc
        float max_budget_usd
        string pipeline_type
        float progress
        uuid reference_id
        int retry_count
        datetime started_at
        string status
    }

    pipeline_tasks {
        uuid id PK
        datetime completed_at
        float cost_usd
        datetime created_at_utc
        string error_details
        uuid job_id
        datetime last_updated_at_utc
        datetime lease_expires_at
        int retry_count
        datetime started_at
        string status
        string task_identifier
        string task_name
        string worker_id
    }

    pipeline_executions {
        uuid id PK
        datetime completed_at
        datetime created_at_utc
        float cumulative_cost_usd
        string current_step
        string error_message
        datetime last_updated_at_utc
        float max_budget_usd
        string model_name
        string pipeline_type
        string pipeline_version
        float progress
        string provider
        uuid reference_id
        int retry_count
        datetime started_at
        string status
        int total_input_tokens
        int total_output_tokens
        uuid user_id
        uuid workspace_id
    }

    pipeline_stages {
        uuid id PK
        datetime completed_at
        string description
        json details_json
        int duration_ms
        uuid execution_id
        string parent_stage_id
        float progress
        int retry_count
        string stage_id
        string stage_name
        datetime started_at
        string status
    }

    pipeline_tasks_durable {
        uuid id PK
        int cache_read_tokens
        int cache_write_tokens
        datetime completed_at
        int completion_tokens
        datetime created_at_utc
        int duration_ms
        string error_message
        float estimated_cost_usd
        uuid execution_id
        json metadata_json
        string model_name
        float progress
        int prompt_tokens
        int retry_count
        datetime started_at
        string status
        string task_identifier
        string task_name
    }

    pipeline_events_durable {
        uuid id PK
        string component
        uuid correlation_id
        uuid execution_id
        string log_level
        string message
        json metadata_json
        string stage_id
        datetime timestamp
    }

    prompt_deployments {
        string prompt_id PK
        string active_version
        string sha256hash
        datetime updated_at_utc
    }

    artifact_registry_entries {
        uuid id PK
        string artifact_id
        string checksum
        datetime created_at_utc
        uuid job_id
        string metadata_json
        string name
        string storage_path
    }

    ai_streaming_sessions {
        uuid id PK
        datetime completed_at
        datetime created_at_utc
        string current_step
        string error_message
        json expected_outputs
        datetime last_updated_utc
        string model_name
        string pipeline_id
        string pipeline_version
        float progress
        string provider
        datetime started_at
        string status
        json summary_data
        float total_cost_usd
        int total_input_tokens
        int total_output_tokens
        uuid user_id
        uuid workspace_id
    }

    ai_streaming_stages {
        uuid id PK
        datetime completed_at
        string description
        json details
        int duration_ms
        string parent_stage_id
        float progress
        int retry_count
        uuid session_id
        string stage_id
        string stage_name
        datetime started_at
        string status
    }

    ai_streaming_logs {
        uuid id PK
        string component
        string log_level
        string message
        uuid session_id
        string stage_id
        datetime timestamp
    }

    ai_streaming_metrics {
        uuid id PK
        string metric_name
        float metric_value
        uuid session_id
        string stage_id
        datetime timestamp
    }

    ai_streaming_sessions ||--o{ ai_streaming_logs : relates_to
    ai_streaming_sessions ||--o{ ai_streaming_metrics : relates_to
    users {
        string id PK
    }

    users ||--o{ ai_streaming_sessions : refers_to
    workspaces {
        string id PK
    }

    workspaces ||--o{ ai_streaming_sessions : refers_to
    ai_streaming_sessions ||--o{ ai_streaming_stages : relates_to
    pipeline_executions ||--o{ pipeline_events_durable : relates_to
    users ||--o{ pipeline_executions : refers_to
    workspaces ||--o{ pipeline_executions : refers_to
    pipeline_executions ||--o{ pipeline_stages : relates_to
    pipeline_executions ||--o{ pipeline_tasks_durable : relates_to
    pipeline_jobs ||--o{ pipeline_tasks : relates_to
```

---
