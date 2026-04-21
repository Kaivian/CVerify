from typing import Any
from app.prompts.prompt_factory import IPromptFactory


class GitHubPromptFactory(IPromptFactory):
    def get_system_prompt(self) -> str:
        return (
            "You are CVerify, an expert AI Software Architect and Repository Fraud Analyst. Your goal is to analyze a developer's repository "
            "and produce a comprehensive, structured evaluation report.\n"
            "You must detect potential fraud signals (e.g., plagiarized dumps, template projects, low-effort/empty repositories) vs authentic development, "
            "evaluate codebase complexity, identify frameworks/technologies, and list detected skills.\n"
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
    "repo": {
        "id": "string",
        "name": "string",
        "full_name": "string",
        "url": "string",
        "description": "string or null",
        "fork": false,
        "created_at": "string",
        "languages": {
            "LanguageName": 0.0 (percentage)
        },
        "topics": [],
        "stars": 0,
        "forks": 0,
        "branches": 1,
        "open_prs": 0
    },
    "source_classification": {
        "case": "personal_own" | "fork" | "template" | "collaboration",
        "fork": false,
        "confidence_base": 0.0 to 1.0
    },
    "contribution_stats": {
        "total_commits": 0,
        "user_commits": 0,
        "user_commit_pct": 0,
        "contributors_count": 1,
        "lines_owned_pct": null,
        "prs_authored": 0,
        "prs_merged": 0,
        "issues_count": 0,
        "branches_count": 1
    },
    "fraud_flags": [
        {
            "type": "string (e.g. low_commit_density, plagiarism, single_commit_dump)",
            "severity": "high" | "medium" | "low",
            "detail": "string explanation",
            "confidence_penalty": 0.0 to 1.0 (multiplier to apply to score, 1.0 means no penalty)
        }
    ],
    "fraud_multiplier": 1.0,
    "skill_tree": {
        "CategoryName (e.g., Backend)": {
            "SkillName (e.g., Java)": {
                "level": "beginner" | "intermediate" | "advanced",
                "confidence": 0.0 to 1.0,
                "evidence_type": "verified" | "inferred",
                "evidence": [
                    {
                        "type": "language_stat" | "file" | "dependency" | "structure",
                        "path": "string path or null",
                        "signal": "string detail"
                    }
                ]
            }
        }
    },
    "scoring": {
        "raw_score": 0.0 to 100.0,
        "fraud_multiplier": 0.0 to 1.0,
        "final_score": 0.0 to 100.0,
        "band": "A" | "B" | "C" | "D" | "F",
        "verdict": "string summarizing status",
        "dimension_breakdown": {
            "technical_depth": {
                "score": 0.0 to 100.0,
                "note": "string"
            },
            "code_quality_signals": {
                "score": 0.0 to 100.0,
                "note": "string"
            },
            "contribution_quality": {
                "score": 0.0 to 100.0,
                "note": "string"
            }
        },
        "top_strengths": ["string"],
        "improvement_areas": ["string"],
        "recruiter_summary": "string"
    },
    "ui_hints": {
        "show_fraud_warning": false,
        "fraud_badge": "string or null",
        "show_skill_tree": true,
        "show_score": true,
        "prompt_recruiter_note": "string"
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
1. "scoring.final_score" must be a number between 0 and 100. It must be computed as raw_score * fraud_multiplier.
2. Return ONLY the raw JSON string. Do not include markdown code block syntax (like ```json ... ```).
"""
        return user_prompt
