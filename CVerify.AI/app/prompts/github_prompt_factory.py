from typing import Any
from app.prompts.prompt_factory import IPromptFactory

class GitHubPromptFactory(IPromptFactory):
    def get_system_prompt(self) -> str:
        return (
            "You are CVerify, an expert AI Software Architect and Repository Evidence Analyst.\n"
            "Your task is to produce a structured JSON intelligence report about a GitHub repository "
            "based on sampled source code, manifest files, and detected technologies.\n\n"
            "CRITICAL RULES FOR ALL DESCRIPTIVE FIELDS:\n"
            "- Every explanation, summary, finding, and narrative field MUST be grounded in specific, "
            "observable evidence from the provided code samples.\n"
            "- Always cite at least one specific file name, class name, method name, or code pattern "
            "when writing explanations and findings. Avoid generic statements that could apply to any codebase.\n"
            "- BAD: 'This repository demonstrates solid engineering practices.'\n"
            "- GOOD: 'The repository uses constructor-based dependency injection consistently across "
            "UserService.cs, AuthService.cs, and RepositoryService.cs, indicating adherence to SOLID principles.'\n"
            "- BAD: 'The developer shows strong frontend skills.'\n"
            "- GOOD: 'React component architecture in src/components/ follows a container/presentational split, "
            "with useReducer-based state management observed in DashboardContainer.tsx.'\n\n"
            "OUTPUT FORMAT:\n"
            "- Return raw JSON only. Do NOT wrap output in markdown code fences (no ```json).\n"
            "- Do NOT truncate the JSON. If the output would exceed limits, compress descriptions rather than "
            "cutting closing braces.\n"
            "- All numeric scores must be JSON numbers (not strings): use 92.0, not '92'.\n"
            "- All required fields listed in the schema below must be present. Use null only if genuinely absent.\n"
        )

    def get_user_prompt(self, input: Any) -> str:
        repo_name = input.get("repo_name", "unknown")
        repo_owner = input.get("repo_owner", "unknown")
        technologies = input.get("technologies", [])
        file_names = input.get("file_names", [])
        file_contents = input.get("file_contents", [])
        
        # Injected classifier metadata
        repo_type = input.get("repo_type", "ORIGINAL_WORK")
        confidence_ceiling = input.get("confidence_ceiling", 1.0)
        classification_rationale = input.get("classification_rationale", "")

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
        "open_prs": 0,
        "repo_type": "string (matches: ORIGINAL_WORK | FORK_NO_CONTRIBUTION | FORK_UPSTREAM_CONTRIBUTION | POSSIBLE_CLONE | ORG_PUBLIC | ORG_PRIVATE_SELF_DECLARE)",
        "confidence_ceiling": 0.0 to 1.0
    },
    "classification": {
        "primary_type": "string (e.g. SaaS Platform, CLI Tool, CRUD Application, Library / Package)",
        "all_types": ["string"],
        "complexity": "low" | "medium" | "high",
        "benchmark_group": "string (e.g. saas_platforms, libraries, cli_tools, mobile_apps)",
        "classification_rationale": "string details explaining why this case was selected",
        "sampled_files": ["string file paths included in analysis"],
        "ignored_files_count": 0,
        "confidence_factors": ["string reason rules applied"]
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
        "explanation": "string details (Must cite specific files or commit density. 2-3 sentences)"
    },
    "trust": {
        "classification": "personal_authentic" | "fork_rebranded" | "template_dump" | "collaboration",
        "confidence": 0 to 100,
        "rule_flags": ["string (e.g., low_commit_density, plagiarism, single_commit_dump) (max 3 flags)"],
        "ai_findings": ["string stylistic observations (max 3 findings. Must cite a file/pattern)"],
        "explanation": "string details (Must explain classification rationale with specific evidence. 2-3 sentences)"
    },
    "positioning": {
        "benchmark_group": "string",
        "percentile_rank": 0 to 100,
        "peer_group_size": 0,
        "relative_strengths": ["string (max 3 strengths. Must cite files/patterns)"]
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
            "explanation": "string details (Must cite files. 2-3 sentences)"
        },
        "engineering_practices": {
            "testing": {
                "frameworks": ["string"],
                "has_tests": true | false,
                "detail": "string details (Must cite test files. 2-3 sentences)"
            },
            "observability": {
                "logging_configured": true | false,
                "metrics_configured": true | false,
                "detail": "string details (Must cite logging configuration or usage. 2-3 sentences)"
            },
            "cicd": {
                "configured": true | false,
                "providers": ["string"]
            }
        }
    },
    "findings": [
        {
            "category": "architecture" | "security" | "testing" | "quality" | "ownership",
            "finding": "string title (3-6 words)",
            "title": "string title (3-6 words, identical to finding)",
            "confidence": 0 to 100,
            "impact": "positive" | "warning" | "critical",
            "explanation": "string details (2-4 sentences. MUST reference at least one specific file path or method name observed in the sampled code)",
            "evidence_signals": ["string paths or patterns supporting finding"],
            "evidence": [
                {
                    "type": "file" | "dependency" | "structure" | "commit",
                    "path": "string path or null",
                    "line_range": "string line range (e.g. 10-25) or null",
                    "signal": "string detail (1 sentence citing files)"
                }
            ]
        }
    ],
    "narrative": {
        "recruiter_summary": "string summary (A detailed, technical explanation of the repository. Detail the repository's purpose, design, architecture patterns, and technology stack in depth with no strict length limit.)",
        "top_strengths": [
            { "strength": "string name", "rationale": "string details (1-2 sentences. Ground in technical observation)" }
        ],
        "limitations": [
            { "limitation": "string name", "rationale": "string details (1-2 sentences. Ground in technical observation)" }
        ]
    }
}
"""

        user_prompt = f"""
