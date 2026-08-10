from typing import Dict, Any, List
import json
import math
import os
import logging
from app.pipelines.candidate.base_task import BaseTask
from app.pipelines.candidate.context import PipelineContext
from app.pipelines.candidate.contracts import CandidateAssessmentV3Contract
from app.pipelines.candidate import scoring_engine

logger = logging.getLogger("candidate_profile_composer")

class CandidateProfileComposer(BaseTask):
    @property
    def name(self) -> str:
        return "L2-014"

    @property
    def task_name(self) -> str:
        return "CandidateProfileComposer"

    @property
    def dependencies(self) -> List[str]:
        # Depends on all upstream steps to compile the final JSON profile
        return ["L2-001", "L2-002", "L2-003", "L2-004", "L2-005", "L2-006", "L2-007", "L2-008", "L2-009", "L2-010", "L2-011", "L2-012", "L2-013", "L2-016"]

    @property
    def input_keys(self) -> List[str]:
        return [
            "cv", "repositoryAssessments", "skillProficiencies", "finalLevel", "finalLevelLabel",
            "primaryTendency", "primaryWorkingStyle", "recruiterHeadline", "fullSummary", "professionalBio",
            "keyStrengths", "watchPoints", "suggestedRoles", "topMatch", "suggestedCvTitles",
            "cvImprovementSuggestions", "confidenceMultiplier", "totalExperienceMonths",
            "confidenceInLevel", "backgroundRepositories", "skillDepthScore", "ownershipScore",
            "architectureScore", "problemSolvingScore", "impactScore", "cvSkills",
            "rawSkillDepth", "rawOwnership", "rawArchitecture", "rawProblemSolving", "rawImpact"
        ]

    @property
    def output_keys(self) -> List[str]:
        return ["candidateProfile"]

    async def _execute_internal(self, context: PipelineContext, correlation_id: str) -> Dict[str, Any]:
        cv = context.cv or {}
        repository_assessments = context.repositoryAssessments or []
        cv_skills = [s.normalizedName for s in context.cvSkills or []]
        skill_proficiencies = context.skillProficiencies or []

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

        # Identify self-declared projects
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

        # Call legacy scoring calculations to preserve compatibility
        has_verified_repos = len(repository_assessments) > 0
        verified_dict = scoring_engine.calculate_verified_score(
            repository_assessments=repository_assessments,
            cv=cv,
            cv_skills=cv_skills,
            skill_proficiencies=skill_proficiencies,
            policy=policy
        )
        self_declared_dict = scoring_engine.calculate_self_declared_score(
            cv=cv,
            cv_skills=cv_skills,
            skill_proficiencies=skill_proficiencies,
            repository_assessments=repository_assessments,
            inputs=context.to_legacy_dict(),
            policy=policy
        )
        combined = scoring_engine.aggregate_scores(
            verified=verified_dict,
            self_declared=self_declared_dict,
            has_verified_repos=has_verified_repos,
            policy=policy
        )

        s_candidate = int(round(combined["score"]))

        # Cohort Normalization
        snapshot_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "cohort_snapshot_v1.json")
        cohort_percentile, cohort_version = scoring_engine.normalize_score_to_cohort(combined["score"], snapshot_path)
        cohort_range = scoring_engine.calculate_uncertainty_band(combined["score"], self_declared_dict["score"], cohort_percentile)

        # Parse basic intelligence properties from repos
        repo_scores = []
        max_difficulty_score = 0.0
        all_categories = set()
        
        scopes = []
        ownerships = []
        leaderships = []
        consistencies = []

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

        # Plus from self-declared projects for category-based breadth
        from app.pipelines.candidate.skill_taxonomy import SKILL_TAXONOMY
        for proj in self_declared_projects:
            for tech in proj.get("technologies", []):
                entry = SKILL_TAXONOMY.get(str(tech).strip().lower())
                if entry and entry.sfia_category:
                    all_categories.add(entry.sfia_category.lower())

        if not repository_assessments and self_declared_projects:
            max_difficulty_score = 3.0

        # Trust score calculation
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

        ownership_val = context.ownershipScore if context.ownershipScore is not None else 60.0
        
        if has_repos and s_candidate > 0:
            r_evidence = float(ownership_val) / float(s_candidate)
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

        candidate_complexity = max_difficulty_score * 10.0
        candidate_leadership = max(leaderships) if leaderships else 0.0
        candidate_consistency = sum(consistencies) / len(consistencies) if consistencies else 0.0
        candidate_problem_solving = float(context.problemSolvingScore or 50.0)

        # 6. Candidate Skill Profiles
        from app.pipelines.candidate.helpers import _get_normalized_name
        from app.pipelines.candidate.skill_taxonomy import normalize_batch
        skill_proficiencies_out = []
        skills_to_process = cv_skills if cv_skills else [p.get("skill") for p in skill_proficiencies if p.get("skill")]
        seen_skills = set()
        skills_to_process = [x for x in skills_to_process if not (x.lower() in seen_skills or seen_skills.add(x.lower()))]

        normalized_skills_info = {res["rawName"].lower(): res for res in normalize_batch(skills_to_process)}

        for skill_name in skills_to_process:
            map_info = normalized_skills_info.get(skill_name.lower())
            skill_id = map_info["skillId"] if map_info else f"skill:{skill_name.lower().replace(' ', '-')}"
            normalized_display_name = map_info["normalizedName"] if map_info else skill_name
            norm_source = "static_map" if (map_info and map_info.get("found")) else "emerging_draft"

            prof = next((p for p in skill_proficiencies if p.get("skill", "").lower() == skill_name.lower()), None)
            supporting_repos = []
            norm_skill_name = _get_normalized_name(skill_name)
            for ra in repository_assessments:
                for attr in ra.get("skillAttributions", []):
                    if _get_normalized_name(attr.get("skillName", "")) == norm_skill_name:
                        json_data = ra.get("jsonData") or {}
                        total_commits = 10.0
                        user_commit_ratio = 1.0
                        if isinstance(json_data, dict):
                            ownership = json_data.get("ownership") or {}
                            if isinstance(ownership, dict):
                                tc = ownership.get("total_commits")
                                if tc is not None:
                                    total_commits = float(tc)
                                ucr = ownership.get("user_commit_ratio")
                                if ucr is not None:
                                    user_commit_ratio = float(ucr)
                        
                        supporting_repos.append({
                            "repositoryId": ra.get("repositoryId"),
                            "repositoryName": ra.get("repositoryName"),
                            "confidence": attr.get("confidence", 0.0),
                            "contributionWeight": attr.get("contributionWeight", 0.0),
                            "trustScore": float(ra.get("overallScore", 70.0)),
                            "userCommits": total_commits * user_commit_ratio
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
                import math
                sum_wtc = 0.0
                sum_t = 0.0
                prod_1_ct = 1.0
                total_user_commits = 0.0
                
                for r in supporting_repos:
                    c_i = float(r["confidence"])
                    w_i = float(r["contributionWeight"])
                    t_i = float(r["trustScore"]) / 100.0
                    u_c = float(r["userCommits"])
                    
                    sum_wtc += w_i * t_i * c_i
                    sum_t += t_i
                    prod_1_ct *= (1.0 - c_i * t_i)
                    total_user_commits += u_c
                
                confidence = max(0.0, min(1.0, 1.0 - prod_1_ct))
                if sum_t > 0.0:
                    score = (sum_wtc / sum_t) * math.log10(10.0 + total_user_commits) * 100.0
                else:
                    score = 0.0
                score = max(0.0, min(100.0, score))
                
                if score >= 75.0:
                    level = "Expert"
                elif score >= 50.0:
                    level = "Advanced"
                elif score >= 25.0:
                    level = "Working"
                else:
                    level = "Basic"
                
                evidence_sources = {
                    "verification_level": "AiAnalyzed",
                    "confidence": round(confidence, 4),
                    "source": "repository_analysis",
                    "rationale": f"Merged from {len(supporting_repos)} repositories. "
                                 f"Verification logic: Merged Confidence = {round(confidence * 100, 1)}%, "
                                 f"Merged Score = {round(score, 1)}/100, "
                                 f"Total User Commits = {int(total_user_commits)}.",
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
                "skillName": normalized_display_name,
                "skillId": skill_id,
                "taxonomyVersion": "2026.07",
                "originalName": skill_name,
                "normalizationSource": norm_source,
                "pipelineTraceId": correlation_id,
                "score": score,
                "confidence": confidence,
                "level": level,
                "evidenceSources": json.dumps(evidence_sources)
            })

        # 7. Candidate Domain Profiles
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
            
            # Simple level classifier
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

        # 8. Best-Fit Roles Matching V1
        best_fit_roles_out = []
        matching_roles = context.suggestedRoles or []
        top_role = context.topMatch or {}
        
        all_roles = []
        if top_role and (top_role.get("roleTitle") or top_role.get("role")):
            all_roles.append(top_role)
        all_roles.extend(matching_roles)

        def get_confidence_val(r):
            val = r.get("confidence", 0.8)
            try:
                return float(val)
            except (ValueError, TypeError):
                return 0.8

        all_roles.sort(key=get_confidence_val, reverse=True)
        seen_titles = set()
        unique_roles = []
        for role in all_roles:
            title = role.get("roleTitle") or role.get("role")
            if not title:
                continue
            title_lower = title.strip().lower()
            if title_lower in seen_titles:
                continue
            seen_titles.add(title_lower)
            unique_roles.append(role)

        for idx, role in enumerate(unique_roles[:3]):
            title = role.get("roleTitle") or role.get("role")
            conf = get_confidence_val(role)
            best_fit_roles_out.append({
                "roleTitle": title,
                "matchScore": conf * 100.0,
                "confidence": conf,
                "rank": idx + 1,
                "matchingEngineVersion": "VectorArchetypeV2",
                "evidence": json.dumps({
                    "rationale": role.get("rationale", ""),
                    "levelFit": role.get("levelFit", "exact")
                }),
                "engineMetadata": json.dumps({
                    "matchingEngine": "VectorArchetypeMatchingV2",
                    "capabilityVector": {
                        "version": "2.0.0",
                        "skillDepth": context.skillDepthScore,
                        "ownership": context.ownershipScore,
                        "architecture": context.architectureScore,
                        "problemSolving": context.problemSolvingScore,
                        "impact": context.impactScore,
                        "dimensions": {
                            "skillDepth": context.skillDepthScore,
                            "ownership": context.ownershipScore,
                            "architecture": context.architectureScore,
                            "problemSolving": context.problemSolvingScore,
                            "impact": context.impactScore
                        },
                        "rawSignals": {
                            "rawSkillDepth": context.rawSkillDepth or 0.0,
                            "rawOwnership": context.rawOwnership or 0.0,
                            "rawArchitecture": context.rawArchitecture or 0.0,
                            "rawProblemSolving": context.rawProblemSolving or 0.0,
                            "rawImpact": context.rawImpact or 0.0
                        }
                    }
                })
            })

        # 9. Strengths & Weaknesses
        strengths_weaknesses_out = []
        for str_item in (context.keyStrengths or []):
            if str_item:
                strengths_weaknesses_out.append({
                    "findingType": "Strength",
                    "topic": "Engineering Capability",
                    "description": str_item,
                    "evidence": None
                })
        for gap_item in (context.watchPoints or context.skillGaps or []):
            g_desc = gap_item
            if isinstance(gap_item, dict):
                g_desc = gap_item.get("detail", gap_item.get("skill", ""))
            if g_desc:
                strengths_weaknesses_out.append({
                    "findingType": "ImprovementArea",
                    "topic": "Development Gap",
                    "description": g_desc,
                    "evidence": None
                })

        # 10. Evidence Governance
        evidence_governance_out = []
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
                "cvVerificationLevel": ra.get("cvVerificationLevel"),
                "trustLevel": ra.get("trustLevel", 2),
                "authorshipPercent": round(own_sig, 2),
                "scoreContributionPercent": round(contrib_pct, 2)
            })

        background_repositories = context.backgroundRepositories or []
        for bg in background_repositories:
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

        display_confidence = min((context.confidenceInLevel or 0.85) * (context.confidenceMultiplier or 1.0), 1.0)

        # Normalize and format scoreBreakdown to comply with ScoreBreakdownV2 contract schema
        raw_breakdown = context.scoreBreakdown or {}
        def get_score_from_breakdown(key_variants: list, fallback: float) -> float:
            for k in key_variants:
                if k in raw_breakdown:
                    val = raw_breakdown[k]
                    if isinstance(val, dict):
                        return val.get("score", fallback)
                    if isinstance(val, (int, float)):
                        return float(val)
            return fallback

        score_breakdown_out = {
            "skillDepth": {
                "score": get_score_from_breakdown(["skillDepth", "skillDepthScore"], context.skillDepthScore or 0.0),
                "weight": 0.35
            },
            "ownership": {
                "score": get_score_from_breakdown(["ownership", "ownershipScore"], context.ownershipScore or 0.0),
                "weight": 0.25
            },
            "architecture": {
                "score": get_score_from_breakdown(["architecture", "architectureScore"], context.architectureScore or 0.0),
                "weight": 0.20
            },
            "problemSolving": {
                "score": get_score_from_breakdown(["problemSolving", "problemSolvingScore"], context.problemSolvingScore or 0.0),
                "weight": 0.12
            },
            "impact": {
                "score": get_score_from_breakdown(["impact", "impactScore"], context.impactScore or 0.0),
                "weight": 0.08
            }
        }

        # Output payload compatible with schema v3 requirements
        data = {
            "schemaVersion": "candidate-profile-v3",
            "candidateScore": s_candidate,  # Legacy scalar compatibility fallback
            "candidateScoreLabel": context.finalLevelLabel or "Middle",
            "careerLevel": context.finalLevel or "L2",
            "careerLevelLabel": context.finalLevelLabel or "Middle",
            "careerLevelConfidence": display_confidence,
            
            "cohortPercentile": cohort_percentile,
            "cohortVersion": cohort_version,
            "cohortPercentileRange": cohort_range,
            
            "primaryTendency": context.primaryTendency or "",
            "primaryWorkingStyle": context.primaryWorkingStyle or "",
            
            "recruiterHeadline": context.recruiterHeadline or "",
            "fullSummary": context.fullSummary or "",
            "professionalBio": context.professionalBio or "",
            "keyStrengths": context.keyStrengths or [],
            "watchPoints": context.watchPoints or [],
 
            "displayConfidence": display_confidence,
            
            # The newly introduced multi-dimensional capability vector space outputs
            "capabilityVector": {
                "version": "2.0.0",
                "skillDepth": context.skillDepthScore or 0.0,
                "ownership": context.ownershipScore or 0.0,
                "architecture": context.architectureScore or 0.0,
                "problemSolving": context.problemSolvingScore or 0.0,
                "impact": context.impactScore or 0.0,
                "dimensions": {
                    "skillDepth": context.skillDepthScore or 0.0,
                    "ownership": context.ownershipScore or 0.0,
                    "architecture": context.architectureScore or 0.0,
                    "problemSolving": context.problemSolvingScore or 0.0,
                    "impact": context.impactScore or 0.0
                },
                "rawSignals": {
                    "rawSkillDepth": context.rawSkillDepth or 0.0,
                    "rawOwnership": context.rawOwnership or 0.0,
                    "rawArchitecture": context.rawArchitecture or 0.0,
                    "rawProblemSolving": context.rawProblemSolving or 0.0,
                    "rawImpact": context.rawImpact or 0.0
                }
            },
 
            "technicalDepth": context.architectureScore or 0.0,
            "technicalBreadth": round(float(len(all_categories)) * 10.0, 2),
            "leadershipPotential": round(candidate_leadership, 2),
            "executionStrength": round((candidate_consistency + candidate_problem_solving) / 2.0, 2),
            "trustLevel": t_candidate,
            "evidenceCompleteness": evidence_completeness,
            "cloneRiskClassification": clone_risk,
 
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
            "evidenceGovernance": evidence_governance_out,
            "cvImprovementSuggestions": context.cvImprovementSuggestions or [],
            "scoreBreakdown": score_breakdown_out
        }
        # Validate against CandidateAssessmentV3Contract (SSOT)
        try:
            CandidateAssessmentV3Contract.model_validate(data)
            logger.info("[CONTRACT_VALIDATION_SUCCESS] CandidateProfile successfully validated against CandidateAssessmentV3Contract.")
        except Exception as ex:
            logger.error(f"[CONTRACT_VALIDATION_FAILED] CandidateProfile validation failed: {str(ex)}")
            raise

        return {
            "candidateProfile": data
        }
