import json
from typing import Any, Dict

from app.pipelines.shared.ai.prompts.prompt_factory import IPromptFactory

_SYSTEM_PROMPT = (
    "You are CVerify JD Matching Engine, an expert AI Talent Matching Analyst.\n"
    "Your task is to objectively match a verified Candidate Profile against a Standardized Job Description "
    "and produce an explainable Match Report.\n\n"
    "CRITICAL RULES:\n"
    "- Ground all match scores in specific evidence from the Candidate Profile.\n"
    "- Never inflate scores. An absent required skill is a real gap.\n"
    "- Use semantic matching: 'React' matches 'ReactJS', not 'Angular'.\n"
    "- Return raw JSON only. No markdown fences. Do NOT truncate JSON.\n"
    "- All numeric scores must be JSON numbers (not strings).\n"
)


class MatchingPromptFactory(IPromptFactory):
    def get_system_prompt(self) -> str:
        return _SYSTEM_PROMPT

    def get_user_prompt(self, input: Any) -> str:
        return ""

    # ── L3-002 JD Field Validator & Skill Normalizer ─────────────────────────

    def get_jd_validator_prompt(self, inputs: Dict[str, Any]) -> str:
        jd_raw = inputs.get("jdRaw", {})
        return (
            f"Validate and normalize a Job Description form submission.\n\n"
            f"JD FORM DATA:\n{json.dumps(jd_raw, indent=2)}\n\n"
            f"VALIDATION RULES:\n"
            f"- jobTitle: required, not empty\n"
            f"- seniority: must be one of [Junior, Middle, Senior, Staff, Principal]\n"
            f"- requiredSkills: required, at least 1 skill\n"
            f"- salaryMin and salaryMax: salaryMin must be ≤ salaryMax\n"
            f"- Normalize all skill names to standard taxonomy (ReactJS → React, etc.)\n\n"
            f"Return JSON:\n"
            f'{{"isValid": true, "validationErrors": [], '
            f'"normalizedJd": {{"jobTitle": "string", "seniority": "Senior", '
            f'"requiredSkills": ["normalized skill list"], '
            f'"preferredSkills": ["normalized"], '
            f'"responsibilities": ["string"], '
            f'"experienceYearsMin": 3, "experienceYearsMax": 6, '
            f'"educationRequirement": "string", "englishLevel": "string", '
            f'"salaryMin": 2000, "salaryMax": 3500, "currency": "USD", '
            f'"location": "string", "workingModel": "remote|hybrid|onsite"}}}}'
        )

    # ── L3-003 AI JD Generator ────────────────────────────────────────────────

    def get_jd_generator_prompt(self, inputs: Dict[str, Any]) -> str:
        normalized_jd = inputs.get("normalizedJd", {})
        return (
            f"Generate a professional, compelling Job Description text from structured form data.\n\n"
            f"STANDARDIZED JD DATA:\n{json.dumps(normalized_jd, indent=2)}\n\n"
            f"REQUIREMENTS:\n"
            f"- Professional tone, clear and inclusive language\n"
            f"- Sections: About the Role, Key Responsibilities, Required Skills, "
            f"Preferred Skills, What We Offer\n"
            f"- Total length: 400-700 words\n"
            f"- Do not invent requirements not present in the form data\n\n"
            f"Return JSON:\n"
            f'{{"generatedJdText": "full professional JD text", '
            f'"wordCount": 520, "sections": {{"aboutRole": "string", '
            f'"keyResponsibilities": ["string"], '
            f'"requiredSkills": ["string"], "preferredSkills": ["string"], '
            f'"whatWeOffer": "string"}}}}'
        )

    # ── L3-005 Skill Match Calculator ────────────────────────────────────────

    def get_skill_match_prompt(self, inputs: Dict[str, Any]) -> str:
        candidate_skills = inputs.get("candidateSkillProficiencies", [])
        jd_required_skills = inputs.get("jdRequiredSkills", [])
        jd_preferred_skills = inputs.get("jdPreferredSkills", [])
        skill_graph = inputs.get("skillEvidenceGraph", {})
        return (
            f"Calculate skill match between candidate and job description. Use semantic matching.\n\n"
            f"CANDIDATE SKILL PROFICIENCIES:\n{json.dumps(candidate_skills, indent=2)}\n\n"
            f"SKILL EVIDENCE GRAPH (for depth verification):\n{json.dumps(skill_graph, indent=2)}\n\n"
            f"JD REQUIRED SKILLS: {json.dumps(jd_required_skills)}\n"
            f"JD PREFERRED SKILLS: {json.dumps(jd_preferred_skills)}\n\n"
            f"MATCHING RULES:\n"
            f"- Semantic match: 'Spring Boot' matches 'Spring Framework'\n"
            f"- Proficiency matters: requiring Senior-level React matched against Awareness-level React = partial match\n"
            f"- Required skill match weight = 1.0, preferred skill match weight = 0.5\n"
            f"- Missing required skill = gap (penalize heavily)\n\n"
            f"Return JSON:\n"
            f'{{"skillMatchScore": 0.78, '
            f'"requiredSkillsMatch": [{{"skill": "React", "matched": true, '
            f'"candidateProficiency": 3, "evidenceStrength": "strong", "matchType": "exact|semantic|partial"}}], '
            f'"preferredSkillsMatch": [{{"skill": "TypeScript", "matched": false}}], '
            f'"missingRequiredSkills": ["GraphQL"], '
            f'"skillMatchSummary": "paragraph"}}'
        )

    # ── L3-006 Responsibility Match Engine ───────────────────────────────────

    def get_responsibility_match_prompt(self, inputs: Dict[str, Any]) -> str:
        candidate_profile = inputs.get("candidateProfile", {})
        jd_responsibilities = inputs.get("jdResponsibilities", [])
        commit_context = inputs.get("commitContextData", {})
        return (
            f"Map candidate experience against job responsibilities. Score coverage.\n\n"
            f"JD RESPONSIBILITIES:\n{json.dumps(jd_responsibilities, indent=2)}\n\n"
            f"CANDIDATE PROFILE:\n{json.dumps(candidate_profile, indent=2)}\n\n"
            f"COMMIT CONTEXT DATA (for evidence):\n{json.dumps(commit_context, indent=2)}\n\n"
            f"TASK: For each JD responsibility, assess how well the candidate's experience covers it.\n"
            f"Use commit data and capability signals as evidence.\n\n"
            f"Return JSON:\n"
            f'{{"responsibilityMatchScore": 0.71, '
            f'"responsibilityMapping": [{{"responsibility": "string", '
            f'"coverageLevel": "full|partial|none", "confidence": 0.85, '
            f'"evidence": "specific code evidence"}}], '
            f'"uncoveredResponsibilities": ["string"], '
            f'"responsibilityMatchSummary": "paragraph"}}'
        )

    # ── L3-007 Seniority Match Calculator ────────────────────────────────────

    def get_seniority_match_prompt(self, inputs: Dict[str, Any]) -> str:
        candidate_level = inputs.get("candidateLevel", "L2")
        candidate_level_label = inputs.get("candidateLevelLabel", "Middle")
        jd_seniority = inputs.get("jdSeniority", "Middle")
        candidate_score = inputs.get("candidateScore", 55.0)
        return (
            f"Compare candidate career level with JD seniority requirement.\n\n"
            f"CANDIDATE LEVEL: {candidate_level} ({candidate_level_label}) — Score: {candidate_score}\n"
            f"JD REQUIRED SENIORITY: {jd_seniority}\n\n"
            f"LEVEL MAPPING:\n"
            f"Junior=L1, Middle=L2, Senior=L3, Staff=L4, Principal=L5\n\n"
            f"MATCHING LOGIC:\n"
            f"- Exact match (same level): seniorityScore = 1.0\n"
            f"- 1 level below JD: seniorityScore = 0.7 (underqualified)\n"
            f"- 2+ levels below JD: seniorityScore = 0.3 (strongly underqualified)\n"
            f"- 1 level above JD: seniorityScore = 0.85 (slightly overqualified)\n"
            f"- 2+ levels above JD: seniorityScore = 0.6 (overqualified)\n\n"
            f"Return JSON:\n"
            f'{{"seniorityMatchScore": 1.0, '
            f'"seniorityFlag": "exact_match|underqualified|overqualified|strongly_underqualified|strongly_overqualified", '
            f'"levelGap": 0, "seniorityMatchSummary": "string"}}'
        )

    # ── L3-010 Culture / Role Fit Analyzer ───────────────────────────────────

    def get_culture_fit_prompt(self, inputs: Dict[str, Any]) -> str:
        candidate_tendency = inputs.get("primaryTendency", "")
        candidate_style = inputs.get("primaryWorkingStyle", "")
        jd_role_type = inputs.get("jdRoleType", "")
        jd_responsibilities = inputs.get("jdResponsibilities", [])
        return (
            f"Score cultural and role fit between candidate tendency/style and job requirements.\n\n"
            f"CANDIDATE:\n"
            f"- Technical Tendency: {candidate_tendency}\n"
            f"- Working Style: {candidate_style}\n\n"
            f"JOB REQUIREMENTS:\n"
            f"- Role Type: {jd_role_type}\n"
            f"- Responsibilities: {json.dumps(jd_responsibilities)}\n\n"
            f"SCORING RULES:\n"
            f"- Perfect tendency + style alignment: 1.0\n"
            f"- Partial alignment (tendency matches but style different): 0.6-0.8\n"
            f"- Misaligned tendency (e.g., Frontend candidate for Backend role): 0.2-0.4\n\n"
            f"Return JSON:\n"
            f'{{"cultureFitScore": 0.85, '
            f'"tendencyAlignment": "strong|moderate|weak|misaligned", '
            f'"styleAlignment": "strong|moderate|weak|misaligned", '
            f'"fitRisks": ["string"], "cultureFitSummary": "paragraph"}}'
        )

    # ── L3-011 Match Score Aggregator ────────────────────────────────────────

    def get_match_aggregator_prompt(self, inputs: Dict[str, Any]) -> str:
        skill_score = inputs.get("skillMatchScore", 0.0)
        responsibility_score = inputs.get("responsibilityMatchScore", 0.0)
        seniority_score = inputs.get("seniorityMatchScore", 0.0)
        salary_score = inputs.get("salaryMatchScore", 1.0)
        culture_score = inputs.get("cultureFitScore", 0.5)
        return (
            f"Aggregate component scores into final Match Score using CVerify formula.\n\n"
            f"COMPONENT SCORES:\n"
            f"- Skill Match: {skill_score} (weight: 35%)\n"
            f"- Responsibility Match: {responsibility_score} (weight: 25%)\n"
            f"- Seniority Match: {seniority_score} (weight: 20%)\n"
            f"- Salary Match: {salary_score} (weight: 10%)\n"
            f"- Culture Fit: {culture_score} (weight: 10%)\n\n"
            f"FORMULA: MatchScore = Skill×0.35 + Responsibility×0.25 + Seniority×0.20 + Salary×0.10 + Culture×0.10\n\n"
            f"Return JSON:\n"
            f'{{"matchScore": 0.74, "matchScorePercent": 74.0, '
            f'"matchLabel": "Strong Match|Good Match|Partial Match|Weak Match|Poor Match", '
            f'"componentBreakdown": {{"skill": {{"score": 0.78, "weight": 0.35, "contribution": 0.273}}, '
            f'"responsibility": {{"score": 0.71, "weight": 0.25, "contribution": 0.178}}, '
            f'"seniority": {{"score": 1.0, "weight": 0.20, "contribution": 0.200}}, '
            f'"salary": {{"score": 1.0, "weight": 0.10, "contribution": 0.100}}, '
            f'"culture": {{"score": 0.85, "weight": 0.10, "contribution": 0.085}}}}}}'
        )

    # ── L3-013 Gap Analysis Engine ────────────────────────────────────────────

    def get_gap_analysis_prompt(self, inputs: Dict[str, Any]) -> str:
        match_score = inputs.get("matchScore", 0.0)
        missing_skills = inputs.get("missingRequiredSkills", [])
        uncovered_responsibilities = inputs.get("uncoveredResponsibilities", [])
        seniority_flag = inputs.get("seniorityFlag", "exact_match")
        salary_score = inputs.get("salaryMatchScore", 1.0)
        candidate_level_label = inputs.get("candidateLevelLabel", "Middle")
        jd_seniority = inputs.get("jdSeniority", "Middle")
        return (
            f"Generate comprehensive gap analysis for candidate-JD matching.\n\n"
            f"MATCH CONTEXT:\n"
            f"- Overall Match Score: {match_score * 100:.0f}%\n"
            f"- Candidate Level: {candidate_level_label} | JD Seniority: {jd_seniority}\n"
            f"- Seniority Flag: {seniority_flag}\n"
            f"- Salary Match Score: {salary_score}\n"
            f"- Missing Required Skills: {json.dumps(missing_skills)}\n"
            f"- Uncovered JD Responsibilities: {json.dumps(uncovered_responsibilities)}\n\n"
            f"TASK: Generate actionable gap analysis with improvement suggestions.\n\n"
            f"Return JSON:\n"
            f'{{"gapSeverity": "critical|significant|minor|none", '
            f'"skillGaps": [{{"skill": "GraphQL", "priority": "required|preferred", '
            f'"improvementSuggestion": "Build a GraphQL API project with Apollo Server"}}], '
            f'"responsibilityGaps": [{{"responsibility": "string", "gap": "string"}}], '
            f'"seniorityGap": {{"hasGap": false, "direction": "underqualified|overqualified|none", '
            f'"levelDiff": 0, "advice": "string"}}, '
            f'"salaryMismatch": {{"hasMismatch": false, "severity": "none|negotiable|hard_mismatch", '
            f'"advice": "string"}}, '
            f'"overallGapSummary": "paragraph visible to both candidate and recruiter"}}'
        )

    # ── L3-015 Hiring Recommendation Generator ────────────────────────────────

    def get_hiring_recommendation_prompt(self, inputs: Dict[str, Any]) -> str:
        match_score_pct = inputs.get("matchScorePercent", 0.0)
        match_label = inputs.get("matchLabel", "")
        gap_severity = inputs.get("gapSeverity", "")
        skill_gaps = inputs.get("skillGaps", [])
        seniority_gap = inputs.get("seniorityGap", {})
        salary_mismatch = inputs.get("salaryMismatch", {})
        candidate_summary = inputs.get("candidateSummary", "")
        jd_title = inputs.get("jdTitle", "")
        return (
            f"Generate hiring recommendation with Yes/Conditional/No verdict and one-paragraph explanation.\n\n"
            f"JOB TITLE: {jd_title}\n"
            f"MATCH SCORE: {match_score_pct:.0f}% ({match_label})\n"
            f"GAP SEVERITY: {gap_severity}\n"
            f"SKILL GAPS: {json.dumps(skill_gaps)}\n"
            f"SENIORITY GAP: {json.dumps(seniority_gap)}\n"
            f"SALARY MISMATCH: {json.dumps(salary_mismatch)}\n"
            f"CANDIDATE SUMMARY: {candidate_summary}\n\n"
            f"VERDICT CRITERIA:\n"
            f"- Yes: Match ≥ 75% AND no critical skill gaps AND no hard salary mismatch\n"
            f"- Conditional: Match 50-74% OR minor gaps that can be addressed\n"
            f"- No: Match < 50% OR critical missing required skills OR hard salary mismatch\n\n"
            f"Return JSON:\n"
            f'{{"verdict": "Yes|Conditional|No", '
            f'"confidence": 0.87, '
            f'"oneParaSummary": "evidence-based explanation paragraph 150-300 chars", '
            f'"keyReasons": [{{"type": "positive|negative|conditional", "reason": "string"}}], '
            f'"conditionalRequirements": ["Only if verdict is Conditional: list requirements"], '
            f'"hiringRisk": "low|medium|high"}}'
        )
