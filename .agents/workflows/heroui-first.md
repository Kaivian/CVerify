---
description: Standardized Frontend Development Workflow for HeroUI-Based CVerify Client
---

# CVerify Frontend Implementation Workflow & Engineering Standards

Whenever implementing, modifying, deleting, or refactoring any frontend functionality in the CVerify client application, follow the workflow below to ensure architectural consistency, UI quality, maintainability, scalability, and production readiness.

---

# 1. Component Discovery First (HeroUI Priority)

Before creating any new UI component manually:

- Check whether the required component already exists in the HeroUI ecosystem.
- Prioritize native HeroUI solutions over custom-built implementations whenever possible.
- Maintain consistency with the platform’s design language and interaction patterns.

Examples:

- Modal
- Drawer
- Tabs
- Toast
- Input OTP
- Dropdown
- Tooltip
- Card
- Spinner
- Pagination
- Skeleton
- Accordion
- Command/Search UI

Avoid reinventing components already available in HeroUI.

---

# 2. Use MCP Server for Official Usage Patterns

If a HeroUI component exists:

Call the MCP server to retrieve:

- official usage patterns
- props
- variants
- accessibility requirements
- composition examples
- animation recommendations
- best practices

Do not rely on assumptions or outdated implementations.

The MCP lookup must happen before coding begins to ensure:

- correct API usage
- proper composition
- consistent styling
- future compatibility

---

# 3. Follow Existing Frontend Architecture

All frontend changes must align with the current CVerify frontend architecture.

## Required Stack Alignment

- Next.js App Router
- HeroUI
- TailwindCSS
- Zustand
- Framer Motion
- TypeScript strict typing

## Respect Existing Structure

- `shared/`
- `features/`
- `hooks/`
- `stores/`
- `app/`
- `providers/`

Avoid:

- duplicated logic
- deeply nested state
- inline business logic inside UI components
- oversized page components

---

# 4. Maintain Design Consistency

All newly implemented UI must visually align with:

`client/src/app/testing/page.tsx`

## Required Design Characteristics

- premium SaaS aesthetics
- smooth transitions
- consistent spacing
- soft borders
- rounded corners
- typography hierarchy
- responsive behavior
- dark/light theme support

Do not introduce:

- inconsistent visual styles
- mixed component systems
- unstructured spacing
- conflicting animation patterns

---

# 5. Color System Rules (No Hardcoded Colors)

Do not hardcode colors directly in components or Tailwind classes.

Use:

- HeroUI semantic color tokens
- existing Tailwind theme variables
- design-system-defined color utilities
- CSS variables already provided by the project

Preferred approach:

- `primary`
- `secondary`
- `success`
- `warning`
- `danger`
- `foreground`
- `background`
- `content1/content2`
- semantic text/background utilities

Avoid:

- raw hex colors
- inline RGB values
- arbitrary Tailwind color values unless explicitly approved

Examples of discouraged usage:

```tsx
className = "bg-[#18181b] text-white";
```

Preferred:

```tsx
color = "primary";
className = "bg-content1 text-foreground";
```

The UI must remain fully theme-compatible across dark/light modes.

---

# 6. ESLint & Type Safety Enforcement

During implementation:

- continuously monitor ESLint warnings/errors
- resolve TypeScript issues immediately
- avoid `any` unless absolutely necessary
- remove unused imports/variables
- avoid unsafe casts
- ensure hooks follow React rules

The codebase must remain:

- type-safe
- lint-clean
- maintainable

Do not postpone lint fixes.

---

# 7. Build Verification Required

After every frontend modification, run:

```bash
npm run build
```

The implementation is not considered complete until:

- the application builds successfully
- there are no TypeScript errors
- there are no ESLint failures
- there are no App Router compilation issues
- no hydration mismatches occur

This step is mandatory after:

- component creation
- routing changes
- auth flow changes
- Zustand/store changes
- provider updates
- HeroUI integrations

---

# 8. Runtime & UX Validation

After build success:

- manually test the affected flow
- validate responsive behavior
- validate loading states
- validate animations/transitions
- validate dark/light theme rendering
- validate accessibility behavior

Ensure:

- no console errors
- no layout shifting
- no broken animations
- no duplicated requests
- no hydration warnings

---

# 9. Frontend Quality Standards

Every implementation should aim for:

- reusable components
- scalable architecture
- clean separation of concerns
- accessible U
- production-ready polish

Avoid:

- quick hacks
- duplicated UI logic
- unstructured styling
- inconsistent animation systems
- mixed notification/dialog systems

The final frontend output should consistently feel like a modern premium SaaS platform.
