import { ComponentNode } from "../types";

export const moleculeComponents: ComponentNode[] = [
  {
    id: "otp-input",
    name: "OtpInput",
    category: "molecule",
    tags: ["auth", "security", "form"],
    description: "Highly secure OTP verification box providing auto-focus behavior, paste validation, keyboard arrows nav, and native numeric restrictions.",
    status: "stable",
    owner: "Security Engineering",
    maintainers: ["steve.rogers@cverify.ai"],
    dependencyRisk: 2,
    reuseScore: 2,
    responsive: true,
    themeable: true,
    a11yCompliant: true,
    usageCount: 4,
    pagesUsed: ["/auth/verify", "/admin/recovery/level2"],
    lastUpdated: "2026-05-25",
    composedOf: ["button"],
    usedIn: [],
    codeSnippet: `import { OtpInput } from '@/components/ui/otp-input';

<OtpInput
  length={6}
  onComplete={(otp) => handleVerify(otp)}
  isLoading={isVerifying}
/>`
  },
  {
    id: "dialog-modal",
    name: "DialogModal",
    category: "molecule",
    tags: ["core", "overlay", "visual"],
    description: "Clean responsive modal dialog providing standard modal accessibility overlays, focus traps, and Framer Motion spring fade-ins.",
    status: "stable",
    owner: "Design Systems Core",
    maintainers: ["alex.smith@cverify.ai"],
    dependencyRisk: 2,
    reuseScore: 4,
    responsive: true,
    themeable: true,
    a11yCompliant: true,
    usageCount: 12,
    pagesUsed: ["/admin/users", "/user/dashboard"],
    lastUpdated: "2026-05-10",
    composedOf: ["button"],
    usedIn: ["session-timeout-modal"],
    codeSnippet: `import { DialogModal } from '@/components/ui/dialog-modal';

<DialogModal
  isOpen={isOpen}
  onClose={closeModal}
  title="Confirm Action"
>
  <p className="text-sm text-muted">Are you absolutely sure you want to proceed?</p>
  <div className="flex gap-2 justify-end mt-4">
    <Button variant="outline" onClick={closeModal}>Cancel</Button>
    <Button variant="danger" onClick={handleConfirm}>Confirm</Button>
  </div>
</DialogModal>`
  },
  {
    id: "pagination-wrapper",
    name: "PaginationWrapper",
    category: "molecule",
    tags: ["core", "data", "navigation"],
    description: "Data grid helper element providing page size adjustments, item offsets rendering, and touch-responsive page index blocks.",
    status: "stable",
    owner: "Design Systems Core",
    maintainers: ["julia.wong@cverify.ai"],
    dependencyRisk: 2,
    reuseScore: 3,
    responsive: true,
    themeable: true,
    a11yCompliant: true,
    usageCount: 8,
    pagesUsed: ["/admin/users", "/admin/roles", "/admin/audit-logs"],
    lastUpdated: "2026-05-15",
    composedOf: ["button"],
    usedIn: [],
    codeSnippet: `import { PaginationWrapper } from '@/components/ui/pagination-wrapper';

<PaginationWrapper
  currentPage={page}
  totalPages={10}
  onPageChange={(p) => setPage(p)}
/>`
  },
  {
    id: "table-action-dropdown",
    name: "TableActionDropdown",
    category: "molecule",
    tags: ["core", "data", "overlay"],
    description: "Standard action triggers helper containing responsive hover menus, nested locks control, and click animations.",
    status: "stable",
    owner: "Design Systems Core",
    maintainers: ["julia.wong@cverify.ai"],
    dependencyRisk: 2,
    reuseScore: 2,
    responsive: true,
    themeable: true,
    a11yCompliant: true,
    usageCount: 6,
    pagesUsed: ["/admin/users", "/admin/roles"],
    lastUpdated: "2026-05-22",
    composedOf: ["button"],
    usedIn: [],
    codeSnippet: `import { TableActionDropdown } from '@/components/ui/table-action-dropdown';

<TableActionDropdown
  actions={[
    { label: "View Details", onClick: () => showDetails() },
    { label: "Lock Account", onClick: () => lockAccount(), isDanger: true }
  ]}
/>`
  },
  {
    id: "unsaved-changes-bar",
    name: "UnsavedChangesBar",
    category: "molecule",
    tags: ["core", "form", "overlay"],
    description: "Floating action banner notifying users of unsaved input adjustments with spring transition animations.",
    status: "beta",
    owner: "Design Systems Core",
    maintainers: ["julia.wong@cverify.ai"],
    dependencyRisk: 2,
    reuseScore: 1,
    responsive: true,
    themeable: true,
    a11yCompliant: true,
    usageCount: 2,
    pagesUsed: ["/admin/roles", "/user/profile"],
    lastUpdated: "2026-05-28",
    composedOf: ["button"],
    usedIn: [],
    codeSnippet: `import { UnsavedChangesBar } from '@/components/ui/unsaved-changes-bar';

<UnsavedChangesBar
  isVisible={hasChanges}
  onSave={handleSave}
  onReset={handleReset}
  isSaving={isSaving}
/>`
  }
];