Please perform a deep code analysis on the repository '{repo_owner}/{repo_name}'.

The repository is classified as '{repo_type}' with confidence ceiling {confidence_ceiling}.
Repository Classification Rationale: {classification_rationale}

Technologies detected from directory scan: {', '.join(technologies)}

Here are the sampled file contents from the repository:
{files_str}

Please generate an evaluation report. You must strictly match the following JSON Schema:
{schema}

Remember:
1. Return ONLY the raw JSON string. Do not include markdown code block syntax (like ```json ... ```).
2. Limit the findings array to a maximum of 5 of the most critical findings.
3. Every explanation, detail, finding, and narrative field MUST meet the CVerify Specificity Standard (cites specific files, methods, patterns).
"""
        return user_prompt

    def get_skills_user_prompt(self, input_data: Any) -> str:
        repo_name = input_data.get("repo_name", "unknown")
        repo_owner = input_data.get("repo_owner", "unknown")
        technologies = input_data.get("technologies", [])
        files_str = input_data.get("files_str", "")

        schema = """
{
    "schemaVersion": "2.0.0",
    "data": {
        "skills": [
            {
                "skill": "string (e.g. Java, React, Docker)",
                "category": "string (e.g. backend, frontend, devops)",
                "confidence": 0 to 100,
                "evidence": ["string cite specific usage like: 'Uses Streams API in UserService.java'"]
            }
        ]
    }
}
"""
        return f"""
Please perform a specialized code analysis on repository '{repo_owner}/{repo_name}' to extract technical skills.
Technologies detected from directory scan: {', '.join(technologies)}

Here are the sampled file contents:
{files_str}

Please generate a skills report. You must strictly match the following JSON Schema:
{schema}

Remember:
1. Return ONLY the raw JSON string. Do not include markdown code block syntax.
2. Limit the skills array to a maximum of 20 of the most significant and clearly evidenced technical skills to prevent response truncation.
"""

    def get_architecture_user_prompt(self, input_data: Any) -> str:
        repo_name = input_data.get("repo_name", "unknown")
        repo_owner = input_data.get("repo_owner", "unknown")
        technologies = input_data.get("technologies", [])
        files_str = input_data.get("files_str", "")

        schema = """
{
    "schemaVersion": "2.0.0",
    "data": {
        "patterns": [
            {
                "pattern": "string (e.g. Clean Architecture, MVC)",
                "confidence": 0 to 100,
                "evidence": ["string cite folder/file structures or dependencies"]
            }
        ],
        "explanation": "string details (Must cite files. 2-3 sentences)"
    }
}
"""
        return f"""
Please perform a specialized architectural analysis on repository '{repo_owner}/{repo_name}' to identify patterns and styles.
Technologies detected from directory scan: {', '.join(technologies)}

Here are the sampled file contents:
{files_str}

Please generate an architectural report. You must strictly match the following JSON Schema:
{schema}

