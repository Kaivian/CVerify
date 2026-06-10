import math
import json
import os
import logging
from typing import Any, Dict, List, Tuple

logger = logging.getLogger("scoring_engine")

def _get_normalized_name(name: str) -> str:
    if not name:
        return ""
    from app.pipelines.candidate.skill_taxonomy import normalize_skill
    entry = normalize_skill(name)
    return entry.normalized_name.lower() if entry else name.strip().lower()

def get_duration_months(entry: dict) -> float:
    from datetime import datetime
    s_str = entry.get("startDate")
    e_str = entry.get("endDate")
    if not s_str:
        return float(entry.get("durationMonths", 0))
    try:
        s_dt = datetime.strptime(s_str[:10], "%Y-%m-%d")
        e_dt = datetime.strptime(e_str[:10], "%Y-%m-%d") if e_str else datetime.now()
        return float(max(1.0, (e_dt.year - s_dt.year) * 12 + e_dt.month - s_dt.month))
    except Exception:
        return float(entry.get("durationMonths", 1))

def calculate_verified_score(
    repository_assessments: List[dict],
    cv: dict,
    cv_skills: List[str],
    skill_proficiencies: List[dict],
    policy: dict
) -> dict:
    dim_cfg = policy["dimensions"]
    w_sd, a_sd, b_sd = dim_cfg["skillDepth"]["weight"], dim_cfg["skillDepth"]["scale_A"], dim_cfg["skillDepth"]["scale_B"]
    w_own, a_own, b_own = dim_cfg["ownership"]["weight"], dim_cfg["ownership"]["scale_A"], dim_cfg["ownership"]["scale_B"]
    w_arch, a_arch, b_arch = dim_cfg["architecture"]["weight"], dim_cfg["architecture"]["scale_A"], dim_cfg["architecture"]["scale_B"]
    w_ps, a_ps, b_ps = dim_cfg["problemSolving"]["weight"], dim_cfg["problemSolving"]["scale_A"], dim_cfg["problemSolving"]["scale_B"]
    w_imp, a_imp, b_imp = dim_cfg["impact"]["weight"], dim_cfg["impact"]["scale_A"], dim_cfg["impact"]["scale_B"]

    # Calculate basic repository metrics if repositories are present
    repo_scores = []
    scopes = []
    
    for ra in repository_assessments:
        repo_score = 0.0
        capabilities = ra.get("capabilities") or []
        for cap in capabilities:
            diff_score = float(cap.get("difficultyScore", 1.0))
            if diff_score <= 1.0:
                diff_score *= 10.0
            
            maturity = cap.get("maturity", "Basic")
            maturity_mult = 0.5 if maturity == "Basic" else 1.0 if maturity == "Intermediate" else 1.5 if maturity == "Advanced" else 2.0
            repo_score += diff_score * maturity_mult
            
        repo_scores.append(repo_score)
        
        sig = ra.get("intelligenceSignal") or {}
        scopes.append(float(sig.get("scopeSignal", 0.0)))

    # 1. Verified Skill Depth
    raw_skills_verified = 0.0
    unique_repo_skills = set()
    for ra in repository_assessments:
        for attr in ra.get("skillAttributions", []):
            sname = attr.get("skillName")
            if sname:
                unique_repo_skills.add(sname)

    all_skills = list(set(cv_skills) | unique_repo_skills)
    
    for skill_name in all_skills:
        prof = next((p for p in skill_proficiencies if p.get("skill", "").lower() == skill_name.lower()), None)
        supporting_repos = []
        norm_skill_name = _get_normalized_name(skill_name)
        for ra in repository_assessments:
            for attr in ra.get("skillAttributions", []):
                if _get_normalized_name(attr.get("skillName", "")) == norm_skill_name:
                    supporting_repos.append(ra)
        if prof and supporting_repos:
            raw_skills_verified += float(prof.get("proficiencyLevel", 1.0)) * 25.0
            
    sd_verified = a_sd * math.log1p(b_sd * raw_skills_verified)

    # 2. Verified Repository Ownership
    raw_ownership_verified = 0.0
    for idx, ra in enumerate(repository_assessments):
        sig = ra.get("intelligenceSignal") or {}
        ownership_signal = float(sig.get("ownershipSignal", 0.0))
        if ownership_signal > 1.0:
            ownership_signal /= 100.0
        if ownership_signal == 0.0:
            ownership_signal = 1.0
        raw_ownership_verified += ownership_signal * repo_scores[idx]
        
    own_verified = a_own * math.log1p(b_own * raw_ownership_verified)

    # 3. Verified System Architecture
    unique_arch_caps = {}
    for ra in repository_assessments:
        capabilities = ra.get("capabilities") or []
        for cap in capabilities:
            diff_score = float(cap.get("difficultyScore", 1.0))
            if diff_score <= 1.0:
                diff_score *= 10.0
            if diff_score >= 5.0:
                cname = cap.get("name", "").lower()
                if not cname:
                    continue
                maturity = cap.get("maturity", "Basic")
                maturity_mult = 0.5 if maturity == "Basic" else 1.0 if maturity == "Intermediate" else 1.5 if maturity == "Advanced" else 2.0
                cap_score = diff_score * 10.0 * maturity_mult
                if cname not in unique_arch_caps or cap_score > unique_arch_caps[cname]:
                    unique_arch_caps[cname] = cap_score
                    
    raw_architecture_verified = sum(unique_arch_caps.values())
    arch_verified = a_arch * math.log1p(b_arch * raw_architecture_verified)

    # 4. Verified Problem Solving
    raw_solving_verified = 0.0
    for ra in repository_assessments:
        sig = ra.get("intelligenceSignal") or {}
        consistency_signal = float(sig.get("consistencySignal", 50.0))
        ownership_signal = float(sig.get("ownershipSignal", 100.0))
        if ownership_signal > 1.0:
            ownership_signal /= 100.0
        
        quality_metrics = ra.get("qualityMetrics") or {}
        quality_score = float(quality_metrics.get("qualityScore", 50.0))
        
        raw_solving_verified += (consistency_signal / 100.0) * quality_score * ownership_signal
        
    ps_verified = a_ps * math.log1p(b_ps * raw_solving_verified)

    # 5. Verified Business Impact (based only on verified projects in CV)
    verified_project_ids = {str(ra.get("cvProjectEntryId")).lower() for ra in repository_assessments if ra.get("cvProjectEntryId")}
    verified_project_names = {str(ra.get("cvProjectName")).lower() for ra in repository_assessments if ra.get("cvProjectName")}
    
    verified_projects = []
    for proj in cv.get("projects", []):
        proj_id = proj.get("cvProjectId")
        proj_name = proj.get("name")
        
        is_verified = False
        if proj_id and str(proj_id).lower() in verified_project_ids:
            is_verified = True
        elif proj_name and str(proj_name).lower() in verified_project_names:
            is_verified = True
        elif proj.get("verificationLevel") in ("AiAnalyzed", "RepositoryLinked"):
            is_verified = True
            
        if is_verified:
            verified_projects.append(proj)

    verified_months = sum(get_duration_months(p) for p in verified_projects)
    
    max_company_scale = 1.0
    max_role_scale = 1.0
    for proj in verified_projects:
        desc = str(proj.get("description", "")).lower()
        if any(term in desc for term in ["google", "apple", "facebook", "meta", "netflix", "amazon", "microsoft"]):
            max_company_scale = 1.15
        title = str(proj.get("role", "")).lower()
        if "principal" in title or "director" in title or "head" in title:
            max_role_scale = max(max_role_scale, 1.6)
        elif "staff" in title or "lead" in title or "manager" in title:
            max_role_scale = max(max_role_scale, 1.4)
        elif "senior" in title:
            max_role_scale = max(max_role_scale, 1.2)
        elif "junior" in title or "intern" in title:
            max_role_scale = max(max_role_scale, 0.8)

    imp_verified = math.log1p(b_imp * verified_months) * max_company_scale * max_role_scale * a_imp

    score_val = sd_verified * w_sd + own_verified * w_own + arch_verified * w_arch + ps_verified * w_ps + imp_verified * w_imp

    return {
        "skillDepth": int(round(sd_verified)),
        "ownership": int(round(own_verified)),
        "architecture": int(round(arch_verified)),
        "skillDepth": int(round(sd_verified)),
        "ownership": int(round(own_verified)),
        "architecture": int(round(arch_verified)),
        "problemSolving": int(round(ps_verified)),
        "impact": int(round(imp_verified)),
        "score": int(round(score_val)),
        "rawSkillDepth": raw_skills_verified,
        "rawOwnership": raw_ownership_verified,
        "rawArchitecture": raw_architecture_verified,
        "rawProblemSolving": raw_solving_verified,
        "rawImpact": verified_months
    }

