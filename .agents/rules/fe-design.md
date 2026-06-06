---
trigger: always_on
description: Apply when modifying frontend pages, layouts, components, styling, or UX. Prioritize existing patterns, HeroUI components, design tokens, minimal customization, clean classNames, and strictly limit changes to the requested scope.
---

# Page Design Rules

## Core Philosophy

Frontend changes must prioritize:

- Consistency over creativity
- Reuse over reinvention
- Simplicity over customization
- Maintainability over visual experimentation

The goal is to make every page feel like part of the same product and design system.

---

## Existing Pattern First

Before creating or modifying layouts, components, styling, or interactions:

- Search the codebase for existing implementations.
- Reuse established patterns whenever possible.
- Follow conventions already used in the same feature area.
- Prefer extending existing solutions over creating new ones.

Do not introduce a new pattern when an existing pattern already solves the problem.

---

## Layout Consistency

Before modifying page layouts:

- Inspect similar pages in the same section.
- Reuse existing spacing patterns.
- Reuse existing width constraints.
- Reuse existing page composition structures.
- Reuse existing content organization patterns.

Pages belonging to the same area should feel visually consistent.

---

## Design Token First

Never hardcode colors when design tokens already exist.

Before introducing visual styling:

- Read and inspect `globals.css`.
- Use existing CSS variables.
- Use existing semantic color tokens.
- Use existing typography, spacing, border, and radius tokens.

Avoid introducing arbitrary visual values when project-defined values already exist.

The design system is the source of truth.

---

## HeroUI First

HeroUI components should be the default implementation choice.

Before building custom UI:

- Check whether HeroUI already provides the component.
- Reuse existing HeroUI variants.
- Reuse existing HeroUI composition patterns.

If uncertain about:

- Component APIs
- Variants
- Slots
- Composition patterns
- Recommended implementation

Consult the HeroUI MCP documentation before implementing.

Do not guess HeroUI behavior.

---

## Component Reuse

Before creating a new component:

- Search for existing reusable components.
- Search for similar implementations.
- Reuse shared components whenever possible.

Avoid duplicating functionality that already exists.

---

## Minimal Component Customization

Do not heavily customize shared components.

Avoid:

- Large class overrides
- Significant visual alterations
- Rebuilding component behavior through styling

If extensive customization is required, reconsider whether the correct component is being used.

Shared components should remain visually and behaviorally consistent across the application.

---

## Component Composition

Keep component hierarchies simple.

Avoid unnecessary wrappers.

Prefer:

- Fewer DOM elements
- Clear JSX structure
- Simple component composition

Every wrapper should have a clear purpose.

---

## Class Name Discipline

Class names should remain as short, clean, and maintainable as possible.

Only add classes that provide meaningful value.

Avoid:

- Redundant utilities
- Duplicate utilities
- Unnecessary overrides
- Visual micro-adjustments without a requirement

Prefer the simplest valid implementation.

Do not add styling that does not directly contribute to the requested outcome.

---

## Animation Policy

Do not introduce:

- Animations
- Transitions
- Motion effects
- Hover effects
- Transform effects

unless explicitly requested by the user.

The default approach is a minimal and static interface.

Animation is opt-in, not opt-out.

---

## Loading, Empty, and Error States

Every data-driven page should consider:

- Loading state
- Empty state
- Error state

Do not implement only the success path.

---

## Dark Mode Consistency

Do not introduce styling that breaks existing theme support.

Always prefer:

- Theme tokens
- Semantic color variables
- Existing theme-aware styling

Avoid hardcoded light-mode assumptions.

---

## Icon Consistency

Use the project's existing icon library.

Do not introduce additional icon libraries without explicit approval.

Maintain visual consistency across the application.

---

## Accessibility

Interactive elements must remain accessible.

Prefer semantic components whenever possible.

Preserve:

- Keyboard accessibility
- Focus behavior
- Accessible labels
- Existing accessibility patterns

Accessibility should never be sacrificed for styling preferences.

---

## UX Consistency

Reuse existing terminology, labels, and interaction patterns.

Before introducing new wording or workflows:

- Review similar functionality elsewhere in the application.
- Follow established UX conventions.

Users should encounter consistent behavior for similar actions.

---

## Minimal Design Changes

Do not redesign, modernize, beautify, or creatively reinterpret existing interfaces unless explicitly requested.

When making UI changes:

- Modify only what is necessary.
- Preserve the existing design language.
- Preserve layout patterns.
- Preserve visual hierarchy.

If adjacent components must be adjusted, keep those changes minimal and directly related to the requested modification.

---

## Scope Protection

When modifying a page or component:

- Restrict changes to the requested scope.
- Avoid unrelated visual improvements.
- Avoid opportunistic refactoring.
- Avoid modifying neighboring components unless required.

Do not expand the scope without explicit approval.

---

## Decision Priority

When making frontend decisions, follow this order:

1. Existing project patterns
2. Existing shared components
3. HeroUI components
4. Design tokens from globals.css
5. Simplicity
6. Minimal customization

Always choose the solution that introduces the least visual and architectural deviation from the existing application.