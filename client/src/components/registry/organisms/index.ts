import type { ComponentNode } from "../types";

export const organismComponents: ComponentNode[] = [
  {
    id: "session-timeout-modal",
    name: "SessionTimeoutModal",
    category: "organism",
    tags: ["auth", "overlay", "security"],
    description: "Enterprise system inactivity warning modal overlay providing security countdown timer, BFCache restoration revalidations, and immediate JWT logout triggers.",
    status: "stable",
    owner: "Security Engineering",
    maintainers: ["steve.rogers@cverify.ai"],
    dependencyRisk: 3,
    reuseScore: 1,
    responsive: true,
    themeable: true,
    a11yCompliant: true,
    usageCount: 1,
    pagesUsed: ["/ (Private App Route Group Layout)"],
    lastUpdated: "2026-05-24",
    composedOf: ["dialog-modal", "button", "card"],
    usedIn: [],
    codeSnippet: `import { SessionTimeoutModal } from '@/components/ui/session-timeout-modal';

<SessionTimeoutModal
  isOpen={showWarning}
  countdown={secondsRemaining}
  onExtend={extendSession}
  onLogout={handleSignOut}
/>`
  },
  {
    id: "header",
    name: "Header",
    category: "organism",
    tags: ["core", "navigation", "layout"],
    description: "System dashboard top navigation container housing branding, language switcher context, and logged-in user auth avatar settings.",
    status: "stable",
    owner: "Design Systems Core",
    maintainers: ["alex.smith@cverify.ai"],
    dependencyRisk: 2,
    reuseScore: 1,
    responsive: true,
    themeable: true,
    a11yCompliant: true,
    usageCount: 1,
    pagesUsed: ["/ (Private App Route Group Layout)"],
    lastUpdated: "2026-05-18",
    composedOf: ["button"],
    usedIn: [],
    codeSnippet: `import { Header } from '@/components/ui/header';

// Typically integrated directly inside the Private App Router Layout
<Header />`
  },
  {
    id: "sidebar",
    name: "Sidebar",
    category: "organism",
    tags: ["core", "navigation", "layout"],
    description: "Standard recursive sidebar supporting desktop collapsible panels, mobile overlay slide-outs drawers, and permission-based link node filters.",
    status: "stable",
    owner: "Design Systems Core",
    maintainers: ["julia.wong@cverify.ai"],
    dependencyRisk: 2,
    reuseScore: 1,
    responsive: true,
    themeable: true,
    a11yCompliant: true,
    usageCount: 1,
    pagesUsed: ["/ (Private App Route Group Layout)"],
    lastUpdated: "2026-05-26",
    composedOf: [],
    usedIn: [],
    codeSnippet: `import { Sidebar } from '@/components/ui/sidebar';

// Typically integrated directly inside the Private App Router Layout
<Sidebar />`
  }
];
