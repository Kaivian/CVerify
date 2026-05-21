from typing import Dict, Any, List, Optional, Callable, Awaitable
import json
import os
from app.pipelines.candidate.base_task import BaseTask
from app.pipelines.candidate.context import PipelineContext, PipelineEvent

class CandidateImprovementEngine(BaseTask):
    @property
    def name(self) -> str:
        return "L2-015"

    @property
    def task_name(self) -> str:
        return "CandidateImprovementEngine"

    @property
    def dependencies(self) -> List[str]:
        return ["L2-014"]

    @property
    def input_keys(self) -> List[str]:
        return ["candidateProfile", "cv", "repositoryAssessments"]

    @property
    def output_keys(self) -> List[str]:
        return ["improvementPlan"]

    async def _execute_internal(
        self,
        context: PipelineContext,
        correlation_id: str,
        event_callback: Optional[Callable[[PipelineEvent], Awaitable[None]]] = None
    ) -> Dict[str, Any]:
        profile = context.candidateProfile or {}
        cv = context.cv or {}
        repos = context.repositoryAssessments or []

        # Load scoring policy
        policy = {
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

        # ── 1. Deterministic Observation Layer ───────────────────────────────
        vector = profile.get("capabilityVector", {})
        sd_score = float(vector.get("skillDepth", 0.0))
        own_score = float(vector.get("ownership", 1.0))
        arch_score = float(vector.get("architecture", 0.0))
        ps_score = float(vector.get("problemSolving", 0.0))
        imp_score = float(vector.get("impact", 0.0))

        gate_violations = context.gateViolations or []
        final_level = context.finalLevel or "L2"
        calibrated_level = context.calibratedLevel or "L2"

        observations = []
        recommendations = []

        # Check for Seniority Gating Downgrades
        if final_level != calibrated_level and gate_violations:
            for violation in gate_violations:
                observations.append({
                    "type": "SeniorityGateViolation",
                    "dimension": "architecture" if "Architecture" in violation else "ownership" if "ownership" in violation else "depth",
                    "details": violation
                })

        # Check for unverified skills
        unverified_skills = []
        for s in profile.get("skills", []):
            if s.get("level") == "Unverified":
                unverified_skills.append(s.get("skillName"))

        if unverified_skills:
            observations.append({
                "type": "UnverifiedSkills",
                "dimension": "skillDepth",
                "details": f"Declared skills {', '.join(unverified_skills[:3])} have no linked code evidence."
            })

        # Check for low ownership exclusion
        for ra in repos:
            sig = ra.get("intelligenceSignal", {})
            own = float(sig.get("ownershipSignal", 0.0))
            if own > 1.0: own /= 100.0
            if own < 0.30:
                observations.append({
                    "type": "LowOwnershipExclusion",
                    "dimension": "ownership",
                    "details": f"Repository '{ra.get('repositoryName')}' has authorship below 30% ({own*100:.1f}%) and is excluded from verification."
                })

        # Check for low architecture complexity
        if arch_score < 100.0:
            observations.append({
                "type": "LowArchitectureComplexity",
                "dimension": "architecture",
                "details": f"System Architecture score of {arch_score:.1f} is below target Senior baseline (100.0)."
            })

        # Emit IMPROVEMENT_SIGNAL_DETECTED events if callback provided
        if event_callback:
            import time
            for obs in observations:
                try:
                    await event_callback(PipelineEvent(
                        eventType="IMPROVEMENT_SIGNAL_DETECTED",
                        timestamp=time.time(),
                        correlationId=correlation_id,
                        taskId=self.name,
                        payload={"gapCategory": obs["type"]},
                        stateSnapshot={
                            "partialScore": context.candidateScore or context.calibratedScore or 0.0,
                            "estimatedLevel": context.finalLevel or context.calibratedLevel or "L1"
                        }
                    ))
                except Exception as ex:
                    pass

        # ── 2. Recommendation Generation Layer ───────────────────────────────
        # Define target role archetype vector based on topMatch suggestions or backend default
        top_role = (profile.get("bestFitRoles", [{}])[0] or {}).get("roleTitle", "Senior Backend Engineer")
        
        # Determine archetype targets
        target_arch = 150.0
        target_ps = 100.0
        target_sd = 100.0
        target_imp = 80.0

        w_sd = policy["dimensions"]["skillDepth"]["weight"]
        w_own = policy["dimensions"]["ownership"]["weight"]
        w_arch = policy["dimensions"]["architecture"]["weight"]
        w_ps = policy["dimensions"]["problemSolving"]["weight"]
        w_imp = policy["dimensions"]["impact"]["weight"]

        rec_id = 1
        for obs in observations:
            action = ""
            boost = 0.0
            prio = "Medium"

            if obs["type"] == "SeniorityGateViolation":
                prio = "High"
                if obs["dimension"] == "architecture":
                    action = "Implement explicit design patterns (such as Dependency Injection, CQRS, or clear modular interfaces) in your primary repository and commit those modifications."
                    boost = 15.0
                elif obs["dimension"] == "ownership":
                    action = "Configure your git author configuration locally to match the email registered on CVerify, or connect repositories where you have at least 30% commit authorship."
                    boost = 20.0
                else:
                    action = "Ensure that your primary verified repository contains active code matching your declared skill sets."
                    boost = 10.0
                    
            elif obs["type"] == "UnverifiedSkills":
                action = f"Add projects containing code files for {', '.join(unverified_skills[:3])} to your CV or connect repositories that contain these frameworks/languages."
                boost = float(len(unverified_skills[:3])) * 3.0
                
            elif obs["type"] == "LowOwnershipExclusion":
                action = f"Contribute more code commits to repository '{obs['details'].split(chr(39))[1]}' to raise your authorship index past the 30% gate."
                boost = 8.0
                
            elif obs["type"] == "LowArchitectureComplexity":
                action = "Introduce decoupling layers (e.g., interfaces, service classes, unit testing suites) to your verified repository structure to scale your architecture index."
                boost = 12.0

            rec = {
                "id": f"IMP-{rec_id:03d}",
                "priority": prio,
                "category": obs["type"],
                "dimension": obs["dimension"],
                "observation": obs["details"],
                "action": action,
                "evidenceGrounded": True,
                "impact": {
                    "scoreBoost": round(boost, 1),
                    "levelProgression": (prio == "High"),
                    "rankingBoost": prio
                }
            }
            recommendations.append(rec)

            if event_callback:
                import time
                try:
                    await event_callback(PipelineEvent(
                        eventType="IMPROVEMENT_RECOMMENDATION_READY",
                        timestamp=time.time(),
                        correlationId=correlation_id,
                        taskId=self.name,
                        payload={
                            "id": rec["id"],
                            "priority": rec["priority"],
                            "action": rec["action"]
                        },
                        stateSnapshot={
                            "partialScore": context.candidateScore or context.calibratedScore or 0.0,
                            "estimatedLevel": context.finalLevel or context.calibratedLevel or "L1"
                        }
                    ))
                except Exception as ex:
                    pass

            rec_id += 1

        # Calculate estimated score potential
        curr_score = float(profile.get("candidateScore", 50))
        added_pot = sum(r["impact"]["scoreBoost"] for r in recommendations if r["priority"] == "High")
        est_potential = min(100.0, curr_score + added_pot)

        target_level = "L3" if final_level == "L2" else "L4" if final_level == "L3" else final_level

        plan = {
            "summary": f"Targeting {top_role} role progression. Resolving the identified ownership and architecture gaps will optimize your capability vector projection.",
            "targetLevel": target_level,
            "estimatedScorePotential": round(est_potential, 1),
            "recommendations": recommendations
        }

        # Add improvementPlan back to context profile
        profile["improvementPlan"] = plan

        return {
            "improvementPlan": plan,
            "candidateProfile": profile
        }
