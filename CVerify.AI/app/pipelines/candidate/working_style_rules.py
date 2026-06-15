"""
working_style_rules.py
======================
Rule-based component for L2-010 WorkingStyleClassifier.

Infers working style from commit distribution patterns (conventional commits).
This implements the deterministic layer of the rule-based + AI hybrid per spec:
  "Infer từ commit distribution patterns"

The 6 working styles:
  Feature Builder       — high feat: commit ratio
  System Designer       — high refactor:, large architecture commits
  Problem Solver        — high fix: commit ratio, quick response
  Maintenance Engineer  — high chore:/docs: ratio, stabilization
  Performance Optimizer — perf: commits, profiling evidence
  Research-Oriented     — experimental branches, POC patterns
"""

from __future__ import annotations
import re

ALL_STYLES = [
    "Feature Builder",
    "System Designer",
    "Problem Solver",
    "Maintenance Engineer",
    "Performance Optimizer",
    "Research-Oriented",
]

# Conventional commit type → working style weights
_COMMIT_TYPE_WEIGHTS: dict[str, dict[str, float]] = {
    "feat": {"Feature Builder": 1.0, "System Designer": 0.1},
    "feature": {"Feature Builder": 1.0},
    "add": {"Feature Builder": 0.8, "System Designer": 0.1},
    "fix": {"Problem Solver": 1.0, "Maintenance Engineer": 0.3},
    "bugfix": {"Problem Solver": 1.0},
    "hotfix": {"Problem Solver": 0.9},
    "bug": {"Problem Solver": 0.9},
    "refactor": {"System Designer": 1.0, "Maintenance Engineer": 0.4},
    "redesign": {"System Designer": 0.9},
    "restructure": {"System Designer": 0.9},
    "arch": {"System Designer": 1.0},
    "architecture": {"System Designer": 1.0},
    "chore": {"Maintenance Engineer": 1.0},
    "deps": {"Maintenance Engineer": 0.8},
    "dep": {"Maintenance Engineer": 0.8},
    "ci": {"Maintenance Engineer": 0.7},
    "build": {"Maintenance Engineer": 0.6},
    "docs": {"Maintenance Engineer": 0.8, "Research-Oriented": 0.2},
    "doc": {"Maintenance Engineer": 0.7},
    "style": {"Maintenance Engineer": 0.5},
    "lint": {"Maintenance Engineer": 0.6},
    "test": {"Maintenance Engineer": 0.5, "Problem Solver": 0.3},
    "perf": {"Performance Optimizer": 1.0},
    "performance": {"Performance Optimizer": 1.0},
    "optimize": {"Performance Optimizer": 0.9},
    "optimise": {"Performance Optimizer": 0.9},
    "benchmark": {"Performance Optimizer": 0.8, "Research-Oriented": 0.4},
    "profile": {"Performance Optimizer": 0.8},
    "exp": {"Research-Oriented": 1.0},
    "experiment": {"Research-Oriented": 1.0},
    "poc": {"Research-Oriented": 1.0},
    "spike": {"Research-Oriented": 0.9},
    "research": {"Research-Oriented": 1.0},
    "wip": {"Research-Oriented": 0.5, "Feature Builder": 0.3},
    "revert": {"Maintenance Engineer": 0.6, "Problem Solver": 0.4},
    "cleanup": {"Maintenance Engineer": 0.9, "System Designer": 0.3},
    "clean": {"Maintenance Engineer": 0.7, "System Designer": 0.3},
    "improve": {"System Designer": 0.5, "Maintenance Engineer": 0.4},
}

_CONVENTIONAL_COMMIT_RE = re.compile(
    r"^(feat|fix|docs|style|refactor|perf|test|chore|build|ci|revert|"
    r"bugfix|hotfix|arch|exp|poc|spike|research|feature|add|deps|cleanup|"
    r"optimize|optimise|benchmark|profile|wip|improve|redesign|restructure|"
    r"dep|lint|clean|bug|doc|experiment|architecture)[(:!]",
    re.IGNORECASE,
)


def _extract_commit_type(message: str) -> str | None:
    m = _CONVENTIONAL_COMMIT_RE.match(message.strip())
    return m.group(1).lower() if m else None


def score_working_styles(
    commit_messages: list[str],
    branch_names: list[str] | None = None,
) -> list[dict]:
    """
    Score all 6 working styles from commit messages and branch names.

    Args:
        commit_messages: List of commit messages.
        branch_names: Optional list of branch names for Research-Oriented signals.

    Returns:
        List of {style, confidence, evidence} sorted by confidence descending.
    """
    style_scores: dict[str, float] = {s: 0.0 for s in ALL_STYLES}
    style_counts: dict[str, int] = {s: 0 for s in ALL_STYLES}
    type_counts: dict[str, int] = {}

    for msg in commit_messages:
        commit_type = _extract_commit_type(msg)
        if commit_type:
            type_counts[commit_type] = type_counts.get(commit_type, 0) + 1
            weights = _COMMIT_TYPE_WEIGHTS.get(commit_type, {})
            for style, weight in weights.items():
                style_scores[style] += weight
                style_counts[style] += 1

    # Branch name signals for Research-Oriented
    for branch in (branch_names or []):
        branch_lower = branch.lower()
        research_signals = ("exp/", "poc/", "spike/", "research/", "experiment/", "prototype/")
        if any(sig in branch_lower for sig in research_signals):
            style_scores["Research-Oriented"] += 2.0
            style_counts["Research-Oriented"] += 1

    total = sum(style_scores.values())
    if total == 0:
        return [{"style": s, "confidence": 0.0, "evidence": "No conventional commits detected"} for s in ALL_STYLES]

    # Compute total parsed commit count for ratios
    total_typed = sum(type_counts.values())

    results = []
    for style in ALL_STYLES:
        raw_score = style_scores[style]
        confidence = round(raw_score / total, 3) if total > 0 else 0.0

        # Build evidence string
        style_types = [
            t for t, weights in _COMMIT_TYPE_WEIGHTS.items()
            if style in weights and type_counts.get(t, 0) > 0
        ]
        if style_types and total_typed > 0:
            top_types = sorted(style_types, key=lambda t: type_counts.get(t, 0), reverse=True)[:3]
            counts_str = ", ".join(f"{t}: {type_counts.get(t, 0)} commits" for t in top_types)
            evidence = f"{counts_str} ({confidence * 100:.0f}% of commit distribution)"
        else:
            evidence = "No direct signals"

        results.append({"style": style, "confidence": confidence, "evidence": evidence})

    return sorted(results, key=lambda x: x["confidence"], reverse=True)


def get_primary_working_style(
    commit_messages: list[str],
    branch_names: list[str] | None = None,
) -> tuple[str, float, list[dict]]:
    """
    Returns (primary_style, confidence, ranked_distribution).
    Falls back to 'Feature Builder' with 0.0 if no signals detected.
    """
    ranked = score_working_styles(commit_messages, branch_names)
    if not ranked or ranked[0]["confidence"] == 0.0:
        return "Feature Builder", 0.0, ranked
    top = ranked[0]
    return top["style"], top["confidence"], ranked
