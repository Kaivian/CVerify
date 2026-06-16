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
    for skill_name in cv_skills:
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
        "problemSolving": int(round(ps_verified)),
        "impact": int(round(imp_verified)),
        "score": int(round(score_val))
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
    for skill_name in cv_skills:
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
    problem_solving_score = float(inputs.get("problemSolvingScore", 50.0))
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
        "score": int(round(score_val))
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
        "score": overall_combined
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
