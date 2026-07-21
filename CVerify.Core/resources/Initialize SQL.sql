--
-- PostgreSQL database dump
--

-- Dumped from database version 16.2 (Debian 16.2-1.pgdg120+2)
-- Dumped by pg_dump version 16.2 (Debian 16.2-1.pgdg120+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: user_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_status AS ENUM (
    'EMAIL_VERIFY_PENDING',
    'ACTIVE',
    'SUSPENDED',
    'BANNED',
    'DELETION_PENDING',
    'DELETED'
);


ALTER TYPE public.user_status OWNER TO postgres;

--
-- Name: fn_update_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$;


ALTER FUNCTION public.fn_update_timestamp() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __EFMigrationsHistory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."__EFMigrationsHistory" (
    migration_id character varying(150) NOT NULL,
    product_version character varying(32) NOT NULL
);


ALTER TABLE public."__EFMigrationsHistory" OWNER TO postgres;

--
-- Name: academic_achievements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.academic_achievements (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    issuer character varying(255) NOT NULL,
    issue_date timestamp with time zone NOT NULL,
    description text NOT NULL,
    credential_url character varying(255),
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.academic_achievements OWNER TO postgres;

--
-- Name: activity_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_events (
    id uuid NOT NULL,
    correlation_id uuid NOT NULL,
    causation_id uuid,
    organization_id uuid,
    actor_user_id uuid,
    event_type character varying(100) NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id uuid,
    visibility character varying(30) NOT NULL,
    is_projected boolean NOT NULL,
    payload_json jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.activity_events OWNER TO postgres;

--
-- Name: admin_invitation_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_invitation_roles (
    id uuid NOT NULL,
    invitation_id uuid NOT NULL,
    role_id uuid NOT NULL
);


ALTER TABLE public.admin_invitation_roles OWNER TO postgres;

--
-- Name: admin_invitations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_invitations (
    id uuid NOT NULL,
    invitee_email public.citext NOT NULL,
    token_hash character varying(64) NOT NULL,
    invited_by_user_id uuid,
    status character varying(30) DEFAULT 'Pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    consumed_by_user_id uuid
);


ALTER TABLE public.admin_invitations OWNER TO postgres;

--
-- Name: admin_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_members (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    status character varying(50) DEFAULT 'Active'::character varying NOT NULL,
    session_version integer DEFAULT 1 NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by_user_id uuid
);


ALTER TABLE public.admin_members OWNER TO postgres;

--
-- Name: ai_inferred_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_inferred_preferences (
    user_id uuid NOT NULL,
    inferred_primary_role character varying(100),
    inferred_seniority character varying(50),
    inferred_skills character varying(100)[] DEFAULT ARRAY[]::character varying[] NOT NULL,
    inferred_salary_min numeric(18,2),
    inferred_salary_max numeric(18,2),
    inferred_salary_currency character varying(10) DEFAULT 'USD'::character varying,
    inferred_industries character varying(100)[] DEFAULT ARRAY[]::character varying[] NOT NULL,
    confidence_score numeric(5,2) DEFAULT 0.00 NOT NULL,
    synthesis_rationale text,
    version integer DEFAULT 1 NOT NULL,
    last_analyzed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.ai_inferred_preferences OWNER TO postgres;

--
-- Name: ai_streaming_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_streaming_logs (
    id uuid NOT NULL,
    session_id uuid NOT NULL,
    stage_id character varying(100),
    log_level character varying(20) NOT NULL,
    component character varying(100),
    message text NOT NULL,
    "timestamp" timestamp with time zone NOT NULL
);


ALTER TABLE public.ai_streaming_logs OWNER TO postgres;

--
-- Name: ai_streaming_metrics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_streaming_metrics (
    id uuid NOT NULL,
    session_id uuid NOT NULL,
    stage_id character varying(100),
    metric_name character varying(100) NOT NULL,
    metric_value double precision NOT NULL,
    "timestamp" timestamp with time zone NOT NULL
);


ALTER TABLE public.ai_streaming_metrics OWNER TO postgres;

--
-- Name: ai_streaming_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_streaming_sessions (
    id uuid NOT NULL,
    pipeline_id character varying(100) NOT NULL,
    user_id uuid,
    workspace_id uuid,
    status character varying(50) NOT NULL,
    progress double precision NOT NULL,
    current_step character varying(100),
    model_name character varying(100),
    provider character varying(100),
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    total_cost_usd numeric(10,6),
    total_input_tokens integer,
    total_output_tokens integer,
    error_message character varying(2000),
    summary_data jsonb,
    expected_outputs jsonb,
    pipeline_version character varying(50) NOT NULL,
    created_at_utc timestamp with time zone NOT NULL,
    last_updated_utc timestamp with time zone NOT NULL
);


ALTER TABLE public.ai_streaming_sessions OWNER TO postgres;

--
-- Name: ai_streaming_stages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_streaming_stages (
    id uuid NOT NULL,
    session_id uuid NOT NULL,
    stage_id character varying(100) NOT NULL,
    stage_name character varying(200) NOT NULL,
    parent_stage_id character varying(100),
    status character varying(50) NOT NULL,
    progress double precision NOT NULL,
    description character varying(1000),
    details jsonb,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    duration_ms bigint,
    retry_count integer NOT NULL
);


ALTER TABLE public.ai_streaming_stages OWNER TO postgres;

--
-- Name: analysis_executions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.analysis_executions (
    id uuid NOT NULL,
    job_id uuid NOT NULL,
    task_id uuid NOT NULL,
    user_id uuid NOT NULL,
    execution_type character varying(50) DEFAULT 'LLM_CALL'::character varying NOT NULL,
    provider character varying(50) NOT NULL,
    model character varying(100) NOT NULL,
    prompt_tokens integer NOT NULL,
    completion_tokens integer NOT NULL,
    total_tokens integer NOT NULL,
    cached_tokens integer NOT NULL,
    estimated_cost_usd numeric(10,6) NOT NULL,
    duration_ms bigint NOT NULL,
    created_at_utc timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.analysis_executions OWNER TO postgres;

--
-- Name: analysis_job_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.analysis_job_events (
    id uuid NOT NULL,
    job_id uuid NOT NULL,
    step character varying(100) NOT NULL,
    progress double precision NOT NULL,
    message character varying(2000) NOT NULL,
    created_at_utc timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.analysis_job_events OWNER TO postgres;

--
-- Name: analysis_jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.analysis_jobs (
    id uuid NOT NULL,
    repository_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status character varying(50) DEFAULT 'Queued'::character varying NOT NULL,
    progress double precision DEFAULT 0.0 NOT NULL,
    current_step character varying(100),
    commit_sha character varying(100),
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    error_message character varying(2000),
    created_at_utc timestamp with time zone DEFAULT now() NOT NULL,
    last_updated_utc timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.analysis_jobs OWNER TO postgres;

--
-- Name: analysis_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.analysis_reports (
    id uuid NOT NULL,
    job_id uuid NOT NULL,
    repository_id uuid NOT NULL,
    report_data jsonb NOT NULL,
    created_at_utc timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.analysis_reports OWNER TO postgres;

--
-- Name: analysis_task_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.analysis_task_events (
    id uuid NOT NULL,
    task_id uuid NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    level character varying(20) DEFAULT 'Info'::character varying NOT NULL,
    event_type character varying(50) NOT NULL,
    message character varying(2000) NOT NULL,
    metadata jsonb
);


ALTER TABLE public.analysis_task_events OWNER TO postgres;

--
-- Name: analysis_task_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.analysis_task_results (
    task_id uuid NOT NULL,
    schema_version character varying(50) DEFAULT '2.0.0'::character varying NOT NULL,
    result_data jsonb NOT NULL,
    created_at_utc timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.analysis_task_results OWNER TO postgres;

--
-- Name: analysis_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.analysis_tasks (
    id uuid NOT NULL,
    job_id uuid NOT NULL,
    task_type character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'Queued'::character varying NOT NULL,
    progress double precision DEFAULT 0.0 NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    duration_ms bigint,
    retry_count integer DEFAULT 0 NOT NULL,
    error_message character varying(2000),
    prompt_tokens integer,
    completion_tokens integer,
    cache_read_tokens integer,
    cache_write_tokens integer,
    estimated_cost_usd numeric(10,6),
    model_name character varying(100),
    metadata jsonb,
    created_at_utc timestamp with time zone DEFAULT now() NOT NULL,
    last_updated_utc timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.analysis_tasks OWNER TO postgres;

--
-- Name: approved_recovery_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.approved_recovery_sessions (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    approved_representative character varying(255) NOT NULL,
    verified_recovery_email character varying(255) NOT NULL,
    recovery_token_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    approved_by character varying(100) NOT NULL,
    suggested_strategy character varying(50) NOT NULL,
    is_consumed boolean DEFAULT false NOT NULL,
    used_at timestamp with time zone,
    used_by_ip character varying(45),
    used_by_device character varying(500),
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.approved_recovery_sessions OWNER TO postgres;

--
-- Name: artifact_registry_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.artifact_registry_entries (
    id uuid NOT NULL,
    job_id uuid NOT NULL,
    artifact_id text NOT NULL,
    name text NOT NULL,
    checksum text NOT NULL,
    storage_path text NOT NULL,
    metadata_json text NOT NULL,
    created_at_utc timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.artifact_registry_entries OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid NOT NULL,
    user_id uuid,
    event_type character varying(100) NOT NULL,
    description text NOT NULL,
    ip_address character varying(45),
    anonymized_actor_hash character varying(64),
    user_agent character varying(500),
    actor_user_id uuid,
    target_user_id uuid,
    organization_id uuid,
    target_role_name character varying(50),
    scope_type character varying(30),
    scope_id uuid,
    details_json jsonb,
    old_state_json jsonb,
    new_state_json jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    browser character varying(50),
    category integer DEFAULT 0 NOT NULL,
    client_app character varying(50),
    correlation_id uuid,
    device character varying(50),
    http_method character varying(10),
    http_path character varying(200),
    is_legacy_security_event boolean DEFAULT false NOT NULL,
    request_id uuid,
    resource_display_name character varying(200),
    resource_id uuid,
    resource_type character varying(50)
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: auth_providers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auth_providers (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    provider_name character varying(50) NOT NULL,
    provider_key character varying(255) NOT NULL,
    provider_account_id character varying(100),
    provider_username character varying(255),
    provider_avatar_url character varying(500),
    granted_scopes character varying(500),
    last_scope_validation_at timestamp with time zone,
    scope_validation_status integer DEFAULT 0 NOT NULL,
    last_successful_refresh_at timestamp with time zone,
    refresh_failure_count integer DEFAULT 0 NOT NULL,
    last_provider_sync_at timestamp with time zone,
    sync_status character varying(50) DEFAULT 'Pending'::character varying NOT NULL,
    sync_error text,
    encrypted_access_token character varying(1000),
    encrypted_refresh_token character varying(1000),
    expires_at timestamp with time zone,
    token_updated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    provider_display_name character varying(255),
    provider_profile_url character varying(500)
);


ALTER TABLE public.auth_providers OWNER TO postgres;

--
-- Name: business_outcomes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.business_outcomes (
    id uuid NOT NULL,
    hiring_requirement_id uuid NOT NULL,
    text character varying(1000) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.business_outcomes OWNER TO postgres;

--
-- Name: candidate_assessment_artifacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_assessment_artifacts (
    id uuid NOT NULL,
    assessment_id uuid NOT NULL,
    artifact_type character varying(100) NOT NULL,
    json_data text NOT NULL,
    created_at_utc timestamp with time zone NOT NULL
);


ALTER TABLE public.candidate_assessment_artifacts OWNER TO postgres;

--
-- Name: candidate_assessments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_assessments (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    cv_id uuid,
    status character varying(50) NOT NULL,
    overall_score double precision NOT NULL,
    career_level character varying(20),
    career_level_label character varying(50),
    primary_tendency character varying(50),
    primary_working_style character varying(50),
    summary_headline character varying(500),
    summary_paragraph character varying(2000),
    pipeline_version character varying(20) NOT NULL,
    assessment_schema_version character varying(20) NOT NULL,
    prompt_version character varying(50),
    model_version character varying(100),
    last_profile_update_at timestamp with time zone NOT NULL,
    last_repository_analysis_at timestamp with time zone NOT NULL,
    last_assessment_at timestamp with time zone,
    failed_stage character varying(100),
    failure_reason text,
    version integer NOT NULL,
    created_at_utc timestamp with time zone NOT NULL,
    completed_at_utc timestamp with time zone,
    execution_strength double precision DEFAULT 0.0 NOT NULL,
    leadership_potential double precision DEFAULT 0.0 NOT NULL,
    technical_breadth double precision DEFAULT 0.0 NOT NULL,
    technical_depth double precision DEFAULT 0.0 NOT NULL,
    trust_level double precision DEFAULT 0.0 NOT NULL,
    calculation_mode character varying(50),
    input_feature_set_hash character varying(100),
    evidence_completeness character varying(50),
    clone_risk_classification character varying(50),
    professional_bio character varying(1000)
);


ALTER TABLE public.candidate_assessments OWNER TO postgres;

--
-- Name: candidate_best_fit_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_best_fit_roles (
    id uuid NOT NULL,
    candidate_assessment_id uuid NOT NULL,
    role_title character varying(100) NOT NULL,
    match_score double precision NOT NULL,
    confidence double precision NOT NULL,
    rank integer NOT NULL,
    matching_engine_version character varying(20) NOT NULL,
    evidence jsonb,
    engine_metadata jsonb
);


ALTER TABLE public.candidate_best_fit_roles OWNER TO postgres;

--
-- Name: candidate_capabilities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_capabilities (
    id uuid NOT NULL,
    candidate_id uuid NOT NULL,
    capability_node_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.candidate_capabilities OWNER TO postgres;

--
-- Name: candidate_capability_evidences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_capability_evidences (
    candidate_capability_id uuid NOT NULL,
    evidence_artifact_id uuid NOT NULL,
    added_at timestamp with time zone NOT NULL
);


ALTER TABLE public.candidate_capability_evidences OWNER TO postgres;

--
-- Name: candidate_capability_histories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_capability_histories (
    id uuid NOT NULL,
    candidate_capability_id uuid NOT NULL,
    proficiency_score double precision NOT NULL,
    recorded_at timestamp with time zone NOT NULL
);


ALTER TABLE public.candidate_capability_histories OWNER TO postgres;

--
-- Name: candidate_capability_projections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_capability_projections (
    candidate_id uuid NOT NULL,
    capabilities_json jsonb NOT NULL,
    projected_at timestamp with time zone NOT NULL
);


ALTER TABLE public.candidate_capability_projections OWNER TO postgres;

--
-- Name: candidate_capability_scores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_capability_scores (
    candidate_capability_id uuid NOT NULL,
    expertise_level character varying(50) NOT NULL,
    proficiency_score double precision NOT NULL,
    recency_index double precision NOT NULL,
    calculated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.candidate_capability_scores OWNER TO postgres;

--
-- Name: candidate_discovery_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_discovery_runs (
    id uuid NOT NULL,
    hiring_requirement_id uuid NOT NULL,
    triggered_by_id uuid,
    started_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone,
    status integer NOT NULL,
    candidates_found_count integer NOT NULL,
    match_quality_summary character varying(500),
    error_message text,
    raw_results_json text
);


ALTER TABLE public.candidate_discovery_runs OWNER TO postgres;

--
-- Name: candidate_domain_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_domain_profiles (
    id uuid NOT NULL,
    candidate_assessment_id uuid NOT NULL,
    domain_name character varying(100) NOT NULL,
    score double precision NOT NULL,
    confidence double precision NOT NULL,
    seniority character varying(50) NOT NULL,
    supporting_evidence jsonb
);


ALTER TABLE public.candidate_domain_profiles OWNER TO postgres;

--
-- Name: candidate_evaluation_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_evaluation_snapshots (
    candidate_id uuid NOT NULL,
    profile_completeness double precision NOT NULL,
    identity_trust_score double precision NOT NULL,
    evidence_trust_score double precision NOT NULL,
    verification_state character varying(50) NOT NULL,
    evaluated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.candidate_evaluation_snapshots OWNER TO postgres;

--
-- Name: candidate_intelligence_signals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_intelligence_signals (
    id uuid NOT NULL,
    candidate_assessment_id uuid NOT NULL,
    scope_signal double precision NOT NULL,
    complexity_signal double precision NOT NULL,
    ownership_signal double precision NOT NULL,
    leadership_signal double precision NOT NULL,
    consistency_signal double precision NOT NULL,
    delivery_signal double precision NOT NULL,
    engineering_maturity_signal double precision NOT NULL,
    problem_solving_signal double precision NOT NULL,
    last_updated_utc timestamp with time zone NOT NULL
);


ALTER TABLE public.candidate_intelligence_signals OWNER TO postgres;

--
-- Name: candidate_match_projections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_match_projections (
    candidate_id uuid NOT NULL,
    profile_summary character varying(1000),
    normalized_capabilities uuid[] NOT NULL,
    last_projected_at timestamp with time zone NOT NULL
);


ALTER TABLE public.candidate_match_projections OWNER TO postgres;

--
-- Name: candidate_ranking_projections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_ranking_projections (
    candidate_id uuid NOT NULL,
    full_name character varying(255) NOT NULL,
    username character varying(32),
    bio character varying(500),
    headline character varying(255),
    location character varying(100),
    avatar_url character varying(1000),
    composite_score double precision NOT NULL,
    ai_score double precision NOT NULL,
    trust_score double precision NOT NULL,
    profile_completeness double precision NOT NULL,
    evidence_trust_score double precision NOT NULL,
    verified_repo_count integer NOT NULL,
    total_stars_count integer NOT NULL,
    total_forks_count integer NOT NULL,
    verified_contribution_count integer NOT NULL,
    top_capabilities_json jsonb,
    primary_domain character varying(100),
    career_level_label character varying(50),
    followers_count integer NOT NULL,
    following_count integer NOT NULL,
    available_for_hire boolean NOT NULL,
    open_to_work_status character varying(20) NOT NULL,
    global_rank_position integer NOT NULL,
    previous_global_rank_position integer NOT NULL,
    last_updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.candidate_ranking_projections OWNER TO postgres;

--
-- Name: candidate_search_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_search_profiles (
    candidate_id uuid NOT NULL,
    full_name character varying(255) NOT NULL,
    headline character varying(255),
    location character varying(100),
    trust_score integer NOT NULL,
    trust_tier character varying(30) NOT NULL,
    capabilities_json jsonb NOT NULL,
    search_embedding real[] NOT NULL,
    last_projected_at timestamp with time zone NOT NULL
);


ALTER TABLE public.candidate_search_profiles OWNER TO postgres;

--
-- Name: candidate_skill_tree_nodes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_skill_tree_nodes (
    id uuid NOT NULL,
    candidate_assessment_id uuid NOT NULL,
    parent_id uuid,
    display_name character varying(100) NOT NULL,
    category character varying(100) NOT NULL,
    proficiency_level character varying(50) NOT NULL,
    confidence_score double precision NOT NULL,
    estimated_experience_months double precision NOT NULL,
    supporting_evidence jsonb
);


ALTER TABLE public.candidate_skill_tree_nodes OWNER TO postgres;

--
-- Name: candidate_skills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_skills (
    id uuid NOT NULL,
    candidate_assessment_id uuid NOT NULL,
    skill_name character varying(100) NOT NULL,
    score double precision NOT NULL,
    confidence double precision NOT NULL,
    level character varying(50) NOT NULL,
    evidence_sources jsonb,
    normalization_source character varying(50),
    original_name character varying(100),
    pipeline_trace_id character varying(100),
    skill_id character varying(100) DEFAULT ''::character varying NOT NULL,
    taxonomy_version character varying(20) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE public.candidate_skills OWNER TO postgres;

--
-- Name: candidate_strengths_weaknesses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_strengths_weaknesses (
    id uuid NOT NULL,
    candidate_assessment_id uuid NOT NULL,
    finding_type character varying(20) NOT NULL,
    topic character varying(150) NOT NULL,
    description character varying(1000) NOT NULL,
    evidence jsonb
);


ALTER TABLE public.candidate_strengths_weaknesses OWNER TO postgres;

--
-- Name: candidate_trust_projections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_trust_projections (
    candidate_id uuid NOT NULL,
    trust_profile_id uuid NOT NULL,
    aggregate_score integer NOT NULL,
    trust_tier character varying(30) NOT NULL,
    last_updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.candidate_trust_projections OWNER TO postgres;

--
-- Name: canonical_skill_aliases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.canonical_skill_aliases (
    alias_name character varying(100) NOT NULL,
    skill_id character varying(100) NOT NULL,
    taxonomy_version character varying(20) NOT NULL
);


ALTER TABLE public.canonical_skill_aliases OWNER TO postgres;

--
-- Name: canonical_skills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.canonical_skills (
    skill_id character varying(100) NOT NULL,
    taxonomy_version character varying(20) NOT NULL,
    display_name character varying(100) NOT NULL,
    sfia_category character varying(100) NOT NULL,
    onet_code character varying(20) NOT NULL,
    status character varying(20) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.canonical_skills OWNER TO postgres;

--
-- Name: capability_aliases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.capability_aliases (
    alias_name character varying(100) NOT NULL,
    canonical_id character varying(100) NOT NULL
);


ALTER TABLE public.capability_aliases OWNER TO postgres;

--
-- Name: capability_catalog_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.capability_catalog_items (
    capability_id character varying(100) NOT NULL,
    display_name character varying(255) NOT NULL,
    category character varying(100) NOT NULL,
    description character varying(1000) NOT NULL,
    skills text[] NOT NULL,
    expected_evidence text[] NOT NULL,
    workspace_id uuid,
    status character varying(20) NOT NULL,
    is_custom boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.capability_catalog_items OWNER TO postgres;

--
-- Name: capability_edges; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.capability_edges (
    source_node_id uuid NOT NULL,
    target_node_id uuid NOT NULL,
    relationship_type character varying(50) NOT NULL,
    weight double precision NOT NULL
);


ALTER TABLE public.capability_edges OWNER TO postgres;

--
-- Name: capability_hierarchies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.capability_hierarchies (
    parent_id character varying(100) NOT NULL,
    child_id character varying(100) NOT NULL
);


ALTER TABLE public.capability_hierarchies OWNER TO postgres;

--
-- Name: capability_nodes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.capability_nodes (
    id uuid NOT NULL,
    name character varying(150) NOT NULL,
    slug character varying(150) NOT NULL,
    description character varying(1000),
    category character varying(50) NOT NULL,
    vector_embedding real[],
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.capability_nodes OWNER TO postgres;

--
-- Name: capability_registries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.capability_registries (
    capability_id character varying(100) NOT NULL,
    display_name character varying(255) NOT NULL,
    category character varying(100) NOT NULL,
    description character varying(1000) NOT NULL,
    taxonomy_version character varying(50) NOT NULL,
    capability_version character varying(20) NOT NULL,
    status character varying(30) NOT NULL,
    deprecated_by_id character varying(100),
    effective_date timestamp with time zone NOT NULL,
    migration_mappings jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.capability_registries OWNER TO postgres;

--
-- Name: career_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.career_preferences (
    user_id uuid NOT NULL,
    available_for_hire boolean DEFAULT true NOT NULL,
    preferred_language character varying(10) DEFAULT 'en'::character varying NOT NULL,
    job_title_preferences character varying(255),
    salary_expectations numeric(18,2),
    remote_preference character varying(20),
    open_to_work_status character varying(20) DEFAULT 'casual'::character varying NOT NULL,
    preferred_locations character varying(100)[] DEFAULT ARRAY[]::character varying[] NOT NULL,
    employment_preferences character varying(50)[] DEFAULT ARRAY[]::character varying[] NOT NULL,
    preferred_work_environments character varying(100)[] DEFAULT ARRAY[]::character varying[] NOT NULL,
    work_styles character varying(100)[] DEFAULT ARRAY[]::character varying[] NOT NULL,
    company_values character varying(100)[] DEFAULT ARRAY[]::character varying[] NOT NULL,
    desired_job_positions character varying(100)[] DEFAULT ARRAY[]::character varying[] NOT NULL,
    expected_salary_min numeric(18,2),
    expected_salary_max numeric(18,2),
    expected_salary_currency character varying(10),
    expected_salary_type character varying(20),
    expected_salary_negotiable boolean DEFAULT false NOT NULL,
    is_expected_salary_visible boolean DEFAULT false NOT NULL,
    work_preference_notes text,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    open_to_relocation boolean DEFAULT false NOT NULL,
    leadership_track character varying(30) DEFAULT 'undecided'::character varying NOT NULL,
    company_stage_preferences character varying(50)[] DEFAULT ARRAY[]::character varying[] NOT NULL,
    preferred_industries character varying(100)[] DEFAULT ARRAY[]::character varying[] NOT NULL,
    target_skills character varying(100)[] DEFAULT ARRAY[]::character varying[] NOT NULL
);


ALTER TABLE public.career_preferences OWNER TO postgres;

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    title character varying(255) DEFAULT 'New Conversation'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- Name: cv_repository_mappings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cv_repository_mappings (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    source_code_repository_id uuid NOT NULL,
    reference_source character varying(50) NOT NULL,
    reference_entity_id uuid,
    indexed_at_utc timestamp with time zone NOT NULL
);


ALTER TABLE public.cv_repository_mappings OWNER TO postgres;

--
-- Name: education_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.education_entries (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    label character varying(255) NOT NULL,
    school_name character varying(255) NOT NULL,
    degree character varying(255),
    major character varying(255),
    gpa numeric(4,2),
    gpa_scale numeric(4,2),
    description text,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    is_currently_studying boolean DEFAULT false NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.education_entries OWNER TO postgres;

--
-- Name: enterprise_workflow_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.enterprise_workflow_requests (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    request_type character varying(50) NOT NULL,
    status character varying(50) NOT NULL,
    priority character varying(50) NOT NULL,
    metadata_json text NOT NULL,
    assigned_reviewer_id uuid,
    assigned_at timestamp with time zone,
    claimed_at timestamp with time zone,
    due_at timestamp with time zone,
    escalated_to_user_id uuid,
    review_state text,
    row_version bytea NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    resolved_at timestamp with time zone
);


ALTER TABLE public.enterprise_workflow_requests OWNER TO postgres;

--
-- Name: evaluation_rubric_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evaluation_rubric_snapshots (
    requirement_snapshot_id uuid NOT NULL,
    capability_weights jsonb,
    scoring_rules jsonb,
    evidence_requirements jsonb,
    snapshotted_at timestamp with time zone NOT NULL
);


ALTER TABLE public.evaluation_rubric_snapshots OWNER TO postgres;

--
-- Name: evaluation_rubrics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evaluation_rubrics (
    id uuid NOT NULL,
    hiring_requirement_id uuid NOT NULL,
    capability_weights jsonb,
    scoring_rules jsonb,
    evidence_requirements jsonb,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.evaluation_rubrics OWNER TO postgres;

--
-- Name: evidence_artifacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evidence_artifacts (
    id uuid NOT NULL,
    source_id uuid NOT NULL,
    external_identifier character varying(500) NOT NULL,
    artifact_type character varying(50) NOT NULL,
    payload jsonb NOT NULL,
    cryptographic_signature character varying(512),
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.evidence_artifacts OWNER TO postgres;

--
-- Name: evidence_claims; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evidence_claims (
    id uuid NOT NULL,
    candidate_id uuid NOT NULL,
    evidence_artifact_id uuid NOT NULL,
    assertion_type character varying(50) NOT NULL,
    confidence_score double precision NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.evidence_claims OWNER TO postgres;

--
-- Name: evidence_signals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evidence_signals (
    id uuid NOT NULL,
    requirement_capability_id uuid NOT NULL,
    signal_type character varying(100) NOT NULL,
    expected_metric character varying(255) NOT NULL,
    rationale character varying(1000),
    metadata jsonb
);


ALTER TABLE public.evidence_signals OWNER TO postgres;

--
-- Name: evidence_sources; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evidence_sources (
    id uuid NOT NULL,
    name character varying(150) NOT NULL,
    provider_type character varying(50) NOT NULL,
    is_active boolean NOT NULL,
    connection_config jsonb,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.evidence_sources OWNER TO postgres;

--
-- Name: evidence_verifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evidence_verifications (
    id uuid NOT NULL,
    evidence_claim_id uuid NOT NULL,
    verification_type character varying(50) NOT NULL,
    status character varying(30) NOT NULL,
    verification_log jsonb,
    verified_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.evidence_verifications OWNER TO postgres;

--
-- Name: external_organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.external_organizations (
    id uuid NOT NULL,
    auth_provider_id uuid NOT NULL,
    external_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    login character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    avatar_url character varying(1000),
    html_url character varying(1000),
    description character varying(2000),
    is_active boolean DEFAULT true NOT NULL,
    last_synced_at timestamp with time zone NOT NULL
);


ALTER TABLE public.external_organizations OWNER TO postgres;

--
-- Name: forum_badges; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.forum_badges (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(500) NOT NULL,
    icon_name character varying(50) NOT NULL,
    criteria_code character varying(100) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.forum_badges OWNER TO postgres;

--
-- Name: forum_bookmarks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.forum_bookmarks (
    topic_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.forum_bookmarks OWNER TO postgres;

--
-- Name: forum_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.forum_categories (
    id uuid NOT NULL,
    organization_id uuid,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    description character varying(500),
    icon_name character varying(50),
    display_order integer NOT NULL,
    is_private boolean NOT NULL,
    is_archived boolean NOT NULL,
    required_role character varying(50),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.forum_categories OWNER TO postgres;

--
-- Name: forum_category_moderators; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.forum_category_moderators (
    category_id uuid NOT NULL,
    user_id uuid NOT NULL,
    assigned_at timestamp with time zone NOT NULL
);


ALTER TABLE public.forum_category_moderators OWNER TO postgres;

--
-- Name: forum_follows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.forum_follows (
    topic_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.forum_follows OWNER TO postgres;

--
-- Name: forum_moderation_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.forum_moderation_logs (
    id uuid NOT NULL,
    moderator_id uuid NOT NULL,
    target_type character varying(50) NOT NULL,
    target_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    reason character varying(500),
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.forum_moderation_logs OWNER TO postgres;

--
-- Name: forum_reactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.forum_reactions (
    id uuid NOT NULL,
    topic_id uuid,
    reply_id uuid,
    user_id uuid NOT NULL,
    reaction_type character varying(50) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.forum_reactions OWNER TO postgres;

--
-- Name: forum_replies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.forum_replies (
    id uuid NOT NULL,
    topic_id uuid NOT NULL,
    author_id uuid NOT NULL,
    parent_reply_id uuid,
    content text NOT NULL,
    quote_text character varying(2000),
    is_accepted_solution boolean NOT NULL,
    score integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.forum_replies OWNER TO postgres;

--
-- Name: forum_reply_histories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.forum_reply_histories (
    id uuid NOT NULL,
    reply_id uuid NOT NULL,
    edited_by_id uuid NOT NULL,
    content text NOT NULL,
    edited_at timestamp with time zone NOT NULL
);


ALTER TABLE public.forum_reply_histories OWNER TO postgres;

--
-- Name: forum_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.forum_reports (
    id uuid NOT NULL,
    topic_id uuid,
    reply_id uuid,
    reported_user_id uuid,
    reporter_user_id uuid NOT NULL,
    reason character varying(500) NOT NULL,
    status character varying(30) NOT NULL,
    resolution_notes character varying(1000),
    created_at timestamp with time zone NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by_id uuid
);


ALTER TABLE public.forum_reports OWNER TO postgres;

--
-- Name: forum_reputations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.forum_reputations (
    user_id uuid NOT NULL,
    points integer NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.forum_reputations OWNER TO postgres;

--
-- Name: forum_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.forum_tags (
    id uuid NOT NULL,
    name character varying(50) NOT NULL,
    slug character varying(50) NOT NULL,
    is_archived boolean NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.forum_tags OWNER TO postgres;

--
-- Name: forum_topic_histories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.forum_topic_histories (
    id uuid NOT NULL,
    topic_id uuid NOT NULL,
    edited_by_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    edited_at timestamp with time zone NOT NULL
);


ALTER TABLE public.forum_topic_histories OWNER TO postgres;

--
-- Name: forum_topic_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.forum_topic_tags (
    topic_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


ALTER TABLE public.forum_topic_tags OWNER TO postgres;

--
-- Name: forum_topics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.forum_topics (
    id uuid NOT NULL,
    category_id uuid NOT NULL,
    organization_id uuid,
    author_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    content text NOT NULL,
    ai_excerpt text,
    view_count integer NOT NULL,
    reply_count integer NOT NULL,
    score integer NOT NULL,
    is_pinned boolean NOT NULL,
    is_locked boolean NOT NULL,
    is_solved boolean NOT NULL,
    is_featured boolean NOT NULL,
    is_archived boolean NOT NULL,
    is_pending_review boolean NOT NULL,
    last_activity_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.forum_topics OWNER TO postgres;

--
-- Name: forum_user_badges; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.forum_user_badges (
    user_id uuid NOT NULL,
    badge_id uuid NOT NULL,
    awarded_at timestamp with time zone NOT NULL
);


ALTER TABLE public.forum_user_badges OWNER TO postgres;

--
-- Name: forum_votes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.forum_votes (
    id uuid NOT NULL,
    topic_id uuid,
    reply_id uuid,
    user_id uuid NOT NULL,
    vote_type character varying(20) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.forum_votes OWNER TO postgres;

--
-- Name: hiring_requirements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hiring_requirements (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    department character varying(100) NOT NULL,
    seniority character varying(50) NOT NULL,
    workplace_type character varying(50) NOT NULL,
    city character varying(100),
    employment_type character varying(50) NOT NULL,
    salary_min numeric,
    salary_max numeric,
    currency character varying(10),
    timezone_range character varying(100),
    degree_requirement character varying(100),
    benefits text[] NOT NULL,
    language_requirements text[] NOT NULL,
    headcount integer NOT NULL,
    status character varying(20) NOT NULL,
    version integer NOT NULL,
    hiring_reason character varying(100),
    business_problem character varying(2000),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    auto_close_rule integer DEFAULT 0 NOT NULL,
    candidates_needed_count integer,
    end_date timestamp with time zone,
    is_manually_closed boolean DEFAULT false NOT NULL,
    is_salary_negotiable boolean DEFAULT false NOT NULL,
    salary_period integer DEFAULT 0 NOT NULL,
    start_date timestamp with time zone
);


ALTER TABLE public.hiring_requirements OWNER TO postgres;

--
-- Name: in_app_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.in_app_notifications (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    activity_event_id uuid,
    notification_type character varying(100) NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id uuid,
    payload_json jsonb,
    is_read boolean NOT NULL,
    is_aggregated boolean NOT NULL,
    aggregate_key character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone,
    deleted_at timestamp with time zone
);


ALTER TABLE public.in_app_notifications OWNER TO postgres;

--
-- Name: interview_blueprint_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.interview_blueprint_snapshots (
    requirement_snapshot_id uuid NOT NULL,
    capability_questions jsonb,
    dimensions jsonb,
    snapshotted_at timestamp with time zone NOT NULL
);


ALTER TABLE public.interview_blueprint_snapshots OWNER TO postgres;

--
-- Name: interview_blueprints; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.interview_blueprints (
    id uuid NOT NULL,
    hiring_requirement_id uuid NOT NULL,
    capability_questions jsonb,
    dimensions jsonb,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.interview_blueprints OWNER TO postgres;

--
-- Name: job_applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_applications (
    id uuid NOT NULL,
    job_vacancy_id uuid NOT NULL,
    candidate_id uuid NOT NULL,
    status character varying(50) NOT NULL,
    gaps_snapshot_json jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    eligibility_snapshot_json jsonb
);


ALTER TABLE public.job_applications OWNER TO postgres;

--
-- Name: job_interactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_interactions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    job_vacancy_id uuid NOT NULL,
    interaction_type character varying(30) NOT NULL,
    interaction_at timestamp with time zone NOT NULL
);


ALTER TABLE public.job_interactions OWNER TO postgres;

--
-- Name: job_vacancies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_vacancies (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    department character varying(100) NOT NULL,
    workplace_type character varying(50) NOT NULL,
    city character varying(100) NOT NULL,
    type character varying(50) NOT NULL,
    salary character varying(100) NOT NULL,
    salary_min_max character varying(100) NOT NULL,
    headcount integer NOT NULL,
    gender character varying(50) NOT NULL,
    experience character varying(100) NOT NULL,
    degree character varying(100) NOT NULL,
    category character varying(200) NOT NULL,
    description text[] DEFAULT ARRAY[]::text[] NOT NULL,
    requirements text[] DEFAULT ARRAY[]::text[] NOT NULL,
    benefits text[] DEFAULT ARRAY[]::text[] NOT NULL,
    tags text[] DEFAULT ARRAY[]::text[] NOT NULL,
    skills text[] DEFAULT ARRAY[]::text[] NOT NULL,
    cover_url character varying(2048) NOT NULL,
    images text[] DEFAULT ARRAY[]::text[] NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    metadata text,
    hiring_requirement_id uuid,
    acquisition_strategy character varying(50) DEFAULT ''::character varying NOT NULL,
    discovery_profile_json jsonb,
    requirement_snapshot_id uuid,
    status character varying(50) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE public.job_vacancies OWNER TO postgres;

--
-- Name: matching_evaluations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.matching_evaluations (
    id uuid NOT NULL,
    job_vacancy_id uuid NOT NULL,
    candidate_id uuid NOT NULL,
    aggregate_score integer NOT NULL,
    confidence_level character varying(30) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.matching_evaluations OWNER TO postgres;

--
-- Name: matching_explanations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.matching_explanations (
    id uuid NOT NULL,
    matching_evaluation_id uuid NOT NULL,
    explanation_type character varying(50) NOT NULL,
    capability_node_id uuid,
    assertion_text text NOT NULL,
    supporting_artifact_id uuid
);


ALTER TABLE public.matching_explanations OWNER TO postgres;

--
-- Name: matching_factors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.matching_factors (
    id uuid NOT NULL,
    matching_evaluation_id uuid NOT NULL,
    factor_name character varying(100) NOT NULL,
    factor_score integer NOT NULL,
    weight double precision NOT NULL
);


ALTER TABLE public.matching_factors OWNER TO postgres;

--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    role character varying(50) NOT NULL,
    content text NOT NULL,
    streaming_state character varying(50) DEFAULT 'Pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_preferences (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    notification_type character varying(100) NOT NULL,
    channel character varying(20) NOT NULL,
    is_enabled boolean NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notification_preferences OWNER TO postgres;

--
-- Name: organization_authorities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_authorities (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(50) NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.organization_authorities OWNER TO postgres;

--
-- Name: organization_candidates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_candidates (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    candidate_id uuid NOT NULL,
    saved_at timestamp with time zone NOT NULL,
    saved_by_id uuid NOT NULL,
    notes text,
    tags text[] NOT NULL,
    hiring_stage character varying(50) NOT NULL,
    recruiter_id uuid
);


ALTER TABLE public.organization_candidates OWNER TO postgres;

--
-- Name: organization_credentials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_credentials (
    organization_id uuid NOT NULL,
    username public.citext NOT NULL,
    password_hash character varying(255) NOT NULL,
    failed_login_attempts integer DEFAULT 0 NOT NULL,
    lockout_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.organization_credentials OWNER TO postgres;

--
-- Name: organization_followers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_followers (
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    followed_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.organization_followers OWNER TO postgres;

--
-- Name: organization_invitation_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_invitation_roles (
    id uuid NOT NULL,
    invitation_id uuid NOT NULL,
    role_id uuid NOT NULL,
    scope_type character varying(30) DEFAULT 'ORGANIZATION'::character varying NOT NULL,
    scope_id uuid NOT NULL
);


ALTER TABLE public.organization_invitation_roles OWNER TO postgres;

--
-- Name: organization_invitations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_invitations (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    invitee_email public.citext NOT NULL,
    token_hash character varying(64) NOT NULL,
    invited_by_user_id uuid,
    status character varying(30) DEFAULT 'Pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    declined_at timestamp with time zone,
    declined_reason character varying(500),
    consumed_by_user_id uuid,
    discovery_notified_at timestamp with time zone
);


ALTER TABLE public.organization_invitations OWNER TO postgres;

--
-- Name: organization_memberships; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_memberships (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.organization_memberships OWNER TO postgres;

--
-- Name: organization_recovery_claims; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_recovery_claims (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    representative_full_name character varying(255) NOT NULL,
    representative_position character varying(255) NOT NULL,
    phone_number character varying(50) NOT NULL,
    recovery_email character varying(255) NOT NULL,
    risk_score integer NOT NULL,
    risk_level character varying(50) NOT NULL,
    suggested_recovery_strategy character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'Pending'::character varying NOT NULL,
    rejection_reason text,
    reviewed_by character varying(100),
    second_reviewer_by character varying(100),
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    document_ocr_metadata text,
    document_suspicious_metadata text,
    workspace_activity_flags text,
    ip_device_flags text,
    historical_claim_flags text,
    documents jsonb DEFAULT '[]'::jsonb NOT NULL
);


ALTER TABLE public.organization_recovery_claims OWNER TO postgres;

--
-- Name: organization_verifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_verifications (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    verification_type character varying(50) NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    verified_value character varying(255),
    verified_at timestamp with time zone,
    verified_by character varying(100),
    metadata text
);


ALTER TABLE public.organization_verifications OWNER TO postgres;

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organizations (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    tax_code character varying(50) NOT NULL,
    email character varying(255) NOT NULL,
    username character varying(100) NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    verification_level integer DEFAULT 0 NOT NULL,
    registration_number character varying(50),
    initial_admin_assigned_at timestamp with time zone,
    representative_name character varying(255),
    representative_email character varying(255),
    representative_phone character varying(50),
    recovery_authority character varying(255),
    representative_identity character varying(255),
    banner_url character varying(2048),
    logo_url character varying(2048),
    description text,
    organization_type character varying(100),
    organization_size character varying(100),
    branch_count integer DEFAULT 0 NOT NULL,
    industry_tags character varying(100)[] DEFAULT ARRAY[]::character varying[] NOT NULL,
    benefit_tags character varying(100)[] DEFAULT ARRAY[]::character varying[] NOT NULL,
    gallery_urls character varying(2048)[] DEFAULT ARRAY[]::character varying[] NOT NULL,
    contact_name character varying(255),
    contact_phone character varying(100),
    contact_email character varying(255),
    city character varying(255),
    detail_address character varying(500),
    google_maps_embed_url character varying(2048),
    linkedin_url character varying(2048),
    facebook_url character varying(2048),
    twitter_url character varying(2048),
    website character varying(2048),
    mission text,
    vision text,
    core_values text,
    founded character varying(50),
    follower_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL
);


ALTER TABLE public.organizations OWNER TO postgres;

--
-- Name: otp_verifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.otp_verifications (
    id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    email character varying(255) NOT NULL,
    otp_hash character varying(255) NOT NULL,
    purpose character varying(100) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    consumed_at timestamp with time zone,
    attempts integer DEFAULT 0,
    last_attempt_at timestamp with time zone,
    resend_count integer DEFAULT 0,
    last_sent_at timestamp with time zone,
    last_resent_at timestamp with time zone,
    status integer DEFAULT 0 NOT NULL,
    cooldown_until timestamp with time zone,
    invalidated_at timestamp with time zone
);


ALTER TABLE public.otp_verifications OWNER TO postgres;

--
-- Name: outbox_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.outbox_messages (
    id uuid NOT NULL,
    type character varying(100) NOT NULL,
    payload text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    error text
);


ALTER TABLE public.outbox_messages OWNER TO postgres;

--
-- Name: pending_auth_providers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pending_auth_providers (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    provider_name character varying(50) NOT NULL,
    provider_key character varying(255) NOT NULL,
    provider_account_id character varying(100),
    provider_username character varying(255),
    provider_display_name character varying(255),
    provider_avatar_url character varying(500),
    provider_profile_url character varying(500),
    encrypted_access_token character varying(1000) NOT NULL,
    encrypted_refresh_token character varying(1000),
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.pending_auth_providers OWNER TO postgres;

--
-- Name: pending_organization_ownerships; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pending_organization_ownerships (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    owner_email public.citext NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    consumed_by_user_id uuid,
    discovery_notified_at timestamp with time zone
);


ALTER TABLE public.pending_organization_ownerships OWNER TO postgres;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    id uuid NOT NULL,
    name character varying(150) NOT NULL,
    display_name character varying(150) NOT NULL,
    description text,
    module character varying(50) NOT NULL,
    is_system boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.permissions OWNER TO postgres;

--
-- Name: pipeline_events_durable; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pipeline_events_durable (
    id uuid NOT NULL,
    execution_id uuid NOT NULL,
    stage_id character varying(100),
    log_level character varying(20) NOT NULL,
    component character varying(100),
    message text NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    metadata_json jsonb,
    correlation_id uuid
);


ALTER TABLE public.pipeline_events_durable OWNER TO postgres;

--
-- Name: pipeline_executions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pipeline_executions (
    id uuid NOT NULL,
    pipeline_type character varying(50) NOT NULL,
    reference_id uuid NOT NULL,
    status character varying(30) NOT NULL,
    progress numeric(5,2) NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    error_message character varying(2000),
    retry_count integer NOT NULL,
    max_budget_usd numeric(10,6) NOT NULL,
    cumulative_cost_usd numeric(10,6) NOT NULL,
    total_input_tokens integer,
    total_output_tokens integer,
    user_id uuid,
    workspace_id uuid,
    model_name character varying(100),
    provider character varying(100),
    pipeline_version character varying(50) NOT NULL,
    created_at_utc timestamp with time zone NOT NULL,
    last_updated_at_utc timestamp with time zone NOT NULL,
    current_step character varying(100)
);


ALTER TABLE public.pipeline_executions OWNER TO postgres;

--
-- Name: pipeline_jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pipeline_jobs (
    id uuid NOT NULL,
    pipeline_type character varying(50) NOT NULL,
    reference_id uuid NOT NULL,
    status character varying(30) DEFAULT 'Queued'::character varying NOT NULL,
    progress numeric DEFAULT 0.00 NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    error_message character varying(2000),
    retry_count integer DEFAULT 0 NOT NULL,
    max_budget_usd numeric DEFAULT 5.00 NOT NULL,
    cumulative_cost_usd numeric DEFAULT 0.00 NOT NULL,
    created_at_utc timestamp with time zone DEFAULT now() NOT NULL,
    last_updated_at_utc timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.pipeline_jobs OWNER TO postgres;

--
-- Name: pipeline_stages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pipeline_stages (
    id uuid NOT NULL,
    execution_id uuid NOT NULL,
    stage_id character varying(100) NOT NULL,
    stage_name character varying(200) NOT NULL,
    parent_stage_id character varying(100),
    status character varying(30) NOT NULL,
    progress numeric(5,2) NOT NULL,
    description character varying(1000),
    details_json jsonb,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    duration_ms bigint,
    retry_count integer NOT NULL
);


ALTER TABLE public.pipeline_stages OWNER TO postgres;

--
-- Name: pipeline_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pipeline_tasks (
    id uuid NOT NULL,
    job_id uuid NOT NULL,
    task_identifier character varying(50) NOT NULL,
    task_name character varying(100) NOT NULL,
    status character varying(30) DEFAULT 'Pending'::character varying NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    retry_count integer DEFAULT 0 NOT NULL,
    lease_expires_at timestamp with time zone,
    worker_id character varying(100),
    error_details text,
    cost_usd numeric DEFAULT 0.000000 NOT NULL,
    created_at_utc timestamp with time zone DEFAULT now() NOT NULL,
    last_updated_at_utc timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.pipeline_tasks OWNER TO postgres;

--
-- Name: pipeline_tasks_durable; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pipeline_tasks_durable (
    id uuid NOT NULL,
    execution_id uuid NOT NULL,
    task_identifier character varying(50) NOT NULL,
    task_name character varying(100) NOT NULL,
    status character varying(30) NOT NULL,
    progress numeric(5,2) NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    duration_ms bigint,
    retry_count integer NOT NULL,
    error_message character varying(2000),
    prompt_tokens integer,
    completion_tokens integer,
    cache_read_tokens integer,
    cache_write_tokens integer,
    estimated_cost_usd numeric(10,6),
    model_name character varying(100),
    metadata_json jsonb,
    created_at_utc timestamp with time zone NOT NULL
);


ALTER TABLE public.pipeline_tasks_durable OWNER TO postgres;

--
-- Name: profile_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profile_attachments (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid,
    file_name character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_size bigint NOT NULL,
    file_type character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.profile_attachments OWNER TO postgres;

--
-- Name: project_contributions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_contributions (
    id uuid NOT NULL,
    project_entry_id uuid NOT NULL,
    content character varying(1000) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.project_contributions OWNER TO postgres;

--
-- Name: project_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_entries (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    role character varying(255),
    description character varying(2000) NOT NULL,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    is_currently_working boolean NOT NULL,
    verification_level integer NOT NULL,
    verification_status integer NOT NULL,
    verified_at timestamp with time zone,
    verification_metadata_json jsonb,
    display_order integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.project_entries OWNER TO postgres;

--
-- Name: project_repository_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_repository_links (
    id uuid NOT NULL,
    project_entry_id uuid NOT NULL,
    source_code_repository_id uuid NOT NULL,
    linked_at timestamp with time zone NOT NULL
);


ALTER TABLE public.project_repository_links OWNER TO postgres;

--
-- Name: project_technologies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_technologies (
    id uuid NOT NULL,
    project_entry_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.project_technologies OWNER TO postgres;

--
-- Name: prompt_deployments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.prompt_deployments (
    prompt_id character varying(50) NOT NULL,
    active_version character varying(30) NOT NULL,
    sha256hash character varying(64) NOT NULL,
    updated_at_utc timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.prompt_deployments OWNER TO postgres;

--
-- Name: recovery_execution_locks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recovery_execution_locks (
    id uuid NOT NULL,
    recovery_session_id uuid NOT NULL,
    status character varying(50) DEFAULT 'Locked'::character varying NOT NULL,
    acquired_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);


ALTER TABLE public.recovery_execution_locks OWNER TO postgres;

--
-- Name: recovery_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recovery_tokens (
    id uuid NOT NULL,
    user_id uuid,
    organization_id uuid,
    token_hash character varying(255) NOT NULL,
    token_type integer NOT NULL,
    purpose character varying(100) NOT NULL,
    metadata_json text,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.recovery_tokens OWNER TO postgres;

--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.refresh_tokens (
    id uuid NOT NULL,
    user_id uuid,
    organization_id uuid,
    token character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    replaced_by_token character varying(255),
    user_agent character varying(500),
    ip_address character varying(45),
    session_id uuid NOT NULL,
    remember_me boolean DEFAULT false NOT NULL,
    replaced_by_token_id uuid
);


ALTER TABLE public.refresh_tokens OWNER TO postgres;

--
-- Name: repository_assessments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.repository_assessments (
    id uuid NOT NULL,
    repository_id uuid NOT NULL,
    analysis_job_id uuid NOT NULL,
    status character varying(30) NOT NULL,
    commit_sha character varying(100) NOT NULL,
    overall_score double precision NOT NULL,
    tech_stack jsonb,
    patterns jsonb,
    quality_metrics jsonb,
    json_data jsonb,
    model_version character varying(100),
    prompt_version character varying(50),
    assessment_schema_version character varying(20),
    pipeline_version character varying(20),
    created_at_utc timestamp with time zone NOT NULL,
    completed_at_utc timestamp with time zone
);


ALTER TABLE public.repository_assessments OWNER TO postgres;

--
-- Name: repository_capabilities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.repository_capabilities (
    id uuid NOT NULL,
    repository_assessment_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    category character varying(50) NOT NULL,
    confidence double precision NOT NULL,
    maturity character varying(30) NOT NULL,
    difficulty_score double precision NOT NULL,
    score double precision NOT NULL,
    evidence_json jsonb,
    assessment_version character varying(20) NOT NULL,
    analysis_version character varying(20) NOT NULL,
    model_version character varying(100) NOT NULL,
    prompt_version character varying(50) NOT NULL
);


ALTER TABLE public.repository_capabilities OWNER TO postgres;

--
-- Name: repository_domains; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.repository_domains (
    id uuid NOT NULL,
    repository_assessment_id uuid NOT NULL,
    domain_name character varying(100) NOT NULL,
    weight double precision NOT NULL,
    confidence double precision NOT NULL,
    evidence_count integer NOT NULL,
    supporting_signals jsonb,
    assessment_version character varying(20) NOT NULL,
    analysis_version character varying(20) NOT NULL,
    model_version character varying(100) NOT NULL,
    prompt_version character varying(50) NOT NULL
);


ALTER TABLE public.repository_domains OWNER TO postgres;

--
-- Name: repository_intelligence_signals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.repository_intelligence_signals (
    id uuid NOT NULL,
    repository_assessment_id uuid NOT NULL,
    scope_signal double precision NOT NULL,
    complexity_signal double precision NOT NULL,
    ownership_signal double precision NOT NULL,
    leadership_signal double precision NOT NULL,
    consistency_signal double precision NOT NULL,
    last_updated_utc timestamp with time zone NOT NULL,
    assessment_version character varying(20) NOT NULL,
    analysis_version character varying(20) NOT NULL,
    model_version character varying(100) NOT NULL,
    prompt_version character varying(50) NOT NULL
);


ALTER TABLE public.repository_intelligence_signals OWNER TO postgres;

--
-- Name: repository_skill_attributions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.repository_skill_attributions (
    id uuid NOT NULL,
    repository_assessment_id uuid NOT NULL,
    skill_name character varying(100) NOT NULL,
    contribution_weight double precision NOT NULL,
    confidence double precision NOT NULL,
    verification_level character varying(30) NOT NULL,
    assessment_version character varying(20) NOT NULL,
    analysis_version character varying(20) NOT NULL,
    model_version character varying(100) NOT NULL,
    prompt_version character varying(50) NOT NULL,
    normalization_source character varying(50),
    original_name character varying(100),
    pipeline_trace_id character varying(100),
    skill_id character varying(100) DEFAULT ''::character varying NOT NULL,
    taxonomy_version character varying(20) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE public.repository_skill_attributions OWNER TO postgres;

--
-- Name: representative_approval_votes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.representative_approval_votes (
    id uuid NOT NULL,
    request_id uuid NOT NULL,
    approver_user_id uuid NOT NULL,
    approver_role character varying(50) NOT NULL,
    decision character varying(50) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.representative_approval_votes OWNER TO postgres;

--
-- Name: representative_authority_histories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.representative_authority_histories (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    previous_representative character varying(255),
    new_representative character varying(255) NOT NULL,
    rotated_by character varying(255) NOT NULL,
    support_reviewer character varying(255) NOT NULL,
    effective_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.representative_authority_histories OWNER TO postgres;

--
-- Name: representative_rotation_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.representative_rotation_requests (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    current_representative character varying(255),
    requested_representative character varying(255) NOT NULL,
    requested_email character varying(255) NOT NULL,
    requested_phone character varying(50) NOT NULL,
    reason text NOT NULL,
    support_approval_status character varying(50) DEFAULT 'pending_review'::character varying NOT NULL,
    admin_approval_status character varying(50) DEFAULT 'pending_review'::character varying NOT NULL,
    final_decision character varying(50) DEFAULT 'pending_review'::character varying NOT NULL,
    verification_call_status character varying(50) DEFAULT 'not_started'::character varying NOT NULL,
    verification_call_notes text,
    optional_supporting_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


ALTER TABLE public.representative_rotation_requests OWNER TO postgres;

--
-- Name: requirement_artifact_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.requirement_artifact_snapshots (
    id uuid NOT NULL,
    requirement_snapshot_id uuid NOT NULL,
    artifact_type character varying(100) NOT NULL,
    markdown_content text NOT NULL,
    structured_content_json jsonb,
    snapshotted_at timestamp with time zone NOT NULL
);


ALTER TABLE public.requirement_artifact_snapshots OWNER TO postgres;

--
-- Name: requirement_artifacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.requirement_artifacts (
    id uuid NOT NULL,
    hiring_requirement_id uuid NOT NULL,
    artifact_type character varying(100) NOT NULL,
    markdown_content text NOT NULL,
    structured_content_json jsonb,
    status character varying(50) NOT NULL,
    model_info character varying(100),
    prompt_template_id character varying(100),
    prompt_version character varying(50),
    prompt_hash character varying(100),
    generation_metadata_json jsonb,
    regeneration_history_json jsonb,
    generation_timestamp timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.requirement_artifacts OWNER TO postgres;

--
-- Name: requirement_capabilities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.requirement_capabilities (
    id uuid NOT NULL,
    hiring_requirement_id uuid NOT NULL,
    capability_id character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    category character varying(100) NOT NULL,
    priority text NOT NULL,
    ownership_level text NOT NULL,
    expected_proficiency integer NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.requirement_capabilities OWNER TO postgres;

--
-- Name: requirement_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.requirement_snapshots (
    id uuid NOT NULL,
    hiring_requirement_id uuid NOT NULL,
    version integer NOT NULL,
    snapshotted_at timestamp with time zone NOT NULL,
    title character varying(255) NOT NULL,
    department character varying(100) NOT NULL,
    seniority character varying(50) NOT NULL,
    workplace_type character varying(50) NOT NULL,
    city character varying(100),
    employment_type character varying(50) NOT NULL,
    salary_min numeric,
    salary_max numeric,
    currency character varying(10),
    timezone_range character varying(100),
    degree_requirement character varying(100),
    benefits text[] NOT NULL,
    language_requirements text[] NOT NULL,
    headcount integer NOT NULL,
    hiring_reason character varying(100),
    business_problem character varying(2000),
    business_outcomes_json jsonb,
    responsibilities_json jsonb,
    capabilities_json jsonb,
    technology_requirements_json jsonb,
    auto_close_rule integer DEFAULT 0 NOT NULL,
    candidates_needed_count integer,
    end_date timestamp with time zone,
    is_manually_closed boolean DEFAULT false NOT NULL,
    is_salary_negotiable boolean DEFAULT false NOT NULL,
    salary_period integer DEFAULT 0 NOT NULL,
    start_date timestamp with time zone
);


ALTER TABLE public.requirement_snapshots OWNER TO postgres;

--
-- Name: requirement_vector_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.requirement_vector_snapshots (
    requirement_snapshot_id uuid NOT NULL,
    vector real[] NOT NULL,
    dimension integer NOT NULL,
    snapshotted_at timestamp with time zone NOT NULL
);


ALTER TABLE public.requirement_vector_snapshots OWNER TO postgres;

--
-- Name: reset_password_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reset_password_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    consumed_at timestamp with time zone
);


ALTER TABLE public.reset_password_tokens OWNER TO postgres;

--
-- Name: responsibilities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.responsibilities (
    id uuid NOT NULL,
    hiring_requirement_id uuid NOT NULL,
    text character varying(1000) NOT NULL,
    priority text NOT NULL,
    ownership_level text NOT NULL,
    is_leadership boolean NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.responsibilities OWNER TO postgres;

--
-- Name: role_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_assignments (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    scope_type character varying(30) NOT NULL,
    scope_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.role_assignments OWNER TO postgres;

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id uuid NOT NULL,
    name character varying(50) NOT NULL,
    display_name character varying(100) NOT NULL,
    description text,
    domain character varying(30) DEFAULT 'SYSTEM'::character varying NOT NULL,
    tenant_id uuid,
    parent_role_id uuid,
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: security_event_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.security_event_comments (
    id uuid NOT NULL,
    security_event_id uuid,
    security_incident_id uuid,
    author_user_id uuid NOT NULL,
    comment_text text NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.security_event_comments OWNER TO postgres;

--
-- Name: security_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.security_events (
    id uuid NOT NULL,
    event_type character varying(100) NOT NULL,
    category character varying(50) NOT NULL,
    severity character varying(20) NOT NULL,
    status character varying(30) NOT NULL,
    risk_score integer NOT NULL,
    confidence_score integer NOT NULL,
    description text NOT NULL,
    actor_user_id uuid,
    target_user_id uuid,
    organization_id uuid,
    ip_address character varying(45),
    country_code character varying(10),
    device character varying(100),
    browser character varying(100),
    session_id uuid,
    details_json jsonb,
    correlation_id uuid NOT NULL,
    incident_id uuid,
    assigned_to_user_id uuid,
    occurrence_count integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.security_events OWNER TO postgres;

--
-- Name: security_incidents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.security_incidents (
    id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    status character varying(30) NOT NULL,
    severity character varying(20) NOT NULL,
    assigned_to_user_id uuid,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.security_incidents OWNER TO postgres;

--
-- Name: security_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.security_rules (
    id uuid NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(150) NOT NULL,
    description text NOT NULL,
    is_enabled boolean NOT NULL,
    severity character varying(20) NOT NULL,
    configuration_json jsonb NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.security_rules OWNER TO postgres;

--
-- Name: seeding_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.seeding_history (
    module_id character varying(100) NOT NULL,
    version character varying(20) NOT NULL,
    environment_name character varying(50) NOT NULL,
    applied_at_utc timestamp with time zone NOT NULL,
    duration_ms integer NOT NULL,
    records_affected integer NOT NULL
);


ALTER TABLE public.seeding_history OWNER TO postgres;

--
-- Name: source_code_repositories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.source_code_repositories (
    id uuid NOT NULL,
    auth_provider_id uuid NOT NULL,
    external_organization_id uuid,
    external_repository_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    owner character varying(255) NOT NULL,
    description character varying(1000),
    html_url character varying(1000),
    default_branch character varying(100),
    owner_login character varying(255) NOT NULL,
    owner_type character varying(50) NOT NULL,
    is_private boolean DEFAULT false NOT NULL,
    primary_language character varying(100),
    stars_count integer DEFAULT 0 NOT NULL,
    forks_count integer DEFAULT 0 NOT NULL,
    open_issues_count integer DEFAULT 0 NOT NULL,
    watchers_count integer DEFAULT 0 NOT NULL,
    last_commit_at timestamp with time zone,
    last_updated_utc timestamp with time zone NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    is_accessible boolean DEFAULT true NOT NULL,
    archived_externally boolean DEFAULT false NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    trust_score double precision DEFAULT 0.0 NOT NULL,
    custom_settings_json text,
    classification character varying(255),
    authenticity_type character varying(255),
    latest_risk_score double precision DEFAULT 0.0 NOT NULL,
    latest_risk_level character varying(50) DEFAULT 'Low'::character varying NOT NULL,
    latest_analysis_status character varying(50) DEFAULT 'NeverAnalyzed'::character varying NOT NULL,
    latest_analysis_completed_at_utc timestamp with time zone,
    latest_risk_factors_json jsonb,
    created_at_utc timestamp with time zone NOT NULL,
    last_synced_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.source_code_repositories OWNER TO postgres;

--
-- Name: system_metadata; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_metadata (
    key character varying(100) NOT NULL,
    value character varying(255) NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.system_metadata OWNER TO postgres;

--
-- Name: technology_requirements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.technology_requirements (
    id uuid NOT NULL,
    hiring_requirement_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    priority text NOT NULL,
    sfia_level integer NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.technology_requirements OWNER TO postgres;

--
-- Name: trust_calculations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trust_calculations (
    id uuid NOT NULL,
    trust_profile_id uuid NOT NULL,
    aggregate_score integer NOT NULL,
    calculation_details jsonb NOT NULL,
    calculated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.trust_calculations OWNER TO postgres;

--
-- Name: trust_components; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trust_components (
    id uuid NOT NULL,
    trust_profile_id uuid NOT NULL,
    component_name character varying(100) NOT NULL,
    component_score integer NOT NULL,
    weight double precision NOT NULL,
    explanation_metadata jsonb,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.trust_components OWNER TO postgres;

--
-- Name: trust_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trust_profiles (
    id uuid NOT NULL,
    target_entity_id uuid NOT NULL,
    target_type character varying(30) NOT NULL,
    recalculated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.trust_profiles OWNER TO postgres;

--
-- Name: user_cv_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_cv_settings (
    user_id uuid NOT NULL,
    cv_template_id character varying(50) NOT NULL,
    cv_theme_color character varying(50),
    is_cv_published boolean NOT NULL,
    cv_layout_config_json text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.user_cv_settings OWNER TO postgres;

--
-- Name: user_followers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_followers (
    follower_id uuid NOT NULL,
    followee_id uuid NOT NULL,
    followed_at timestamp with time zone NOT NULL
);


ALTER TABLE public.user_followers OWNER TO postgres;

--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_profiles (
    user_id uuid NOT NULL,
    username public.citext,
    bio character varying(1000),
    location character varying(50),
    phone_number character varying(15),
    birth_date timestamp with time zone,
    headline character varying(50),
    company character varying(50),
    pronouns character varying(20),
    custom_pronouns character varying(30),
    public_email character varying(255),
    profile_visibility character varying(20) DEFAULT 'public'::character varying NOT NULL,
    recruiter_visibility boolean DEFAULT true NOT NULL,
    ai_talent_discovery character varying(20) DEFAULT 'disabled'::character varying NOT NULL,
    social_links character varying(255)[] DEFAULT ARRAY[]::character varying[] NOT NULL,
    last_profile_update_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    ai_suggestions_json text
);


ALTER TABLE public.user_profiles OWNER TO postgres;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: user_skills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_skills (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    skill character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    normalized_name character varying(100),
    skill_id character varying(100)
);


ALTER TABLE public.user_skills OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email public.citext NOT NULL,
    username public.citext,
    last_username_change_at timestamp with time zone,
    password_hash text,
    password_changed_at timestamp with time zone,
    full_name character varying(255) NOT NULL,
    avatar_url text,
    avatar_source integer DEFAULT 0 NOT NULL,
    status public.user_status DEFAULT 'EMAIL_VERIFY_PENDING'::public.user_status NOT NULL,
    email_verified_at timestamp with time zone,
    last_login_at timestamp with time zone,
    last_login_ip inet,
    failed_attempts integer DEFAULT 0,
    last_failed_at timestamp with time zone,
    lock_until timestamp with time zone,
    session_version integer DEFAULT 1 NOT NULL,
    is_legal_hold boolean DEFAULT false NOT NULL,
    linked_emails jsonb DEFAULT '[]'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: verification_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.verification_links (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    tax_code character varying(50),
    organization_name character varying(255),
    token_hash character varying(255) NOT NULL,
    purpose character varying(100) NOT NULL,
    user_id uuid,
    organization_id uuid,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    consumed_at timestamp with time zone,
    consumed_by_ip character varying(45),
    consumed_by_user_agent character varying(500),
    deleted_at timestamp with time zone
);


ALTER TABLE public.verification_links OWNER TO postgres;

--
-- Name: verification_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.verification_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    consumed_at timestamp with time zone
);


ALTER TABLE public.verification_tokens OWNER TO postgres;

--
-- Name: work_experience_achievements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_experience_achievements (
    id uuid NOT NULL,
    work_experience_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.work_experience_achievements OWNER TO postgres;

--
-- Name: work_experience_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_experience_entries (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    job_title character varying(255) NOT NULL,
    company character varying(255) NOT NULL,
    experience_category integer NOT NULL,
    employment_type integer NOT NULL,
    location character varying(255),
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone,
    is_currently_working boolean DEFAULT false NOT NULL,
    is_leadership boolean DEFAULT false NOT NULL,
    description text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.work_experience_entries OWNER TO postgres;

--
-- Name: work_experience_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_experience_links (
    id uuid NOT NULL,
    work_experience_id uuid NOT NULL,
    link_type integer NOT NULL,
    url character varying(500) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.work_experience_links OWNER TO postgres;

--
-- Name: work_experience_technologies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_experience_technologies (
    id uuid NOT NULL,
    work_experience_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.work_experience_technologies OWNER TO postgres;

--
-- Name: workflow_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workflow_attachments (
    id uuid NOT NULL,
    workflow_request_id uuid NOT NULL,
    storage_path character varying(2048) NOT NULL,
    file_name character varying(255) NOT NULL,
    content_type character varying(100) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.workflow_attachments OWNER TO postgres;

--
-- Name: workflow_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workflow_comments (
    id uuid NOT NULL,
    workflow_request_id uuid NOT NULL,
    author_user_id uuid NOT NULL,
    content text NOT NULL,
    is_internal_only boolean NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.workflow_comments OWNER TO postgres;

--
-- Name: workspace_archive_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workspace_archive_snapshots (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    snapshot_data_json text NOT NULL,
    archived_by character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.workspace_archive_snapshots OWNER TO postgres;

--
-- Name: workspace_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workspace_members (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(50) NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.workspace_members OWNER TO postgres;

--
-- Name: workspace_posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workspace_posts (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    created_by_user_id uuid NOT NULL,
    category character varying(100) NOT NULL,
    content text NOT NULL,
    images text[] DEFAULT ARRAY[]::text[] NOT NULL,
    likes integer NOT NULL,
    shares_count integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.workspace_posts OWNER TO postgres;

--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workspaces (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    display_name character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    description character varying(1000),
    branding text,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.workspaces OWNER TO postgres;

--
-- Name: academic_achievements academic_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.academic_achievements
    ADD CONSTRAINT academic_achievements_pkey PRIMARY KEY (id);


--
-- Name: activity_events activity_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_events
    ADD CONSTRAINT activity_events_pkey PRIMARY KEY (id);


--
-- Name: admin_invitation_roles admin_invitation_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_invitation_roles
    ADD CONSTRAINT admin_invitation_roles_pkey PRIMARY KEY (id);


--
-- Name: admin_invitations admin_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_invitations
    ADD CONSTRAINT admin_invitations_pkey PRIMARY KEY (id);


--
-- Name: admin_members admin_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_members
    ADD CONSTRAINT admin_members_pkey PRIMARY KEY (id);


--
-- Name: ai_inferred_preferences ai_inferred_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_inferred_preferences
    ADD CONSTRAINT ai_inferred_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: analysis_executions analysis_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_executions
    ADD CONSTRAINT analysis_executions_pkey PRIMARY KEY (id);


--
-- Name: analysis_job_events analysis_job_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_job_events
    ADD CONSTRAINT analysis_job_events_pkey PRIMARY KEY (id);


--
-- Name: analysis_jobs analysis_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_jobs
    ADD CONSTRAINT analysis_jobs_pkey PRIMARY KEY (id);


--
-- Name: analysis_reports analysis_reports_job_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_reports
    ADD CONSTRAINT analysis_reports_job_id_key UNIQUE (job_id);


--
-- Name: analysis_reports analysis_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_reports
    ADD CONSTRAINT analysis_reports_pkey PRIMARY KEY (id);


--
-- Name: analysis_task_events analysis_task_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_task_events
    ADD CONSTRAINT analysis_task_events_pkey PRIMARY KEY (id);


--
-- Name: analysis_task_results analysis_task_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_task_results
    ADD CONSTRAINT analysis_task_results_pkey PRIMARY KEY (task_id);


--
-- Name: analysis_tasks analysis_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_tasks
    ADD CONSTRAINT analysis_tasks_pkey PRIMARY KEY (id);


--
-- Name: approved_recovery_sessions approved_recovery_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approved_recovery_sessions
    ADD CONSTRAINT approved_recovery_sessions_pkey PRIMARY KEY (id);


--
-- Name: artifact_registry_entries artifact_registry_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.artifact_registry_entries
    ADD CONSTRAINT artifact_registry_entries_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: auth_providers auth_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_providers
    ADD CONSTRAINT auth_providers_pkey PRIMARY KEY (id);


--
-- Name: candidate_assessment_artifacts candidate_assessment_artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_assessment_artifacts
    ADD CONSTRAINT candidate_assessment_artifacts_pkey PRIMARY KEY (id);


--
-- Name: candidate_assessments candidate_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_assessments
    ADD CONSTRAINT candidate_assessments_pkey PRIMARY KEY (id);


--
-- Name: candidate_best_fit_roles candidate_best_fit_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_best_fit_roles
    ADD CONSTRAINT candidate_best_fit_roles_pkey PRIMARY KEY (id);


--
-- Name: candidate_domain_profiles candidate_domain_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_domain_profiles
    ADD CONSTRAINT candidate_domain_profiles_pkey PRIMARY KEY (id);


--
-- Name: candidate_intelligence_signals candidate_intelligence_signals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_intelligence_signals
    ADD CONSTRAINT candidate_intelligence_signals_pkey PRIMARY KEY (id);


--
-- Name: candidate_skills candidate_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_skills
    ADD CONSTRAINT candidate_skills_pkey PRIMARY KEY (id);


--
-- Name: candidate_strengths_weaknesses candidate_strengths_weaknesses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_strengths_weaknesses
    ADD CONSTRAINT candidate_strengths_weaknesses_pkey PRIMARY KEY (id);


--
-- Name: career_preferences career_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.career_preferences
    ADD CONSTRAINT career_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: education_entries education_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.education_entries
    ADD CONSTRAINT education_entries_pkey PRIMARY KEY (id);


--
-- Name: external_organizations external_organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_organizations
    ADD CONSTRAINT external_organizations_pkey PRIMARY KEY (id);


--
-- Name: in_app_notifications in_app_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.in_app_notifications
    ADD CONSTRAINT in_app_notifications_pkey PRIMARY KEY (id);


--
-- Name: job_vacancies job_vacancies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_vacancies
    ADD CONSTRAINT job_vacancies_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: organization_authorities organization_authorities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_authorities
    ADD CONSTRAINT organization_authorities_pkey PRIMARY KEY (id);


--
-- Name: organization_credentials organization_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_credentials
    ADD CONSTRAINT organization_credentials_pkey PRIMARY KEY (organization_id);


--
-- Name: organization_followers organization_followers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_followers
    ADD CONSTRAINT organization_followers_pkey PRIMARY KEY (user_id, organization_id);


--
-- Name: organization_invitation_roles organization_invitation_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_invitation_roles
    ADD CONSTRAINT organization_invitation_roles_pkey PRIMARY KEY (id);


--
-- Name: organization_invitations organization_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_pkey PRIMARY KEY (id);


--
-- Name: organization_memberships organization_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_pkey PRIMARY KEY (id);


--
-- Name: organization_recovery_claims organization_recovery_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_recovery_claims
    ADD CONSTRAINT organization_recovery_claims_pkey PRIMARY KEY (id);


--
-- Name: organization_verifications organization_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_verifications
    ADD CONSTRAINT organization_verifications_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: otp_verifications otp_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otp_verifications
    ADD CONSTRAINT otp_verifications_pkey PRIMARY KEY (id);


--
-- Name: outbox_messages outbox_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.outbox_messages
    ADD CONSTRAINT outbox_messages_pkey PRIMARY KEY (id);


--
-- Name: pending_auth_providers pending_auth_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pending_auth_providers
    ADD CONSTRAINT pending_auth_providers_pkey PRIMARY KEY (id);


--
-- Name: pending_organization_ownerships pending_organization_ownerships_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pending_organization_ownerships
    ADD CONSTRAINT pending_organization_ownerships_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: pipeline_jobs pipeline_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_jobs
    ADD CONSTRAINT pipeline_jobs_pkey PRIMARY KEY (id);


--
-- Name: pipeline_tasks pipeline_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_tasks
    ADD CONSTRAINT pipeline_tasks_pkey PRIMARY KEY (id);


--
-- Name: __EFMigrationsHistory pk___ef_migrations_history; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."__EFMigrationsHistory"
    ADD CONSTRAINT pk___ef_migrations_history PRIMARY KEY (migration_id);


--
-- Name: ai_streaming_logs pk_ai_streaming_logs; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_streaming_logs
    ADD CONSTRAINT pk_ai_streaming_logs PRIMARY KEY (id);


--
-- Name: ai_streaming_metrics pk_ai_streaming_metrics; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_streaming_metrics
    ADD CONSTRAINT pk_ai_streaming_metrics PRIMARY KEY (id);


--
-- Name: ai_streaming_sessions pk_ai_streaming_sessions; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_streaming_sessions
    ADD CONSTRAINT pk_ai_streaming_sessions PRIMARY KEY (id);


--
-- Name: ai_streaming_stages pk_ai_streaming_stages; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_streaming_stages
    ADD CONSTRAINT pk_ai_streaming_stages PRIMARY KEY (id);


--
-- Name: business_outcomes pk_business_outcomes; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_outcomes
    ADD CONSTRAINT pk_business_outcomes PRIMARY KEY (id);


--
-- Name: candidate_capabilities pk_candidate_capabilities; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_capabilities
    ADD CONSTRAINT pk_candidate_capabilities PRIMARY KEY (id);


--
-- Name: candidate_capability_evidences pk_candidate_capability_evidences; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_capability_evidences
    ADD CONSTRAINT pk_candidate_capability_evidences PRIMARY KEY (candidate_capability_id, evidence_artifact_id);


--
-- Name: candidate_capability_histories pk_candidate_capability_histories; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_capability_histories
    ADD CONSTRAINT pk_candidate_capability_histories PRIMARY KEY (id);


--
-- Name: candidate_capability_projections pk_candidate_capability_projections; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_capability_projections
    ADD CONSTRAINT pk_candidate_capability_projections PRIMARY KEY (candidate_id);


--
-- Name: candidate_capability_scores pk_candidate_capability_scores; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_capability_scores
    ADD CONSTRAINT pk_candidate_capability_scores PRIMARY KEY (candidate_capability_id);


--
-- Name: candidate_discovery_runs pk_candidate_discovery_runs; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_discovery_runs
    ADD CONSTRAINT pk_candidate_discovery_runs PRIMARY KEY (id);


--
-- Name: candidate_evaluation_snapshots pk_candidate_evaluation_snapshots; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_evaluation_snapshots
    ADD CONSTRAINT pk_candidate_evaluation_snapshots PRIMARY KEY (candidate_id);


--
-- Name: candidate_match_projections pk_candidate_match_projections; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_match_projections
    ADD CONSTRAINT pk_candidate_match_projections PRIMARY KEY (candidate_id);


--
-- Name: candidate_ranking_projections pk_candidate_ranking_projections; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_ranking_projections
    ADD CONSTRAINT pk_candidate_ranking_projections PRIMARY KEY (candidate_id);


--
-- Name: candidate_search_profiles pk_candidate_search_profiles; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_search_profiles
    ADD CONSTRAINT pk_candidate_search_profiles PRIMARY KEY (candidate_id);


--
-- Name: candidate_skill_tree_nodes pk_candidate_skill_tree_nodes; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_skill_tree_nodes
    ADD CONSTRAINT pk_candidate_skill_tree_nodes PRIMARY KEY (id);


--
-- Name: candidate_trust_projections pk_candidate_trust_projections; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_trust_projections
    ADD CONSTRAINT pk_candidate_trust_projections PRIMARY KEY (candidate_id);


--
-- Name: canonical_skill_aliases pk_canonical_skill_aliases; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.canonical_skill_aliases
    ADD CONSTRAINT pk_canonical_skill_aliases PRIMARY KEY (alias_name);


--
-- Name: canonical_skills pk_canonical_skills; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.canonical_skills
    ADD CONSTRAINT pk_canonical_skills PRIMARY KEY (skill_id, taxonomy_version);


--
-- Name: capability_aliases pk_capability_aliases; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.capability_aliases
    ADD CONSTRAINT pk_capability_aliases PRIMARY KEY (alias_name);


--
-- Name: capability_catalog_items pk_capability_catalog_items; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.capability_catalog_items
    ADD CONSTRAINT pk_capability_catalog_items PRIMARY KEY (capability_id);


--
-- Name: capability_edges pk_capability_edges; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.capability_edges
    ADD CONSTRAINT pk_capability_edges PRIMARY KEY (source_node_id, target_node_id, relationship_type);


--
-- Name: capability_hierarchies pk_capability_hierarchies; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.capability_hierarchies
    ADD CONSTRAINT pk_capability_hierarchies PRIMARY KEY (parent_id, child_id);


--
-- Name: capability_nodes pk_capability_nodes; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.capability_nodes
    ADD CONSTRAINT pk_capability_nodes PRIMARY KEY (id);


--
-- Name: capability_registries pk_capability_registries; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.capability_registries
    ADD CONSTRAINT pk_capability_registries PRIMARY KEY (capability_id);


--
-- Name: cv_repository_mappings pk_cv_repository_mappings; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cv_repository_mappings
    ADD CONSTRAINT pk_cv_repository_mappings PRIMARY KEY (id);


--
-- Name: enterprise_workflow_requests pk_enterprise_workflow_requests; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enterprise_workflow_requests
    ADD CONSTRAINT pk_enterprise_workflow_requests PRIMARY KEY (id);


--
-- Name: evaluation_rubric_snapshots pk_evaluation_rubric_snapshots; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluation_rubric_snapshots
    ADD CONSTRAINT pk_evaluation_rubric_snapshots PRIMARY KEY (requirement_snapshot_id);


--
-- Name: evaluation_rubrics pk_evaluation_rubrics; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluation_rubrics
    ADD CONSTRAINT pk_evaluation_rubrics PRIMARY KEY (id);


--
-- Name: evidence_artifacts pk_evidence_artifacts; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence_artifacts
    ADD CONSTRAINT pk_evidence_artifacts PRIMARY KEY (id);


--
-- Name: evidence_claims pk_evidence_claims; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence_claims
    ADD CONSTRAINT pk_evidence_claims PRIMARY KEY (id);


--
-- Name: evidence_signals pk_evidence_signals; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence_signals
    ADD CONSTRAINT pk_evidence_signals PRIMARY KEY (id);


--
-- Name: evidence_sources pk_evidence_sources; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence_sources
    ADD CONSTRAINT pk_evidence_sources PRIMARY KEY (id);


--
-- Name: evidence_verifications pk_evidence_verifications; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence_verifications
    ADD CONSTRAINT pk_evidence_verifications PRIMARY KEY (id);


--
-- Name: forum_badges pk_forum_badges; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_badges
    ADD CONSTRAINT pk_forum_badges PRIMARY KEY (id);


--
-- Name: forum_bookmarks pk_forum_bookmarks; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_bookmarks
    ADD CONSTRAINT pk_forum_bookmarks PRIMARY KEY (topic_id, user_id);


--
-- Name: forum_categories pk_forum_categories; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_categories
    ADD CONSTRAINT pk_forum_categories PRIMARY KEY (id);


--
-- Name: forum_category_moderators pk_forum_category_moderators; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_category_moderators
    ADD CONSTRAINT pk_forum_category_moderators PRIMARY KEY (category_id, user_id);


--
-- Name: forum_follows pk_forum_follows; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_follows
    ADD CONSTRAINT pk_forum_follows PRIMARY KEY (topic_id, user_id);


--
-- Name: forum_moderation_logs pk_forum_moderation_logs; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_moderation_logs
    ADD CONSTRAINT pk_forum_moderation_logs PRIMARY KEY (id);


--
-- Name: forum_reactions pk_forum_reactions; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_reactions
    ADD CONSTRAINT pk_forum_reactions PRIMARY KEY (id);


--
-- Name: forum_replies pk_forum_replies; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_replies
    ADD CONSTRAINT pk_forum_replies PRIMARY KEY (id);


--
-- Name: forum_reply_histories pk_forum_reply_histories; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_reply_histories
    ADD CONSTRAINT pk_forum_reply_histories PRIMARY KEY (id);


--
-- Name: forum_reports pk_forum_reports; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_reports
    ADD CONSTRAINT pk_forum_reports PRIMARY KEY (id);


--
-- Name: forum_reputations pk_forum_reputations; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_reputations
    ADD CONSTRAINT pk_forum_reputations PRIMARY KEY (user_id);


--
-- Name: forum_tags pk_forum_tags; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_tags
    ADD CONSTRAINT pk_forum_tags PRIMARY KEY (id);


--
-- Name: forum_topic_histories pk_forum_topic_histories; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_topic_histories
    ADD CONSTRAINT pk_forum_topic_histories PRIMARY KEY (id);


--
-- Name: forum_topic_tags pk_forum_topic_tags; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_topic_tags
    ADD CONSTRAINT pk_forum_topic_tags PRIMARY KEY (topic_id, tag_id);


--
-- Name: forum_topics pk_forum_topics; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_topics
    ADD CONSTRAINT pk_forum_topics PRIMARY KEY (id);


--
-- Name: forum_user_badges pk_forum_user_badges; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_user_badges
    ADD CONSTRAINT pk_forum_user_badges PRIMARY KEY (user_id, badge_id);


--
-- Name: forum_votes pk_forum_votes; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_votes
    ADD CONSTRAINT pk_forum_votes PRIMARY KEY (id);


--
-- Name: hiring_requirements pk_hiring_requirements; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hiring_requirements
    ADD CONSTRAINT pk_hiring_requirements PRIMARY KEY (id);


--
-- Name: interview_blueprint_snapshots pk_interview_blueprint_snapshots; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_blueprint_snapshots
    ADD CONSTRAINT pk_interview_blueprint_snapshots PRIMARY KEY (requirement_snapshot_id);


--
-- Name: interview_blueprints pk_interview_blueprints; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_blueprints
    ADD CONSTRAINT pk_interview_blueprints PRIMARY KEY (id);


--
-- Name: job_applications pk_job_applications; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT pk_job_applications PRIMARY KEY (id);


--
-- Name: job_interactions pk_job_interactions; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_interactions
    ADD CONSTRAINT pk_job_interactions PRIMARY KEY (id);


--
-- Name: matching_evaluations pk_matching_evaluations; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matching_evaluations
    ADD CONSTRAINT pk_matching_evaluations PRIMARY KEY (id);


--
-- Name: matching_explanations pk_matching_explanations; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matching_explanations
    ADD CONSTRAINT pk_matching_explanations PRIMARY KEY (id);


--
-- Name: matching_factors pk_matching_factors; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matching_factors
    ADD CONSTRAINT pk_matching_factors PRIMARY KEY (id);


--
-- Name: organization_candidates pk_organization_candidates; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_candidates
    ADD CONSTRAINT pk_organization_candidates PRIMARY KEY (id);


--
-- Name: pipeline_events_durable pk_pipeline_events_durable; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_events_durable
    ADD CONSTRAINT pk_pipeline_events_durable PRIMARY KEY (id);


--
-- Name: pipeline_executions pk_pipeline_executions; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_executions
    ADD CONSTRAINT pk_pipeline_executions PRIMARY KEY (id);


--
-- Name: pipeline_stages pk_pipeline_stages; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_stages
    ADD CONSTRAINT pk_pipeline_stages PRIMARY KEY (id);


--
-- Name: pipeline_tasks_durable pk_pipeline_tasks_durable; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_tasks_durable
    ADD CONSTRAINT pk_pipeline_tasks_durable PRIMARY KEY (id);


--
-- Name: requirement_artifact_snapshots pk_requirement_artifact_snapshots; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requirement_artifact_snapshots
    ADD CONSTRAINT pk_requirement_artifact_snapshots PRIMARY KEY (id);


--
-- Name: requirement_artifacts pk_requirement_artifacts; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requirement_artifacts
    ADD CONSTRAINT pk_requirement_artifacts PRIMARY KEY (id);


--
-- Name: requirement_capabilities pk_requirement_capabilities; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requirement_capabilities
    ADD CONSTRAINT pk_requirement_capabilities PRIMARY KEY (id);


--
-- Name: requirement_snapshots pk_requirement_snapshots; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requirement_snapshots
    ADD CONSTRAINT pk_requirement_snapshots PRIMARY KEY (id);


--
-- Name: requirement_vector_snapshots pk_requirement_vector_snapshots; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requirement_vector_snapshots
    ADD CONSTRAINT pk_requirement_vector_snapshots PRIMARY KEY (requirement_snapshot_id);


--
-- Name: responsibilities pk_responsibilities; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.responsibilities
    ADD CONSTRAINT pk_responsibilities PRIMARY KEY (id);


--
-- Name: security_event_comments pk_security_event_comments; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_event_comments
    ADD CONSTRAINT pk_security_event_comments PRIMARY KEY (id);


--
-- Name: security_events pk_security_events; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT pk_security_events PRIMARY KEY (id);


--
-- Name: security_incidents pk_security_incidents; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_incidents
    ADD CONSTRAINT pk_security_incidents PRIMARY KEY (id);


--
-- Name: security_rules pk_security_rules; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_rules
    ADD CONSTRAINT pk_security_rules PRIMARY KEY (id);


--
-- Name: technology_requirements pk_technology_requirements; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.technology_requirements
    ADD CONSTRAINT pk_technology_requirements PRIMARY KEY (id);


--
-- Name: trust_calculations pk_trust_calculations; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trust_calculations
    ADD CONSTRAINT pk_trust_calculations PRIMARY KEY (id);


--
-- Name: trust_components pk_trust_components; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trust_components
    ADD CONSTRAINT pk_trust_components PRIMARY KEY (id);


--
-- Name: trust_profiles pk_trust_profiles; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trust_profiles
    ADD CONSTRAINT pk_trust_profiles PRIMARY KEY (id);


--
-- Name: user_cv_settings pk_user_cv_settings; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_cv_settings
    ADD CONSTRAINT pk_user_cv_settings PRIMARY KEY (user_id);


--
-- Name: user_followers pk_user_followers; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_followers
    ADD CONSTRAINT pk_user_followers PRIMARY KEY (follower_id, followee_id);


--
-- Name: workflow_attachments pk_workflow_attachments; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_attachments
    ADD CONSTRAINT pk_workflow_attachments PRIMARY KEY (id);


--
-- Name: workflow_comments pk_workflow_comments; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_comments
    ADD CONSTRAINT pk_workflow_comments PRIMARY KEY (id);


--
-- Name: profile_attachments profile_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profile_attachments
    ADD CONSTRAINT profile_attachments_pkey PRIMARY KEY (id);


--
-- Name: project_contributions project_contributions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_contributions
    ADD CONSTRAINT project_contributions_pkey PRIMARY KEY (id);


--
-- Name: project_entries project_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_entries
    ADD CONSTRAINT project_entries_pkey PRIMARY KEY (id);


--
-- Name: project_repository_links project_repository_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_repository_links
    ADD CONSTRAINT project_repository_links_pkey PRIMARY KEY (id);


--
-- Name: project_technologies project_technologies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_technologies
    ADD CONSTRAINT project_technologies_pkey PRIMARY KEY (id);


--
-- Name: prompt_deployments prompt_deployments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prompt_deployments
    ADD CONSTRAINT prompt_deployments_pkey PRIMARY KEY (prompt_id);


--
-- Name: recovery_execution_locks recovery_execution_locks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recovery_execution_locks
    ADD CONSTRAINT recovery_execution_locks_pkey PRIMARY KEY (id);


--
-- Name: recovery_tokens recovery_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recovery_tokens
    ADD CONSTRAINT recovery_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: repository_assessments repository_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repository_assessments
    ADD CONSTRAINT repository_assessments_pkey PRIMARY KEY (id);


--
-- Name: repository_capabilities repository_capabilities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repository_capabilities
    ADD CONSTRAINT repository_capabilities_pkey PRIMARY KEY (id);


--
-- Name: repository_domains repository_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repository_domains
    ADD CONSTRAINT repository_domains_pkey PRIMARY KEY (id);


--
-- Name: repository_intelligence_signals repository_intelligence_signals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repository_intelligence_signals
    ADD CONSTRAINT repository_intelligence_signals_pkey PRIMARY KEY (id);


--
-- Name: repository_skill_attributions repository_skill_attributions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repository_skill_attributions
    ADD CONSTRAINT repository_skill_attributions_pkey PRIMARY KEY (id);


--
-- Name: representative_approval_votes representative_approval_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.representative_approval_votes
    ADD CONSTRAINT representative_approval_votes_pkey PRIMARY KEY (id);


--
-- Name: representative_authority_histories representative_authority_histories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.representative_authority_histories
    ADD CONSTRAINT representative_authority_histories_pkey PRIMARY KEY (id);


--
-- Name: representative_rotation_requests representative_rotation_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.representative_rotation_requests
    ADD CONSTRAINT representative_rotation_requests_pkey PRIMARY KEY (id);


--
-- Name: reset_password_tokens reset_password_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reset_password_tokens
    ADD CONSTRAINT reset_password_tokens_pkey PRIMARY KEY (id);


--
-- Name: reset_password_tokens reset_password_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reset_password_tokens
    ADD CONSTRAINT reset_password_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: role_assignments role_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_assignments
    ADD CONSTRAINT role_assignments_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: seeding_history seeding_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seeding_history
    ADD CONSTRAINT seeding_history_pkey PRIMARY KEY (module_id);


--
-- Name: source_code_repositories source_code_repositories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.source_code_repositories
    ADD CONSTRAINT source_code_repositories_pkey PRIMARY KEY (id);


--
-- Name: system_metadata system_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_metadata
    ADD CONSTRAINT system_metadata_pkey PRIMARY KEY (key);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: user_profiles user_profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_username_key UNIQUE (username);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: user_skills user_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_skills
    ADD CONSTRAINT user_skills_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verification_links verification_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verification_links
    ADD CONSTRAINT verification_links_pkey PRIMARY KEY (id);


--
-- Name: verification_tokens verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verification_tokens
    ADD CONSTRAINT verification_tokens_pkey PRIMARY KEY (id);


--
-- Name: verification_tokens verification_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verification_tokens
    ADD CONSTRAINT verification_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: work_experience_achievements work_experience_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_experience_achievements
    ADD CONSTRAINT work_experience_achievements_pkey PRIMARY KEY (id);


--
-- Name: work_experience_entries work_experience_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_experience_entries
    ADD CONSTRAINT work_experience_entries_pkey PRIMARY KEY (id);


--
-- Name: work_experience_links work_experience_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_experience_links
    ADD CONSTRAINT work_experience_links_pkey PRIMARY KEY (id);


--
-- Name: work_experience_technologies work_experience_technologies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_experience_technologies
    ADD CONSTRAINT work_experience_technologies_pkey PRIMARY KEY (id);


--
-- Name: workspace_archive_snapshots workspace_archive_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_archive_snapshots
    ADD CONSTRAINT workspace_archive_snapshots_pkey PRIMARY KEY (id);


--
-- Name: workspace_members workspace_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_pkey PRIMARY KEY (id);


--
-- Name: workspace_posts workspace_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_posts
    ADD CONSTRAINT workspace_posts_pkey PRIMARY KEY (id);


--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


--
-- Name: idx_academic_achievements_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_academic_achievements_user_id ON public.academic_achievements USING btree (user_id);


--
-- Name: idx_activity_events_correlation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_events_correlation ON public.activity_events USING btree (correlation_id);


--
-- Name: idx_activity_events_org_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_events_org_created ON public.activity_events USING btree (organization_id, created_at);


--
-- Name: idx_admin_invitations_token_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_admin_invitations_token_hash ON public.admin_invitations USING btree (token_hash);


--
-- Name: idx_ai_inferred_skills; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_inferred_skills ON public.ai_inferred_preferences USING gin (inferred_skills);


--
-- Name: idx_analysis_executions_job_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_analysis_executions_job_id ON public.analysis_executions USING btree (job_id);


--
-- Name: idx_analysis_executions_task_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_analysis_executions_task_id ON public.analysis_executions USING btree (task_id);


--
-- Name: idx_analysis_executions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_analysis_executions_user_id ON public.analysis_executions USING btree (user_id);


--
-- Name: idx_analysis_job_events_job_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_analysis_job_events_job_id ON public.analysis_job_events USING btree (job_id);


--
-- Name: idx_analysis_jobs_repository_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_analysis_jobs_repository_id ON public.analysis_jobs USING btree (repository_id);


--
-- Name: idx_analysis_jobs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_analysis_jobs_user_id ON public.analysis_jobs USING btree (user_id);


--
-- Name: idx_analysis_reports_repository_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_analysis_reports_repository_id ON public.analysis_reports USING btree (repository_id);


--
-- Name: idx_analysis_task_events_task_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_analysis_task_events_task_id ON public.analysis_task_events USING btree (task_id);


--
-- Name: idx_analysis_tasks_job_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_analysis_tasks_job_id ON public.analysis_tasks USING btree (job_id);


--
-- Name: idx_analysis_tasks_job_id_task_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_analysis_tasks_job_id_task_type ON public.analysis_tasks USING btree (job_id, task_type);


--
-- Name: idx_approved_recovery_sessions_token_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_approved_recovery_sessions_token_hash ON public.approved_recovery_sessions USING btree (recovery_token_hash);


--
-- Name: idx_audit_logs_actor_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_actor_user_id ON public.audit_logs USING btree (actor_user_id);


--
-- Name: idx_audit_logs_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_organization_id ON public.audit_logs USING btree (organization_id);


--
-- Name: idx_audit_logs_target_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_target_user_id ON public.audit_logs USING btree (target_user_id);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_auth_providers_key_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_auth_providers_key_active ON public.auth_providers USING btree (provider_name, provider_key) WHERE (deleted_at IS NULL);


--
-- Name: idx_auth_providers_user_type_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_auth_providers_user_type_active ON public.auth_providers USING btree (user_id, provider_name) WHERE ((deleted_at IS NULL) AND ((provider_name)::text = 'google'::text));


--
-- Name: idx_auth_providers_user_type_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_auth_providers_user_type_lookup ON public.auth_providers USING btree (user_id, provider_name) WHERE (deleted_at IS NULL);


--
-- Name: idx_business_outcomes_hr_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_business_outcomes_hr_id ON public.business_outcomes USING btree (hiring_requirement_id);


--
-- Name: idx_candidate_assessment_artifacts_assessment_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_candidate_assessment_artifacts_assessment_id ON public.candidate_assessment_artifacts USING btree (assessment_id);


--
-- Name: idx_candidate_assessments_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_candidate_assessments_user_id ON public.candidate_assessments USING btree (user_id);


--
-- Name: idx_candidate_discovery_runs_requirement_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_candidate_discovery_runs_requirement_id ON public.candidate_discovery_runs USING btree (hiring_requirement_id);


--
-- Name: idx_candidate_discovery_runs_triggered_by_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_candidate_discovery_runs_triggered_by_id ON public.candidate_discovery_runs USING btree (triggered_by_id);


--
-- Name: idx_candidate_skills_assessment_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_candidate_skills_assessment_id ON public.candidate_skills USING btree (candidate_assessment_id);


--
-- Name: idx_career_prefs_desired_roles; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_career_prefs_desired_roles ON public.career_preferences USING gin (desired_job_positions);


--
-- Name: idx_career_prefs_target_skills; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_career_prefs_target_skills ON public.career_preferences USING gin (target_skills);


--
-- Name: idx_conversations_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_user_id ON public.conversations USING btree (user_id);


--
-- Name: idx_cv_repository_mappings_repo_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cv_repository_mappings_repo_id ON public.cv_repository_mappings USING btree (source_code_repository_id);


--
-- Name: idx_cv_repository_mappings_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cv_repository_mappings_user_id ON public.cv_repository_mappings USING btree (user_id);


--
-- Name: idx_education_entries_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_education_entries_user_id ON public.education_entries USING btree (user_id);


--
-- Name: idx_evaluation_rubrics_hr_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_evaluation_rubrics_hr_id ON public.evaluation_rubrics USING btree (hiring_requirement_id);


--
-- Name: idx_evidence_signals_cap_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_evidence_signals_cap_id ON public.evidence_signals USING btree (requirement_capability_id);


--
-- Name: idx_external_organizations_provider_external_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_external_organizations_provider_external_active ON public.external_organizations USING btree (auth_provider_id, external_id);


--
-- Name: idx_hiring_requirements_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hiring_requirements_org_id ON public.hiring_requirements USING btree (organization_id);


--
-- Name: idx_hiring_requirements_workspace_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hiring_requirements_workspace_id ON public.hiring_requirements USING btree (workspace_id);


--
-- Name: idx_in_app_notifications_aggregate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_in_app_notifications_aggregate ON public.in_app_notifications USING btree (user_id, aggregate_key) WHERE ((is_read = false) AND (deleted_at IS NULL));


--
-- Name: idx_in_app_notifications_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_in_app_notifications_user_id ON public.in_app_notifications USING btree (user_id);


--
-- Name: idx_in_app_notifications_user_unread; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_in_app_notifications_user_unread ON public.in_app_notifications USING btree (user_id, is_read) WHERE (deleted_at IS NULL);


--
-- Name: idx_interview_blueprints_hr_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interview_blueprints_hr_id ON public.interview_blueprints USING btree (hiring_requirement_id);


--
-- Name: idx_job_artifact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_job_artifact ON public.artifact_registry_entries USING btree (job_id, artifact_id);


--
-- Name: idx_job_task_identifier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_job_task_identifier ON public.pipeline_tasks USING btree (job_id, task_identifier);


--
-- Name: idx_job_vacancies_published_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_vacancies_published_active ON public.job_vacancies USING btree (status, is_active) WHERE (((status)::text = 'Published'::text) AND (is_active = true));


--
-- Name: idx_messages_conversation_id_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_conversation_id_created_at ON public.messages USING btree (conversation_id, created_at);


--
-- Name: idx_org_invitations_email_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_org_invitations_email_status ON public.organization_invitations USING btree (invitee_email, status);


--
-- Name: idx_org_invitations_token_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_org_invitations_token_hash ON public.organization_invitations USING btree (token_hash);


--
-- Name: idx_organization_candidates_composite; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_organization_candidates_composite ON public.organization_candidates USING btree (organization_id, candidate_id);


--
-- Name: idx_organization_credentials_username_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_organization_credentials_username_active ON public.organization_credentials USING btree (username) WHERE (deleted_at IS NULL);


--
-- Name: idx_organization_followers_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organization_followers_org_id ON public.organization_followers USING btree (organization_id);


--
-- Name: idx_organization_memberships_org_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_organization_memberships_org_user ON public.organization_memberships USING btree (organization_id, user_id);


--
-- Name: idx_organization_verifications_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organization_verifications_org_id ON public.organization_verifications USING btree (organization_id);


--
-- Name: idx_organizations_tax_code_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_organizations_tax_code_active ON public.organizations USING btree (tax_code) WHERE (deleted_at IS NULL);


--
-- Name: idx_organizations_username_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_organizations_username_active ON public.organizations USING btree (username) WHERE (deleted_at IS NULL);


--
-- Name: idx_otp_verifications_challenge_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_otp_verifications_challenge_id ON public.otp_verifications USING btree (challenge_id);


--
-- Name: idx_otp_verifications_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_otp_verifications_email ON public.otp_verifications USING btree (email);


--
-- Name: idx_outbox_messages_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_outbox_messages_pending ON public.outbox_messages USING btree (created_at) WHERE (processed_at IS NULL);


--
-- Name: idx_pending_auth_providers_expiry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pending_auth_providers_expiry ON public.pending_auth_providers USING btree (expires_at);


--
-- Name: idx_pending_org_ownership_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_pending_org_ownership_unique ON public.pending_organization_ownerships USING btree (organization_id, owner_email) WHERE (consumed_at IS NULL);


--
-- Name: idx_permissions_hierarchy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_permissions_hierarchy ON public.permissions USING btree (name varchar_pattern_ops);


--
-- Name: idx_profile_attachments_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profile_attachments_entity ON public.profile_attachments USING btree (entity_type, entity_id);


--
-- Name: idx_profile_attachments_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profile_attachments_user_id ON public.profile_attachments USING btree (user_id);


--
-- Name: idx_project_contributions_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_contributions_project_id ON public.project_contributions USING btree (project_entry_id);


--
-- Name: idx_project_entries_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_entries_user_id ON public.project_entries USING btree (user_id);


--
-- Name: idx_project_repo_links_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_project_repo_links_unique ON public.project_repository_links USING btree (project_entry_id, source_code_repository_id);


--
-- Name: idx_project_technologies_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_technologies_project_id ON public.project_technologies USING btree (project_entry_id);


--
-- Name: idx_recovery_tokens_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_recovery_tokens_active ON public.recovery_tokens USING btree (token_hash) WHERE ((consumed_at IS NULL) AND (revoked_at IS NULL));


--
-- Name: idx_recovery_tokens_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_recovery_tokens_organization_id ON public.recovery_tokens USING btree (organization_id);


--
-- Name: idx_recovery_tokens_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_recovery_tokens_user_id ON public.recovery_tokens USING btree (user_id);


--
-- Name: idx_refresh_tokens_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_refresh_tokens_expires_at ON public.refresh_tokens USING btree (expires_at);


--
-- Name: idx_refresh_tokens_session_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_refresh_tokens_session_id ON public.refresh_tokens USING btree (session_id);


--
-- Name: idx_refresh_tokens_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_refresh_tokens_token ON public.refresh_tokens USING btree (token);


--
-- Name: idx_refresh_tokens_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_refresh_tokens_user ON public.refresh_tokens USING btree (user_id);


--
-- Name: idx_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: idx_repository_assessments_job_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repository_assessments_job_id ON public.repository_assessments USING btree (analysis_job_id);


--
-- Name: idx_repository_assessments_repo_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repository_assessments_repo_id ON public.repository_assessments USING btree (repository_id);


--
-- Name: idx_repository_capabilities_assessment_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repository_capabilities_assessment_id ON public.repository_capabilities USING btree (repository_assessment_id);


--
-- Name: idx_repository_domains_assessment_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repository_domains_assessment_id ON public.repository_domains USING btree (repository_assessment_id);


--
-- Name: idx_repository_skill_attributions_assessment_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repository_skill_attributions_assessment_id ON public.repository_skill_attributions USING btree (repository_assessment_id);


--
-- Name: idx_requirement_capabilities_hr_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requirement_capabilities_hr_id ON public.requirement_capabilities USING btree (hiring_requirement_id);


--
-- Name: idx_requirement_snapshots_hr_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requirement_snapshots_hr_id ON public.requirement_snapshots USING btree (hiring_requirement_id);


--
-- Name: idx_reset_password_tokens_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reset_password_tokens_active ON public.reset_password_tokens USING btree (token_hash) WHERE (consumed_at IS NULL);


--
-- Name: idx_responsibilities_hr_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_responsibilities_hr_id ON public.responsibilities USING btree (hiring_requirement_id);


--
-- Name: idx_role_assignments_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_role_assignments_unique ON public.role_assignments USING btree (user_id, role_id, scope_type, scope_id);


--
-- Name: idx_roles_name_system; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_roles_name_system ON public.roles USING btree (name) WHERE (tenant_id IS NULL);


--
-- Name: idx_roles_tenant_id_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_roles_tenant_id_name ON public.roles USING btree (tenant_id, name);


--
-- Name: idx_source_code_repositories_accessible; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_source_code_repositories_accessible ON public.source_code_repositories USING btree (is_accessible) WHERE (is_accessible = true);


--
-- Name: idx_source_code_repositories_authenticity_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_source_code_repositories_authenticity_type ON public.source_code_repositories USING btree (authenticity_type) WHERE (authenticity_type IS NOT NULL);


--
-- Name: idx_source_code_repositories_classification; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_source_code_repositories_classification ON public.source_code_repositories USING btree (classification) WHERE (classification IS NOT NULL);


--
-- Name: idx_source_code_repositories_external_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_source_code_repositories_external_active ON public.source_code_repositories USING btree (auth_provider_id, external_repository_id);


--
-- Name: idx_source_code_repositories_language; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_source_code_repositories_language ON public.source_code_repositories USING btree (primary_language) WHERE (primary_language IS NOT NULL);


--
-- Name: idx_source_code_repositories_latest_analysis_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_source_code_repositories_latest_analysis_status ON public.source_code_repositories USING btree (latest_analysis_status);


--
-- Name: idx_source_code_repositories_latest_risk_score; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_source_code_repositories_latest_risk_score ON public.source_code_repositories USING btree (latest_risk_score);


--
-- Name: idx_source_code_repositories_owner_login; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_source_code_repositories_owner_login ON public.source_code_repositories USING btree (owner_login);


--
-- Name: idx_source_code_repositories_stars; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_source_code_repositories_stars ON public.source_code_repositories USING btree (stars_count DESC);


--
-- Name: idx_source_code_repositories_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_source_code_repositories_updated ON public.source_code_repositories USING btree (last_updated_utc DESC);


--
-- Name: idx_technology_requirements_hr_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_technology_requirements_hr_id ON public.technology_requirements USING btree (hiring_requirement_id);


--
-- Name: idx_user_notification_prefs; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_user_notification_prefs ON public.notification_preferences USING btree (user_id, notification_type, channel);


--
-- Name: idx_user_profiles_username_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_user_profiles_username_active ON public.user_profiles USING btree (username) WHERE (deleted_at IS NULL);


--
-- Name: idx_user_skills_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_skills_name ON public.user_skills USING btree (skill);


--
-- Name: idx_user_skills_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_skills_user_id ON public.user_skills USING btree (user_id);


--
-- Name: idx_users_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_active ON public.users USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_users_email_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_users_email_active ON public.users USING btree (email) WHERE ((deleted_at IS NULL) OR (status = 'DELETION_PENDING'::public.user_status));


--
-- Name: idx_users_username_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_users_username_active ON public.users USING btree (username) WHERE ((deleted_at IS NULL) OR (status = 'DELETION_PENDING'::public.user_status));


--
-- Name: idx_verification_links_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_verification_links_active ON public.verification_links USING btree (token_hash) WHERE ((deleted_at IS NULL) AND (consumed_at IS NULL));


--
-- Name: idx_verification_tokens_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_verification_tokens_active ON public.verification_tokens USING btree (token_hash) WHERE (consumed_at IS NULL);


--
-- Name: idx_work_experience_achievements_entry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_experience_achievements_entry ON public.work_experience_achievements USING btree (work_experience_id);


--
-- Name: idx_work_experience_entries_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_experience_entries_user_id ON public.work_experience_entries USING btree (user_id);


--
-- Name: idx_work_experience_links_entry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_experience_links_entry ON public.work_experience_links USING btree (work_experience_id);


--
-- Name: idx_work_experience_technologies_entry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_experience_technologies_entry ON public.work_experience_technologies USING btree (work_experience_id);


--
-- Name: idx_workspace_members_workspace_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_workspace_members_workspace_user ON public.workspace_members USING btree (workspace_id, user_id);


--
-- Name: idx_workspaces_slug_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_workspaces_slug_active ON public.workspaces USING btree (slug) WHERE (deleted_at IS NULL);


--
-- Name: ix_activity_events_actor_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_activity_events_actor_user_id ON public.activity_events USING btree (actor_user_id);


--
-- Name: ix_ai_streaming_logs_session_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_ai_streaming_logs_session_id ON public.ai_streaming_logs USING btree (session_id);


--
-- Name: ix_ai_streaming_metrics_session_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_ai_streaming_metrics_session_id ON public.ai_streaming_metrics USING btree (session_id);


--
-- Name: ix_ai_streaming_sessions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_ai_streaming_sessions_user_id ON public.ai_streaming_sessions USING btree (user_id);


--
-- Name: ix_ai_streaming_sessions_workspace_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_ai_streaming_sessions_workspace_id ON public.ai_streaming_sessions USING btree (workspace_id);


--
-- Name: ix_ai_streaming_stages_session_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_ai_streaming_stages_session_id ON public.ai_streaming_stages USING btree (session_id);


--
-- Name: ix_artifact_registry_entries_job_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_artifact_registry_entries_job_id ON public.artifact_registry_entries USING btree (job_id);


--
-- Name: ix_candidate_best_fit_roles_candidate_assessment_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_candidate_best_fit_roles_candidate_assessment_id ON public.candidate_best_fit_roles USING btree (candidate_assessment_id);


--
-- Name: ix_candidate_capabilities_candidate_id_capability_node_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_candidate_capabilities_candidate_id_capability_node_id ON public.candidate_capabilities USING btree (candidate_id, capability_node_id);


--
-- Name: ix_candidate_capabilities_capability_node_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_candidate_capabilities_capability_node_id ON public.candidate_capabilities USING btree (capability_node_id);


--
-- Name: ix_candidate_capability_evidences_evidence_artifact_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_candidate_capability_evidences_evidence_artifact_id ON public.candidate_capability_evidences USING btree (evidence_artifact_id);


--
-- Name: ix_candidate_capability_histories_candidate_capability_id_reco; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_candidate_capability_histories_candidate_capability_id_reco ON public.candidate_capability_histories USING btree (candidate_capability_id, recorded_at);


--
-- Name: ix_candidate_domain_profiles_candidate_assessment_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_candidate_domain_profiles_candidate_assessment_id ON public.candidate_domain_profiles USING btree (candidate_assessment_id);


--
-- Name: ix_candidate_intelligence_signals_candidate_assessment_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_candidate_intelligence_signals_candidate_assessment_id ON public.candidate_intelligence_signals USING btree (candidate_assessment_id);


--
-- Name: ix_candidate_skill_tree_nodes_candidate_assessment_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_candidate_skill_tree_nodes_candidate_assessment_id ON public.candidate_skill_tree_nodes USING btree (candidate_assessment_id);


--
-- Name: ix_candidate_skill_tree_nodes_parent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_candidate_skill_tree_nodes_parent_id ON public.candidate_skill_tree_nodes USING btree (parent_id);


--
-- Name: ix_candidate_skills_candidate_assessment_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_candidate_skills_candidate_assessment_id ON public.candidate_skills USING btree (candidate_assessment_id);


--
-- Name: ix_candidate_strengths_weaknesses_candidate_assessment_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_candidate_strengths_weaknesses_candidate_assessment_id ON public.candidate_strengths_weaknesses USING btree (candidate_assessment_id);


--
-- Name: ix_candidate_trust_projections_trust_profile_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_candidate_trust_projections_trust_profile_id ON public.candidate_trust_projections USING btree (trust_profile_id);


--
-- Name: ix_capability_aliases_canonical_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_capability_aliases_canonical_id ON public.capability_aliases USING btree (canonical_id);


--
-- Name: ix_capability_catalog_items_workspace_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_capability_catalog_items_workspace_id ON public.capability_catalog_items USING btree (workspace_id);


--
-- Name: ix_capability_edges_target_node_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_capability_edges_target_node_id ON public.capability_edges USING btree (target_node_id);


--
-- Name: ix_capability_hierarchies_child_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_capability_hierarchies_child_id ON public.capability_hierarchies USING btree (child_id);


--
-- Name: ix_capability_nodes_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_capability_nodes_slug ON public.capability_nodes USING btree (slug);


--
-- Name: ix_capability_registries_deprecated_by_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_capability_registries_deprecated_by_id ON public.capability_registries USING btree (deprecated_by_id);


--
-- Name: ix_capability_registries_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_capability_registries_status ON public.capability_registries USING btree (status);


--
-- Name: ix_capability_registries_taxonomy_version; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_capability_registries_taxonomy_version ON public.capability_registries USING btree (taxonomy_version);


--
-- Name: ix_enterprise_workflow_requests_assigned_reviewer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_enterprise_workflow_requests_assigned_reviewer_id ON public.enterprise_workflow_requests USING btree (assigned_reviewer_id);


--
-- Name: ix_enterprise_workflow_requests_escalated_to_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_enterprise_workflow_requests_escalated_to_user_id ON public.enterprise_workflow_requests USING btree (escalated_to_user_id);


--
-- Name: ix_enterprise_workflow_requests_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_enterprise_workflow_requests_organization_id ON public.enterprise_workflow_requests USING btree (organization_id);


--
-- Name: ix_evidence_artifacts_source_id_external_identifier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_evidence_artifacts_source_id_external_identifier ON public.evidence_artifacts USING btree (source_id, external_identifier);


--
-- Name: ix_evidence_claims_candidate_id_evidence_artifact_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_evidence_claims_candidate_id_evidence_artifact_id ON public.evidence_claims USING btree (candidate_id, evidence_artifact_id);


--
-- Name: ix_evidence_claims_evidence_artifact_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_evidence_claims_evidence_artifact_id ON public.evidence_claims USING btree (evidence_artifact_id);


--
-- Name: ix_evidence_verifications_evidence_claim_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_evidence_verifications_evidence_claim_id ON public.evidence_verifications USING btree (evidence_claim_id);


--
-- Name: ix_forum_bookmarks_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_bookmarks_user_id ON public.forum_bookmarks USING btree (user_id);


--
-- Name: ix_forum_categories_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_categories_organization_id ON public.forum_categories USING btree (organization_id);


--
-- Name: ix_forum_category_moderators_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_category_moderators_user_id ON public.forum_category_moderators USING btree (user_id);


--
-- Name: ix_forum_follows_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_follows_user_id ON public.forum_follows USING btree (user_id);


--
-- Name: ix_forum_moderation_logs_moderator_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_moderation_logs_moderator_id ON public.forum_moderation_logs USING btree (moderator_id);


--
-- Name: ix_forum_reactions_reply_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_reactions_reply_id ON public.forum_reactions USING btree (reply_id);


--
-- Name: ix_forum_reactions_topic_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_reactions_topic_id ON public.forum_reactions USING btree (topic_id);


--
-- Name: ix_forum_reactions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_reactions_user_id ON public.forum_reactions USING btree (user_id);


--
-- Name: ix_forum_replies_author_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_replies_author_id ON public.forum_replies USING btree (author_id);


--
-- Name: ix_forum_replies_parent_reply_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_replies_parent_reply_id ON public.forum_replies USING btree (parent_reply_id);


--
-- Name: ix_forum_replies_topic_id_parent_reply_id_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_replies_topic_id_parent_reply_id_created_at ON public.forum_replies USING btree (topic_id, parent_reply_id, created_at);


--
-- Name: ix_forum_reply_histories_edited_by_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_reply_histories_edited_by_id ON public.forum_reply_histories USING btree (edited_by_id);


--
-- Name: ix_forum_reply_histories_reply_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_reply_histories_reply_id ON public.forum_reply_histories USING btree (reply_id);


--
-- Name: ix_forum_reports_reply_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_reports_reply_id ON public.forum_reports USING btree (reply_id);


--
-- Name: ix_forum_reports_reported_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_reports_reported_user_id ON public.forum_reports USING btree (reported_user_id);


--
-- Name: ix_forum_reports_reporter_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_reports_reporter_user_id ON public.forum_reports USING btree (reporter_user_id);


--
-- Name: ix_forum_reports_resolved_by_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_reports_resolved_by_id ON public.forum_reports USING btree (resolved_by_id);


--
-- Name: ix_forum_reports_topic_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_reports_topic_id ON public.forum_reports USING btree (topic_id);


--
-- Name: ix_forum_tags_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_forum_tags_name ON public.forum_tags USING btree (name);


--
-- Name: ix_forum_tags_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_forum_tags_slug ON public.forum_tags USING btree (slug);


--
-- Name: ix_forum_topic_histories_edited_by_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_topic_histories_edited_by_id ON public.forum_topic_histories USING btree (edited_by_id);


--
-- Name: ix_forum_topic_histories_topic_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_topic_histories_topic_id ON public.forum_topic_histories USING btree (topic_id);


--
-- Name: ix_forum_topic_tags_tag_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_topic_tags_tag_id ON public.forum_topic_tags USING btree (tag_id);


--
-- Name: ix_forum_topics_author_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_topics_author_id ON public.forum_topics USING btree (author_id);


--
-- Name: ix_forum_topics_category_id_is_pinned_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_topics_category_id_is_pinned_created_at ON public.forum_topics USING btree (category_id, is_pinned, created_at);


--
-- Name: ix_forum_topics_organization_id_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_topics_organization_id_created_at ON public.forum_topics USING btree (organization_id, created_at);


--
-- Name: ix_forum_topics_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_forum_topics_slug ON public.forum_topics USING btree (slug);


--
-- Name: ix_forum_user_badges_badge_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_user_badges_badge_id ON public.forum_user_badges USING btree (badge_id);


--
-- Name: ix_forum_votes_reply_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_votes_reply_id ON public.forum_votes USING btree (reply_id);


--
-- Name: ix_forum_votes_topic_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_votes_topic_id ON public.forum_votes USING btree (topic_id);


--
-- Name: ix_forum_votes_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_forum_votes_user_id ON public.forum_votes USING btree (user_id);


--
-- Name: ix_in_app_notifications_activity_event_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_in_app_notifications_activity_event_id ON public.in_app_notifications USING btree (activity_event_id);


--
-- Name: ix_job_applications_candidate_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_job_applications_candidate_id ON public.job_applications USING btree (candidate_id);


--
-- Name: ix_job_applications_job_vacancy_id_candidate_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_job_applications_job_vacancy_id_candidate_id ON public.job_applications USING btree (job_vacancy_id, candidate_id);


--
-- Name: ix_job_interactions_job_vacancy_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_job_interactions_job_vacancy_id ON public.job_interactions USING btree (job_vacancy_id);


--
-- Name: ix_job_interactions_user_id_interaction_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_job_interactions_user_id_interaction_type ON public.job_interactions USING btree (user_id, interaction_type);


--
-- Name: ix_job_interactions_user_id_job_vacancy_id_interaction_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_job_interactions_user_id_job_vacancy_id_interaction_type ON public.job_interactions USING btree (user_id, job_vacancy_id, interaction_type);


--
-- Name: ix_job_vacancies_hiring_requirement_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_job_vacancies_hiring_requirement_id ON public.job_vacancies USING btree (hiring_requirement_id);


--
-- Name: ix_job_vacancies_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_job_vacancies_organization_id ON public.job_vacancies USING btree (organization_id);


--
-- Name: ix_job_vacancies_requirement_snapshot_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_job_vacancies_requirement_snapshot_id ON public.job_vacancies USING btree (requirement_snapshot_id);


--
-- Name: ix_matching_evaluations_candidate_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_matching_evaluations_candidate_id ON public.matching_evaluations USING btree (candidate_id);


--
-- Name: ix_matching_evaluations_job_vacancy_id_candidate_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_matching_evaluations_job_vacancy_id_candidate_id ON public.matching_evaluations USING btree (job_vacancy_id, candidate_id);


--
-- Name: ix_matching_explanations_capability_node_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_matching_explanations_capability_node_id ON public.matching_explanations USING btree (capability_node_id);


--
-- Name: ix_matching_explanations_matching_evaluation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_matching_explanations_matching_evaluation_id ON public.matching_explanations USING btree (matching_evaluation_id);


--
-- Name: ix_matching_explanations_supporting_artifact_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_matching_explanations_supporting_artifact_id ON public.matching_explanations USING btree (supporting_artifact_id);


--
-- Name: ix_matching_factors_matching_evaluation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_matching_factors_matching_evaluation_id ON public.matching_factors USING btree (matching_evaluation_id);


--
-- Name: ix_organization_candidates_candidate_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_organization_candidates_candidate_id ON public.organization_candidates USING btree (candidate_id);


--
-- Name: ix_organization_candidates_recruiter_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_organization_candidates_recruiter_id ON public.organization_candidates USING btree (recruiter_id);


--
-- Name: ix_organization_candidates_saved_by_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_organization_candidates_saved_by_id ON public.organization_candidates USING btree (saved_by_id);


--
-- Name: ix_pipeline_events_durable_execution_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_pipeline_events_durable_execution_id ON public.pipeline_events_durable USING btree (execution_id);


--
-- Name: ix_pipeline_executions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_pipeline_executions_user_id ON public.pipeline_executions USING btree (user_id);


--
-- Name: ix_pipeline_executions_workspace_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_pipeline_executions_workspace_id ON public.pipeline_executions USING btree (workspace_id);


--
-- Name: ix_pipeline_stages_execution_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_pipeline_stages_execution_id ON public.pipeline_stages USING btree (execution_id);


--
-- Name: ix_pipeline_tasks_durable_execution_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_pipeline_tasks_durable_execution_id ON public.pipeline_tasks_durable USING btree (execution_id);


--
-- Name: ix_pipeline_tasks_job_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_pipeline_tasks_job_id ON public.pipeline_tasks USING btree (job_id);


--
-- Name: ix_project_repository_links_source_code_repository_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_project_repository_links_source_code_repository_id ON public.project_repository_links USING btree (source_code_repository_id);


--
-- Name: ix_requirement_artifact_snapshots_requirement_snapshot_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_requirement_artifact_snapshots_requirement_snapshot_id ON public.requirement_artifact_snapshots USING btree (requirement_snapshot_id);


--
-- Name: ix_requirement_artifacts_hiring_requirement_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_requirement_artifacts_hiring_requirement_id ON public.requirement_artifacts USING btree (hiring_requirement_id);


--
-- Name: ix_security_event_comments_author_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_security_event_comments_author_user_id ON public.security_event_comments USING btree (author_user_id);


--
-- Name: ix_security_event_comments_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_security_event_comments_created_at ON public.security_event_comments USING btree (created_at);


--
-- Name: ix_security_event_comments_security_event_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_security_event_comments_security_event_id ON public.security_event_comments USING btree (security_event_id);


--
-- Name: ix_security_event_comments_security_incident_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_security_event_comments_security_incident_id ON public.security_event_comments USING btree (security_incident_id);


--
-- Name: ix_security_events_actor_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_security_events_actor_user_id ON public.security_events USING btree (actor_user_id);


--
-- Name: ix_security_events_assigned_to_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_security_events_assigned_to_user_id ON public.security_events USING btree (assigned_to_user_id);


--
-- Name: ix_security_events_correlation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_security_events_correlation_id ON public.security_events USING btree (correlation_id);


--
-- Name: ix_security_events_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_security_events_created_at ON public.security_events USING btree (created_at);


--
-- Name: ix_security_events_event_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_security_events_event_type ON public.security_events USING btree (event_type);


--
-- Name: ix_security_events_incident_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_security_events_incident_id ON public.security_events USING btree (incident_id);


--
-- Name: ix_security_events_ip_address; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_security_events_ip_address ON public.security_events USING btree (ip_address);


--
-- Name: ix_security_events_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_security_events_organization_id ON public.security_events USING btree (organization_id);


--
-- Name: ix_security_events_severity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_security_events_severity ON public.security_events USING btree (severity);


--
-- Name: ix_security_events_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_security_events_status ON public.security_events USING btree (status);


--
-- Name: ix_security_events_target_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_security_events_target_user_id ON public.security_events USING btree (target_user_id);


--
-- Name: ix_security_incidents_assigned_to_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_security_incidents_assigned_to_user_id ON public.security_incidents USING btree (assigned_to_user_id);


--
-- Name: ix_security_incidents_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_security_incidents_created_at ON public.security_incidents USING btree (created_at);


--
-- Name: ix_security_incidents_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_security_incidents_status ON public.security_incidents USING btree (status);


--
-- Name: ix_security_rules_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_security_rules_code ON public.security_rules USING btree (code);


--
-- Name: ix_source_code_repositories_external_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_source_code_repositories_external_organization_id ON public.source_code_repositories USING btree (external_organization_id);


--
-- Name: ix_trust_calculations_trust_profile_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_trust_calculations_trust_profile_id ON public.trust_calculations USING btree (trust_profile_id);


--
-- Name: ix_trust_components_trust_profile_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_trust_components_trust_profile_id ON public.trust_components USING btree (trust_profile_id);


--
-- Name: ix_trust_profiles_target_entity_id_target_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_trust_profiles_target_entity_id_target_type ON public.trust_profiles USING btree (target_entity_id, target_type);


--
-- Name: ix_user_followers_followee_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_user_followers_followee_id ON public.user_followers USING btree (followee_id);


--
-- Name: ix_workflow_attachments_workflow_request_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_workflow_attachments_workflow_request_id ON public.workflow_attachments USING btree (workflow_request_id);


--
-- Name: ix_workflow_comments_author_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_workflow_comments_author_user_id ON public.workflow_comments USING btree (author_user_id);


--
-- Name: ix_workflow_comments_workflow_request_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_workflow_comments_workflow_request_id ON public.workflow_comments USING btree (workflow_request_id);


--
-- Name: ix_workspace_posts_created_by_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_workspace_posts_created_by_user_id ON public.workspace_posts USING btree (created_by_user_id);


--
-- Name: ix_workspace_posts_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_workspace_posts_organization_id ON public.workspace_posts USING btree (organization_id);


--
-- Name: ix_workspaces_owner_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_workspaces_owner_id ON public.workspaces USING btree (owner_id);


--
-- Name: ux_candidate_assessment_artifacts_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ux_candidate_assessment_artifacts_type ON public.candidate_assessment_artifacts USING btree (assessment_id, artifact_type);


--
-- Name: ux_candidate_assessments_user_version; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ux_candidate_assessments_user_version ON public.candidate_assessments USING btree (user_id, version);


--
-- Name: ux_candidate_skills_assessment_id_skill; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ux_candidate_skills_assessment_id_skill ON public.candidate_skills USING btree (candidate_assessment_id, skill_id, taxonomy_version);


--
-- Name: ux_repository_assessments_repo_sha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ux_repository_assessments_repo_sha ON public.repository_assessments USING btree (repository_id, commit_sha);


--
-- Name: ux_repository_capabilities_assessment_id_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ux_repository_capabilities_assessment_id_name ON public.repository_capabilities USING btree (repository_assessment_id, name);


--
-- Name: ux_repository_domains_assessment_id_domain; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ux_repository_domains_assessment_id_domain ON public.repository_domains USING btree (repository_assessment_id, domain_name);


--
-- Name: ux_repository_intelligence_signals_assessment_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ux_repository_intelligence_signals_assessment_id ON public.repository_intelligence_signals USING btree (repository_assessment_id);


--
-- Name: ux_repository_skill_attributions_assessment_id_skill; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ux_repository_skill_attributions_assessment_id_skill ON public.repository_skill_attributions USING btree (repository_assessment_id, skill_id, taxonomy_version);


--
-- Name: academic_achievements tr_academic_achievements_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_academic_achievements_timestamp BEFORE UPDATE ON public.academic_achievements FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- Name: admin_members tr_admin_members_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_admin_members_timestamp BEFORE UPDATE ON public.admin_members FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- Name: career_preferences tr_career_preferences_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_career_preferences_timestamp BEFORE UPDATE ON public.career_preferences FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- Name: conversations tr_conversations_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_conversations_timestamp BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- Name: education_entries tr_education_entries_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_education_entries_timestamp BEFORE UPDATE ON public.education_entries FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- Name: permissions tr_permissions_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_permissions_timestamp BEFORE UPDATE ON public.permissions FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- Name: profile_attachments tr_profile_attachments_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_profile_attachments_timestamp BEFORE UPDATE ON public.profile_attachments FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- Name: roles tr_roles_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_roles_timestamp BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- Name: user_profiles tr_user_profiles_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_user_profiles_timestamp BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- Name: users tr_users_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_users_timestamp BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- Name: work_experience_achievements tr_work_experience_achievements_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_work_experience_achievements_timestamp BEFORE UPDATE ON public.work_experience_achievements FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- Name: work_experience_entries tr_work_experience_entries_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_work_experience_entries_timestamp BEFORE UPDATE ON public.work_experience_entries FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- Name: admin_invitation_roles admin_invitation_roles_invitation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_invitation_roles
    ADD CONSTRAINT admin_invitation_roles_invitation_id_fkey FOREIGN KEY (invitation_id) REFERENCES public.admin_invitations(id) ON DELETE CASCADE;


--
-- Name: admin_invitation_roles admin_invitation_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_invitation_roles
    ADD CONSTRAINT admin_invitation_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: admin_invitations admin_invitations_consumed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_invitations
    ADD CONSTRAINT admin_invitations_consumed_by_user_id_fkey FOREIGN KEY (consumed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: admin_invitations admin_invitations_invited_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_invitations
    ADD CONSTRAINT admin_invitations_invited_by_user_id_fkey FOREIGN KEY (invited_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: admin_members admin_members_assigned_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_members
    ADD CONSTRAINT admin_members_assigned_by_user_id_fkey FOREIGN KEY (assigned_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: admin_members admin_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_members
    ADD CONSTRAINT admin_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: candidate_best_fit_roles candidate_best_fit_roles_candidate_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_best_fit_roles
    ADD CONSTRAINT candidate_best_fit_roles_candidate_assessment_id_fkey FOREIGN KEY (candidate_assessment_id) REFERENCES public.candidate_assessments(id) ON DELETE CASCADE;


--
-- Name: candidate_domain_profiles candidate_domain_profiles_candidate_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_domain_profiles
    ADD CONSTRAINT candidate_domain_profiles_candidate_assessment_id_fkey FOREIGN KEY (candidate_assessment_id) REFERENCES public.candidate_assessments(id) ON DELETE CASCADE;


--
-- Name: candidate_intelligence_signals candidate_intelligence_signals_candidate_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_intelligence_signals
    ADD CONSTRAINT candidate_intelligence_signals_candidate_assessment_id_fkey FOREIGN KEY (candidate_assessment_id) REFERENCES public.candidate_assessments(id) ON DELETE CASCADE;


--
-- Name: candidate_skills candidate_skills_candidate_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_skills
    ADD CONSTRAINT candidate_skills_candidate_assessment_id_fkey FOREIGN KEY (candidate_assessment_id) REFERENCES public.candidate_assessments(id) ON DELETE CASCADE;


--
-- Name: candidate_strengths_weaknesses candidate_strengths_weaknesses_candidate_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_strengths_weaknesses
    ADD CONSTRAINT candidate_strengths_weaknesses_candidate_assessment_id_fkey FOREIGN KEY (candidate_assessment_id) REFERENCES public.candidate_assessments(id) ON DELETE CASCADE;


--
-- Name: academic_achievements fk_academic_achievements_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.academic_achievements
    ADD CONSTRAINT fk_academic_achievements_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: activity_events fk_activity_events_organizations_organization_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_events
    ADD CONSTRAINT fk_activity_events_organizations_organization_id FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: activity_events fk_activity_events_users_actor_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_events
    ADD CONSTRAINT fk_activity_events_users_actor_user_id FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ai_inferred_preferences fk_ai_inferred_preferences_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_inferred_preferences
    ADD CONSTRAINT fk_ai_inferred_preferences_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ai_streaming_logs fk_ai_streaming_logs_ai_streaming_sessions_session_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_streaming_logs
    ADD CONSTRAINT fk_ai_streaming_logs_ai_streaming_sessions_session_id FOREIGN KEY (session_id) REFERENCES public.ai_streaming_sessions(id) ON DELETE CASCADE;


--
-- Name: ai_streaming_metrics fk_ai_streaming_metrics_ai_streaming_sessions_session_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_streaming_metrics
    ADD CONSTRAINT fk_ai_streaming_metrics_ai_streaming_sessions_session_id FOREIGN KEY (session_id) REFERENCES public.ai_streaming_sessions(id) ON DELETE CASCADE;


--
-- Name: ai_streaming_sessions fk_ai_streaming_sessions_users_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_streaming_sessions
    ADD CONSTRAINT fk_ai_streaming_sessions_users_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: ai_streaming_sessions fk_ai_streaming_sessions_workspaces_workspace_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_streaming_sessions
    ADD CONSTRAINT fk_ai_streaming_sessions_workspaces_workspace_id FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);


--
-- Name: ai_streaming_stages fk_ai_streaming_stages_ai_streaming_sessions_session_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_streaming_stages
    ADD CONSTRAINT fk_ai_streaming_stages_ai_streaming_sessions_session_id FOREIGN KEY (session_id) REFERENCES public.ai_streaming_sessions(id) ON DELETE CASCADE;


--
-- Name: analysis_executions fk_analysis_executions_job; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_executions
    ADD CONSTRAINT fk_analysis_executions_job FOREIGN KEY (job_id) REFERENCES public.analysis_jobs(id) ON DELETE CASCADE;


--
-- Name: analysis_executions fk_analysis_executions_task; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_executions
    ADD CONSTRAINT fk_analysis_executions_task FOREIGN KEY (task_id) REFERENCES public.analysis_tasks(id) ON DELETE CASCADE;


--
-- Name: analysis_executions fk_analysis_executions_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_executions
    ADD CONSTRAINT fk_analysis_executions_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: analysis_job_events fk_analysis_job_events_job; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_job_events
    ADD CONSTRAINT fk_analysis_job_events_job FOREIGN KEY (job_id) REFERENCES public.analysis_jobs(id) ON DELETE CASCADE;


--
-- Name: analysis_jobs fk_analysis_jobs_repository; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_jobs
    ADD CONSTRAINT fk_analysis_jobs_repository FOREIGN KEY (repository_id) REFERENCES public.source_code_repositories(id) ON DELETE CASCADE;


--
-- Name: analysis_jobs fk_analysis_jobs_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_jobs
    ADD CONSTRAINT fk_analysis_jobs_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: analysis_reports fk_analysis_reports_job; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_reports
    ADD CONSTRAINT fk_analysis_reports_job FOREIGN KEY (job_id) REFERENCES public.analysis_jobs(id) ON DELETE CASCADE;


--
-- Name: analysis_reports fk_analysis_reports_repository; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_reports
    ADD CONSTRAINT fk_analysis_reports_repository FOREIGN KEY (repository_id) REFERENCES public.source_code_repositories(id) ON DELETE CASCADE;


--
-- Name: analysis_task_events fk_analysis_task_events_task; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_task_events
    ADD CONSTRAINT fk_analysis_task_events_task FOREIGN KEY (task_id) REFERENCES public.analysis_tasks(id) ON DELETE CASCADE;


--
-- Name: analysis_task_results fk_analysis_task_results_task; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_task_results
    ADD CONSTRAINT fk_analysis_task_results_task FOREIGN KEY (task_id) REFERENCES public.analysis_tasks(id) ON DELETE CASCADE;


--
-- Name: analysis_tasks fk_analysis_tasks_job; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_tasks
    ADD CONSTRAINT fk_analysis_tasks_job FOREIGN KEY (job_id) REFERENCES public.analysis_jobs(id) ON DELETE CASCADE;


--
-- Name: representative_approval_votes fk_approval_votes_request; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.representative_approval_votes
    ADD CONSTRAINT fk_approval_votes_request FOREIGN KEY (request_id) REFERENCES public.representative_rotation_requests(id) ON DELETE CASCADE;


--
-- Name: representative_approval_votes fk_approval_votes_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.representative_approval_votes
    ADD CONSTRAINT fk_approval_votes_user FOREIGN KEY (approver_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workspace_archive_snapshots fk_archive_snapshots_organization; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_archive_snapshots
    ADD CONSTRAINT fk_archive_snapshots_organization FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: artifact_registry_entries fk_artifact_registry_analysis_jobs_job_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.artifact_registry_entries
    ADD CONSTRAINT fk_artifact_registry_analysis_jobs_job_id FOREIGN KEY (job_id) REFERENCES public.analysis_jobs(id) ON DELETE CASCADE;


--
-- Name: auth_providers fk_auth_providers_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_providers
    ADD CONSTRAINT fk_auth_providers_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: representative_authority_histories fk_authority_histories_organization; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.representative_authority_histories
    ADD CONSTRAINT fk_authority_histories_organization FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: business_outcomes fk_business_outcomes_hiring_requirements_hiring_requirement_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_outcomes
    ADD CONSTRAINT fk_business_outcomes_hiring_requirements_hiring_requirement_id FOREIGN KEY (hiring_requirement_id) REFERENCES public.hiring_requirements(id) ON DELETE CASCADE;


--
-- Name: candidate_assessment_artifacts fk_candidate_assessment_artifacts_candidate_assessments_assess; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_assessment_artifacts
    ADD CONSTRAINT fk_candidate_assessment_artifacts_candidate_assessments_assess FOREIGN KEY (assessment_id) REFERENCES public.candidate_assessments(id) ON DELETE CASCADE;


--
-- Name: candidate_assessments fk_candidate_assessments_users_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_assessments
    ADD CONSTRAINT fk_candidate_assessments_users_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: candidate_capabilities fk_candidate_capabilities_capability_nodes_capability_node_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_capabilities
    ADD CONSTRAINT fk_candidate_capabilities_capability_nodes_capability_node_id FOREIGN KEY (capability_node_id) REFERENCES public.capability_nodes(id) ON DELETE CASCADE;


--
-- Name: candidate_capabilities fk_candidate_capabilities_users_candidate_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_capabilities
    ADD CONSTRAINT fk_candidate_capabilities_users_candidate_id FOREIGN KEY (candidate_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: candidate_capability_evidences fk_candidate_capability_evidences_candidate_capabilities_candi; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_capability_evidences
    ADD CONSTRAINT fk_candidate_capability_evidences_candidate_capabilities_candi FOREIGN KEY (candidate_capability_id) REFERENCES public.candidate_capabilities(id) ON DELETE CASCADE;


--
-- Name: candidate_capability_evidences fk_candidate_capability_evidences_evidence_artifacts_evidence_; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_capability_evidences
    ADD CONSTRAINT fk_candidate_capability_evidences_evidence_artifacts_evidence_ FOREIGN KEY (evidence_artifact_id) REFERENCES public.evidence_artifacts(id) ON DELETE CASCADE;


--
-- Name: candidate_capability_histories fk_candidate_capability_histories_candidate_capabilities_candi; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_capability_histories
    ADD CONSTRAINT fk_candidate_capability_histories_candidate_capabilities_candi FOREIGN KEY (candidate_capability_id) REFERENCES public.candidate_capabilities(id) ON DELETE CASCADE;


--
-- Name: candidate_capability_projections fk_candidate_capability_projections_users_candidate_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_capability_projections
    ADD CONSTRAINT fk_candidate_capability_projections_users_candidate_id FOREIGN KEY (candidate_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: candidate_capability_scores fk_candidate_capability_scores_candidate_capabilities_candidat; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_capability_scores
    ADD CONSTRAINT fk_candidate_capability_scores_candidate_capabilities_candidat FOREIGN KEY (candidate_capability_id) REFERENCES public.candidate_capabilities(id) ON DELETE CASCADE;


--
-- Name: candidate_discovery_runs fk_candidate_discovery_runs_hiring_requirements_hiring_require; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_discovery_runs
    ADD CONSTRAINT fk_candidate_discovery_runs_hiring_requirements_hiring_require FOREIGN KEY (hiring_requirement_id) REFERENCES public.hiring_requirements(id) ON DELETE CASCADE;


--
-- Name: candidate_discovery_runs fk_candidate_discovery_runs_users_triggered_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_discovery_runs
    ADD CONSTRAINT fk_candidate_discovery_runs_users_triggered_by_id FOREIGN KEY (triggered_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: candidate_evaluation_snapshots fk_candidate_evaluation_snapshots_users_candidate_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_evaluation_snapshots
    ADD CONSTRAINT fk_candidate_evaluation_snapshots_users_candidate_id FOREIGN KEY (candidate_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: candidate_match_projections fk_candidate_match_projections_users_candidate_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_match_projections
    ADD CONSTRAINT fk_candidate_match_projections_users_candidate_id FOREIGN KEY (candidate_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: candidate_ranking_projections fk_candidate_ranking_projections_users_candidate_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_ranking_projections
    ADD CONSTRAINT fk_candidate_ranking_projections_users_candidate_id FOREIGN KEY (candidate_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: candidate_search_profiles fk_candidate_search_profiles_users_candidate_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_search_profiles
    ADD CONSTRAINT fk_candidate_search_profiles_users_candidate_id FOREIGN KEY (candidate_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: candidate_skill_tree_nodes fk_candidate_skill_tree_nodes_candidate_assessments_candidate_; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_skill_tree_nodes
    ADD CONSTRAINT fk_candidate_skill_tree_nodes_candidate_assessments_candidate_ FOREIGN KEY (candidate_assessment_id) REFERENCES public.candidate_assessments(id) ON DELETE CASCADE;


--
-- Name: candidate_skill_tree_nodes fk_candidate_skill_tree_nodes_candidate_skill_tree_nodes_paren; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_skill_tree_nodes
    ADD CONSTRAINT fk_candidate_skill_tree_nodes_candidate_skill_tree_nodes_paren FOREIGN KEY (parent_id) REFERENCES public.candidate_skill_tree_nodes(id) ON DELETE RESTRICT;


--
-- Name: candidate_trust_projections fk_candidate_trust_projections_trust_profiles_trust_profile_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_trust_projections
    ADD CONSTRAINT fk_candidate_trust_projections_trust_profiles_trust_profile_id FOREIGN KEY (trust_profile_id) REFERENCES public.trust_profiles(id) ON DELETE CASCADE;


--
-- Name: candidate_trust_projections fk_candidate_trust_projections_users_candidate_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_trust_projections
    ADD CONSTRAINT fk_candidate_trust_projections_users_candidate_id FOREIGN KEY (candidate_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: capability_aliases fk_capability_aliases_capability_registries_canonical_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.capability_aliases
    ADD CONSTRAINT fk_capability_aliases_capability_registries_canonical_id FOREIGN KEY (canonical_id) REFERENCES public.capability_registries(capability_id) ON DELETE CASCADE;


--
-- Name: capability_catalog_items fk_capability_catalog_items_workspaces_workspace_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.capability_catalog_items
    ADD CONSTRAINT fk_capability_catalog_items_workspaces_workspace_id FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);


--
-- Name: capability_edges fk_capability_edges_capability_nodes_source_node_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.capability_edges
    ADD CONSTRAINT fk_capability_edges_capability_nodes_source_node_id FOREIGN KEY (source_node_id) REFERENCES public.capability_nodes(id) ON DELETE CASCADE;


--
-- Name: capability_edges fk_capability_edges_capability_nodes_target_node_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.capability_edges
    ADD CONSTRAINT fk_capability_edges_capability_nodes_target_node_id FOREIGN KEY (target_node_id) REFERENCES public.capability_nodes(id) ON DELETE CASCADE;


--
-- Name: capability_hierarchies fk_capability_hierarchies_capability_registries_child_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.capability_hierarchies
    ADD CONSTRAINT fk_capability_hierarchies_capability_registries_child_id FOREIGN KEY (child_id) REFERENCES public.capability_registries(capability_id) ON DELETE CASCADE;


--
-- Name: capability_hierarchies fk_capability_hierarchies_capability_registries_parent_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.capability_hierarchies
    ADD CONSTRAINT fk_capability_hierarchies_capability_registries_parent_id FOREIGN KEY (parent_id) REFERENCES public.capability_registries(capability_id) ON DELETE CASCADE;


--
-- Name: capability_registries fk_capability_registries_capability_registries_deprecated_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.capability_registries
    ADD CONSTRAINT fk_capability_registries_capability_registries_deprecated_by_id FOREIGN KEY (deprecated_by_id) REFERENCES public.capability_registries(capability_id) ON DELETE SET NULL;


--
-- Name: career_preferences fk_career_preferences_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.career_preferences
    ADD CONSTRAINT fk_career_preferences_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: conversations fk_conversations_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT fk_conversations_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: cv_repository_mappings fk_cv_repository_mappings_source_code_repositories_source_code; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cv_repository_mappings
    ADD CONSTRAINT fk_cv_repository_mappings_source_code_repositories_source_code FOREIGN KEY (source_code_repository_id) REFERENCES public.source_code_repositories(id) ON DELETE CASCADE;


--
-- Name: education_entries fk_education_entries_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.education_entries
    ADD CONSTRAINT fk_education_entries_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: enterprise_workflow_requests fk_enterprise_workflow_requests_organizations_organization_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enterprise_workflow_requests
    ADD CONSTRAINT fk_enterprise_workflow_requests_organizations_organization_id FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: enterprise_workflow_requests fk_enterprise_workflow_requests_users_assigned_reviewer_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enterprise_workflow_requests
    ADD CONSTRAINT fk_enterprise_workflow_requests_users_assigned_reviewer_id FOREIGN KEY (assigned_reviewer_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: enterprise_workflow_requests fk_enterprise_workflow_requests_users_escalated_to_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enterprise_workflow_requests
    ADD CONSTRAINT fk_enterprise_workflow_requests_users_escalated_to_user_id FOREIGN KEY (escalated_to_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: evaluation_rubric_snapshots fk_evaluation_rubric_snapshots_requirement_snapshots_requireme; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluation_rubric_snapshots
    ADD CONSTRAINT fk_evaluation_rubric_snapshots_requirement_snapshots_requireme FOREIGN KEY (requirement_snapshot_id) REFERENCES public.requirement_snapshots(id) ON DELETE CASCADE;


--
-- Name: evaluation_rubrics fk_evaluation_rubrics_hiring_requirements_hiring_requirement_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluation_rubrics
    ADD CONSTRAINT fk_evaluation_rubrics_hiring_requirements_hiring_requirement_id FOREIGN KEY (hiring_requirement_id) REFERENCES public.hiring_requirements(id) ON DELETE CASCADE;


--
-- Name: evidence_artifacts fk_evidence_artifacts_evidence_sources_source_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence_artifacts
    ADD CONSTRAINT fk_evidence_artifacts_evidence_sources_source_id FOREIGN KEY (source_id) REFERENCES public.evidence_sources(id) ON DELETE CASCADE;


--
-- Name: evidence_claims fk_evidence_claims_evidence_artifacts_evidence_artifact_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence_claims
    ADD CONSTRAINT fk_evidence_claims_evidence_artifacts_evidence_artifact_id FOREIGN KEY (evidence_artifact_id) REFERENCES public.evidence_artifacts(id) ON DELETE CASCADE;


--
-- Name: evidence_claims fk_evidence_claims_users_candidate_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence_claims
    ADD CONSTRAINT fk_evidence_claims_users_candidate_id FOREIGN KEY (candidate_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: evidence_signals fk_evidence_signals_requirement_capabilities_requirement_capab; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence_signals
    ADD CONSTRAINT fk_evidence_signals_requirement_capabilities_requirement_capab FOREIGN KEY (requirement_capability_id) REFERENCES public.requirement_capabilities(id) ON DELETE CASCADE;


--
-- Name: evidence_verifications fk_evidence_verifications_evidence_claims_evidence_claim_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence_verifications
    ADD CONSTRAINT fk_evidence_verifications_evidence_claims_evidence_claim_id FOREIGN KEY (evidence_claim_id) REFERENCES public.evidence_claims(id) ON DELETE CASCADE;


--
-- Name: recovery_execution_locks fk_execution_locks_session; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recovery_execution_locks
    ADD CONSTRAINT fk_execution_locks_session FOREIGN KEY (recovery_session_id) REFERENCES public.approved_recovery_sessions(id) ON DELETE CASCADE;


--
-- Name: external_organizations fk_external_organizations_auth_providers; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_organizations
    ADD CONSTRAINT fk_external_organizations_auth_providers FOREIGN KEY (auth_provider_id) REFERENCES public.auth_providers(id) ON DELETE CASCADE;


--
-- Name: forum_bookmarks fk_forum_bookmarks_forum_topics_topic_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_bookmarks
    ADD CONSTRAINT fk_forum_bookmarks_forum_topics_topic_id FOREIGN KEY (topic_id) REFERENCES public.forum_topics(id) ON DELETE CASCADE;


--
-- Name: forum_bookmarks fk_forum_bookmarks_users_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_bookmarks
    ADD CONSTRAINT fk_forum_bookmarks_users_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: forum_categories fk_forum_categories_organizations_organization_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_categories
    ADD CONSTRAINT fk_forum_categories_organizations_organization_id FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: forum_category_moderators fk_forum_category_moderators_forum_categories_category_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_category_moderators
    ADD CONSTRAINT fk_forum_category_moderators_forum_categories_category_id FOREIGN KEY (category_id) REFERENCES public.forum_categories(id) ON DELETE CASCADE;


--
-- Name: forum_category_moderators fk_forum_category_moderators_users_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_category_moderators
    ADD CONSTRAINT fk_forum_category_moderators_users_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: forum_follows fk_forum_follows_forum_topics_topic_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_follows
    ADD CONSTRAINT fk_forum_follows_forum_topics_topic_id FOREIGN KEY (topic_id) REFERENCES public.forum_topics(id) ON DELETE CASCADE;


--
-- Name: forum_follows fk_forum_follows_users_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_follows
    ADD CONSTRAINT fk_forum_follows_users_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: forum_moderation_logs fk_forum_moderation_logs_users_moderator_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_moderation_logs
    ADD CONSTRAINT fk_forum_moderation_logs_users_moderator_id FOREIGN KEY (moderator_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: forum_reactions fk_forum_reactions_forum_replies_reply_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_reactions
    ADD CONSTRAINT fk_forum_reactions_forum_replies_reply_id FOREIGN KEY (reply_id) REFERENCES public.forum_replies(id) ON DELETE CASCADE;


--
-- Name: forum_reactions fk_forum_reactions_forum_topics_topic_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_reactions
    ADD CONSTRAINT fk_forum_reactions_forum_topics_topic_id FOREIGN KEY (topic_id) REFERENCES public.forum_topics(id) ON DELETE CASCADE;


--
-- Name: forum_reactions fk_forum_reactions_users_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_reactions
    ADD CONSTRAINT fk_forum_reactions_users_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: forum_replies fk_forum_replies_forum_replies_parent_reply_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_replies
    ADD CONSTRAINT fk_forum_replies_forum_replies_parent_reply_id FOREIGN KEY (parent_reply_id) REFERENCES public.forum_replies(id);


--
-- Name: forum_replies fk_forum_replies_forum_topics_topic_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_replies
    ADD CONSTRAINT fk_forum_replies_forum_topics_topic_id FOREIGN KEY (topic_id) REFERENCES public.forum_topics(id) ON DELETE CASCADE;


--
-- Name: forum_replies fk_forum_replies_users_author_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_replies
    ADD CONSTRAINT fk_forum_replies_users_author_id FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: forum_reply_histories fk_forum_reply_histories_forum_replies_reply_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_reply_histories
    ADD CONSTRAINT fk_forum_reply_histories_forum_replies_reply_id FOREIGN KEY (reply_id) REFERENCES public.forum_replies(id) ON DELETE CASCADE;


--
-- Name: forum_reply_histories fk_forum_reply_histories_users_edited_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_reply_histories
    ADD CONSTRAINT fk_forum_reply_histories_users_edited_by_id FOREIGN KEY (edited_by_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: forum_reports fk_forum_reports_forum_replies_reply_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_reports
    ADD CONSTRAINT fk_forum_reports_forum_replies_reply_id FOREIGN KEY (reply_id) REFERENCES public.forum_replies(id);


--
-- Name: forum_reports fk_forum_reports_forum_topics_topic_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_reports
    ADD CONSTRAINT fk_forum_reports_forum_topics_topic_id FOREIGN KEY (topic_id) REFERENCES public.forum_topics(id);


--
-- Name: forum_reports fk_forum_reports_users_reported_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_reports
    ADD CONSTRAINT fk_forum_reports_users_reported_user_id FOREIGN KEY (reported_user_id) REFERENCES public.users(id);


--
-- Name: forum_reports fk_forum_reports_users_reporter_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_reports
    ADD CONSTRAINT fk_forum_reports_users_reporter_user_id FOREIGN KEY (reporter_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: forum_reports fk_forum_reports_users_resolved_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_reports
    ADD CONSTRAINT fk_forum_reports_users_resolved_by_id FOREIGN KEY (resolved_by_id) REFERENCES public.users(id);


--
-- Name: forum_reputations fk_forum_reputations_users_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_reputations
    ADD CONSTRAINT fk_forum_reputations_users_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: forum_topic_histories fk_forum_topic_histories_forum_topics_topic_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_topic_histories
    ADD CONSTRAINT fk_forum_topic_histories_forum_topics_topic_id FOREIGN KEY (topic_id) REFERENCES public.forum_topics(id) ON DELETE CASCADE;


--
-- Name: forum_topic_histories fk_forum_topic_histories_users_edited_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_topic_histories
    ADD CONSTRAINT fk_forum_topic_histories_users_edited_by_id FOREIGN KEY (edited_by_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: forum_topic_tags fk_forum_topic_tags_forum_tags_tag_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_topic_tags
    ADD CONSTRAINT fk_forum_topic_tags_forum_tags_tag_id FOREIGN KEY (tag_id) REFERENCES public.forum_tags(id) ON DELETE CASCADE;


--
-- Name: forum_topic_tags fk_forum_topic_tags_forum_topics_topic_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_topic_tags
    ADD CONSTRAINT fk_forum_topic_tags_forum_topics_topic_id FOREIGN KEY (topic_id) REFERENCES public.forum_topics(id) ON DELETE CASCADE;


--
-- Name: forum_topics fk_forum_topics_forum_categories_category_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_topics
    ADD CONSTRAINT fk_forum_topics_forum_categories_category_id FOREIGN KEY (category_id) REFERENCES public.forum_categories(id) ON DELETE CASCADE;


--
-- Name: forum_topics fk_forum_topics_organizations_organization_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_topics
    ADD CONSTRAINT fk_forum_topics_organizations_organization_id FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: forum_topics fk_forum_topics_users_author_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_topics
    ADD CONSTRAINT fk_forum_topics_users_author_id FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: forum_user_badges fk_forum_user_badges_forum_badges_badge_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_user_badges
    ADD CONSTRAINT fk_forum_user_badges_forum_badges_badge_id FOREIGN KEY (badge_id) REFERENCES public.forum_badges(id) ON DELETE CASCADE;


--
-- Name: forum_user_badges fk_forum_user_badges_users_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_user_badges
    ADD CONSTRAINT fk_forum_user_badges_users_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: forum_votes fk_forum_votes_forum_replies_reply_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_votes
    ADD CONSTRAINT fk_forum_votes_forum_replies_reply_id FOREIGN KEY (reply_id) REFERENCES public.forum_replies(id) ON DELETE CASCADE;


--
-- Name: forum_votes fk_forum_votes_forum_topics_topic_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_votes
    ADD CONSTRAINT fk_forum_votes_forum_topics_topic_id FOREIGN KEY (topic_id) REFERENCES public.forum_topics(id) ON DELETE CASCADE;


--
-- Name: forum_votes fk_forum_votes_users_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_votes
    ADD CONSTRAINT fk_forum_votes_users_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: hiring_requirements fk_hiring_requirements_organizations_organization_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hiring_requirements
    ADD CONSTRAINT fk_hiring_requirements_organizations_organization_id FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: hiring_requirements fk_hiring_requirements_workspaces_workspace_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hiring_requirements
    ADD CONSTRAINT fk_hiring_requirements_workspaces_workspace_id FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: in_app_notifications fk_in_app_notifications_activity_events_activity_event_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.in_app_notifications
    ADD CONSTRAINT fk_in_app_notifications_activity_events_activity_event_id FOREIGN KEY (activity_event_id) REFERENCES public.activity_events(id) ON DELETE SET NULL;


--
-- Name: in_app_notifications fk_in_app_notifications_users_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.in_app_notifications
    ADD CONSTRAINT fk_in_app_notifications_users_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: interview_blueprint_snapshots fk_interview_blueprint_snapshots_requirement_snapshots_require; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_blueprint_snapshots
    ADD CONSTRAINT fk_interview_blueprint_snapshots_requirement_snapshots_require FOREIGN KEY (requirement_snapshot_id) REFERENCES public.requirement_snapshots(id) ON DELETE CASCADE;


--
-- Name: interview_blueprints fk_interview_blueprints_hiring_requirements_hiring_requirement; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_blueprints
    ADD CONSTRAINT fk_interview_blueprints_hiring_requirements_hiring_requirement FOREIGN KEY (hiring_requirement_id) REFERENCES public.hiring_requirements(id) ON DELETE CASCADE;


--
-- Name: job_applications fk_job_applications_job_vacancies_job_vacancy_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT fk_job_applications_job_vacancies_job_vacancy_id FOREIGN KEY (job_vacancy_id) REFERENCES public.job_vacancies(id) ON DELETE CASCADE;


--
-- Name: job_applications fk_job_applications_users_candidate_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT fk_job_applications_users_candidate_id FOREIGN KEY (candidate_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: job_interactions fk_job_interactions_job_vacancies_job_vacancy_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_interactions
    ADD CONSTRAINT fk_job_interactions_job_vacancies_job_vacancy_id FOREIGN KEY (job_vacancy_id) REFERENCES public.job_vacancies(id) ON DELETE CASCADE;


--
-- Name: job_interactions fk_job_interactions_users_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_interactions
    ADD CONSTRAINT fk_job_interactions_users_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: job_vacancies fk_job_vacancies_hiring_requirements_hiring_requirement_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_vacancies
    ADD CONSTRAINT fk_job_vacancies_hiring_requirements_hiring_requirement_id FOREIGN KEY (hiring_requirement_id) REFERENCES public.hiring_requirements(id) ON DELETE CASCADE;


--
-- Name: job_vacancies fk_job_vacancies_organizations_organization_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_vacancies
    ADD CONSTRAINT fk_job_vacancies_organizations_organization_id FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: job_vacancies fk_job_vacancies_requirement_snapshots_requirement_snapshot_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_vacancies
    ADD CONSTRAINT fk_job_vacancies_requirement_snapshots_requirement_snapshot_id FOREIGN KEY (requirement_snapshot_id) REFERENCES public.requirement_snapshots(id) ON DELETE SET NULL;


--
-- Name: matching_evaluations fk_matching_evaluations_job_vacancies_job_vacancy_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matching_evaluations
    ADD CONSTRAINT fk_matching_evaluations_job_vacancies_job_vacancy_id FOREIGN KEY (job_vacancy_id) REFERENCES public.job_vacancies(id) ON DELETE CASCADE;


--
-- Name: matching_evaluations fk_matching_evaluations_users_candidate_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matching_evaluations
    ADD CONSTRAINT fk_matching_evaluations_users_candidate_id FOREIGN KEY (candidate_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: matching_explanations fk_matching_explanations_capability_nodes_capability_node_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matching_explanations
    ADD CONSTRAINT fk_matching_explanations_capability_nodes_capability_node_id FOREIGN KEY (capability_node_id) REFERENCES public.capability_nodes(id);


--
-- Name: matching_explanations fk_matching_explanations_evidence_artifacts_supporting_artifac; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matching_explanations
    ADD CONSTRAINT fk_matching_explanations_evidence_artifacts_supporting_artifac FOREIGN KEY (supporting_artifact_id) REFERENCES public.evidence_artifacts(id);


--
-- Name: matching_explanations fk_matching_explanations_matching_evaluations_matching_evaluat; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matching_explanations
    ADD CONSTRAINT fk_matching_explanations_matching_evaluations_matching_evaluat FOREIGN KEY (matching_evaluation_id) REFERENCES public.matching_evaluations(id) ON DELETE CASCADE;


--
-- Name: matching_factors fk_matching_factors_matching_evaluations_matching_evaluation_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matching_factors
    ADD CONSTRAINT fk_matching_factors_matching_evaluations_matching_evaluation_id FOREIGN KEY (matching_evaluation_id) REFERENCES public.matching_evaluations(id) ON DELETE CASCADE;


--
-- Name: messages fk_messages_conversation; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: notification_preferences fk_notification_preferences_users_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT fk_notification_preferences_users_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: organization_invitation_roles fk_org_invitation_roles_invitation; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_invitation_roles
    ADD CONSTRAINT fk_org_invitation_roles_invitation FOREIGN KEY (invitation_id) REFERENCES public.organization_invitations(id) ON DELETE CASCADE;


--
-- Name: organization_invitation_roles fk_org_invitation_roles_role; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_invitation_roles
    ADD CONSTRAINT fk_org_invitation_roles_role FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: organization_authorities fk_organization_authorities_organization; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_authorities
    ADD CONSTRAINT fk_organization_authorities_organization FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_authorities fk_organization_authorities_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_authorities
    ADD CONSTRAINT fk_organization_authorities_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: organization_candidates fk_organization_candidates_organizations_organization_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_candidates
    ADD CONSTRAINT fk_organization_candidates_organizations_organization_id FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_candidates fk_organization_candidates_users_candidate_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_candidates
    ADD CONSTRAINT fk_organization_candidates_users_candidate_id FOREIGN KEY (candidate_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: organization_candidates fk_organization_candidates_users_recruiter_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_candidates
    ADD CONSTRAINT fk_organization_candidates_users_recruiter_id FOREIGN KEY (recruiter_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: organization_candidates fk_organization_candidates_users_saved_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_candidates
    ADD CONSTRAINT fk_organization_candidates_users_saved_by_id FOREIGN KEY (saved_by_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: organization_credentials fk_organization_credentials_organization; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_credentials
    ADD CONSTRAINT fk_organization_credentials_organization FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: organization_followers fk_organization_followers_organization; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_followers
    ADD CONSTRAINT fk_organization_followers_organization FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_followers fk_organization_followers_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_followers
    ADD CONSTRAINT fk_organization_followers_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: organization_invitations fk_organization_invitations_consumed_by; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT fk_organization_invitations_consumed_by FOREIGN KEY (consumed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: organization_invitations fk_organization_invitations_invited_by; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT fk_organization_invitations_invited_by FOREIGN KEY (invited_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: organization_invitations fk_organization_invitations_organization; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT fk_organization_invitations_organization FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_memberships fk_organization_memberships_organization; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT fk_organization_memberships_organization FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_memberships fk_organization_memberships_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT fk_organization_memberships_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: organization_verifications fk_organization_verifications_organization; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_verifications
    ADD CONSTRAINT fk_organization_verifications_organization FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: pending_auth_providers fk_pending_auth_providers_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pending_auth_providers
    ADD CONSTRAINT fk_pending_auth_providers_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pending_organization_ownerships fk_pending_organization_ownerships_organization; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pending_organization_ownerships
    ADD CONSTRAINT fk_pending_organization_ownerships_organization FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: pending_organization_ownerships fk_pending_organization_ownerships_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pending_organization_ownerships
    ADD CONSTRAINT fk_pending_organization_ownerships_user FOREIGN KEY (consumed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: pipeline_events_durable fk_pipeline_events_durable_pipeline_executions_execution_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_events_durable
    ADD CONSTRAINT fk_pipeline_events_durable_pipeline_executions_execution_id FOREIGN KEY (execution_id) REFERENCES public.pipeline_executions(id) ON DELETE CASCADE;


--
-- Name: pipeline_executions fk_pipeline_executions_users_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_executions
    ADD CONSTRAINT fk_pipeline_executions_users_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: pipeline_executions fk_pipeline_executions_workspaces_workspace_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_executions
    ADD CONSTRAINT fk_pipeline_executions_workspaces_workspace_id FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);


--
-- Name: pipeline_stages fk_pipeline_stages_pipeline_executions_execution_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_stages
    ADD CONSTRAINT fk_pipeline_stages_pipeline_executions_execution_id FOREIGN KEY (execution_id) REFERENCES public.pipeline_executions(id) ON DELETE CASCADE;


--
-- Name: pipeline_tasks_durable fk_pipeline_tasks_durable_pipeline_executions_execution_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_tasks_durable
    ADD CONSTRAINT fk_pipeline_tasks_durable_pipeline_executions_execution_id FOREIGN KEY (execution_id) REFERENCES public.pipeline_executions(id) ON DELETE CASCADE;


--
-- Name: profile_attachments fk_profile_attachments_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profile_attachments
    ADD CONSTRAINT fk_profile_attachments_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_contributions fk_project_contributions_project_entries_project_entry_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_contributions
    ADD CONSTRAINT fk_project_contributions_project_entries_project_entry_id FOREIGN KEY (project_entry_id) REFERENCES public.project_entries(id) ON DELETE CASCADE;


--
-- Name: project_entries fk_project_entries_users_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_entries
    ADD CONSTRAINT fk_project_entries_users_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_repository_links fk_project_repository_links_project_entries_project_entry_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_repository_links
    ADD CONSTRAINT fk_project_repository_links_project_entries_project_entry_id FOREIGN KEY (project_entry_id) REFERENCES public.project_entries(id) ON DELETE CASCADE;


--
-- Name: project_repository_links fk_project_repository_links_source_code_repositories_source_co; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_repository_links
    ADD CONSTRAINT fk_project_repository_links_source_code_repositories_source_co FOREIGN KEY (source_code_repository_id) REFERENCES public.source_code_repositories(id) ON DELETE CASCADE;


--
-- Name: project_technologies fk_project_technologies_project_entries_project_entry_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_technologies
    ADD CONSTRAINT fk_project_technologies_project_entries_project_entry_id FOREIGN KEY (project_entry_id) REFERENCES public.project_entries(id) ON DELETE CASCADE;


--
-- Name: organization_recovery_claims fk_recovery_claims_organization; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_recovery_claims
    ADD CONSTRAINT fk_recovery_claims_organization FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: approved_recovery_sessions fk_recovery_sessions_organization; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approved_recovery_sessions
    ADD CONSTRAINT fk_recovery_sessions_organization FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: recovery_tokens fk_recovery_tokens_organization; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recovery_tokens
    ADD CONSTRAINT fk_recovery_tokens_organization FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: recovery_tokens fk_recovery_tokens_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recovery_tokens
    ADD CONSTRAINT fk_recovery_tokens_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens fk_refresh_tokens_organization; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT fk_refresh_tokens_organization FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens fk_refresh_tokens_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: requirement_artifact_snapshots fk_requirement_artifact_snapshots_requirement_snapshots_requir; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requirement_artifact_snapshots
    ADD CONSTRAINT fk_requirement_artifact_snapshots_requirement_snapshots_requir FOREIGN KEY (requirement_snapshot_id) REFERENCES public.requirement_snapshots(id) ON DELETE CASCADE;


--
-- Name: requirement_artifacts fk_requirement_artifacts_hiring_requirements_hiring_requiremen; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requirement_artifacts
    ADD CONSTRAINT fk_requirement_artifacts_hiring_requirements_hiring_requiremen FOREIGN KEY (hiring_requirement_id) REFERENCES public.hiring_requirements(id) ON DELETE CASCADE;


--
-- Name: requirement_capabilities fk_requirement_capabilities_hiring_requirements_hiring_require; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requirement_capabilities
    ADD CONSTRAINT fk_requirement_capabilities_hiring_requirements_hiring_require FOREIGN KEY (hiring_requirement_id) REFERENCES public.hiring_requirements(id) ON DELETE CASCADE;


--
-- Name: requirement_snapshots fk_requirement_snapshots_hiring_requirements_hiring_requiremen; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requirement_snapshots
    ADD CONSTRAINT fk_requirement_snapshots_hiring_requirements_hiring_requiremen FOREIGN KEY (hiring_requirement_id) REFERENCES public.hiring_requirements(id) ON DELETE CASCADE;


--
-- Name: requirement_vector_snapshots fk_requirement_vector_snapshots_requirement_snapshots_requirem; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requirement_vector_snapshots
    ADD CONSTRAINT fk_requirement_vector_snapshots_requirement_snapshots_requirem FOREIGN KEY (requirement_snapshot_id) REFERENCES public.requirement_snapshots(id) ON DELETE CASCADE;


--
-- Name: reset_password_tokens fk_reset_password_tokens_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reset_password_tokens
    ADD CONSTRAINT fk_reset_password_tokens_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: responsibilities fk_responsibilities_hiring_requirements_hiring_requirement_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.responsibilities
    ADD CONSTRAINT fk_responsibilities_hiring_requirements_hiring_requirement_id FOREIGN KEY (hiring_requirement_id) REFERENCES public.hiring_requirements(id) ON DELETE CASCADE;


--
-- Name: role_permissions fk_role_permissions_permission; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions fk_role_permissions_role; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: representative_rotation_requests fk_rotation_requests_organization; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.representative_rotation_requests
    ADD CONSTRAINT fk_rotation_requests_organization FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: security_event_comments fk_security_event_comments_security_events_security_event_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_event_comments
    ADD CONSTRAINT fk_security_event_comments_security_events_security_event_id FOREIGN KEY (security_event_id) REFERENCES public.security_events(id) ON DELETE CASCADE;


--
-- Name: security_event_comments fk_security_event_comments_security_incidents_security_inciden; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_event_comments
    ADD CONSTRAINT fk_security_event_comments_security_incidents_security_inciden FOREIGN KEY (security_incident_id) REFERENCES public.security_incidents(id) ON DELETE CASCADE;


--
-- Name: security_event_comments fk_security_event_comments_users_author_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_event_comments
    ADD CONSTRAINT fk_security_event_comments_users_author_user_id FOREIGN KEY (author_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: security_events fk_security_events_organizations_organization_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT fk_security_events_organizations_organization_id FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: security_events fk_security_events_security_incidents_incident_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT fk_security_events_security_incidents_incident_id FOREIGN KEY (incident_id) REFERENCES public.security_incidents(id) ON DELETE SET NULL;


--
-- Name: security_events fk_security_events_users_actor_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT fk_security_events_users_actor_user_id FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: security_events fk_security_events_users_assigned_to_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT fk_security_events_users_assigned_to_user_id FOREIGN KEY (assigned_to_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: security_events fk_security_events_users_target_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT fk_security_events_users_target_user_id FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: security_incidents fk_security_incidents_users_assigned_to_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_incidents
    ADD CONSTRAINT fk_security_incidents_users_assigned_to_user_id FOREIGN KEY (assigned_to_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: source_code_repositories fk_source_code_repositories_auth_provider; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.source_code_repositories
    ADD CONSTRAINT fk_source_code_repositories_auth_provider FOREIGN KEY (auth_provider_id) REFERENCES public.auth_providers(id) ON DELETE CASCADE;


--
-- Name: source_code_repositories fk_source_code_repositories_external_organization; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.source_code_repositories
    ADD CONSTRAINT fk_source_code_repositories_external_organization FOREIGN KEY (external_organization_id) REFERENCES public.external_organizations(id) ON DELETE SET NULL;


--
-- Name: technology_requirements fk_technology_requirements_hiring_requirements_hiring_requirem; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.technology_requirements
    ADD CONSTRAINT fk_technology_requirements_hiring_requirements_hiring_requirem FOREIGN KEY (hiring_requirement_id) REFERENCES public.hiring_requirements(id) ON DELETE CASCADE;


--
-- Name: trust_calculations fk_trust_calculations_trust_profiles_trust_profile_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trust_calculations
    ADD CONSTRAINT fk_trust_calculations_trust_profiles_trust_profile_id FOREIGN KEY (trust_profile_id) REFERENCES public.trust_profiles(id) ON DELETE CASCADE;


--
-- Name: trust_components fk_trust_components_trust_profiles_trust_profile_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trust_components
    ADD CONSTRAINT fk_trust_components_trust_profiles_trust_profile_id FOREIGN KEY (trust_profile_id) REFERENCES public.trust_profiles(id) ON DELETE CASCADE;


--
-- Name: user_cv_settings fk_user_cv_settings_users_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_cv_settings
    ADD CONSTRAINT fk_user_cv_settings_users_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_followers fk_user_followers_users_followee_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_followers
    ADD CONSTRAINT fk_user_followers_users_followee_id FOREIGN KEY (followee_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_followers fk_user_followers_users_follower_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_followers
    ADD CONSTRAINT fk_user_followers_users_follower_id FOREIGN KEY (follower_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_profiles fk_user_profiles_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_roles fk_user_roles_role; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles fk_user_roles_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_skills fk_user_skills_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_skills
    ADD CONSTRAINT fk_user_skills_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: verification_links fk_verification_links_organization; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verification_links
    ADD CONSTRAINT fk_verification_links_organization FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: verification_links fk_verification_links_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verification_links
    ADD CONSTRAINT fk_verification_links_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: verification_tokens fk_verification_tokens_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verification_tokens
    ADD CONSTRAINT fk_verification_tokens_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: work_experience_achievements fk_work_experience_achievements_entry; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_experience_achievements
    ADD CONSTRAINT fk_work_experience_achievements_entry FOREIGN KEY (work_experience_id) REFERENCES public.work_experience_entries(id) ON DELETE CASCADE;


--
-- Name: work_experience_entries fk_work_experience_entries_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_experience_entries
    ADD CONSTRAINT fk_work_experience_entries_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: work_experience_links fk_work_experience_links_entry; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_experience_links
    ADD CONSTRAINT fk_work_experience_links_entry FOREIGN KEY (work_experience_id) REFERENCES public.work_experience_entries(id) ON DELETE CASCADE;


--
-- Name: work_experience_technologies fk_work_experience_technologies_entry; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_experience_technologies
    ADD CONSTRAINT fk_work_experience_technologies_entry FOREIGN KEY (work_experience_id) REFERENCES public.work_experience_entries(id) ON DELETE CASCADE;


--
-- Name: workflow_attachments fk_workflow_attachments_enterprise_workflow_requests_workflow_; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_attachments
    ADD CONSTRAINT fk_workflow_attachments_enterprise_workflow_requests_workflow_ FOREIGN KEY (workflow_request_id) REFERENCES public.enterprise_workflow_requests(id) ON DELETE CASCADE;


--
-- Name: workflow_comments fk_workflow_comments_enterprise_workflow_requests_workflow_req; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_comments
    ADD CONSTRAINT fk_workflow_comments_enterprise_workflow_requests_workflow_req FOREIGN KEY (workflow_request_id) REFERENCES public.enterprise_workflow_requests(id) ON DELETE CASCADE;


--
-- Name: workflow_comments fk_workflow_comments_users_author_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_comments
    ADD CONSTRAINT fk_workflow_comments_users_author_user_id FOREIGN KEY (author_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workspace_members fk_workspace_members_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT fk_workspace_members_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workspace_members fk_workspace_members_workspace; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT fk_workspace_members_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_posts fk_workspace_posts_organizations_organization_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_posts
    ADD CONSTRAINT fk_workspace_posts_organizations_organization_id FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: workspace_posts fk_workspace_posts_users_created_by_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_posts
    ADD CONSTRAINT fk_workspace_posts_users_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workspaces fk_workspaces_organization; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT fk_workspaces_organization FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: workspaces fk_workspaces_users_owner_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT fk_workspaces_users_owner_id FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pipeline_tasks pipeline_tasks_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_tasks
    ADD CONSTRAINT pipeline_tasks_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.pipeline_jobs(id) ON DELETE CASCADE;


--
-- Name: repository_capabilities repository_capabilities_repository_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repository_capabilities
    ADD CONSTRAINT repository_capabilities_repository_assessment_id_fkey FOREIGN KEY (repository_assessment_id) REFERENCES public.repository_assessments(id) ON DELETE CASCADE;


--
-- Name: repository_domains repository_domains_repository_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repository_domains
    ADD CONSTRAINT repository_domains_repository_assessment_id_fkey FOREIGN KEY (repository_assessment_id) REFERENCES public.repository_assessments(id) ON DELETE CASCADE;


--
-- Name: repository_intelligence_signals repository_intelligence_signals_repository_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repository_intelligence_signals
    ADD CONSTRAINT repository_intelligence_signals_repository_assessment_id_fkey FOREIGN KEY (repository_assessment_id) REFERENCES public.repository_assessments(id) ON DELETE CASCADE;


--
-- Name: repository_skill_attributions repository_skill_attributions_repository_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repository_skill_attributions
    ADD CONSTRAINT repository_skill_attributions_repository_assessment_id_fkey FOREIGN KEY (repository_assessment_id) REFERENCES public.repository_assessments(id) ON DELETE CASCADE;


--
-- Name: role_assignments role_assignments_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_assignments
    ADD CONSTRAINT role_assignments_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: role_assignments role_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_assignments
    ADD CONSTRAINT role_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: roles roles_parent_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_parent_role_id_fkey FOREIGN KEY (parent_role_id) REFERENCES public.roles(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

