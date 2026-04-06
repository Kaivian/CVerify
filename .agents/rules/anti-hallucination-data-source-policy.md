---
trigger: model_decision
description: Apply this rule when the AI initializes tool calls, writes logic for retrieving travel data, or designs response schemas for the itinerary planner system.
---

- The Large Language Model (LLM) must function strictly as a reasoning and orchestration engine; it must never be considered a reliable source of factual data.
- All information regarding opening hours, ticket prices, travel distances, and addresses must be fetched from verified external APIs or the internal POI Database.
- The system must enforce a strict JSON Schema output through the emit_itinerary tool to prevent data hallucination.
- An AI Validation layer must be implemented to check for scheduling conflicts and travel times (using the Google Maps Matrix API) before the itinerary is returned to the Frontend.
- All AI responses must include a schema_version to ensure backward compatibility and prevent breaking changes.
