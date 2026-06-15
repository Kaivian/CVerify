"""
tendency_rules.py
=================
Rule-based component for L2-009 TechnicalTendencyClassifier.

Scores each of the 9 technical roles based on detected technologies and
skill signals from the skill evidence graph. Used as the pre-computation
layer before AI refinement (rule-based + ML hybrid per task spec).
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Technology → role signal weights
# ---------------------------------------------------------------------------
# Each entry maps a technology keyword (lowercase) to a dict of
# {role: weight} where weight ∈ [0, 1].
_TECH_ROLE_SIGNALS: dict[str, dict[str, float]] = {
    # Backend signals
    "fastapi": {"Backend": 1.0, "Fullstack": 0.3},
    "django": {"Backend": 1.0, "Fullstack": 0.3},
    "flask": {"Backend": 0.9, "Fullstack": 0.3},
    "spring": {"Backend": 1.0, "Fullstack": 0.2},
    "spring boot": {"Backend": 1.0, "Fullstack": 0.2},
    "express": {"Backend": 0.8, "Fullstack": 0.5},
    "nestjs": {"Backend": 0.9, "Fullstack": 0.3},
    "laravel": {"Backend": 0.9, "Fullstack": 0.3},
    "rails": {"Backend": 0.9, "Fullstack": 0.3},
    "gin": {"Backend": 1.0},
    "fiber": {"Backend": 1.0},
    "grpc": {"Backend": 1.0, "Platform Engineering": 0.4},
    "graphql": {"Backend": 0.7, "Fullstack": 0.7},
    "rest api": {"Backend": 0.8, "Fullstack": 0.4},
    "postgresql": {"Backend": 0.8, "Data Engineering": 0.3},
    "mysql": {"Backend": 0.7, "Data Engineering": 0.3},
    "mongodb": {"Backend": 0.7, "Fullstack": 0.3},
    "redis": {"Backend": 0.6, "Platform Engineering": 0.4},
    "kafka": {"Backend": 0.5, "Data Engineering": 0.6, "Platform Engineering": 0.5},
    "rabbitmq": {"Backend": 0.6, "Platform Engineering": 0.4},
    "microservices": {"Backend": 0.7, "Platform Engineering": 0.5},

    # Frontend signals
    "react": {"Frontend": 1.0, "Fullstack": 0.6},
    "vue": {"Frontend": 1.0, "Fullstack": 0.6},
    "angular": {"Frontend": 1.0, "Fullstack": 0.6},
    "next.js": {"Frontend": 0.8, "Fullstack": 0.8},
    "svelte": {"Frontend": 1.0, "Fullstack": 0.5},
    "typescript": {"Frontend": 0.6, "Backend": 0.4, "Fullstack": 0.6},
    "css": {"Frontend": 0.9},
    "tailwind": {"Frontend": 0.9},
    "webpack": {"Frontend": 0.8},
    "vite": {"Frontend": 0.7, "Fullstack": 0.4},

    # Mobile signals
    "android": {"Mobile": 1.0},
    "ios": {"Mobile": 1.0},
    "react native": {"Mobile": 1.0, "Frontend": 0.3},
    "flutter": {"Mobile": 1.0},
    "swift": {"Mobile": 0.9},
    "kotlin": {"Mobile": 0.7, "Backend": 0.4},
    "objective-c": {"Mobile": 0.9},

    # DevOps / SRE signals
    "docker": {"DevOps/SRE": 0.8, "Platform Engineering": 0.5},
    "kubernetes": {"DevOps/SRE": 1.0, "Platform Engineering": 0.8},
    "terraform": {"DevOps/SRE": 0.9, "Platform Engineering": 0.7},
    "ansible": {"DevOps/SRE": 0.9, "Platform Engineering": 0.6},
    "jenkins": {"DevOps/SRE": 0.8},
    "github actions": {"DevOps/SRE": 0.7},
    "gitlab ci": {"DevOps/SRE": 0.7},
    "helm": {"DevOps/SRE": 0.9, "Platform Engineering": 0.7},
    "prometheus": {"DevOps/SRE": 0.9, "Platform Engineering": 0.5},
    "grafana": {"DevOps/SRE": 0.8},
    "aws": {"DevOps/SRE": 0.5, "Platform Engineering": 0.5, "Backend": 0.3},
    "gcp": {"DevOps/SRE": 0.5, "Platform Engineering": 0.5, "Backend": 0.3},
    "azure": {"DevOps/SRE": 0.5, "Platform Engineering": 0.5, "Backend": 0.3},

    # Data Engineering signals
    "spark": {"Data Engineering": 1.0},
    "hadoop": {"Data Engineering": 1.0},
    "airflow": {"Data Engineering": 0.9},
    "etl": {"Data Engineering": 1.0},
    "dbt": {"Data Engineering": 0.9},
    "snowflake": {"Data Engineering": 0.9},
    "bigquery": {"Data Engineering": 0.9},
    "pandas": {"Data Engineering": 0.6, "AI/ML Engineering": 0.4},
    "sql": {"Data Engineering": 0.6, "Backend": 0.4},

    # AI/ML Engineering signals
    "tensorflow": {"AI/ML Engineering": 1.0},
    "pytorch": {"AI/ML Engineering": 1.0},
    "scikit-learn": {"AI/ML Engineering": 0.9},
    "sklearn": {"AI/ML Engineering": 0.9},
    "machine learning": {"AI/ML Engineering": 1.0},
    "deep learning": {"AI/ML Engineering": 1.0},
    "nlp": {"AI/ML Engineering": 0.9},
    "llm": {"AI/ML Engineering": 0.9},
    "huggingface": {"AI/ML Engineering": 0.9},
    "langchain": {"AI/ML Engineering": 0.8},
    "openai": {"AI/ML Engineering": 0.7},
    "numpy": {"AI/ML Engineering": 0.5, "Data Engineering": 0.4},
    "r": {"AI/ML Engineering": 0.5, "Data Engineering": 0.6},

    # Security Engineering signals
    "owasp": {"Security Engineering": 1.0},
    "penetration testing": {"Security Engineering": 1.0},
    "pentest": {"Security Engineering": 1.0},
    "cryptography": {"Security Engineering": 0.9},
    "siem": {"Security Engineering": 0.9},
    "vulnerability": {"Security Engineering": 0.8},
    "oauth": {"Security Engineering": 0.5, "Backend": 0.4},
    "jwt": {"Security Engineering": 0.4, "Backend": 0.4},
    "ssl": {"Security Engineering": 0.5},
    "tls": {"Security Engineering": 0.5},

    # Platform Engineering signals
    "service mesh": {"Platform Engineering": 1.0},
    "istio": {"Platform Engineering": 1.0},
    "envoy": {"Platform Engineering": 0.9},
    "cilium": {"Platform Engineering": 0.9},
    "platform": {"Platform Engineering": 0.6},
    "sdk": {"Platform Engineering": 0.5, "Backend": 0.4},
}

ALL_ROLES = [
    "Backend", "Frontend", "Fullstack", "Mobile",
    "DevOps/SRE", "Data Engineering", "AI/ML Engineering",
    "Security Engineering", "Platform Engineering",
]


def score_tendencies(
    detected_technologies: list[str],
    skill_names: list[str],
    commit_languages: dict[str, float] | None = None,
) -> list[dict]:
    """
    Score all 9 technical roles based on detected signals.

    Args:
        detected_technologies: Technology names from repo detection (any case).
        skill_names: Skill names from skill evidence graph (any case).
        commit_languages: {language: percentage} from GitHub language stats.

    Returns:
        List of {role, score, evidenceSignals} sorted by score descending.
        Scores are in [0, 1].
    """
    role_scores: dict[str, float] = {r: 0.0 for r in ALL_ROLES}
    role_evidence: dict[str, list[str]] = {r: [] for r in ALL_ROLES}

    all_signals = [t.lower() for t in (detected_technologies or [])]
    all_signals += [s.lower() for s in (skill_names or [])]

    for signal in all_signals:
        for tech_key, role_weights in _TECH_ROLE_SIGNALS.items():
            # Require at least 2 chars and whole-word or exact containment to avoid
            # short keys like "r" or "go" matching unrelated strings
            if len(tech_key) < 2:
                match = signal == tech_key
            elif len(tech_key) <= 3:
                # Short keys (e.g. "sql", "r", "go") must be exact or whole-word boundary
                import re as _re
                match = bool(_re.search(r"(?<![a-z])" + _re.escape(tech_key) + r"(?![a-z])", signal))
            else:
                match = tech_key in signal or signal in tech_key
            if match:
                for role, weight in role_weights.items():
                    role_scores[role] = min(1.0, role_scores[role] + weight * 0.5)
                    evidence_label = f"{signal} → {role} (+{weight:.1f})"
                    if evidence_label not in role_evidence[role]:
                        role_evidence[role].append(signal)

    # Language bonus signals
    if commit_languages:
        lang_bonuses: dict[str, dict[str, float]] = {
            "python": {"Backend": 0.3, "Data Engineering": 0.3, "AI/ML Engineering": 0.3},
            "javascript": {"Frontend": 0.3, "Fullstack": 0.3, "Backend": 0.1},
            "typescript": {"Frontend": 0.25, "Fullstack": 0.25, "Backend": 0.15},
            "swift": {"Mobile": 0.5},
            "kotlin": {"Mobile": 0.4, "Backend": 0.1},
            "dart": {"Mobile": 0.5},
            "go": {"Backend": 0.3, "Platform Engineering": 0.3, "DevOps/SRE": 0.2},
            "rust": {"Platform Engineering": 0.4, "Backend": 0.2},
            "java": {"Backend": 0.3, "Mobile": 0.1},
            "r": {"Data Engineering": 0.3, "AI/ML Engineering": 0.3},
            "shell": {"DevOps/SRE": 0.3, "Platform Engineering": 0.2},
            "hcl": {"DevOps/SRE": 0.4, "Platform Engineering": 0.3},
            "dockerfile": {"DevOps/SRE": 0.3},
        }
        for lang, pct in commit_languages.items():
            lang_lower = lang.lower()
            bonuses = lang_bonuses.get(lang_lower, {})
            for role, bonus in bonuses.items():
                weighted = bonus * min(pct / 100.0, 1.0)
                role_scores[role] = min(1.0, role_scores[role] + weighted)
                role_evidence[role].append(f"{lang} ({pct:.0f}% of codebase)")

    # Normalize so max score = 1.0
    max_score = max(role_scores.values()) if any(v > 0 for v in role_scores.values()) else 1.0
    if max_score > 0:
        role_scores = {r: round(v / max_score, 3) for r, v in role_scores.items()}

    ranked = sorted(
        [
            {
                "role": role,
                "confidence": score,
                "evidenceSignals": role_evidence[role][:5],
            }
            for role, score in role_scores.items()
            if score > 0
        ],
        key=lambda x: x["confidence"],
        reverse=True,
    )
    return ranked


def get_primary_tendency(
    detected_technologies: list[str],
    skill_names: list[str],
    commit_languages: dict[str, float] | None = None,
) -> tuple[str, float, list[dict]]:
    """
    Returns (primary_tendency, confidence, ranked_list).
    Falls back to 'Backend' with 0.0 confidence if no signals detected.
    """
    ranked = score_tendencies(detected_technologies, skill_names, commit_languages)
    if not ranked:
        return "Backend", 0.0, []
    top = ranked[0]
    return top["role"], top["confidence"], ranked
