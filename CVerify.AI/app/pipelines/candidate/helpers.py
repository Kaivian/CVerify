import logging
from datetime import datetime

logger = logging.getLogger("candidate_helpers")

_LEVEL_ORDER = ["L1", "L2", "L3", "L4", "L5"]
_LEVEL_LABELS = {"L1": "Junior", "L2": "Middle", "L3": "Senior", "L4": "Staff", "L5": "Principal"}

def _get_normalized_name(name: str) -> str:
    if not name:
        return ""
    from app.pipelines.candidate.skill_taxonomy import normalize_skill
    entry = normalize_skill(name)
    return entry.normalized_name.lower() if entry else name.strip().lower()

def _score_to_level(score: float) -> tuple[str, str]:
    if score >= 93:
        return "L5", _LEVEL_LABELS["L5"]
    elif score >= 83:
        return "L4", _LEVEL_LABELS["L4"]
    elif score >= 66:
        return "L3", _LEVEL_LABELS["L3"]
    elif score >= 46:
        return "L2", _LEVEL_LABELS["L2"]
    else:
        return "L1", _LEVEL_LABELS["L1"]

def _is_boundary_score(score: float, margin: float = 3.0) -> bool:
    boundaries = [46.0, 66.0, 83.0, 93.0]
    return any(abs(score - b) <= margin for b in boundaries)

def _is_adjacent_or_same_level(level_a: str, level_b: str) -> bool:
    if level_a not in _LEVEL_ORDER or level_b not in _LEVEL_ORDER:
        return True
    idx_a = _LEVEL_ORDER.index(level_a)
    idx_b = _LEVEL_ORDER.index(level_b)
    return abs(idx_a - idx_b) <= 1

def parse_date(d_str, default_val):
    if not d_str:
        return default_val
    try:
        return datetime.strptime(d_str[:10], "%Y-%m-%d")
    except:
        return default_val

def calculate_discounted_experience_months(cv) -> float:
    experiences = cv.get("experiences", [])
    projects = cv.get("projects", [])
    total_discounted_months = 0.0

    for exp in experiences:
        duration = float(exp.get("durationMonths", 0))
        if duration <= 0:
            continue
        
        start_str = exp.get("startDate")
        end_str = exp.get("endDate")
        
        exp_start = parse_date(start_str, None)
        exp_end = parse_date(end_str, None)
        
        if not exp_start:
            has_independent = any(p.get("verificationLevel") == "Independent" for p in projects)
            if has_independent:
                total_discounted_months += duration * 0.70
            else:
                total_discounted_months += duration
            continue
            
        if not exp_end:
            exp_end = datetime.now()
            
        exp_months = []
        curr_year, curr_month = exp_start.year, exp_start.month
        while (curr_year < exp_end.year) or (curr_year == exp_end.year and curr_month <= exp_end.month):
            exp_months.append((curr_year, curr_month))
            curr_month += 1
            if curr_month > 12:
                curr_month = 1
                curr_year += 1
                
        overlapping_count = 0
        for yr, m in exp_months:
            is_overlapping = False
            for proj in projects:
                if proj.get("verificationLevel") != "Independent":
                    continue
                p_start = parse_date(proj.get("startDate"), None)
                p_end = parse_date(proj.get("endDate"), None)
                if p_start:
                    if not p_end:
                        p_end = datetime.now()
                    mid_date = datetime(yr, m, 15)
                    if p_start <= mid_date <= p_end:
                        is_overlapping = True
                        break
            if is_overlapping:
                overlapping_count += 1
        
        discounted_exp_months = (len(exp_months) - overlapping_count) + (overlapping_count * 0.70)
        if len(exp_months) > 0:
            scale_factor = duration / len(exp_months)
            total_discounted_months += discounted_exp_months * scale_factor
        else:
            total_discounted_months += duration
            
    return total_discounted_months
