---
trigger: model_decision
description: Apply this rule when integrating Claude (Anthropic), Google Places, OpenWeather, or Amadeus APIs, or when establishing the caching infrastructure.
---

- To optimize API operational costs, the system must implement Claude's Prompt Caching for static System Prompts (approximately 4000 tokens detailing business rules and tool schemas) to save 90% on input costs.
- The chat context window must truncate history after 10 conversation turns, retaining only a summary.
- Redis must be used to cache external API queries: Weather API (30 minutes TTL), Route calculations (6 hours TTL), and POI data (24 hours TTL).
- The system should prioritize looking up data in the internal POI Database through background synchronization jobs (RabbitMQ or Hangfire) to avoid continuous external API calls.
- The system must integrate Polly .NET as a circuit breaker to fall back to memory-cached draft itineraries if the Claude API or external services experience downtime.
