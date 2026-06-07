from typing import Any
from app.pipelines.shared.ai.prompts.prompt_factory import IPromptFactory


class CvPromptFactory(IPromptFactory):
    def get_system_prompt(self) -> str:
        return (
            "You are CVerify, a professional career profile analyst and expert technical resume editor.\n"
            "Your task is to convert structured repository context and candidate contribution data "
            "into a career-oriented, short-form CV narrative summary.\n\n"
            "CRITICAL FORMATTING RULES:\n"
            "1. Project Summary: The summary MUST be maximum 1 short, concise sentence (30 to 150 characters) summarizing the repository's purpose. Do NOT mention developer contributions or names here.\n"
            "2. Key Contributions Highlights: Provide exactly 2 to 3 bullet points. Each bullet point MUST be 1 concise sentence that fits naturally within a resume layout and is under 100 characters.\n"
            "3. Action Verbs: Every contribution bullet point MUST start with a strong action verb (e.g., 'Built', 'Developed', 'Implemented', 'Optimized', 'Designed', 'Refactored').\n"
            "4. CV Style: Write in a professional resume style. Focus exclusively on what the developer built, implemented, optimized, or delivered.\n"
            "5. STRICT PROHIBITIONS: Do NOT include repository evaluations, strengths/weaknesses analysis, maintainability commentary, warning labels, quality assessments, score-oriented language, or technical auditing/grading terminology (e.g., do NOT say 'This repository has good code quality' or 'maintainability is medium').\n"
            "6. Output Format: Return ONLY the raw JSON string conforming to the schema. Do NOT wrap in markdown code fences.\n"
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
    "summary": "string (maximum 1 short sentence summarizing the repository's purpose. STRICT LIMIT: 30 to 150 characters)",
    "highlights": [
        {
            "signal": "string (a concise contribution bullet point, 1 sentence, starting with an action verb, e.g. 'Implemented JWT authentication flows.' STRICT LIMIT: under 100 characters.)",
            "impact": "string (MUST be set to empty string: '')"
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
1. The 'summary' field MUST describe only the repository's core purpose in a single, short sentence (30 to 150 characters).
2. The 'highlights' array must contain 2 to 4 key contribution bullet points (1 sentence each), describing actual developer contributions/achievements. Set the 'impact' field of each highlight to an empty string ('').
3. EVERY bullet point in the 'highlights' array MUST start with a strong action verb (e.g., 'Built', 'Developed', 'Implemented', 'Optimized', 'Designed', 'Refactored').
4. Do NOT include repository evaluations, strengths/weaknesses analysis, maintainability commentary, warning labels, quality assessments, score-oriented language, or technical auditing/grading terminology.
5. Return ONLY the raw JSON string. Do not include markdown code block syntax.
6. The 'title', 'skills', and 'ownershipProfile' fields MUST be copied exactly from the input facts.
7. Do not invent any facts or skills not explicitly listed above.
"""

