from typing import Any
from app.prompts.prompt_factory import IPromptFactory


class CvPromptFactory(IPromptFactory):
    def get_system_prompt(self) -> str:
        return (
            "You are CVerify, an expert technical CV copyeditor and professional profile analyst.\n"
            "Your task is to refine and proofread repository summary narratives into a professional "
            "2-3 sentence recruiter-ready summary.\n"
            "You will be provided with a JSON object containing structured facts about a repository.\n\n"
            "CRITICAL RULES:\n"
            "1. You must ONLY refine the provided 'rawSummary' and findings. Do NOT invent new facts, "
            "metrics, filenames, or technologies not present in the input.\n"
            "2. Keep the 'summary' narrative professional, neutral, and directly grounded in the input. "
            "Avoid generic marketing fluff.\n"
            "3. The output must conform strictly to the specified JSON schema.\n"
            "4. Return ONLY the raw JSON string. Do NOT wrap output in markdown code fences (no ```json).\n"
        )

    def get_user_prompt(self, input_data: Any) -> str:
        repo_name = input_data.get("repo_name", "unknown")
        classification = input_data.get("classification", "Unknown")
        skills = input_data.get("skills", [])
        ownership_profile = input_data.get("ownershipProfile", "Standard contribution profile")
        raw_summary = input_data.get("rawSummary", "")
        findings = input_data.get("findings", [])

        import json
        findings_json = json.dumps(findings, indent=2)

        schema = """
{
    "title": "string (e.g. 'SaaS Platform Developer')",
    "skills": ["string (copied exactly from the input skills list)"],
    "summary": "string (refined 2-3 sentence recruiter-ready summary based on rawSummary)",
    "highlights": [
        {
            "signal": "string (refined description of the finding)",
            "impact": "string (copied exactly from findings impact: positive | warning | critical)"
        }
    ],
    "ownershipProfile": "string (copied exactly from input ownershipProfile)"
}
"""
        return f"""
Please refine the recruiter summary and format the CV output object for repository '{repo_name}'.

INPUT FACTS:
- Classification Domain: {classification}
- Deterministic Skills: {', '.join(skills)}
- Ownership Profile: {ownership_profile}
- Raw Summary to Refine: {raw_summary}
- Upstream Findings:
{findings_json}

Please generate the CV object. You must strictly match the following JSON Schema:
{schema}

Remember:
1. Return ONLY the raw JSON string. Do not include markdown code block syntax.
2. The 'title', 'skills', and 'ownershipProfile' fields MUST be copied exactly from the input facts.
3. The 'highlights' array must contain the findings mapped and refined professionally (1 sentence each), retaining their exact impact value.
4. Do not invent any facts or skills not explicitly listed above.
"""
