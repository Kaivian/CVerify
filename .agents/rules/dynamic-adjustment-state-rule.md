---
trigger: model_decision
description: Apply this rule when writing code for the collaborative editing feature, updating itineraries due to weather changes, or updating the state logic of Activity Blocks.
---

- When executing Dynamic Adjustment (real-time re-planning), the system is only allowed to regenerate the specific blocks affected by a change (e.g., due to heavy rain or a user requesting a location swap).
- It must keep all unaffected blocks completely intact.
- The system must allow users to pin or lock important activities, and the AI is strictly prohibited from automatically overwriting these pinned blocks.
- For multi-user collaborative editing, the system must implement optimistic locking using a version field; if a version conflict is detected, the system must throw an HTTP 409 Conflict error.
