from typing import Any
from app.prompts.prompt_factory import IPromptFactory


class GitHubPromptFactory(IPromptFactory):
    def get_system_prompt(self) -> str:
        return (
            "You are CVerify, an expert AI Software Architect and Repository Fraud Analyst. Your goal is to analyze a developer's repository "
            "and produce a comprehensive, structured evidence-based evaluation report.\n"
            "To prevent token truncation and API timeout, you MUST keep all explanation, narrative, and signal text fields extremely concise (maximum 1-2 short sentences each).\n"
            "Respond strictly in valid JSON format matching the schema provided. Do not write any markdown wrappers, intro or outro text. Only output the raw JSON."
        )

    def get_user_prompt(self, input: Any) -> str:
        repo_name = input.get("repo_name", "unknown")
        repo_owner = input.get("repo_owner", "unknown")
        technologies = input.get("technologies", [])
        file_names = input.get("file_names", [])
        file_contents = input.get("file_contents", [])

        files_str = ""
        for name, content in zip(file_names, file_contents):
            files_str += f"--- FILE: {name} ---\n{content}\n\n"

        schema = """
{
    "schemaVersion": "evidence-intelligence-v1",
    "repo": {
        "id": "string",
        "name": "string",
        "full_name": "string",
        "url": "string",
        "description": "string or null",
        "fork": false,
        "created_at": "string",
        "languages": {
            "LanguageName": 0.0
        },
        "topics": [],
        "stars": 0,
        "forks": 0,
        "branches": 1,
        "open_prs": 0
    },
    "classification": {
        "primary_type": "string (e.g. SaaS Platform, CLI Tool, Minecraft Plugin, CRUD Application, Library / Package)",
        "all_types": ["string"],
        "complexity": "low" | "medium" | "high",
        "benchmark_group": "string (e.g. saas_platforms, libraries, cli_tools, mobile_apps)"
    },
    "evidence_points": {
        "total": 0,
        "breakdown": {
            "backend": 0,
            "database": 0,
            "frontend": 0,
            "devops": 0,
            "security": 0
        }
    },
    "ownership": {
        "user_commit_ratio": 0.0 to 1.0,
        "total_commits": 0,
        "is_primary_author": true | false,
        "architectural_ownership_pct": 0.0 to 100.0,
        "critical_path_ownership_pct": 0.0 to 100.0,
        "maintenance_duration_months": 0,
        "explanation": "string details (concise, 1-2 sentences)"
    },
    "trust": {
        "classification": "personal_authentic" | "fork_rebranded" | "template_dump" | "collaboration",
        "confidence": 0 to 100,
        "rule_flags": ["string (e.g., low_commit_density, plagiarism, single_commit_dump) (max 3 flags)"],
        "ai_findings": ["string stylistic observations (max 3 findings)"],
        "explanation": "string details (concise, 1-2 sentences)"
    },
    "positioning": {
        "benchmark_group": "string",
        "percentile_rank": 0 to 100,
        "peer_group_size": 0,
        "relative_strengths": ["string (max 3 strengths)"]
    },
    "profile": {
        "technologies": [
            { "name": "string", "type": "language" | "framework" | "database" | "library" | "infrastructure" }
        ],
        "skills": {
            "CategoryName (e.g., backend)": ["string"]
        },
        "architecture": {
            "patterns": ["string"],
            "explanation": "string details (concise, 1-2 sentences)"
        },
        "engineering_practices": {
            "testing": {
                "frameworks": ["string"],
                "has_tests": true | false,
                "detail": "string details (concise, 1-2 sentences)"
            },
            "observability": {
                "logging_configured": true | false,
                "metrics_configured": true | false,
                "detail": "string details (concise, 1-2 sentences)"
            },
            "cicd": {
                "configured": true | false,
                "providers": ["string"]
            }
        }
    },
    "findings": [
        {
            "category": "backend" | "frontend" | "database" | "devops" | "security" | "architecture" | "engineering" | "ownership" | "trust",
            "finding": "string title",
            "confidence": 0 to 100,
            "explanation": "string details (extremely concise, 1 sentence)",
            "evidence": [
                {
                    "type": "file" | "dependency" | "structure" | "commit",
                    "path": "string path or null",
                    "line_range": "string line range (e.g. 10-25) or null",
                    "signal": "string detail (extremely concise, 1 sentence)"
                }
            ]
        }
    ],
    "narrative": {
        "recruiter_summary": "string summary (concise, 2 sentences)",
        "top_strengths": [
            { "strength": "string name", "rationale": "string details (concise, 1 sentence)" }
        ],
        "limitations": [
            { "limitation": "string name", "rationale": "string details (concise, 1 sentence)" }
        ]
    }
}
"""

        user_prompt = f"""
Please perform a deep code analysis on the repository '{repo_owner}/{repo_name}'.
Technologies detected from directory scan: {', '.join(technologies)}

Here are the sampled file contents from the repository:
{files_str}

Please generate an evaluation report. You must strictly match the following JSON Schema:
{schema}

Remember:
1. Return ONLY the raw JSON string. Do not include markdown code block syntax (like ```json ... ```).
2. Limit the findings array to a maximum of 5 of the most critical findings.
3. Every explanation, detail, wisp, and signal in findings evidence MUST be kept to 1 sentence maximum to prevent output truncation.
"""
        return user_prompt