Remember:
1. Return ONLY the raw JSON string. Do not include markdown code block syntax.
2. Limit the patterns array to a maximum of 10 of the most relevant architectural patterns observed.
"""

    def get_quality_user_prompt(self, input_data: Any) -> str:
        repo_name = input_data.get("repo_name", "unknown")
        repo_owner = input_data.get("repo_owner", "unknown")
        files_str = input_data.get("files_str", "")

        schema = """
{
    "schemaVersion": "2.0.0",
    "data": {
        "testing": {
            "frameworks": ["string"],
            "has_tests": true | false,
            "confidence": 0 to 100,
            "evidence": ["string cite test files"],
            "detail": "string details (Must cite test files. 2-3 sentences)"
        },
        "observability": {
            "logging_configured": true | false,
            "metrics_configured": true | false,
            "confidence": 0 to 100,
            "evidence": ["string cite logging setup"],
            "detail": "string details (Must cite logging usage. 2-3 sentences)"
        },
        "cicd": {
            "configured": true | false,
            "providers": ["string"],
            "confidence": 0 to 100,
            "evidence": ["string cite CI/CD configs"]
        },
        "findings": [
            {
                "finding": "string title (3-6 words)",
                "title": "string title (identical to finding)",
                "confidence": 0 to 100,
                "impact": "positive" | "warning" | "critical",
                "explanation": "string details (MUST reference specific file/method)",
                "evidence_signals": ["string paths/patterns"]
            }
        ]
    }
}
"""
        return f"""
Please perform a specialized code quality, testing, and observability analysis on repository '{repo_owner}/{repo_name}'.

Here are the sampled file contents:
{files_str}

Please generate a code quality report. You must strictly match the following JSON Schema:
{schema}

Remember:
1. Return ONLY the raw JSON string. Do not include markdown code block syntax.
2. Limit the findings array to a maximum of 5 of the most critical quality findings.
"""

    def get_security_user_prompt(self, input_data: Any) -> str:
        repo_name = input_data.get("repo_name", "unknown")
        repo_owner = input_data.get("repo_owner", "unknown")
        files_str = input_data.get("files_str", "")

        schema = """
{
    "schemaVersion": "2.0.0",
    "data": {
        "vulnerabilities": [
            {
                "vulnerability": "string (e.g. Hardcoded Credentials)",
                "confidence": 0 to 100,
                "impact": "warning" | "critical",
                "explanation": "string details (MUST cite file/line)",
                "evidence": ["string path/snippet"]
            }
        ],
        "confidence": 0 to 100,
        "evidence": ["string summary citation"],
        "findings": [
            {
                "finding": "string title (3-6 words)",
                "title": "string title (identical to finding)",
                "confidence": 0 to 100,
                "impact": "warning" | "critical",
                "explanation": "string details (MUST reference specific file/method)",
                "evidence_signals": ["string paths/patterns"]
            }
        ]
    }
}
"""
        return f"""
Please perform a specialized security and vulnerability scan on repository '{repo_owner}/{repo_name}'.

Here are the sampled file contents:
{files_str}

Please generate a security report. You must strictly match the following JSON Schema:
{schema}

Remember:
1. Return ONLY the raw JSON string. Do not include markdown code block syntax.
2. Limit the vulnerabilities array to a maximum of 5 entries and the findings array to a maximum of 5 of the most critical security findings.
"""

    def get_summary_user_prompt(self, input_data: Any) -> str:
        repo_name = input_data.get("repo_name", "unknown")
        repo_owner = input_data.get("repo_owner", "unknown")
        technologies = input_data.get("technologies", [])
        files_str = input_data.get("files_str", "")
        preceding_context = input_data.get("preceding_context", "")

        schema = """
{
    "schemaVersion": "2.0.0",
    "data": {
        "recruiter_summary": "string summary (A detailed, technical explanation of the repository. Detail the repository's purpose, design, architecture patterns, and technology stack in depth with no strict length limit.)",
        "top_strengths": [
            {
                "strength": "string name",
                "rationale": "string details (1-2 sentences)",
                "evidence": ["string citation"]
            }
        ],
        "limitations": [
            {
                "limitation": "string name",
                "rationale": "string details (1-2 sentences)",
                "evidence": ["string citation"]
            }
        ]
    }
}
"""
        return f"""
Please perform a specialized narrative evaluation on repository '{repo_owner}/{repo_name}'.
Technologies detected from directory scan: {', '.join(technologies)}

Here is the preceding task context:
{preceding_context}

Here are the sampled file contents:
{files_str}

Please generate the narrative report. You must strictly match the following JSON Schema:
{schema}

