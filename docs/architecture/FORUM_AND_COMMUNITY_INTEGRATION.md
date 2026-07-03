# CVerify Community & Candidate Forum Architecture Specification

This specification documents the data flow, topic taxonomy, and authorization policies for the CVerify recruitment community and forum subsystem.

---

## 1. Domain Overview & Taxonomy

The Community Subsystem provides peer discussions, verified candidate credential sharing, and hiring manager Q&A.

`	ext
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ Category Root   │──────►│ Discussion Topic│──────►│ Reply / Answer  │
│ - Tech Skills   │       │ - Author Tag    │       │ - Accepted State│
│ - Verification  │       │ - Verification  │       │ - Upvotes / Meta│
│ - Career Advice │       │   Badge Status  │       │                 │
└─────────────────┘       └─────────────────┘       └─────────────────┘
`

---

## 2. Topic Filtering & Query Optimization

- **Composite Indexes**: Topics are indexed by (CategoryId, Status, CreatedAt DESC) to prevent full table scans.
- **Fast Filter Overlays**: Filter queries support composite criteria:
  - status: Active, Solved, Archived.
  - erified_only: Boolean flag restricting view to verified credential holders.
  - sort: 	rending (decayed interaction score), latest, unanswered.

---

## 3. Security & Anti-Spam Guards

1. **Role-Based Permissions**: Unverified anonymous applicants cannot initiate new topics in the Enterprise Q&A section.
2. **Rate Limiting**: Redis Token Bucket algorithm limits topic creation to 3 per hour per applicant ID.
