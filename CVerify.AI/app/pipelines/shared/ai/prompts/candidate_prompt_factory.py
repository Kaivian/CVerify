import json
from typing import Any, Dict


_SYSTEM_PROMPT = (
    "You are CVerify Candidate Intelligence Engine, an expert AI Talent Analyst.\n"
    "Your task is to evaluate software engineer candidates based on verified repository evidence, "
    "CV data, and GitHub profile data.\n\n"
    "CRITICAL RULES:\n"
    "- Ground all assessments in specific, observable code evidence (file names, commit patterns, metrics).\n"
    "- Never infer skills without evidence. Confidence must reflect evidence depth.\n"
    "- Career level must be based on the level framework definitions, not subjective opinion.\n"
    "- Return raw JSON only. No markdown fences. Do NOT truncate JSON.\n"
    "- All numeric scores must be JSON numbers (not strings).\n"
)


class CandidatePromptFactory:
    def get_system_prompt(self) -> str:
        return _SYSTEM_PROMPT

    # ── L2-001 Skill Taxonomy Mapper ─────────────────────────────────────────

    def get_skill_taxonomy_mapper_prompt(self, inputs: Dict[str, Any]) -> str:
        skill_graph = inputs.get("skillEvidenceGraph", {})
        cv_skills = inputs.get("cvSkills", [])
        return (
            f"Map the raw skill evidence from the Skill Evidence Graph to the SFIA 9 / O*NET standard taxonomy.\n\n"
            f"RAW SKILL EVIDENCE GRAPH:\n{json.dumps(skill_graph, indent=2)}\n\n"
            f"CV DECLARED SKILLS: {json.dumps(cv_skills)}\n\n"
            f"TASK:\n"
            f"1. For each detected skill node, map it to the closest SFIA 9 skill category and O*NET occupation.\n"
            f"2. Normalize skill names (e.g., ReactJS → React, Spring Boot → Spring Framework).\n"
            f"3. Cross-reference CV declared skills with evidence graph. Flag declared-but-unproven skills.\n\n"
            f"Return JSON:\n"
            f'{{"mappedSkills": [{{"rawName": "string", "normalizedName": "string", '
            f'"sfiaCategory": "string", "onetCode": "string", "evidenceStrength": "none|weak|moderate|strong", '
            f'"declaredInCv": true}}], '
            f'"unmatchedCvSkills": ["list of skills declared in CV but not found in code evidence"]}}'
        )

    # ── L2-002 Skill Proficiency Estimator ───────────────────────────────────

    def get_skill_proficiency_estimator_prompt(self, inputs: Dict[str, Any]) -> str:
        mapped_skills = inputs.get("mappedSkills", [])
        skill_graph = inputs.get("skillEvidenceGraph", {})
        return (
            f"Estimate proficiency level for each skill based on depth and breadth of code evidence.\n\n"
            f"MAPPED SKILLS:\n{json.dumps(mapped_skills, indent=2)}\n\n"
            f"SKILL EVIDENCE GRAPH:\n{json.dumps(skill_graph, indent=2)}\n\n"
            f"PROFICIENCY SCALE (SFIA-aligned):\n"
            f"1 = Awareness: Has used the technology but limited depth\n"
            f"2 = Working: Applies it in standard scenarios with guidance\n"
            f"3 = Practitioner: Independently applies in complex scenarios\n"
            f"4 = Expert: Deep mastery, can architect and mentor\n\n"
            f"TASK: For each skill, assign proficiency level 1-4 with evidence rationale.\n\n"
            f"Return JSON:\n"
            f'{{"skillProficiencies": [{{"skill": "string", "proficiencyLevel": 1, '
            f'"proficiencyLabel": "Awareness|Working|Practitioner|Expert", '
            f'"evidenceRationale": "specific code files/patterns cited", '
            f'"confidenceScore": 0.85}}]}}'
        )

    # ── L2-003 Strength & Weakness Analyzer ──────────────────────────────────

    def get_strength_weakness_prompt(self, inputs: Dict[str, Any]) -> str:
        skill_proficiencies = inputs.get("skillProficiencies", [])
        unmatched_cv_skills = inputs.get("unmatchedCvSkills", [])
        return (
            f"Identify top strength domains and skill gaps from proficiency assessment.\n\n"
            f"SKILL PROFICIENCIES:\n{json.dumps(skill_proficiencies, indent=2)}\n\n"
            f"CV SKILLS WITHOUT CODE EVIDENCE: {json.dumps(unmatched_cv_skills)}\n\n"
            f"TASK:\n"
            f"1. Cluster skills into top 3-5 strongest domains (e.g., 'Backend API Development', 'DevOps').\n"
            f"2. Identify skills declared in CV but missing from code evidence (potential exaggerations).\n"
            f"3. Identify significant gaps relative to the skill profile.\n\n"
            f"Return JSON:\n"
            f'{{"strongestDomains": [{{"domain": "string", "skills": ["list"], "avgProficiency": 3.2, '
            f'"domainSummary": "string"}}], '
            f'"skillGaps": [{{"skill": "string", "gapType": "declared_unproven|missing_for_domain|low_proficiency", '
            f'"severity": "low|medium|high", "detail": "string"}}], '
            f'"overallStrengthSummary": "one paragraph"}}'
        )

    # ── L2-004 Career Level Evidence Mapper ──────────────────────────────────

    def get_career_level_mapper_prompt(self, inputs: Dict[str, Any]) -> str:
        repo_report = inputs.get("repoIntelligenceReport", {})
        skill_proficiencies = inputs.get("skillProficiencies", [])
        strongest_domains = inputs.get("strongestDomains", [])
        return (
            f"Map candidate evidence to career level definitions.\n\n"
            f"CAREER LEVEL FRAMEWORK:\n"
            f"L1 Junior (score 20-45): Basic CRUD, simple UI, limited architecture understanding\n"
            f"L2 Middle (score 46-65): Feature implementation, API design, team collaboration patterns\n"
            f"L3 Senior (score 66-82): Architecture decisions, complex system design, mentoring evidence\n"
            f"L4 Staff (score 83-92): Cross-team impact, platform/infra ownership, strategic technical decisions\n"
            f"L5 Principal (score 93-100): Org-wide technical direction, novel architecture, research-grade work\n\n"
            f"REQUIRED EVIDENCE PER LEVEL:\n"
            f"L1: Any working code, basic data structures\n"
            f"L2: API endpoints, database operations, testing evidence\n"
            f"L3: Architecture patterns (DI, CQRS, Hexagonal), system design decisions, 2+ year maintenance\n"
            f"L4: Infrastructure/platform code, cross-service orchestration, OSS contributions\n"
            f"L5: Novel algorithm/framework, research citations, industry-recognized patterns\n\n"
            f"REPOSITORY INTELLIGENCE REPORT:\n{json.dumps(repo_report, indent=2)}\n\n"
            f"SKILL PROFICIENCIES:\n{json.dumps(skill_proficiencies, indent=2)}\n\n"
            f"STRONGEST DOMAINS:\n{json.dumps(strongest_domains, indent=2)}\n\n"
            f"Return JSON:\n"
            f'{{"candidateScore": 72.5, "estimatedLevel": "L3", "estimatedLevelLabel": "Senior", '
            f'"scoreBreakdown": {{"skillDepth": 0.35, "ownershipScore": 0.25, "architectureScore": 0.20, '
            f'"problemSolvingScore": 0.12, "impactScore": 0.08}}, '
            f'"levelEvidence": {{"L3": [{{"criterion": "string", "met": true, "evidence": "string"}}]}}, '
            f'"levelRationale": "paragraph explaining level assignment"}}'
        )

    # ── L2-005 Career Level Threshold Calibrator ─────────────────────────────

    def get_career_level_calibrator_prompt(self, inputs: Dict[str, Any]) -> str:
        candidate_score = inputs.get("candidateScore", 0)
        score_breakdown = inputs.get("scoreBreakdown", {})
        level_evidence = inputs.get("levelEvidence", {})
        return (
            f"Validate and calibrate career level assignment against threshold rules.\n\n"
            f"CANDIDATE SCORE: {candidate_score}\n"
            f"SCORE BREAKDOWN: {json.dumps(score_breakdown)}\n"
            f"LEVEL EVIDENCE: {json.dumps(level_evidence, indent=2)}\n\n"
            f"THRESHOLD RULES:\n"
            f"Junior (L1): 20 ≤ score < 46\n"
            f"Middle (L2): 46 ≤ score < 66\n"
            f"Senior (L3): 66 ≤ score < 83\n"
            f"Staff (L4): 83 ≤ score < 93\n"
            f"Principal (L5): 93 ≤ score ≤ 100\n\n"
            f"TASK: Apply threshold rules. Check for boundary cases (score near level transitions).\n"
            f"Adjust if evidence strongly supports a different level than raw score suggests.\n\n"
            f"Return JSON:\n"
            f'{{"calibratedScore": 72.5, "calibratedLevel": "L3", "calibratedLevelLabel": "Senior", '
            f'"confidenceInLevel": 0.87, "isBoundaryCase": false, '
            f'"calibrationNotes": "explanation if adjusted from raw score"}}'
        )

    # ── L2-006 Career Level Evidence Gate ────────────────────────────────────

    def get_career_level_gate_prompt(self, inputs: Dict[str, Any]) -> str:
        calibrated_level = inputs.get("calibratedLevel", "L2")
        calibrated_score = inputs.get("calibratedScore", 0)
        level_evidence = inputs.get("levelEvidence", {})
        repo_report = inputs.get("repoIntelligenceReport", {})
        return (
            f"Apply evidence gate validation: ensure candidate meets mandatory evidence requirements for their level.\n\n"
            f"CALIBRATED LEVEL: {calibrated_level} (Score: {calibrated_score})\n"
            f"LEVEL EVIDENCE: {json.dumps(level_evidence, indent=2)}\n"
            f"REPO REPORT (architecture section): {json.dumps(repo_report.get('patterns', []))}\n\n"
            f"GATE RULES:\n"
            f"Senior (L3) gate: MUST have architecture evidence (DI, patterns, system design). "
            f"If score ≥66 but no architecture evidence → downgrade to L2.\n"
            f"Staff (L4) gate: MUST have platform/infra or cross-service evidence.\n"
            f"Principal (L5) gate: MUST have novel technical contribution or research-grade work.\n\n"
            f"Return JSON:\n"
            f'{{"gatePassed": true, "finalLevel": "L3", "finalLevelLabel": "Senior", '
            f'"finalScore": 72.5, "gateViolations": [], '
            f'"gateRationale": "explanation of gate result"}}'
        )

    # ── L2-007 Engineering Maturity Assessor ─────────────────────────────────

    def get_engineering_maturity_prompt(self, inputs: Dict[str, Any]) -> str:
        repo_report = inputs.get("repoIntelligenceReport", {})
        commit_data = inputs.get("commitTimelineData", {})
        quality_data = inputs.get("codeQualityData", {})
        return (
            f"Assess engineering maturity: code quality habits, refactoring discipline, documentation, testing.\n\n"
            f"REPOSITORY REPORT:\n{json.dumps(repo_report, indent=2)}\n\n"
            f"COMMIT TIMELINE:\n{json.dumps(commit_data, indent=2)}\n\n"
            f"CODE QUALITY DATA:\n{json.dumps(quality_data, indent=2)}\n\n"
            f"MATURITY SIGNALS TO ASSESS:\n"
            f"- Proactive refactoring (not just feature/bug commits)\n"
            f"- Test coverage discipline (test files added alongside features)\n"
            f"- Documentation quality (READMEs, comments, API docs)\n"
            f"- Error handling discipline (specific try/catch, not bare except)\n"
            f"- Code smell awareness (complexity reduction over time)\n\n"
            f"Return JSON:\n"
            f'{{"engineeringMaturityScore": 75.0, "maturityLevel": "Practitioner", '
            f'"signals": [{{"signal": "proactive_refactoring", "observed": true, '
            f'"evidence": "string", "strength": "strong|moderate|weak"}}], '
            f'"maturitySummary": "paragraph"}}'
        )

    # ── L2-008 Problem Solving Analyzer ──────────────────────────────────────

    def get_problem_solving_prompt(self, inputs: Dict[str, Any]) -> str:
        commit_timeline = inputs.get("commitTimelineData", {})
        commit_intent_data = inputs.get("commitIntentData", {})
        return (
            f"Analyze problem solving patterns from commit history: bug-fix quality, time-to-fix, recurrence.\n\n"
            f"COMMIT TIMELINE DATA:\n{json.dumps(commit_timeline, indent=2)}\n\n"
            f"COMMIT INTENT DATA:\n{json.dumps(commit_intent_data, indent=2)}\n\n"
            f"ANALYSIS TASKS:\n"
            f"1. Time-to-fix: How quickly does the developer resolve reported bugs?\n"
            f"2. Fix quality: Are fixes comprehensive (root cause) or band-aid (symptom)?\n"
            f"3. Recurrence rate: Do the same areas get fixed repeatedly? (high = poor root cause analysis)\n"
            f"4. Complexity handling: Are complex bugs fixed with proportional solution quality?\n\n"
            f"Return JSON:\n"
            f'{{"problemSolvingScore": 78.0, '
            f'"avgTimeToFixDays": 2.5, "rootCauseFixRatio": 0.72, '
            f'"recurrenceRate": 0.18, "complexBugHandling": "strong|moderate|weak", '
            f'"problemSolvingPatterns": [{{"pattern": "string", "frequency": "high|medium|low", '
            f'"assessment": "positive|negative|neutral", "evidence": "string"}}], '
            f'"problemSolvingSummary": "paragraph"}}'
        )

    # ── L2-009 Technical Tendency Classifier ─────────────────────────────────

    def get_technical_tendency_prompt(self, inputs: Dict[str, Any]) -> str:
        skill_proficiencies = inputs.get("skillProficiencies", [])
        strongest_domains = inputs.get("strongestDomains", [])
        repo_report = inputs.get("repoIntelligenceReport", {})
        return (
            f"Classify candidate into primary technical tendency (role affinity).\n\n"
            f"TECHNICAL ROLES (classify into 1-3 primary matches):\n"
            f"Backend, Frontend, Fullstack, Mobile, DevOps/SRE, Data Engineering, "
            f"AI/ML Engineering, Security Engineering, Platform Engineering\n\n"
            f"SKILL PROFICIENCIES:\n{json.dumps(skill_proficiencies, indent=2)}\n\n"
            f"STRONGEST DOMAINS:\n{json.dumps(strongest_domains, indent=2)}\n\n"
            f"REPO REPORT (technologies, patterns):\n{json.dumps(repo_report, indent=2)}\n\n"
            f"Return JSON:\n"
            f'{{"primaryTendency": "Backend", "primaryConfidence": 0.88, '
            f'"tendencyRanking": [{{"role": "Backend", "confidence": 0.88, '
            f'"evidenceSignals": ["FastAPI endpoints in api/", "PostgreSQL ORM usage", "Redis caching"]}}], '
            f'"tendencySummary": "paragraph"}}'
        )

    # ── L2-010 Working Style Classifier ──────────────────────────────────────

    def get_working_style_prompt(self, inputs: Dict[str, Any]) -> str:
        commit_timeline = inputs.get("commitTimelineData", {})
        commit_intent = inputs.get("commitIntentData", {})
        strongest_domains = inputs.get("strongestDomains", [])
        return (
            f"Classify candidate working style from commit distribution and contribution patterns.\n\n"
            f"WORKING STYLE OPTIONS:\n"
            f"- Feature Builder: Primarily builds new features, high feat: commit ratio\n"
            f"- System Designer: Architecture-first, large refactoring commits, pattern standardization\n"
            f"- Problem Solver: High fix: commit ratio, quick response to issues\n"
            f"- Maintenance Engineer: Primarily chore/refactor/docs commits, stabilization focus\n"
            f"- Performance Optimizer: Profiling evidence, perf-focused refactors\n"
            f"- Research-Oriented: Experimental branches, proof-of-concept patterns\n\n"
            f"COMMIT TIMELINE:\n{json.dumps(commit_timeline, indent=2)}\n\n"
            f"COMMIT INTENT:\n{json.dumps(commit_intent, indent=2)}\n\n"
            f"STRONGEST DOMAINS:\n{json.dumps(strongest_domains, indent=2)}\n\n"
            f"Return JSON:\n"
            f'{{"primaryWorkingStyle": "Feature Builder", "styleConfidence": 0.82, '
            f'"styleDistribution": [{{"style": "Feature Builder", "confidence": 0.82, '
            f'"evidence": "72% of commits are feat: type"}}], '
            f'"workingStyleSummary": "paragraph"}}'
        )

    # ── L2-012 Multi-Role Recommendation Engine ───────────────────────────────

    def get_multi_role_recommendation_prompt(self, inputs: Dict[str, Any]) -> str:
        primary_tendency = inputs.get("primaryTendency", "")
        tendency_ranking = inputs.get("tendencyRanking", [])
        final_level = inputs.get("finalLevel", "L2")
        final_level_label = inputs.get("finalLevelLabel", "Middle")
        strongest_domains = inputs.get("strongestDomains", [])
        working_style = inputs.get("primaryWorkingStyle", "")
        return (
            f"Generate role recommendations based on technical tendency, career level, and working style.\n\n"
            f"CANDIDATE PROFILE:\n"
            f"- Primary Tendency: {primary_tendency}\n"
            f"- Career Level: {final_level} ({final_level_label})\n"
            f"- Working Style: {working_style}\n"
            f"- Tendency Ranking: {json.dumps(tendency_ranking)}\n"
            f"- Strongest Domains: {json.dumps(strongest_domains)}\n\n"
            f"TASK:\n"
            f"1. Recommend Top 1 best-fit role with specific job titles.\n"
            f"2. Suggest 5-10 additional matching positions with confidence scores.\n"
            f"3. Generate suggested CV role titles the candidate should use.\n\n"
            f"Return JSON:\n"
            f'{{"topMatch": {{"roleTitle": "Senior Backend Engineer", "confidence": 0.91, '
            f'"rationale": "string"}}, '
            f'"suggestedRoles": [{{"roleTitle": "string", "confidence": 0.75, '
            f'"domain": "string", "levelFit": "exact|stretch|underqualified"}}], '
            f'"suggestedCvTitles": ["Senior Python Developer", "Backend Engineer | FastAPI | PostgreSQL"]}}'
        )

    # ── L2-013 Candidate Summary Generator ───────────────────────────────────

    def get_candidate_summary_prompt(self, inputs: Dict[str, Any]) -> str:
        final_level = inputs.get("finalLevel", "L2")
        final_level_label = inputs.get("finalLevelLabel", "Middle")
        primary_tendency = inputs.get("primaryTendency", "")
        working_style = inputs.get("primaryWorkingStyle", "")
        strongest_domains = inputs.get("strongestDomains", [])
        skill_gaps = inputs.get("skillGaps", [])
        engineering_maturity = inputs.get("engineeringMaturitySummary", "")
        problem_solving = inputs.get("problemSolvingSummary", "")
        top_role = inputs.get("topMatchRole", "")
        return (
            f"Generate an objective, evidence-based candidate summary for recruiter review.\n\n"
            f"CANDIDATE DATA:\n"
            f"- Career Level: {final_level} ({final_level_label})\n"
            f"- Primary Tendency: {primary_tendency}\n"
            f"- Working Style: {working_style}\n"
            f"- Strongest Domains: {json.dumps(strongest_domains)}\n"
            f"- Skill Gaps: {json.dumps(skill_gaps)}\n"
            f"- Engineering Maturity: {engineering_maturity}\n"
            f"- Problem Solving: {problem_solving}\n"
            f"- Top Role Match: {top_role}\n\n"
            f"REQUIREMENTS:\n"
            f"- Tone: objective, evidence-based, professional (not promotional)\n"
            f"- Length: 200-350 characters for recruiter_headline, 400-700 characters for full_summary\n"
            f"- Must cite specific technical evidence, not generic statements\n"
            f"- Must mention level, tendency, and top 2-3 skills\n\n"
            f"Return JSON:\n"
            f'{{"recruiterHeadline": "Senior Backend Engineer with 3+ years of Python/FastAPI expertise", '
            f'"fullSummary": "paragraph 400-700 chars", '
            f'"keyStrengths": ["Distributed system design", "API architecture", "PostgreSQL optimization"], '
            f'"watchPoints": ["Limited frontend exposure", "No mobile development evidence"]}}'
        )
