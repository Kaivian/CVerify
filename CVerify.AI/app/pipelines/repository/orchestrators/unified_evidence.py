import hashlib
import os
import logging
from typing import List, Literal, Dict, Any
from pydantic import BaseModel, Field

logger = logging.getLogger("unified_evidence")

class UnifiedEvidenceItem(BaseModel):
    id: str
    type: Literal["engineering_practices", "security_findings", "architecture_insights"]
    severity: Literal["low", "medium", "high", "critical"]
    confidence: float  # 0.0 to 1.0
    fingerprint: str
    title: str
    content: str
    evidence_signals: List[str] = Field(default_factory=list)

class UnifiedEvidenceEngine:
    @staticmethod
    def generate_fingerprint(item_type: str, title: str, files: List[str]) -> str:
        # Normalize title and extract key security terms to group duplicates
        title_norm = title.lower().strip()
        
        # Normalize files: extract file basenames and sort
        file_bases = []
        for f in files:
            if f:
                file_bases.append(os.path.basename(f).lower().strip())
        file_bases = sorted(list(set(file_bases)))
        
        if item_type == "security_findings":
            # Identify core vulnerability category to map similar titles to the same fingerprint
            key_category = "general"
            categories = [
                ("credential", ["credential", "password", "secret", "token", "private key", "jwt_key"]),
                ("xss", ["xss", "cross-site", "dom injection", "appendchild", "innerhtml"]),
                ("injection", ["injection", "sql", "command"]),
                ("csp", ["csp", "content security"]),
                ("dependency", ["dependency", "version range", "npm", "pom.xml"]),
                ("canvas", ["canvas", "webgl", "render", "shader"]),
                ("concurrency", ["concurrent", "thread", "race condition", "synchronization"]),
                ("validation", ["validation", "sanitize", "input check", "bounds"])
            ]
            for cat, keywords in categories:
                if any(kw in title_norm for kw in keywords):
                    key_category = cat
                    break
            
            # Security fingerprint based on category and target files
            fp_base = f"security:{key_category}:{'-'.join(file_bases)}"
        elif item_type == "engineering_practices":
            # Quality fingerprint based on normalized title
            fp_base = f"quality:{title_norm}:{'-'.join(file_bases)}"
        else:
            # Architecture fingerprint based on normalized pattern title
            fp_base = f"architecture:{title_norm}"
            
        return hashlib.sha256(fp_base.encode('utf-8')).hexdigest()

    @classmethod
    def normalize_quality(cls, quality_data: Dict[str, Any]) -> List[UnifiedEvidenceItem]:
        items = []
        findings = quality_data.get("findings", [])
        for idx, f in enumerate(findings):
            if not isinstance(f, dict):
                continue
            title = f.get("finding", f.get("title", "Quality Finding"))
            content = f.get("explanation", "")
            signals = f.get("evidence_signals", [])
            impact = f.get("impact", "warning")
            
            # Map impact to severity
            if impact == "critical":
                severity = "high"
            elif impact == "warning":
                severity = "medium"
            else:
                severity = "low"
                
            confidence = float(f.get("confidence", 80)) / 100.0
            fp = cls.generate_fingerprint("engineering_practices", title, signals)
            
            items.append(UnifiedEvidenceItem(
                id=f"quality-{idx}",
                type="engineering_practices",
                severity=severity,
                confidence=confidence,
                fingerprint=fp,
                title=title,
                content=content,
                evidence_signals=signals
            ))
        return items

    @classmethod
    def normalize_security(cls, security_data: Dict[str, Any]) -> List[UnifiedEvidenceItem]:
        items = []
        vulns = security_data.get("vulnerabilities", [])
        for idx, v in enumerate(vulns):
            if not isinstance(v, dict):
                continue
            title = v.get("vulnerability", "Security Vulnerability")
            content = v.get("explanation", "")
            signals = v.get("evidence", [])
            impact = v.get("impact", "warning")
            
            severity = "critical" if impact == "critical" else "medium"
            confidence = float(v.get("confidence", 80)) / 100.0
            fp = cls.generate_fingerprint("security_findings", title, signals)
            
            items.append(UnifiedEvidenceItem(
                id=f"security-vuln-{idx}",
                type="security_findings",
                severity=severity,
                confidence=confidence,
                fingerprint=fp,
                title=f"Vulnerability: {title}",
                content=content,
                evidence_signals=signals
            ))
            
        findings = security_data.get("findings", [])
        for idx, f in enumerate(findings):
            if not isinstance(f, dict):
                continue
            title = f.get("finding", f.get("title", "Security Finding"))
            content = f.get("explanation", "")
            signals = f.get("evidence_signals", [])
            impact = f.get("impact", "warning")
            
            severity = "critical" if impact == "critical" else "medium"
            confidence = float(f.get("confidence", 80)) / 100.0
            fp = cls.generate_fingerprint("security_findings", title, signals)
            
            items.append(UnifiedEvidenceItem(
                id=f"security-find-{idx}",
                type="security_findings",
                severity=severity,
                confidence=confidence,
                fingerprint=fp,
                title=title,
                content=content,
                evidence_signals=signals
            ))
        return items

    @classmethod
    def normalize_architecture(cls, architecture_data: Dict[str, Any]) -> List[UnifiedEvidenceItem]:
        items = []
        patterns = architecture_data.get("patterns", [])
        for idx, p in enumerate(patterns):
            if not isinstance(p, dict):
                continue
            title = p.get("pattern", "Architectural Pattern")
            content = "Detected architectural design pattern configured in the workspace."
            signals = p.get("evidence", [])
            confidence = float(p.get("confidence", 80)) / 100.0
            fp = cls.generate_fingerprint("architecture_insights", title, signals)
            
            items.append(UnifiedEvidenceItem(
                id=f"architecture-pat-{idx}",
                type="architecture_insights",
                severity="low",
                confidence=confidence,
                fingerprint=fp,
                title=title,
                content=content,
                evidence_signals=signals
            ))
        return items

    @classmethod
    def deduplicate_and_validate(
        cls, 
        items: List[UnifiedEvidenceItem], 
        filenames: List[str]
    ) -> List[UnifiedEvidenceItem]:
        # Enforce deterministic deduplication by fingerprint
        unique_by_fingerprint: Dict[str, UnifiedEvidenceItem] = {}
        filenames_set = {f.lower().strip() for f in filenames}
        
        for item in items:
            # 1. Validation: Filter out hallucinated file references
            valid_signals = []
            for sig in item.evidence_signals:
                sig_clean = sig.strip()
                sig_lower = sig_clean.lower()
                # Check if file exists in repo or is a standard package manager file
                is_valid = False
                for fname in filenames_set:
                    if fname in sig_lower or sig_lower in fname:
                        is_valid = True
                        break
                if not is_valid:
                    if any(pkg in sig_lower for pkg in ["package.json", "requirements.txt", "go.mod", "pom.xml", "build.gradle"]):
                        is_valid = True
                
                if is_valid:
                    valid_signals.append(sig_clean)
            
            # Update item with validated signals
            item.evidence_signals = valid_signals
            
            # 2. Enforce no overlap invariant (deduplication)
            fp = item.fingerprint
            if fp not in unique_by_fingerprint:
                unique_by_fingerprint[fp] = item
            else:
                existing = unique_by_fingerprint[fp]
                # Keep the one with higher severity or confidence
                sev_ranking = {"low": 0, "medium": 1, "high": 2, "critical": 3}
                if sev_ranking[item.severity] > sev_ranking[existing.severity]:
                    unique_by_fingerprint[fp] = item
                elif sev_ranking[item.severity] == sev_ranking[existing.severity]:
                    if item.confidence > existing.confidence:
                        unique_by_fingerprint[fp] = item
                        
        return list(unique_by_fingerprint.values())

    @staticmethod
    def calculate_evidence_strength(items: List[UnifiedEvidenceItem]) -> dict:
        total_score = 0.0
        # Compute using unique and weighted signals
        for item in items:
            if item.severity == "critical":
                weight = 20.0
            elif item.severity == "high":
                weight = 15.0
            elif item.severity == "medium":
                weight = 10.0
            else:  # "low"
                weight = 5.0
                
            total_score += weight * item.confidence
            
        # Scale & threshold labeling
        if total_score <= 15.0:
            label = "Minimal"
        elif total_score <= 40.0:
            label = "Standard"
        elif total_score <= 85.0:
            label = "Strong"
        else:
            label = "Exceptional"
            
        return {
            "score": round(total_score, 1),
            "label": label
        }