def calculate_self_declared_score(
    cv: dict,
    cv_skills: List[str],
    skill_proficiencies: List[dict],
    repository_assessments: List[dict],
    inputs: dict,
    policy: dict
) -> dict:
    dim_cfg = policy["dimensions"]
    w_sd, a_sd, b_sd = dim_cfg["skillDepth"]["weight"], dim_cfg["skillDepth"]["scale_A"], dim_cfg["skillDepth"]["scale_B"]
    w_own, a_own, b_own = dim_cfg["ownership"]["weight"], dim_cfg["ownership"]["scale_A"], dim_cfg["ownership"]["scale_B"]
    w_arch, a_arch, b_arch = dim_cfg["architecture"]["weight"], dim_cfg["architecture"]["scale_A"], dim_cfg["architecture"]["scale_B"]
    w_ps, a_ps, b_ps = dim_cfg["problemSolving"]["weight"], dim_cfg["problemSolving"]["scale_A"], dim_cfg["problemSolving"]["scale_B"]
    w_imp, a_imp, b_imp = dim_cfg["impact"]["weight"], dim_cfg["impact"]["scale_A"], dim_cfg["impact"]["scale_B"]

    # Build a list of self-declared projects
    verified_project_ids = {str(ra.get("cvProjectEntryId")).lower() for ra in repository_assessments if ra.get("cvProjectEntryId")}
    verified_project_names = {str(ra.get("cvProjectName")).lower() for ra in repository_assessments if ra.get("cvProjectName")}
    
    self_declared_projects = []
    for proj in cv.get("projects", []):
        proj_id = proj.get("cvProjectId")
        proj_name = proj.get("name")
        
        is_verified = False
        if proj_id and str(proj_id).lower() in verified_project_ids:
            is_verified = True
        elif proj_name and str(proj_name).lower() in verified_project_names:
            is_verified = True
        elif proj.get("verificationLevel") in ("AiAnalyzed", "RepositoryLinked"):
            is_verified = True
            
        if not is_verified:
            self_declared_projects.append(proj)

    # 1. Self-Declared Skill Depth
    raw_skills_self = 0.0
    unique_skills = list(set(cv_skills) | {p.get("skill", "") for p in skill_proficiencies if p.get("skill")})
    for skill_name in unique_skills:
        prof = next((p for p in skill_proficiencies if p.get("skill", "").lower() == skill_name.lower()), None)
        supporting_self_declared = []
        norm_skill_name = _get_normalized_name(skill_name)
        for proj in self_declared_projects:
            techs = [_get_normalized_name(t) for t in proj.get("technologies", [])]
            if norm_skill_name in techs:
                supporting_self_declared.append(proj)
        if prof and supporting_self_declared:
            raw_skills_self += float(prof.get("proficiencyLevel", 1.0)) * 25.0
            
    sd_self = a_sd * math.log1p(b_sd * raw_skills_self)

    # 2. Self-Declared Ownership
    raw_ownership_self = 0.0
    for proj in self_declared_projects:
        ownership_signal = 0.80
        project_complexity = 30.0
        raw_ownership_self += ownership_signal * project_complexity
        
    own_self = a_own * math.log1p(b_own * raw_ownership_self)

    # 3. Self-Declared System Architecture
    unique_arch_caps_self = {}
    arch_skills = {"microservices", "system design", "aws", "kubernetes", "docker", "cqrs", "clean architecture", "ci/cd", "redis", "kafka", "distributed systems", "cloud architecture", "gcp", "azure", "graphql", "rabbitmq"}
    for skill_name in cv_skills:
        if skill_name.lower() in arch_skills:
            has_self_declared_support = any(
                skill_name.lower() in [str(t).lower() for t in proj.get("technologies", [])]
                for proj in self_declared_projects
            )
            if has_self_declared_support:
                unique_arch_caps_self[skill_name.lower()] = 20.0
                
    raw_architecture_self = sum(unique_arch_caps_self.values())
    arch_self = a_arch * math.log1p(b_arch * raw_architecture_self)

    # 4. Self-Declared Problem Solving
    problem_solving_score = float(inputs.get("problemSolvingScore") or 50.0)
    raw_solving_self = len(self_declared_projects) * problem_solving_score
    ps_self = a_ps * math.log1p(b_ps * raw_solving_self)

    # 5. Self-Declared Impact (based on work experiences in CV)
    total_months = 0.0
    experiences = cv.get("experiences", [])
    for exp in experiences:
        total_months += float(exp.get("durationMonths", 0))
    if total_months == 0:
        experiences_raw = cv.get("experiences", [])
        for exp in experiences_raw:
            total_months += get_duration_months(exp)
            
    has_leadership = any(exp.get("isLeadership", False) for exp in experiences)
    leadership_mult = 1.15 if has_leadership else 1.0

    max_company_scale = 1.0
    max_role_scale = 1.0
    for exp in experiences:
        if any(term in str(exp.get("company", "")).lower() for term in ["google", "apple", "facebook", "meta", "netflix", "amazon", "microsoft"]):
            max_company_scale = 1.15
        title = str(exp.get("jobTitle", "")).lower()
        if "principal" in title or "director" in title or "head" in title:
            max_role_scale = max(max_role_scale, 1.6)
        elif "staff" in title or "lead" in title or "manager" in title:
            max_role_scale = max(max_role_scale, 1.4)
        elif "senior" in title:
            max_role_scale = max(max_role_scale, 1.2)
        elif "junior" in title or "intern" in title:
            max_role_scale = max(max_role_scale, 0.8)

    imp_self = math.log1p(b_imp * total_months) * max_company_scale * max_role_scale * leadership_mult * a_imp

    score_val = sd_self * w_sd + own_self * w_own + arch_self * w_arch + ps_self * w_ps + imp_self * w_imp

    return {
        "skillDepth": int(round(sd_self)),
        "ownership": int(round(own_self)),
        "architecture": int(round(arch_self)),
        "problemSolving": int(round(ps_self)),
        "impact": int(round(imp_self)),
        "score": int(round(score_val)),
        "rawSkillDepth": raw_skills_self,
        "rawOwnership": raw_ownership_self,
        "rawArchitecture": raw_architecture_self,
        "rawProblemSolving": raw_solving_self,
        "rawImpact": total_months
    }

