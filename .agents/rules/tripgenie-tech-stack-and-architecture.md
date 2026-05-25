---
trigger: glob
globs: **/*
---

- The CVerify AI project must strictly adhere to the approved technology stack.
- The Frontend (Client Layer) must be built using Next.js 16 (App Router) with Server Components, incorporating HeroUI v3 and Tailwind CSS v4 for UI design.
- State management is handled globally by Zustand, and form validation must use React Hook Form combined with Zod.
- The Backend (Server Layer) must use ASP.NET Core v10 to build RESTful APIs and Minimal APIs for streaming endpoints.
- The database must be PostgreSQL utilizing Entity Framework Core.
- The core AI model must be Claude Sonnet 4.6 (claude-sonnet-4-6) for complex reasoning tasks (AI Planner) and Claude Haiku 4.5 for lightweight tasks like recommendation and validation.
- Model IDs must never be hardcoded directly into the business logic; they must be stored in appsettings.json or environment variables.
- PostgreSQL is the absolute source of truth, while Google Sheets serves only as an export or collaboration artifact.
