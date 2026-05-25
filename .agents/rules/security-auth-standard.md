---
trigger: glob
globs: src/Controllers/AuthController.cs, src/models/users.cs, middleware.ts, src/app/(auth)/**/*
---

- The authentication and authorization system must support both traditional Email/Password login and Google OAuth 2.0.
- It must issue JWT Access Tokens (valid for 15 minutes) and Refresh Tokens (valid for 7 days).
- Passwords saved in the PostgreSQL users table must be securely encrypted using BCrypt.
- Tokens must be stored in HttpOnly, Secure, and SameSite Cookies to protect against XSS attacks and JavaScript token theft.
- Role-Based Access Control (RBAC) must be implemented for USER and ADMIN groups.
- Additionally, the AI execution flow must include rate limiting per IP/User and prompt sanitization to defend against prompt injection attacks.