def aggregate_scores(
    verified: dict,
    self_declared: dict,
    has_verified_repos: bool,
    policy: dict
) -> dict:
    dim_cfg = policy["dimensions"]
    w_sd = dim_cfg["skillDepth"]["weight"]
    w_own = dim_cfg["ownership"]["weight"]
    w_arch = dim_cfg["architecture"]["weight"]
    w_ps = dim_cfg["problemSolving"]["weight"]
    w_imp = dim_cfg["impact"]["weight"]

    # Combine scores using a weighted aggregator
    if has_verified_repos:
        verified_weight = 0.85
        self_declared_weight = 0.15
        scale_ceiling = 1.0
    else:
        verified_weight = 0.0
        self_declared_weight = 1.0
        # Ceiling factor to scale down purely self-declared candidate scores
        scale_ceiling = 0.40

    def combine_dim(k: str) -> float:
        val = verified[k] * verified_weight + self_declared[k] * self_declared_weight
        return val * scale_ceiling

    sd_combined = combine_dim("skillDepth")
    own_combined = combine_dim("ownership")
    arch_combined = combine_dim("architecture")
    ps_combined = combine_dim("problemSolving")
    imp_combined = combine_dim("impact")

    # Combine raw signals
    raw_sd = verified.get("rawSkillDepth", 0.0) * verified_weight + self_declared.get("rawSkillDepth", 0.0) * self_declared_weight
    raw_own = verified.get("rawOwnership", 0.0) * verified_weight + self_declared.get("rawOwnership", 0.0) * self_declared_weight
    raw_arch = verified.get("rawArchitecture", 0.0) * verified_weight + self_declared.get("rawArchitecture", 0.0) * self_declared_weight
    raw_ps = verified.get("rawProblemSolving", 0.0) * verified_weight + self_declared.get("rawProblemSolving", 0.0) * self_declared_weight
    raw_imp = verified.get("rawImpact", 0.0) * verified_weight + self_declared.get("rawImpact", 0.0) * self_declared_weight

    # The combined overall score is computed directly as the weighted sum of combined dimensions
    overall_combined = (
        sd_combined * w_sd +
        own_combined * w_own +
        arch_combined * w_arch +
        ps_combined * w_ps +
        imp_combined * w_imp
    )

    return {
        "skillDepth": sd_combined,
        "ownership": own_combined,
        "architecture": arch_combined,
        "problemSolving": ps_combined,
        "impact": imp_combined,
        "score": overall_combined,
        "rawSkillDepth": raw_sd,
        "rawOwnership": raw_own,
        "rawArchitecture": raw_arch,
        "rawProblemSolving": raw_ps,
        "rawImpact": raw_imp
    }

