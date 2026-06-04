# CVerify Frontend Client Layer

Welcome to the CVerify Frontend Client Layer. This is a state-of-the-art web portal built with Next.js 16 (App Router) and React 19. The application features highly responsive interfaces, secure edge routing, client-side validation, global state synchronization across multiple tabs, and seamless API communication.

## Technology Stack

The client application uses a curated stack of modern web technologies:

* Core Engine: Next.js 16 (App Router) using Server Components for optimized performance and Search Engine Optimization (SEO).
* UI Components: HeroUI v3, built on top of React Aria for fully accessible, keyboard-navigable components.
* Styling: Tailwind CSS v4, utilizing Oklch color palettes and instant compilation.
* State Management: Zustand 5.x for lightweight, atomic global state storage.
* Form validation: React Hook Form 7.x combined with Zod 4.x for schema-based input verification.
* API Client: Axios 1.x, configured with custom interceptors for CSRF token propagation and silent token refresh.
* JWT Processing: jose 6.x for cryptographic signature validation at the edge.

## Folder Structure and Architecture

The frontend codebase is organized using a feature-driven folder structure to enforce strict boundaries and prevent shared dumping grounds:

```
client/
├── public/                 # Static assets (images, vectors, logos)
├── src/
│   ├── app/                # Next.js App Router (Layouts, Routing, Styles)
│   │   ├── (auth)/         # Gated authentication routes group
│   │   ├── dashboard/      # Protected dashboards (Admin/Business/User subdirectories)
│   │   ├── system/         # Server telemetry, performance, and diagnostics
│   │   ├── unauthorized/   # Fallback page for role authorization failures
│   │   ├── globals.css     # Global Tailwind CSS and HeroUI variable injection
│   │   ├── layout.tsx      # Main wrapper with typography and theme initializers
│   │   └── providers.tsx   # React context injections (HeroUI, Query, Toast providers)
│   ├── components/         # Core generic UI elements and global controls
│   │   ├── ui/             # Primitive, highly-accessible UI components (OtpInput, Buttons, Cards)
│   │   └── forms/          # Standardized form controller wrappers (FormOtpField, FormInput)
│   ├── features/           # Gated, domain-specific modules with encapsulated logic
│   │   └── auth/           # Complete Authentication domain boundary
│   │       ├── components/ # Auth-specific components (PasswordStrengthMeter, Showcase layouts)
│   │       ├── security/   # Cryptographic / complexity validation logic (PasswordPolicy)
│   │       ├── permissions/# RBAC seed database registry, schema types, and metadata checkers
│   │       ├── services/   # Auth API request wrappers (RecoveryService, TokenHub)
│   │       ├── store/      # Encapsulated auth Zustand slice (useAuthStore)
│   │       └── views/      # Dedicated full-page auth controllers (CompanyVerificationView, ReclaimView)
│   ├── hooks/              # Custom global React hooks (e.g. SSE streaming handlers, useSessionTimeout)
│   ├── lib/                # Technical integrations, constants, and utilities
│   │   ├── api/            # Axios HTTP client, end-to-end endpoints, and telemetry service
│   │   ├── constants/      # Immutable configurations, application route names, cookie keys
│   │   ├── utils/          # Pure helpers (date formatters, token parsers, claims helpers)
│   │   └── validators/     # Zod schemas matched strictly against C# class validations
│   ├── stores/             # Consolidated global Zustand state models (useThemeStore)
│   ├── types/              # Global TypeScript typings and standardized API response contracts (api.types)
│   └── proxy.ts            # Security Proxy - Edge middleware checking cryptographic tokens and claims
├── .env.example            # Baseline environment variables template
├── tsconfig.json           # Type configurations for React 19/TypeScript 5
└── next.config.ts          # Next.js bundler and compiler configuration
```

### Modularity Guidelines
1. No Shared Dumping Ground: Avoid global shared directories. Primitive inputs go to `src/components/ui/`, form integrations belong in `src/components/forms/`, and domain logic goes to `src/features/`.
2. Consolidated Zustand Stores: Global states like themes or user sessions are consolidated under `src/stores/` to avoid multi-instance sync problems.
3. Module Aliases: imports use `@/*` pointing to the `./src/` directory.

