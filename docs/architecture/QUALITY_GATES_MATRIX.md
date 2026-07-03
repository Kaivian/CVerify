# CVerify Architectural Matrix & Quality Gates

Overview of CVerify verification gates, OCR parsing accuracy thresholds, and static analysis checkpoints.

---

## 1. Quality Gates

1. **OCR Accuracy Threshold**: Multi-lingual text extraction must attain $\ge 98.5\%$ character confidence score.
2. **Deterministic Entity Extraction**: PII redaction and candidate skill categorization are verified against benchmark golden sets.
3. **Architecture Boundary Enforcement**: Core verification algorithms in CVerify.Core cannot directly invoke presentation tier controllers.