def normalize_score_to_cohort(raw_score: float, snapshot_path: str) -> Tuple[float, str]:
    if not os.path.exists(snapshot_path):
        logger.warning(f"Cohort snapshot file not found: {snapshot_path}. Falling back to default distribution.")
        # Fallback linear mapping
        return min(100.0, max(0.0, raw_score)), "v0.0.0-fallback"

    try:
        with open(snapshot_path, "r") as f:
            snapshot = json.load(f)
    except Exception as e:
        logger.error(f"Failed to read cohort snapshot: {e}")
        return min(100.0, max(0.0, raw_score)), "v0.0.0-error"

    bins = snapshot.get("percentiles", [])
    version = snapshot.get("cohortVersion", "unknown")
    if not bins:
        return min(100.0, max(0.0, raw_score)), version

    # Sort bins by score just in case
    bins = sorted(bins, key=lambda x: x["score"])

    if raw_score <= bins[0]["score"]:
        return float(bins[0]["percentile"]), version
    if raw_score >= bins[-1]["score"]:
        return float(bins[-1]["percentile"]), version

    # Linear interpolation
    for i in range(len(bins) - 1):
        s0, p0 = bins[i]["score"], bins[i]["percentile"]
        s1, p1 = bins[i+1]["score"], bins[i+1]["percentile"]
        if s0 <= raw_score <= s1:
            ratio = (raw_score - s0) / (s1 - s0)
            percentile = p0 + ratio * (p1 - p0)
            return float(percentile), version

    return 50.0, version

def calculate_uncertainty_band(
    combined_score: float,
    self_declared_score: float,
    cohort_percentile: float
) -> dict:
    ratio = self_declared_score / max(combined_score, 1.0)
    # Clamp ratio between 0.0 and 1.0
    ratio = max(0.0, min(1.0, ratio))

    # Margin is ±5% for fully verified, growing to ±20% for fully self-declared
    margin = 5.0 + 15.0 * ratio

    return {
        "min": max(0.0, round(cohort_percentile - margin, 2)),
        "max": min(100.0, round(cohort_percentile + margin, 2)),
        "margin": round(margin, 2)
    }

def classify_seniority(complexity: float, leadership: float, maturity: float, ownership: float) -> Tuple[str, str]:
    if complexity >= 85 and leadership >= 80 and maturity >= 85 and ownership >= 75:
        return "L5", "Principal"
    if complexity >= 75 and leadership >= 65 and maturity >= 75 and ownership >= 60:
        return "L4", "Staff"
    if complexity >= 55 and leadership >= 40 and maturity >= 60 and ownership >= 45:
        return "L3", "Senior"
    if complexity >= 30 and leadership >= 15 and maturity >= 35 and ownership >= 30:
        return "L2", "Middle"
    if complexity >= 10 and maturity >= 15 and ownership >= 15:
        return "L1", "Junior"
    return "Intern", "Intern"

