import json
import hashlib
from typing import Any, Dict
from app.pipelines.shared.ai.prompts.prompt_factory import IPromptFactory

_SYSTEM_PROMPT = (
    "You are CVerify Hiring Requirement Assistant, an expert AI Talent Acquisition Architect and Technical Recruiter.\n"
    "Your task is to analyze structured capability hiring requirements and generate downstream recruitment artifacts:\n"
    "1. A highly professional, compelling markdown Job Description.\n"
    "2. An Evaluation Rubric with scoring rules and evidence expectations.\n"
    "3. An AI Interview Blueprint with structured questions and dimensions mapping to required capabilities.\n\n"
    "CRITICAL RULES:\n"
    "- When generating Job Descriptions in raw streaming mode, output raw Markdown text directly. Do not wrap in JSON or add conversational chatter.\n"
    "- When requested to output JSON for rubrics, blueprints, or parsers, return raw JSON only. No markdown fences. Do NOT truncate JSON.\n"
    "- Ground all generated content in the provided outcomes, capabilities, and responsibilities.\n"
    "- Maintain a professional, developer-friendly, and objective tone.\n"
)

class RequirementPromptFactory(IPromptFactory):
    PROMPT_TEMPLATE_ID = "jd-generator-std"
    PROMPT_VERSION = "1.2"

    def get_system_prompt(self) -> str:
        return _SYSTEM_PROMPT

    def get_user_prompt(self, input: Any) -> str:
        return ""

    def get_prompt_hash(self, prompt_str: str) -> str:
        return hashlib.sha256(prompt_str.encode("utf-8")).hexdigest()

    def get_jd_generator_prompt(self, requirement: Dict[str, Any]) -> str:
        return (
            "Generate a professional, compelling Job Description in markdown format from the following structured requirement data.\n"
            "Output the markdown text directly. Do not wrap in JSON. Do not include markdown code fences (like ```markdown). Start directly with the title.\n\n"
            f"REQUIREMENT DATA:\n{json.dumps(requirement, indent=2)}\n\n"
            "SECTIONS REQUIRED IN THE MARKDOWN:\n"
            "You MUST generate exactly these 13 sections in order, using the specified headers:\n"
            "1. # [Job Title] - [Department]\n"
            "   (Use the actual job title and department from the requirement data)\n"
            "2. ## About the Role\n"
            "   (Detail the role purpose, team context, workplace logistics, and organizational division)\n"
            "3. ## Business Goals & Outcomes\n"
            "   (Detail the business problem and the specific business outcomes the hire will achieve)\n"
            "4. ## 30-60-90 Day Milestones\n"
            "   (Explain what success looks like in the first 30, 60, and 90 days based on outcomes)\n"
            "5. ## Key Responsibilities\n"
            "   (List the core responsibilities formatted as bullet points)\n"
            "6. ## Required Capabilities\n"
            "   (List the technical capabilities from the mapped capabilities list, along with their categories and expected levels)\n"
            "7. ## Technology Stack\n"
            "   (List the required technologies and SFIA levels)\n"
            "8. ## Preferred Skills\n"
            "   (List nice-to-have or preferred skills, libraries, or tools)\n"
            "9. ## Experience Requirements\n"
            "   (Detail experience expectations, seniority expectations, and years of experience)\n"
            "10. ## Qualifications\n"
            "    (Educational background, degree requirements, or certifications)\n"
            "11. ## Soft Skills\n"
            "    (Soft skills, communication expectations, and behavioral qualities)\n"
            "12. ## Benefits & Compensation\n"
            "    (Detail salary range/negotiability, workplace model details, benefits, and perks)\n"
            "13. ## Hiring Process\n"
            "    (Brief outline of the evaluation, code verification, and interview steps)\n"
        )

    def get_jd_parser_prompt(self, markdown_content: str) -> str:
        return (
            "Parse the following Markdown Job Description and extract its structured content into a JSON payload.\n"
            "You MUST respond with a single valid JSON object and nothing else. Do not wrap in markdown code fences. Do not include any explanation or extra text.\n\n"
            f"MARKDOWN CONTENT:\n{markdown_content}\n\n"
            "JSON SCHEMA EXPECTED:\n"
            "{\n"
            '  "jobTitle": "string (extracted title)",\n'
            '  "positionSummary": "string (summary from About the Role)",\n'
            '  "companyOverview": "string (company details if present, otherwise general context from About the Role)",\n'
            '  "responsibilities": ["string (list of key responsibilities)"],\n'
            '  "technicalSkills": ["string (list of required capabilities & tech stack items)"],\n'
            '  "preferredSkills": ["string (list of nice-to-have skills)"],\n'
            '  "experienceRequirements": "string (experience description)",\n'
            '  "qualifications": ["string (list of educational or certification requirements)"],\n'
            '  "softSkills": ["string (list of soft/behavioral skills)"],\n'
            '  "successCriteria": ["string (list of 30-60-90 day milestones or outcomes)"],\n'
            '  "benefits": ["string (list of benefits and compensation details)"],\n'
            '  "hiringProcess": ["string (list of hiring steps)"]\n'
            "}\n"
        )

    def get_rubric_generator_prompt(self, requirement: Dict[str, Any]) -> str:
        return (
            "Generate an Evaluation Rubric (scoring rules and evidence requirements) for assessing candidate capabilities.\n\n"
            f"REQUIREMENT DATA:\n{json.dumps(requirement, indent=2)}\n\n"
            "RULES:\n"
            "- Identify what evidence (e.g. AST signature, code complexity, blame ownership) is needed for each capability.\n"
            "- Define clear scoring rules and minimum maturity thresholds based on seniority (e.g. Junior needs Contributor, Senior needs Practitioner/Expert).\n\n"
            "Return JSON:\n"
            '{"scoringRules": {"minimumMaturityThreshold": "Practitioner", "selfDeclaredMatchCeiling": 0.40, "additionalRules": ["Rule 1"]}, '
            '"evidenceRequirements": [{"capabilityId": "db.query-tuning", "evidenceType": "AstSignature", "rationale": "High contributor attribution on DB schema files.", "expectedMetric": "Git Blame authorship > 40%"}]}'
        )

    def get_blueprint_generator_prompt(self, requirement: Dict[str, Any]) -> str:
        return (
            "Design an Interview Blueprint containing structured questions and evaluation dimensions for checking the candidate's required capabilities.\n\n"
            f"REQUIREMENT DATA:\n{json.dumps(requirement, indent=2)}\n\n"
            "RULES:\n"
            "- For each required capability, provide 1 highly targeted behavioral or situational question, and a grading rubric specifying what strong/weak evidence looks like.\n"
            "- Formulate 3-5 assessment dimensions (e.g., Code Hygiene, Problem Solving, Architecture Intent).\n\n"
            "Return JSON:\n"
            '{"questions": [{"capabilityId": "db.query-tuning", "questionText": "Describe a time you optimized a slow query...", "gradingRubric": "Look for EXPLAIN execution plan analysis."}], '
            '"dimensions": ["Code Hygiene", "Problem Solving", "Architecture Intent"]}'
        )