## Environment Variables

Copy the example file to `.env.local` to start local configuration:

```bash
cp .env.example .env.local
```

The table below explains the required keys:

| Environment Key | Example Value | Description |
| :--- | :--- | :--- |
| NEXT_PUBLIC_API_URL | http://localhost:5247/api | Base URL pointing to the CVerify.Core backend REST API. |
| JWT_SECRET | DbqDgBM1u2H5lN... | Cryptographic secret key used to verify JWT integrity. Must exactly match the JWT_KEY variable in the backend configurations. |
| NEXT_PUBLIC_GOOGLE_CLIENT_ID | 429618424119-... | Unique client ID generated in Google Cloud Console for the SSO OAuth flow. |

## Running Locally

### 1. Installation
Install all npm packages required for the project:

```bash
cd client
npm install
```

### 2. Start Development Server
Run the local Next.js server with Turbopack compilation:

```bash
npm run dev
```
Open `http://localhost:3000` to view the application.

### 3. Build and Run in Production Mode
Compile the production assets and start the optimized server:

```bash
npm run build
npm run start
```

## API Client and Resiliency

The client communicates with the backend API using a customized Axios client located in `src/lib/api/axios-client.ts`. The API layer includes the following resiliency implementations:

1. CSRF Verification: A request interceptor reads the CSRF cookie and propagates it in the `X-XSRF-TOKEN` header for state-mutating requests (POST, PUT, DELETE).
2. HttpOnly Cookie Storage: Authenticators do not store access or refresh tokens in local storage. All authentication claims use HttpOnly cookies, protecting the client against cross-site scripting (XSS) attacks.
3. Silent Token Rotation: An interceptor detects 401 Unauthorized API responses and automatically executes a silent refresh request to rotate cookies. It handles concurrent requests by caching the refresh operation in a single promise to prevent duplicate rotation checks.
4. Error Normalization: Standardizes C# ProblemDetails error collections (typically formatted in PascalCase) to camelCase so they map directly to Zod validation states and form UI components.

## Security Proxy and Edge Gating

Access gating is handled at the network edge by the Next.js middleware proxy in `src/proxy.ts`:

1. Decryption and Signature Checks: The proxy decodes the `access_token` cookie using the `JWT_SECRET` key to assert token validity.
2. Email Verification Enforcer: If a user has a valid session but their `isEmailVerified` claim is false, the proxy intercepts and redirects the browser session to `/verify-email`.
3. Role-Based Access Control (RBAC): Gated directories are validated based on user roles:
   * `/dashboard/admin/**/*` requires the ADMIN role.
   * `/dashboard/business/**/*` requires BUSINESS or ADMIN roles.
   * `/dashboard/user/**/*` requires USER, BUSINESS, or ADMIN roles.
4. Session Broadcast Synchronization: User sessions use a `BroadcastChannel` in the authentication Zustand store. Logouts or session invalidation in one browser tab are broadcast to all other open tabs, forcing them to terminate their active sessions and redirect to `/login` immediately.

## Troubleshooting

### Security Proxy Redirect Loops
If a successful login redirects you to the dashboard, but you are instantly redirected back to the login screen, check that the `JWT_SECRET` in `client/.env.local` matches the `JWT_KEY` in `CVerify.Core/.env` exactly. If the keys mismatch, the edge proxy will reject the token signature as invalid while the API server accepts it.

### CORS Preflight Failures
If the browser console displays CORS errors, verify that `NEXT_PUBLIC_API_URL` uses the exact port binding of the CVerify.Core backend. Additionally, check that `FRONTEND_URL` is set to `http://localhost:3000` in the backend configurations so it is added to the whitelisted CORS origins.

### Google Sign-In SDK Button Width Warning
If the Google Sign-In SDK prints warnings regarding invalid button widths, ensure that the container wrapper for the Google button is configured with an explicit pixel width or fixed CSS width property rather than a percentage.

### Hydration Mismatch Errors
If Next.js reports hydration mismatch warnings (e.g. mismatch between server pre-render and client render), check if your UI reads cookies or local storage directly during initial rendering. Gate these checks inside React `useEffect` hooks or wrap them behind client-only state checks to guarantee correct client-side hydration.
