"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/features/workspace/store/use-workspace-store";
import { useActiveWorkspace } from "@/features/workspace/hooks/use-active-workspace";
import { workspaceService } from "@/features/workspace/services/workspace.service";
import { CreateWorkspaceModal } from "@/features/workspace/components/create-workspace-modal";
import { EditWorkspaceModal } from "@/features/workspace/components/edit-workspace-modal";
import { TransferOwnershipModal } from "@/features/workspace/components/transfer-ownership-modal";
import { WorkspaceMembersManager } from "@/features/workspace/components/WorkspaceMembersManager";
import DialogModal from "@/components/ui/dialog-modal";
import PaginationWrapper from "@/components/ui/pagination-wrapper";
import { Card } from "@/components/ui/card";
import SelectDropdown from "@/components/ui/select-dropdown";
import {
  Typography,
  Spinner,
  Button,
  Input,
  Dropdown,
  Label,
  AlertDialog
} from "@heroui/react";
import {
  Building2,
  Plus,
  ArrowRight,
  Search,
  MoreVertical,
  Settings,
  Users,
  Key,
  Archive,
  Trash2,
  RefreshCw,
  AlertTriangle,
  ExternalLink
} from "lucide-react";
import { BusinessVerificationBadge } from "@/components/ui/cverify/verification-badges";

