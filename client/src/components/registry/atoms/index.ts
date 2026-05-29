import type { ComponentNode } from "../types";

export const atomComponents: ComponentNode[] = [
  {
    id: "button",
    name: "Button",
    category: "atom",
    tags: ["core", "interactive", "form"],
    description: "Enterprise high-fidelity button wrapper around HeroUI Button containing custom hover transitions, state loading spinners, and active touch compression.",
    status: "stable",
    owner: "Design Systems Core",
    maintainers: ["alex.smith@cverify.ai", "julia.wong@cverify.ai"],
    dependencyRisk: 1,
    reuseScore: 8,
    responsive: true,
    themeable: true,
    a11yCompliant: true,
    usageCount: 42,
    pagesUsed: ["/login", "/register", "/admin/users", "/user/dashboard", "/business"],
    lastUpdated: "2026-05-18",
    composedOf: [],
    usedIn: ["otp-input", "dialog-modal", "pagination-wrapper", "table-action-dropdown", "unsaved-changes-bar", "header", "session-timeout-modal"],
    codeSnippet: `import { Button } from '@/components/ui/button';

// Standard action button
<Button variant="solid" onClick={handleClick}>
  Save Changes
</Button>

// Premium outline button
<Button variant="outline" isLoading={isSubmitting}>
  Cancel
</Button>`
  },
  {
    id: "card",
    name: "Card",
    category: "atom",
    tags: ["core", "layout", "visual"],
    description: "Premium visual container featuring theme-adaptive glowing linear gradients, soft border offsets, and smooth depth lighting shadows.",
    status: "stable",
    owner: "Design Systems Core",
    maintainers: ["alex.smith@cverify.ai"],
    dependencyRisk: 1,
    reuseScore: 6,
    responsive: true,
    themeable: true,
    a11yCompliant: true,
    usageCount: 28,
    pagesUsed: ["/admin", "/user", "/business/dashboard"],
    lastUpdated: "2026-05-20",
    composedOf: [],
    usedIn: ["session-timeout-modal", "admin-dashboard-view", "user-dashboard-view"],
    codeSnippet: `import { Card } from '@/components/ui/card';

<Card glow={true}>
  <h3 className="text-lg font-bold text-foreground">Interactive Card</h3>
  <p className="text-sm text-muted">Hover to see glowing dynamic borders.</p>
</Card>`
  }
];
