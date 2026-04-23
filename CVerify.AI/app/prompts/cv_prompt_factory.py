from typing import Any
from app.prompts.prompt_factory import IPromptFactory


class CvPromptFactory(IPromptFactory):
    def get_system_prompt(self) -> str:
        return (
            "You are CVerify, a professional career profile analyst and expert technical resume editor.\n"
            "Your task is to act as a transformation layer that converts structured repository context "
            "and candidate contribution data into a career-oriented, short-form CV narrative summary.\n\n"
            "CRITICAL RULES FOR THE SUMMARY FIELD:\n"
            "1. CV Bullet Style: The summary must be a compact, professional narrative suitable for direct copy-pasting into a resume.\n"
            "2. Length: The summary MUST be between 250 and 450 characters in total length (inclusive of spaces). Be extremely concise.\n"
            "3. Focus: Describe: (a) what the repository is, and (b) what the user contributed or implemented based on the contribution facts. Do NOT include technical deep dives, architectural details, or quality metrics.\n"
            "4. Grounding: Rely strictly on the provided input facts (Classification Domain, developer skills, ownership profile, and contribution details). Do not invent new skills, facts, or filenames.\n"
            "5. Output Format: Return ONLY the raw JSON string conforming to the schema. Do NOT wrap in markdown code fences.\n"
        )

    def get_user_prompt(self, input_data: Any) -> str:
        repo_name = input_data.get("repo_name", "unknown")
        classification = input_data.get("classification", "Unknown")
        skills = input_data.get("skills", [])
        ownership_profile = input_data.get("ownershipProfile", "Standard contribution profile")
        ownership_explanation = input_data.get("ownership_explanation", "")
        findings = input_data.get("findings", [])

        import json
        findings_json = json.dumps(findings, indent=2)

        schema = """
{
    "title": "string (e.g. 'SaaS Platform Developer')",
    "skills": ["string (copied exactly from the input skills list)"],
    "summary": "string (refined, career-oriented short-form CV narrative summary. STRICT LIMIT: 250 to 450 characters, single paragraph/bullet style)",
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
Please generate the professional CV summary and highlights object for repository '{repo_name}'.

INPUT FACTS:
- Classification Domain: {classification}
- Developer Skills: {', '.join(skills)}
- Ownership Profile: {ownership_profile}
- Developer Contribution History: {ownership_explanation}

- Upstream Findings:
{findings_json}

Please generate the CV object. You must strictly match the following JSON Schema:
{schema}

Remember:
1. The 'summary' field MUST be optimized for a CV, describing only the repository's purpose and the developer's contributions.
2. The 'summary' field length MUST be between 250 and 450 characters.
3. Return ONLY the raw JSON string. Do not include markdown code block syntax.
4. The 'title', 'skills', and 'ownershipProfile' fields MUST be copied exactly from the input facts.
5. The 'highlights' array must contain the findings mapped and refined professionally (1 sentence each), retaining their exact impact value.
6. Do not invent any facts or skills not explicitly listed above.
"""
