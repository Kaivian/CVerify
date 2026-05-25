---
trigger: glob
globs: src/components/**/*.tsx, src/store/*.ts
---

- The User Interface must be built with a Mobile-first approach, ensuring seamless compatibility on iOS Safari and Android Chrome.
- The primary color scheme must utilize OKLCH variables with signature colors: Ocean Blue as the primary color, Lantern Yellow as the accent color, and Hue Purple for AI-specific features.
- Components such as the ActivityBlock must support drag-and-drop between time slots and inline editing, which will trigger the POST /edit API.
- The entire trip state must be managed via Zustand using the persist middleware so that draft itineraries survive page refreshes.
- If the AI suggests a location with low confidence (ai_confidence < 0.7), the UI must display a yellow "AI suggestion" badge prompting the user to verify the information.