def score_candidate_deterministic(
    cv: dict,
    repository_assessments: List[dict],
    skill_proficiencies: Optional[List[dict]] = None,
    historical_maturity_score: Optional[float] = None,
    historical_problem_solving_score: Optional[float] = None
) -> dict:
    policy = {
        "version": "1.0.0",
        "dimensions": {
            "skillDepth": {"weight": 0.35, "scale_A": 22.0, "scale_B": 0.05},
            "ownership": {"weight": 0.25, "scale_A": 22.0, "scale_B": 0.2},
            "architecture": {"weight": 0.20, "scale_A": 22.0, "scale_B": 0.05},
            "problemSolving": {"weight": 0.12, "scale_A": 22.0, "scale_B": 0.1},
            "impact": {"weight": 0.08, "scale_A": 20.0, "scale_B": 1.0}
        }
    }
    policy_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scoring_policy.json")
    if os.path.exists(policy_path):
        try:
            with open(policy_path, "r") as f:
                policy = json.load(f)
        except Exception:
            pass

    cv_skills = cv.get("skills", [])
    
    if not skill_proficiencies:
        skill_map = {}
        for ra in repository_assessments:
            for attr in ra.get("skillAttributions", []):
                sname = attr.get("skillName")
                if not sname:
                    continue
                sname_lower = sname.lower()
                weight = float(attr.get("contributionWeight", 0.0))
                skill_map.setdefault(sname_lower, []).append(weight)
        
        skill_proficiencies = []
        for sname_lower, weights in skill_map.items():
            avg_weight = sum(weights) / len(weights)
            if avg_weight >= 0.8:
                prof_level = 4.0
                label = "Expert"
            elif avg_weight >= 0.5:
                prof_level = 3.0
                label = "Practitioner"
            elif avg_weight >= 0.2:
                prof_level = 2.0
                label = "Working"
            else:
                prof_level = 1.0
                label = "Awareness"
            skill_proficiencies.append({
                "skill": sname_lower,
                "proficiencyLevel": prof_level,
                "proficiencyLabel": label
            })

    has_verified_repos = len(repository_assessments) > 0
    verified_dict = calculate_verified_score(
        repository_assessments=repository_assessments,
        cv=cv,
        cv_skills=cv_skills,
        skill_proficiencies=skill_proficiencies,
        policy=policy
    )
    
    dummy_inputs = {
        "problemSolvingScore": 50.0
    }
    self_declared_dict = calculate_self_declared_score(
        cv=cv,
        cv_skills=cv_skills,
        skill_proficiencies=skill_proficiencies,
        repository_assessments=repository_assessments,
        inputs=dummy_inputs,
        policy=policy
    )
    combined = aggregate_scores(
        verified=verified_dict,
        self_declared=self_declared_dict,
        has_verified_repos=has_verified_repos,
        policy=policy
    )

    snapshot_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "cohort_snapshot_v1.json")
    cohort_percentile, cohort_version = normalize_score_to_cohort(combined["score"], snapshot_path)
    cohort_range = calculate_uncertainty_band(combined["score"], self_declared_dict["score"], cohort_percentile)

    all_categories = set()
    repo_scores = []
    scopes = []
    ownerships = []
    leaderships = []
    consistencies = []
    max_difficulty_score = 0.0

    for ra in repository_assessments:
        repo_score = 0.0
        capabilities = ra.get("capabilities") or []
        for cap in capabilities:
            diff_score = float(cap.get("difficultyScore", 1.0))
            if diff_score <= 1.0:
                diff_score *= 10.0
            max_difficulty_score = max(max_difficulty_score, diff_score)
            all_categories.add(cap.get("category", "other").lower())
            
            maturity = cap.get("maturity", "Basic")
            maturity_mult = 0.5 if maturity == "Basic" else 1.0 if maturity == "Intermediate" else 1.5 if maturity == "Advanced" else 2.0
            repo_score += diff_score * maturity_mult
            
        repo_scores.append(repo_score)
        
        sig = ra.get("intelligenceSignal") or {}
        scopes.append(float(sig.get("scopeSignal", 0.0)))
        ownerships.append(float(sig.get("ownershipSignal", 0.0)))
        leaderships.append(float(sig.get("leadershipSignal", 0.0)))
        consistencies.append(float(sig.get("consistencySignal", 0.0)))

    from app.pipelines.candidate.skill_taxonomy import SKILL_TAXONOMY
    for proj in cv.get("projects", []):
        for tech in proj.get("technologies", []):
            entry = SKILL_TAXONOMY.get(str(tech).strip().lower())
            if entry and entry.sfia_category:
                all_categories.add(entry.sfia_category.lower())

    mat_score = historical_maturity_score if historical_maturity_score is not None else 50.0
    ps_score = historical_problem_solving_score if historical_problem_solving_score is not None else 50.0

    candidate_complexity = max_difficulty_score * 10.0
    candidate_leadership = max(leaderships) if leaderships else 0.0
    candidate_consistency = sum(consistencies) / len(consistencies) if consistencies else 0.0
    candidate_problem_solving = ps_score

    capability_vector = {
        "version": "2.0.0",
        "skillDepth": int(round(combined["skillDepth"])),
        "ownership": int(round(combined["ownership"])),
        "architecture": int(round(combined["architecture"])),
        "problemSolving": int(round(combined["problemSolving"])),
        "impact": int(round(combined["impact"])),
        "dimensions": {
            "skillDepth": int(round(combined["skillDepth"])),
            "ownership": int(round(combined["ownership"])),
            "architecture": int(round(combined["architecture"])),
            "problemSolving": int(round(combined["problemSolving"])),
            "impact": int(round(combined["impact"]))
        },
        "rawSignals": {
            "rawSkillDepth": round(combined.get("rawSkillDepth", 0.0), 2),
            "rawOwnership": round(combined.get("rawOwnership", 0.0), 2),
            "rawArchitecture": round(combined.get("rawArchitecture", 0.0), 2),
            "rawProblemSolving": round(combined.get("rawProblemSolving", 0.0), 2),
            "rawImpact": round(combined.get("rawImpact", 0.0), 2)
        }
    }

    # 1. Candidate Skill Profiles
    from app.pipelines.candidate.helpers import _get_normalized_name
    skill_proficiencies_out = []
    skills_to_process = cv_skills if cv_skills else [p.get("skill") for p in skill_proficiencies if p.get("skill")]
    seen_skills = set()
    skills_to_process = [x for x in skills_to_process if not (x.lower() in seen_skills or seen_skills.add(x.lower()))]

    for skill_name in skills_to_process:
        prof = next((p for p in skill_proficiencies if p.get("skill", "").lower() == skill_name.lower()), None)
        supporting_repos = []
        norm_skill_name = _get_normalized_name(skill_name)
        for ra in repository_assessments:
            for attr in ra.get("skillAttributions", []):
                if _get_normalized_name(attr.get("skillName", "")) == norm_skill_name:
                    supporting_repos.append({
                        "repositoryId": ra.get("repositoryId"),
                        "repositoryName": ra.get("repositoryName"),
                        "confidence": attr.get("confidence", 0.0),
                        "contributionWeight": attr.get("contributionWeight", 0.0)
                    })
        
        supporting_projects = []
        verified_proj_names = []
        unverified_proj_names = []
        for proj in cv.get("projects", []):
            techs = [_get_normalized_name(t) for t in proj.get("technologies", [])]
            if norm_skill_name in techs:
                proj_id = proj.get("cvProjectId")
                proj_name = proj.get("name", "Unnamed Project")
                
                is_this_verified = False
                for ra in repository_assessments:
                    if proj_id and str(ra.get("cvProjectEntryId")).lower() == str(proj_id).lower():
                        is_this_verified = True
                    elif proj_name and str(ra.get("cvProjectName")).lower() == str(proj_name).lower():
                        is_this_verified = True
                        
                if proj.get("verificationLevel") in ("AiAnalyzed", "RepositoryLinked"):
                    is_this_verified = True
                    
                if is_this_verified:
                    verified_proj_names.append(proj_name)
                else:
                    unverified_proj_names.append(proj_name)
                supporting_projects.append(proj_name)

        if supporting_repos:
            score = float(prof.get("proficiencyLevel", 1.0)) * 25.0 if prof else 25.0
            confidence = float(prof.get("confidenceScore", 0.85)) if prof else 0.85
            level = prof.get("proficiencyLabel", "Working") if prof else "Working"
            evidence_sources = {
                "verification_level": "AiAnalyzed",
                "confidence": 0.85,
                "source": "repository_analysis",
                "rationale": f"Verified via {', '.join(r['repositoryName'] for r in supporting_repos)}: {prof.get('evidenceRationale', '') if prof else ''}".strip(),
                "metadata": {
                    "repositories": supporting_repos
                }
            }
        elif verified_proj_names:
            score = float(prof.get("proficiencyLevel", 1.0)) * 25.0 if prof else 25.0
            confidence = 0.60
            level = prof.get("proficiencyLabel", "Working") if prof else "Working"
            evidence_sources = {
                "verification_level": "SelfDeclared",
                "confidence": 0.60,
                "source": "cv_portfolio",
                "rationale": f"Self-declared in CV under project(s) linked to analyzed repository: {', '.join(verified_proj_names)}.",
                "metadata": {
                    "projects": verified_proj_names,
                    "verified_linkage": True
                }
            }
        elif unverified_proj_names:
            score = float(prof.get("proficiencyLevel", 1.0)) * 25.0 if prof else 25.0
            confidence = 0.40
            level = prof.get("proficiencyLabel", "Working") if prof else "Working"
            evidence_sources = {
                "verification_level": "SelfDeclared",
                "confidence": 0.40,
                "source": "cv_portfolio",
                "rationale": f"Declared in CV portfolio for projects: {', '.join(unverified_proj_names)}.",
                "metadata": {
                    "projects": unverified_proj_names,
                    "verified_linkage": False
                }
            }
        else:
            score = 0.0
            confidence = 0.20
            level = "Unverified"
            evidence_sources = {
                "verification_level": "Unverified",
                "confidence": 0.20,
                "source": "cv_skills_list",
                "rationale": "Declared in CV skills list, but no matching code evidence or project details found.",
                "metadata": {}
            }
            
        skill_proficiencies_out.append({
            "skillName": skill_name,
            "score": score,
            "confidence": confidence,
            "level": level,
            "evidenceSources": json.dumps(evidence_sources)
        })

    # 2. Candidate Domain Profiles
    domain_profiles_out = []
    domain_sums = {}
    domain_weights_sum = {}
    for ra in repository_assessments:
        for dom in ra.get("domains", []):
            dname = dom.get("domainName")
            if not dname:
                continue
            w = float(dom.get("weight", 0.0))
            d_score = float(ra.get("overallScore", 0.0))
            domain_sums[dname] = domain_sums.get(dname, 0.0) + (d_score * w)
            domain_weights_sum[dname] = domain_weights_sum.get(dname, 0.0) + w

    from app.pipelines.candidate.orchestrator import _LEVEL_LABELS
    for dname, w_sum in domain_weights_sum.items():
        avg_score = domain_sums[dname] / w_sum if w_sum > 0 else 0.0
        dom_complexity = candidate_complexity * (w_sum / len(repository_assessments) if repository_assessments else 1.0)
        
        dom_level = "L2"
        if dom_complexity >= 85: dom_level = "L5"
        elif dom_complexity >= 75: dom_level = "L4"
        elif dom_complexity >= 55: dom_level = "L3"
        
        domain_profiles_out.append({
            "domainName": dname,
            "score": round(avg_score, 2),
            "confidence": 0.85,
            "seniority": _LEVEL_LABELS.get(dom_level, "Middle"),
            "supportingEvidence": json.dumps({
                "weight_ratio": round(w_sum, 2)
            })
        })

    # 3. Best-Fit Roles Matching V1
    best_fit_roles_out = []
    target_role = cv.get("candidate", {}).get("headline") or "Software Engineer"
    best_fit_roles_out.append({
        "roleTitle": target_role,
        "matchScore": float(combined["score"]),
        "confidence": 0.85,
        "rank": 1,
        "matchingEngineVersion": "VectorArchetypeV2",
        "evidence": json.dumps({
            "rationale": f"Calculated based on primary capability score and profile alignment.",
            "levelFit": "exact"
        }),
        "engineMetadata": json.dumps({
            "matchingEngine": "VectorArchetypeMatchingV2",
            "capabilityVector": capability_vector
        })
    })

    sorted_domains = sorted(domain_profiles_out, key=lambda x: x["score"], reverse=True)
    rank = 2
    for dp in sorted_domains:
        role_title = f"{dp['seniority']} {dp['domainName']} Developer"
        if role_title.lower() != target_role.lower() and rank <= 3:
            best_fit_roles_out.append({
                "roleTitle": role_title,
                "matchScore": dp["score"],
                "confidence": dp["confidence"],
                "rank": rank,
                "matchingEngineVersion": "VectorArchetypeV2",
                "evidence": json.dumps({
                    "rationale": f"Inferred from domain score of {dp['score']} in {dp['domainName']}.",
                    "levelFit": "exact"
                }),
                "engineMetadata": json.dumps({
                    "matchingEngine": "VectorArchetypeMatchingV2",
                    "capabilityVector": capability_vector
                })
            })
            rank += 1

    # 4. Strengths & Weaknesses
    strengths_weaknesses_out = []
    strengths_weaknesses_out.append({
        "findingType": "Strength",
        "topic": "Engineering Capability",
        "description": "Solid engineering execution verified by repository assessments.",
        "evidence": None
    })

    overall_level, overall_label = classify_seniority(
        complexity=candidate_complexity,
        leadership=candidate_leadership,
        maturity=mat_score,
        ownership=combined["ownership"]
    )

    # 5. Trust score calculations
    has_repos = len(repository_assessments) > 0
    
    verified_skills_set = set()
    for ra in repository_assessments:
        for attr in ra.get("skillAttributions", []):
            sname = attr.get("skillName")
            if sname:
                verified_skills_set.add(sname.lower())

    matched_skills_count = sum(1 for s in cv_skills if str(s).lower() in verified_skills_set)
    
    if has_repos:
        r_skills = float(matched_skills_count) / float(len(cv_skills)) if cv_skills else 1.0
    else:
        r_skills = 0.0
    r_skills = min(1.0, max(0.0, r_skills))

    verified_repos_count = 0
    for ra in repository_assessments:
        signal = ra.get("intelligenceSignal") or {}
        ownership = float(signal.get("ownershipSignal", 0.0))
        if ownership > 1.0:
            ownership /= 100.0
        if ownership == 0.0:
            ownership = float(ra.get("overallScore", 100.0)) / 100.0
        
        # Verify repository gate: authorship >= 30%
        if ownership >= 0.30:
            verified_repos_count += 1

    if has_repos:
        r_repos = float(verified_repos_count) / float(len(repository_assessments))
    else:
        r_repos = 0.0
    r_repos = min(1.0, max(0.0, r_repos))

    s_candidate = int(round(combined["score"]))
    ownership_score = combined.get("ownership", 60.0)
    
    if has_repos and s_candidate > 0:
        r_evidence = float(ownership_score) / float(s_candidate)
    else:
        r_evidence = 0.0
    r_evidence = min(1.0, max(0.0, r_evidence))

    if has_repos:
        t_candidate = ((r_skills * 0.30) + (r_repos * 0.30) + (r_evidence * 0.40)) * 100.0
    else:
        t_candidate = 10.0
    t_candidate = round(max(min(t_candidate, 100.0), 0.0), 2)

    has_type1 = any(ra.get("cvVerificationLevel") == "AiAnalyzed" or ra.get("trustLevel", 2) >= 3 for ra in repository_assessments)
    if has_repos and t_candidate >= 70.0 and has_type1 and r_skills >= 0.5 and r_repos >= 0.5:
        evidence_completeness = "FULL"
    elif has_repos and t_candidate >= 30.0:
        evidence_completeness = "PARTIAL"
    else:
        evidence_completeness = "NONE"

    # Compute consolidated clone risk rating
    clone_risks = []
    for ra in repository_assessments:
        quality_metrics = ra.get("qualityMetrics") or {}
        if isinstance(quality_metrics, dict):
            clone_risks.append(quality_metrics.get("cloneRiskClassification", "clean"))
            
    if "high_risk" in clone_risks:
        clone_risk = "high_risk"
    elif "medium_risk" in clone_risks:
        clone_risk = "medium_risk"
    elif "low_risk" in clone_risks:
        clone_risk = "low_risk"
    else:
        clone_risk = "clean"

    logger.info(
        f"[SCORING_CALCULATION] Candidate: {cv.get('cvId') or 'unknown'}, "
        f"SkillDepth: {combined['skillDepth']:.2f}, Ownership: {combined['ownership']:.2f}, "
        f"Architecture: {combined['architecture']:.2f}, ProblemSolving: {combined['problemSolving']:.2f}, "
        f"Impact: {combined['impact']:.2f}, Score: {combined['score']:.2f}, "
        f"TrustLevel: {t_candidate}, Completeness: {evidence_completeness}, "
        f"CloneRisk: {clone_risk}"
    )

    key_strengths_out = [
        sw["description"] for sw in strengths_weaknesses_out if sw["findingType"] == "Strength"
    ]
    watch_points_out = [
        sw["description"] for sw in strengths_weaknesses_out if sw["findingType"] in ("Weakness", "WatchPoint", "Gap")
    ]

    # Evidence Governance
    evidence_governance_out = []
    repo_scores = [float(ra.get("overallScore", 100.0)) for ra in repository_assessments]
    total_contrib = sum(float(ra.get("intelligenceSignal", {}).get("ownershipSignal", 100.0)) / 100.0 * repo_scores[idx] for idx, ra in enumerate(repository_assessments))
    for idx, ra in enumerate(repository_assessments):
        repo_name = ra.get("repositoryName")
        repo_contrib = float(ra.get("intelligenceSignal", {}).get("ownershipSignal", 100.0)) / 100.0 * repo_scores[idx]
        contrib_pct = (repo_contrib / total_contrib * 100.0) if total_contrib > 0 else (100.0 / len(repository_assessments))
        
        own_sig = float(ra.get("intelligenceSignal", {}).get("ownershipSignal", 0.0))
        if own_sig == 0.0:
            own_sig = float(ra.get("overallScore", 100.0))
        elif own_sig > 1.0:
            pass
        else:
            own_sig *= 100.0

        evidence_governance_out.append({
            "repositoryId": ra.get("repositoryId"),
            "repositoryName": repo_name,
            "cvProjectEntryId": ra.get("cvProjectEntryId"),
            "cvProjectName": ra.get("cvProjectName"),
            "cvVerificationLevel": ra.get("cvVerificationLevel") or "RepositoryLinked",
            "trustLevel": ra.get("trustLevel", 2),
            "authorshipPercent": round(own_sig, 2),
            "scoreContributionPercent": round(contrib_pct, 2)
        })

    bg_repos = cv.get("backgroundRepositories", [])
    for bg in bg_repos:
        evidence_governance_out.append({
            "repositoryId": bg.get("repositoryId"),
            "repositoryName": bg.get("repositoryName"),
            "cvProjectEntryId": None,
            "cvProjectName": None,
            "cvVerificationLevel": "Background",
            "trustLevel": 0,
            "authorshipPercent": 0.0,
            "scoreContributionPercent": 0.0
        })

    profile = {
        "schemaVersion": "candidate-profile-v3",
        "candidateScore": int(round(combined["score"])),
        "candidateScoreLabel": overall_label,
        "careerLevel": overall_level,
        "careerLevelLabel": overall_label,
        "careerLevelConfidence": 0.85,
        "cohortPercentile": cohort_percentile,
        "cohortVersion": cohort_version,
        "cohortPercentileRange": cohort_range,
        "capabilityVector": capability_vector,
        "evidenceCompleteness": evidence_completeness,
        "cloneRiskClassification": clone_risk,
        "technicalDepth": candidate_complexity,
        "technicalBreadth": len(all_categories) * 10.0,
        "leadershipPotential": candidate_leadership,
        "executionStrength": (candidate_consistency + candidate_problem_solving) / 2.0,
        "trustLevel": t_candidate,
        "trustScoreMetrics": {
            "verifiedSkillRatio": round(r_skills, 2),
            "verifiedRepositoryRatio": round(r_repos, 2),
            "verifiedEvidenceRatio": round(r_evidence, 2),
            "candidateTrustScore": t_candidate
        },
        "skills": skill_proficiencies_out,
        "domainProfiles": domain_profiles_out,
        "bestFitRoles": best_fit_roles_out,
        "strengthsWeaknesses": strengths_weaknesses_out,
        "keyStrengths": key_strengths_out,
        "watchPoints": watch_points_out,
        "evidenceGovernance": evidence_governance_out,
        "scoreBreakdown": {
            "skillDepth": {"score": round(combined["skillDepth"], 2), "weight": policy["dimensions"]["skillDepth"]["weight"]},
            "ownership": {"score": round(combined["ownership"], 2), "weight": policy["dimensions"]["ownership"]["weight"]},
            "architecture": {"score": round(combined["architecture"], 2), "weight": policy["dimensions"]["architecture"]["weight"]},
            "problemSolving": {"score": round(combined["problemSolving"], 2), "weight": policy["dimensions"]["problemSolving"]["weight"]},
            "impact": {"score": round(combined["impact"], 2), "weight": policy["dimensions"]["impact"]["weight"]}
        }
    }

    return profile