Remember:
1. Under 'recruiter_summary', provide a comprehensive, technically detailed explanation of the repository's purpose, design, implementation, and overall domain. Feel free to explain in depth; there is no strict length limit.
2. Structure the 'recruiter_summary' text into clean, readable sections separated by double newlines (\n\n) (for example, separate the overall summary, key subsystems/architecture, and quality signals into distinct paragraphs).
3. Return ONLY the raw JSON string. Do not include markdown code block syntax.
"""

    def get_commits_user_prompt(self, input_data: Any) -> str:
        repo_name = input_data.get("repo_name", "unknown")
        repo_owner = input_data.get("repo_owner", "unknown")
        red_flags = input_data.get("red_flags", [])
        repo_type = input_data.get("repo_type", "ORIGINAL_WORK")
        files_str = input_data.get("files_str", "")
        
        factual_total_commits = input_data.get("factual_total_commits", 1)
        factual_user_commit_ratio = input_data.get("factual_user_commit_ratio", 1.0)
        factual_bus_factor = input_data.get("factual_bus_factor", 1)
        factual_active_contributors = input_data.get("factual_active_contributors", 1)

        schema = """
{
    "schemaVersion": "2.0.0",
    "data": {
        "ownership": {
            "user_commit_ratio": 0.0 to 1.0,
            "total_commits": 0,
            "is_primary_author": true | false,
            "architectural_ownership_pct": 0.0 to 100.0,
            "critical_path_ownership_pct": 0.0 to 100.0,
            "maintenance_duration_months": 0,
            "explanation": "string details (Must cite specific files or commit density. 2-3 sentences)"
        },
        "trust": {
            "classification": "personal_authentic" | "fork_rebranded" | "template_dump" | "collaboration",
            "confidence": 0 to 100,
            "rule_flags": ["string (max 3 flags)"],
            "ai_findings": ["string stylistic observations (max 3 findings. Must cite a file/pattern)"],
            "explanation": "string details (Must explain classification rationale with specific evidence. 2-3 sentences)"
        }
    }
}
"""
        return f"""
Please perform a specialized commit history, developer ownership, and project trust evaluation on repository '{repo_owner}/{repo_name}'.
Repository type: '{repo_type}'
Red flags detected from metadata scan: {', '.join(red_flags) if red_flags else 'None'}

FACTUAL METRICS (CROSS-REFERENCED FROM LOCAL GIT LOG):
- Total commits in repository: {factual_total_commits}
- Authenticated developer's commit ratio: {factual_user_commit_ratio:.2%}
- Bus factor: {factual_bus_factor}
- Active contributors: {factual_active_contributors}

You MUST align your JSON output with these exact metrics (under ownership.total_commits, ownership.user_commit_ratio, etc.).
Your qualitative explanation must align with and justify these metrics using the sampled files and context.

Here are the sampled file contents:
{files_str}

Please generate the ownership and trust report. You must strictly match the following JSON Schema:
{schema}

Remember to return ONLY the raw JSON string. Do not include markdown code block syntax.
"""

    def get_classification_user_prompt(self, input_data: Any) -> str:
        repo_name = input_data.get("repo_name", "unknown")
        repo_owner = input_data.get("repo_owner", "unknown")
        technologies = input_data.get("technologies", [])
        files_str = input_data.get("files_str", "")

        schema = """
{
    "schemaVersion": "2.0.0",
    "data": {
        "primary_type": "string (e.g. Portfolio Website, SaaS Platform, Library, CLI Tool, Game, Mobile App, AI System, Infrastructure Tool, or Unknown. NEVER output 'Fork' here)",
        "all_types": ["string"],
        "confidence": 0.0 to 1.0,
        "evidence": ["string cite specific folder/file structures or dependencies that explain why this type was selected"],
        "schema_version": "1.0",
        "classifier_version": "2026.06"
    }
}
"""
        return f"""
Please perform a specialized repository semantic domain classification on repository '{repo_owner}/{repo_name}'.
Your goal is to categorize the project based on its code, structure, configuration files, and primary purposes.
NOTE: Do NOT categorize as a 'Fork'—if it is a fork but contains library code, categorize it as a 'Library'. If it contains no discernible domain, categorize it as 'Unknown'.

Technologies detected from directory scan: {', '.join(technologies)}

Here are the sampled file contents:
{files_str}

Please generate a classification report. You must strictly match the following JSON Schema:
{schema}

Remember to return ONLY the raw JSON string. Do not include markdown code block syntax.
"""