export default function WorkspacesDirectoryPage() {
  const params = useParams();
  const router = useRouter();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  // Context-specific active workspace hook
  const { activeWorkspaceId, setActiveWorkspaceId } = useActiveWorkspace(organizationSlug);
  const fetchWorkspace = useWorkspaceStore((s) => s.fetchWorkspace);
  const workspaceDetails = useWorkspaceStore((s) => s.workspaces[organizationSlug]);

  // Workspaces list state
  const [items, setItems] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("name_asc");
  const [isLoading, setIsLoading] = useState(false);

  // Debounced search query
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<any>(null);

  // Action confirms
  const [deleteConfirmWorkspace, setDeleteConfirmWorkspace] = useState<any>(null);
  const [archiveConfirmWorkspace, setArchiveConfirmWorkspace] = useState<any>(null);
  const [restoreConfirmWorkspace, setRestoreConfirmWorkspace] = useState<any>(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Load workspaces
  const loadWorkspaces = useCallback(async () => {
    if (!organizationSlug) return;
    setIsLoading(true);
    try {
      const result = await workspaceService.getWorkspaces(organizationSlug, {
        search: debouncedSearch || undefined,
        status: status === "all" ? undefined : status,
        sortBy,
        page,
        pageSize
      });
      setItems(result.items || []);
      setTotalCount(result.totalCount || 0);
    } catch (err) {
      console.error("[Workspaces Directory] Failed to load workspaces", err);
    } finally {
      setIsLoading(false);
    }
  }, [organizationSlug, debouncedSearch, status, sortBy, page, pageSize]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  // Handle active workspace contexts
  const handleOpenWorkspace = (id: string) => {
    setActiveWorkspaceId(id);
    router.push(`/business/${organizationSlug}/recruitment/dashboard`);
  };

  // Perform destructive actions
  const handleDelete = async (ws: any) => {
    try {
      await workspaceService.deleteWorkspace(organizationSlug, ws.id);
      await loadWorkspaces();
      // Reload sidebar / cached workspace details too
      fetchWorkspace(organizationSlug);
    } catch (err) {
      console.error("[Workspaces Directory] Failed to delete workspace", err);
    }
  };

  const handleArchive = async (ws: any) => {
    try {
      await workspaceService.archiveWorkspace(organizationSlug, ws.id);
      await loadWorkspaces();
      fetchWorkspace(organizationSlug);
    } catch (err) {
      console.error("[Workspaces Directory] Failed to archive workspace", err);
    }
  };

  const handleRestore = async (ws: any) => {
    try {
      await workspaceService.restoreWorkspace(organizationSlug, ws.id);
      await loadWorkspaces();
      fetchWorkspace(organizationSlug);
    } catch (err) {
      console.error("[Workspaces Directory] Failed to restore workspace", err);
    }
  };

  const totalPages = useMemo(() => Math.ceil(totalCount / pageSize), [totalCount, pageSize]);

  return (
    <div className="space-y-6 font-outfit max-w-7xl mx-auto text-foreground p-4">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-surface border border-border text-foreground select-none">
        <div className="space-y-1">
          <Typography type="h2" className="text-2xl font-bold flex items-center gap-2 text-foreground font-outfit">
            <Building2 size={24} className="text-accent" />
            Workspaces Directory
          </Typography>
          <Typography type="body-xs" className="text-muted font-medium mt-0.5 font-outfit">
            Manage your company's operational hiring teams, university outreach initiatives, and recruiting workflows.
          </Typography>
        </div>
        <div className="flex gap-2.5 items-center">
          <Button
            onPress={() => setIsCreateOpen(true)}
            className="bg-accent hover:bg-accent/90 text-white font-bold text-xs rounded-xl px-4 py-2 cursor-pointer border-none flex items-center gap-1.5"
          >
            <Plus size={14} /> Create Workspace
          </Button>
          <BusinessVerificationBadge level={workspaceDetails?.verificationLevel} />
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 rounded-2xl border border-border bg-surface select-none">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 size-4 text-muted/60" />
          <Input
            placeholder="Search workspaces..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs font-semibold"
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>

        <div className="flex gap-3 w-full sm:w-auto items-center justify-end">
          <div className="w-36">
            <SelectDropdown
              value={status}
              onChange={(val) => {
                setStatus(val);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'active', label: 'Active' },
                { value: 'archived', label: 'Archived' },
                { value: 'frozen', label: 'Frozen' }
              ]}
            />
          </div>

          <div className="w-40">
            <SelectDropdown
              value={sortBy}
              onChange={(val) => setSortBy(val)}
              options={[
                { value: 'name_asc', label: 'Sort: Name A-Z' },
                { value: 'name_desc', label: 'Sort: Name Z-A' },
                { value: 'date_desc', label: 'Sort: Newest First' },
                { value: 'date_asc', label: 'Sort: Oldest First' },
                { value: 'member_count_desc', label: 'Sort: Members High-Low' },
                { value: 'member_count_asc', label: 'Sort: Members Low-High' }
              ]}
            />
          </div>
        </div>
      </div>

      {/* Data Table */}
      <Card className="border border-border bg-surface overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Spinner size="md" color="accent" />
            <Typography type="body-xs" className="text-muted font-semibold">
              Fetching workspaces...
            </Typography>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 px-4">
            <AlertTriangle className="size-8 text-muted/50 mx-auto mb-3" />
            <Typography type="h4" className="font-bold text-foreground mb-1">
              No Workspaces Found
            </Typography>
            <Typography type="body-xs" className="text-muted max-w-sm mx-auto mb-6">
              Try adjusting your search query, status filters, or add a brand new workspace operational unit.
            </Typography>
            <Button
              onPress={() => setIsCreateOpen(true)}
              className="bg-foreground text-background font-bold rounded-xl px-5 py-2 cursor-pointer border-none text-xs"
            >
              Create Workspace
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse select-none">
              <thead>
                <tr className="border-b border-border/80 text-[10px] uppercase font-bold text-muted/70 tracking-wider">
                  <th className="py-3 px-4">Workspace Name</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4 text-center">Members</th>
                  <th className="py-3 px-4 text-center">Active Jobs</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs">
                {items.map((w) => {
                  const isActiveContext = w.id === activeWorkspaceId;
                  return (
                    <tr key={w.id} className={`hover:bg-surface-secondary/20 transition-colors ${isActiveContext ? 'bg-accent/5' : ''}`}>
                      <td className="py-3 px-4 font-semibold text-foreground">
                        <div className="flex flex-col">
                          <span className="flex items-center gap-1.5">
                            {w.displayName}
                            {isActiveContext && (
                              <span className="text-[8px] font-bold text-accent bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded-full uppercase tracking-wider scale-90">
                                Active Context
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-muted font-mono mt-0.5">@{w.slug}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-xs text-muted truncate">{w.description || "—"}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-foreground/10 text-foreground flex items-center justify-center font-bold text-[10px] border border-border">
                            {w.ownerUser?.name?.[0]?.toUpperCase() || "?"}
                          </div>
                          <span className="font-semibold text-foreground truncate max-w-xs">{w.ownerUser?.name || "—"}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-foreground">{w.memberCount}</td>
                      <td className="py-3 px-4 text-center font-bold text-foreground">{w.activePositionsCount}</td>
                      <td className="py-3 px-4 text-muted font-semibold">
                        {new Date(w.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                          w.status === 'active' ? 'bg-success/10 text-success border-success/20' :
                          w.status === 'archived' ? 'bg-warning/10 text-warning border-warning/20' :
                          'bg-muted/10 text-muted border-muted/20'
                        }`}>
                          {w.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Dropdown>
                          <Button isIconOnly variant="ghost" className="w-8 h-8 rounded-xl cursor-pointer" aria-label="Workspace actions">
                            <MoreVertical size={16} />
                          </Button>
                          <Dropdown.Popover className="bg-overlay border border-border shadow-overlay rounded-xl p-1.5 min-w-[170px] outline-hidden animate-in fade-in duration-100 z-50 font-outfit">
                            <Dropdown.Menu
                              className="text-foreground text-xs p-1"
                              aria-label="Workspace actions menu"
                              onAction={(key) => {
                                if (key === "open") handleOpenWorkspace(w.id);
                                else if (key === "edit") {
                                  setSelectedWorkspace(w);
                                  setIsEditOpen(true);
                                } else if (key === "members") {
                                  setSelectedWorkspace(w);
                                  setIsMembersOpen(true);
                                } else if (key === "transfer") {
                                  setSelectedWorkspace(w);
                                  setIsTransferOpen(true);
                                } else if (key === "archive") {
                                  setArchiveConfirmWorkspace(w);
                                } else if (key === "restore") {
                                  setRestoreConfirmWorkspace(w);
                                } else if (key === "delete") {
                                  setDeleteConfirmWorkspace(w);
                                }
                              }}
                            >
                              <Dropdown.Item
                                id="open"
                                textValue="Open Workspace"
                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer outline-hidden select-none text-foreground hover:bg-surface-secondary focus:bg-surface-secondary"
                              >
                                <ExternalLink size={13} className="text-muted shrink-0" />
                                <Label className="font-semibold text-inherit">Open Workspace</Label>
                              </Dropdown.Item>
                              <Dropdown.Item
                                id="edit"
                                textValue="Edit Settings"
                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer outline-hidden select-none text-foreground hover:bg-surface-secondary focus:bg-surface-secondary"
                              >
                                <Settings size={13} className="text-muted shrink-0" />
                                <Label className="font-semibold text-inherit">Edit Settings</Label>
                              </Dropdown.Item>
                              <Dropdown.Item
                                id="members"
                                textValue="Manage Members"
                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer outline-hidden select-none text-foreground hover:bg-surface-secondary focus:bg-surface-secondary"
                              >
                                <Users size={13} className="text-muted shrink-0" />
                                <Label className="font-semibold text-inherit">Manage Members</Label>
                              </Dropdown.Item>
                              <Dropdown.Item
                                id="transfer"
                                textValue="Transfer Ownership"
                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer outline-hidden select-none text-foreground hover:bg-surface-secondary focus:bg-surface-secondary"
                              >
                                <Key size={13} className="text-muted shrink-0" />
                                <Label className="font-semibold text-inherit">Transfer Ownership</Label>
                              </Dropdown.Item>
                              {w.status !== "archived" ? (
                                <Dropdown.Item
                                  id="archive"
                                  textValue="Archive Workspace"
                                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer outline-hidden select-none text-warning hover:bg-warning/10 focus:bg-warning/10"
                                >
                                  <Archive size={13} className="text-warning shrink-0" />
                                  <Label className="font-semibold text-inherit">Archive Workspace</Label>
                                </Dropdown.Item>
                              ) : (
                                <Dropdown.Item
                                  id="restore"
                                  textValue="Restore Workspace"
                                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer outline-hidden select-none text-success hover:bg-success/10 focus:bg-success/10"
                                >
                                  <RefreshCw size={13} className="text-success shrink-0" />
                                  <Label className="font-semibold text-inherit">Restore Workspace</Label>
                                </Dropdown.Item>
                              )}
                              <Dropdown.Item
                                id="delete"
                                textValue="Delete Workspace"
                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer outline-hidden select-none text-danger hover:bg-danger/10 focus:bg-danger/10"
                              >
                                <Trash2 size={13} className="text-danger shrink-0" />
                                <Label className="font-semibold text-inherit">Delete Workspace</Label>
                              </Dropdown.Item>
                            </Dropdown.Menu>
                          </Dropdown.Popover>
                        </Dropdown>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border/60">
            <PaginationWrapper
              page={page}
              totalPages={totalPages}
              totalItems={totalCount}
              itemsPerPage={pageSize}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        )}
      </Card>

      {/* Create Modal */}
      <CreateWorkspaceModal
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        organizationSlug={organizationSlug}
        onSuccess={() => {
          loadWorkspaces();
          fetchWorkspace(organizationSlug);
        }}
      />

      {/* Edit Modal */}
      <EditWorkspaceModal
        isOpen={isEditOpen}
        onOpenChange={setIsEditOpen}
        organizationSlug={organizationSlug}
        workspace={selectedWorkspace}
        onSuccess={() => {
          loadWorkspaces();
          fetchWorkspace(organizationSlug);
        }}
      />

      {/* Transfer Ownership Modal */}
      <TransferOwnershipModal
        isOpen={isTransferOpen}
        onOpenChange={setIsTransferOpen}
        organizationSlug={organizationSlug}
        workspace={selectedWorkspace}
        onSuccess={() => {
          loadWorkspaces();
          fetchWorkspace(organizationSlug);
        }}
      />

      {/* Manage Members Drawer Modal */}
      <DialogModal
        isOpen={isMembersOpen}
        onOpenChange={setIsMembersOpen}
        title="Manage Workspace Members"
        size="lg"
        footer={null}
      >
        {selectedWorkspace && (
          <WorkspaceMembersManager
            organizationSlug={organizationSlug}
            workspaceId={selectedWorkspace.id}
            workspaceName={selectedWorkspace.displayName}
          />
        )}
      </DialogModal>

      {/* Archive Confirmation AlertDialog */}
      {archiveConfirmWorkspace && (
        <AlertDialog.Backdrop
          isOpen={!!archiveConfirmWorkspace}
          onOpenChange={(open) => {
            if (!open) setArchiveConfirmWorkspace(null);
          }}
        >
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-[400px]">
              {(renderProps) => (
                <>
                  <AlertDialog.CloseTrigger />
                  <AlertDialog.Header>
                    <AlertDialog.Icon status="warning">
                      <AlertTriangle className="size-5 text-warning" />
                    </AlertDialog.Icon>
                    <AlertDialog.Heading>
                      Archive Workspace
                    </AlertDialog.Heading>
                  </AlertDialog.Header>
                  <AlertDialog.Body className="text-sm font-sans font-light leading-relaxed">
                    <p>
                      Are you sure you want to archive the workspace <strong>{archiveConfirmWorkspace.displayName}</strong>?
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      Archiving freezes operational tasks and job listings inside this workspace. You can restore it to active at any time.
                    </p>
                  </AlertDialog.Body>
                  <AlertDialog.Footer>
                    <Button
                      onPress={() => {
                        setArchiveConfirmWorkspace(null);
                        renderProps.close();
                      }}
                      className="rounded-xl bg-transparent border border-border text-foreground hover:bg-surface-secondary text-xs font-bold"
                    >
                      Cancel
                    </Button>
                    <Button
                      onPress={async () => {
                        await handleArchive(archiveConfirmWorkspace);
                        setArchiveConfirmWorkspace(null);
                        renderProps.close();
                      }}
                      className="bg-warning text-white rounded-xl text-xs font-bold"
                    >
                      Archive
                    </Button>
                  </AlertDialog.Footer>
                </>
              )}
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      )}

      {/* Restore Confirmation AlertDialog */}
      {restoreConfirmWorkspace && (
        <AlertDialog.Backdrop
          isOpen={!!restoreConfirmWorkspace}
          onOpenChange={(open) => {
            if (!open) setRestoreConfirmWorkspace(null);
          }}
        >
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-[400px]">
              {(renderProps) => (
                <>
                  <AlertDialog.CloseTrigger />
                  <AlertDialog.Header>
                    <AlertDialog.Icon status="warning">
                      <RefreshCw className="size-5 text-success" />
                    </AlertDialog.Icon>
                    <AlertDialog.Heading>
                      Restore Workspace
                    </AlertDialog.Heading>
                  </AlertDialog.Header>
                  <AlertDialog.Body className="text-sm font-sans font-light leading-relaxed">
                    <p>
                      Are you sure you want to restore the workspace <strong>{restoreConfirmWorkspace.displayName}</strong> to Active status?
                    </p>
                  </AlertDialog.Body>
                  <AlertDialog.Footer>
                    <Button
                      onPress={() => {
                        setRestoreConfirmWorkspace(null);
                        renderProps.close();
                      }}
                      className="rounded-xl bg-transparent border border-border text-foreground hover:bg-surface-secondary text-xs font-bold"
                    >
                      Cancel
                    </Button>
                    <Button
                      onPress={async () => {
                        await handleRestore(restoreConfirmWorkspace);
                        setRestoreConfirmWorkspace(null);
                        renderProps.close();
                      }}
                      className="bg-success text-white rounded-xl text-xs font-bold"
                    >
                      Restore
                    </Button>
                  </AlertDialog.Footer>
                </>
              )}
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      )}

      {/* Delete Confirmation AlertDialog */}
      {deleteConfirmWorkspace && (
        <AlertDialog.Backdrop
          isOpen={!!deleteConfirmWorkspace}
          onOpenChange={(open) => {
            if (!open) setDeleteConfirmWorkspace(null);
          }}
        >
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-[400px]">
              {(renderProps) => (
                <>
                  <AlertDialog.CloseTrigger />
                  <AlertDialog.Header>
                    <AlertDialog.Icon status="danger">
                      <AlertTriangle className="size-5 text-danger" />
                    </AlertDialog.Icon>
                    <AlertDialog.Heading>
                      Delete Workspace
                    </AlertDialog.Heading>
                  </AlertDialog.Header>
                  <AlertDialog.Body className="text-sm font-sans font-light leading-relaxed">
                    <p>
                      Are you sure you want to delete the workspace <strong>{deleteConfirmWorkspace.displayName}</strong>?
                    </p>
                    <p className="mt-2 text-xs text-danger font-semibold">
                      Warning: This soft deletes the workspace. All member assignments and metadata inside this workspace will be inaccessible.
                    </p>
                  </AlertDialog.Body>
                  <AlertDialog.Footer>
                    <Button
                      onPress={() => {
                        setDeleteConfirmWorkspace(null);
                        renderProps.close();
                      }}
                      className="rounded-xl bg-transparent border border-border text-foreground hover:bg-surface-secondary text-xs font-bold"
                    >
                      Cancel
                    </Button>
                    <Button
                      onPress={async () => {
                        await handleDelete(deleteConfirmWorkspace);
                        setDeleteConfirmWorkspace(null);
                        renderProps.close();
                      }}
                      className="bg-danger text-white rounded-xl text-xs font-bold"
                    >
                      Delete
                    </Button>
                  </AlertDialog.Footer>
                </>
              )}
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      )}
    </div>
  );
}
