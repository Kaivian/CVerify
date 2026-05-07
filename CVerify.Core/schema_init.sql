-- Greenfield Schema Initialization Script
-- Drops legacy tables if they exist and re-creates the database structure

DROP TABLE IF EXISTS analysis_executions CASCADE;
DROP TABLE IF EXISTS analysis_task_results CASCADE;
DROP TABLE IF EXISTS analysis_task_events CASCADE;
DROP TABLE IF EXISTS analysis_tasks CASCADE;
DROP TABLE IF EXISTS analysis_reports CASCADE;
DROP TABLE IF EXISTS analysis_job_events CASCADE;
DROP TABLE IF EXISTS analysis_jobs CASCADE;
DROP TABLE IF EXISTS prompt_deployments CASCADE;
DROP TABLE IF EXISTS artifact_registry CASCADE;
DROP TABLE IF EXISTS pipeline_tasks CASCADE;
DROP TABLE IF EXISTS pipeline_jobs CASCADE;

-- 1. Pipeline Jobs (Platform Layer)
CREATE TABLE pipeline_jobs (
    id UUID PRIMARY KEY,
    pipeline_type VARCHAR(50) NOT NULL, 
    reference_id UUID NOT NULL,          
    status VARCHAR(30) NOT NULL DEFAULT 'Queued',
    progress NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    started_at TIMESTAMP WITH TIME ZONE NULL,
    completed_at TIMESTAMP WITH TIME ZONE NULL,
    error_message VARCHAR(2000) NULL,
    retry_count INT NOT NULL DEFAULT 0,
    max_budget_usd NUMERIC(6, 2) NOT NULL DEFAULT 5.00,
    cumulative_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Pipeline Tasks (Platform Layer)
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
    cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0.000000,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_job_task_identifier ON pipeline_tasks(job_id, task_identifier);

-- 3. Prompt Deployments (AI Subsystem)
CREATE TABLE prompt_deployments (
    prompt_id VARCHAR(50) PRIMARY KEY, 
    active_version VARCHAR(30) NOT NULL, 
    sha256_hash VARCHAR(64) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 4. Artifact Registry
CREATE TABLE artifact_registry (
    id UUID PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES pipeline_jobs(id) ON DELETE CASCADE,
    artifact_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    metadata_json TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_job_artifact ON artifact_registry(job_id, artifact_id);
