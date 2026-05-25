---
trigger: glob
globs: src/app/hooks/useStreamPlan.ts, src/Controllers/*Controller.cs, src/Services/AI/StreamHandler.cs
---

- The system must use Server-Sent Events (SSE) to stream data from the Backend to the Frontend, which optimizes the User Experience (UX) during the 8-15 second AI processing wait time.
- The ASP.NET Core v10 backend must receive the SSE stream from the Claude API and forward it immediately to the Frontend using Response.WriteAsync().
- The Next.js Frontend must use TextDecoder and getReader() to parse the incoming data stream.
- Event types such as tool_pending (showing loading/search progress), itinerary_draft (rendering the preview), and final (rendering the completed data and Google Sheets link) must be properly parsed and handled.
