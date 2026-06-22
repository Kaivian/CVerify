"use client";

import React, { useState, useEffect } from "react";
import {
  Button,
  Chip,
  Spinner,
  Table,
  Typography,
  toast,
  Checkbox,
  SearchField,
  AlertDialog,
  type Selection
} from "@heroui/react";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import { Card } from "@/components/ui/card";
import { PaginationWrapper } from "@/components/ui/pagination-wrapper";
import {
  Plus,
  Settings,
  FolderOpen,
  Filter,
  ArrowUpDown,
  BookOpen,
  Trash2,
  Archive,
  Send,
  X,
  CheckSquare,
  AlertTriangle
} from "lucide-react";
import { hiringRequirementService, type HiringRequirement } from "@/services/hiring-requirement.service";

interface JdDashboardListProps {
  workspaceId: string;
  onViewRequirement: (req: HiringRequirement) => void;
  onEditRequirement: (req: HiringRequirement) => void;
  onCreateNew: () => void;
  onManageTaxonomy: () => void;
}

export default function JdDashboardList({
  workspaceId,
  onViewRequirement,
  onEditRequirement,
  onCreateNew,
  onManageTaxonomy
}: JdDashboardListProps) {
  // State for paginated data
  const [items, setItems] = useState<HiringRequirement[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState("UpdatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Saved Views
  const [selectedSavedView, setSelectedSavedView] = useState("all");

  // Selection state
  const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set<string>());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // State for delete confirmation AlertDialog
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{ id: string; title: string } | null>(null);

  // Load departments list for filter
  const [departments, setDepartments] = useState<string[]>([]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const response = await hiringRequirementService.getByWorkspaceId(
        workspaceId,
        debouncedSearch || undefined,
        department || undefined,
        status || undefined,
        sortBy,
        sortOrder,
        page,
        pageSize
      );
      
      setItems(response.items);
      setTotalCount(response.totalCount);

      // Extract unique departments for filtering dropdown from loaded items if not set
      if (departments.length === 0 && response.items.length > 0) {
        // Just extract a few standard ones or from the returned list
        const depts = Array.from(new Set(response.items.map(i => i.department).filter(Boolean)));
        setDepartments(depts);
      }
    } catch (err: any) {
      toast.danger("Failed to load hiring requirements");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce search input to avoid duplicate fetching
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Load data when dependencies change
  useEffect(() => {
    Promise.resolve().then(() => {
      loadData();
    });
  }, [workspaceId, page, pageSize, department, status, sortBy, sortOrder, debouncedSearch]);


  const handleSavedViewChange = (viewKey: string) => {
    setSelectedSavedView(viewKey);
    if (viewKey === "all") {
      setStatus("");
      setDepartment("");
    } else if (viewKey === "drafts") {
      setStatus("Draft");
      setDepartment("");
    } else if (viewKey === "published") {
      setStatus("Published");
      setDepartment("");
    } else if (viewKey === "engineering") {
      setStatus("");
      setDepartment("Platform Engineering");
    }
    setPage(1);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const selectedCount = selectedKeys === "all" ? items.length : selectedKeys.size;

  const getSelectedIds = (): string[] => {
    if (selectedKeys === "all") {
      return items.map(i => i.id);
    }
    return Array.from(selectedKeys) as string[];
  };

  const handleBulkPublish = async () => {
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    setIsBulkProcessing(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        const item = items.find(i => i.id === id);
        if (item && item.status.toLowerCase() === "draft") {
          await hiringRequirementService.publish(id);
          successCount++;
        }
      } catch (err) {
        failCount++;
        console.error(`Failed to publish requirement ${id}:`, err);
      }
    }

    setIsBulkProcessing(false);
    setSelectedKeys(new Set<string>());
    loadData();

    if (successCount > 0) {
      toast.success(`Successfully published ${successCount} requirement(s).`);
    }
    if (failCount > 0) {
      toast.danger(`Failed to publish ${failCount} requirement(s).`);
    }
  };

  const handleBulkArchive = async () => {
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    setIsBulkProcessing(true);
    try {
      await hiringRequirementService.bulkArchive(ids);
      toast.success(`Successfully archived ${ids.length} requirement(s).`);
      setSelectedKeys(new Set<string>());
      loadData();
    } catch (err: any) {
      toast.danger(err.message || "Failed to bulk archive hiring requirements.");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    setIsBulkProcessing(true);
    try {
      await hiringRequirementService.bulkDelete(ids);
      toast.success(`Successfully deleted ${ids.length} requirement(s).`);
      setSelectedKeys(new Set<string>());
      loadData();
    } catch (err: any) {
      toast.danger(err.message || "Failed to bulk delete hiring requirements.");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleDeleteSingle = async (id: string) => {
    try {
      await hiringRequirementService.delete(id);
      toast.success("Hiring requirement deleted successfully.");
      loadData();
    } catch (err: any) {
      toast.danger(err.message || "Failed to delete hiring requirement.");
    }
  };

  return (
    <div className="space-y-6 font-outfit text-foreground">
      {/* Search and Filters panel */}
      <Card className="p-5 border border-border/80 bg-surface">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4 mb-4 select-none">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-accent" />
            <span className="text-xs font-bold text-foreground">Filter & Search Requirements</span>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] text-muted font-bold uppercase mr-1">Saved Views:</span>
            <SelectDropdown
              value={selectedSavedView}
              onChange={handleSavedViewChange}
              options={[
                { value: "all", label: "All Requirements" },
                { value: "drafts", label: "Active Drafts" },
                { value: "published", label: "Published Roles" },
                { value: "engineering", label: "Platform Engineering" },
              ]}
              placeholder="Saved Views"
              className="w-48 text-xs font-semibold"
            />

            <Button
              onClick={onManageTaxonomy}
              className="bg-default text-default-foreground hover:bg-surface-secondary border border-border text-[11px] font-bold h-9 px-3.5 rounded-xl cursor-pointer flex items-center gap-1.5"
            >
              <Settings size={14} /> Custom Taxonomy
            </Button>

            <Button
              onClick={onCreateNew}
              className="bg-accent text-accent-foreground text-[11px] font-bold h-9 px-3.5 rounded-xl cursor-pointer flex items-center gap-1.5"
            >
              <Plus size={14} /> Create Requirement
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
          <SearchField
            fullWidth
            value={search}
            onChange={setSearch}
            aria-label="Search by role title"
            className="sm:col-span-2"
          >
            <SearchField.Group className="h-[38px] rounded-xl">
              <SearchField.SearchIcon />
              <SearchField.Input
                placeholder="Search by role title..."
                className="text-xs font-semibold"
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>

          <SelectDropdown
            value={department}
            onChange={(val) => {
              setDepartment(val);
              setPage(1);
            }}
            options={[
              { value: "", label: "All Departments" },
              ...(departments.length > 0
                ? departments.map((d) => ({ value: d, label: d }))
                : [
                    { value: "Platform Engineering", label: "Platform Engineering" },
                    { value: "Web Client Core", label: "Web Client Core" },
                  ]),
            ]}
            placeholder="Select Department"
            className="w-full text-xs font-medium"
          />

          <SelectDropdown
            value={status}
            onChange={(val) => {
              setStatus(val);
              setPage(1);
            }}
            options={[
              { value: "", label: "All Statuses" },
              { value: "Draft", label: "Draft" },
              { value: "Published", label: "Published" },
              { value: "Archived", label: "Archived" },
            ]}
            placeholder="Select Status"
            className="w-full text-xs font-medium"
          />
        </div>
      </Card>

      {/* Bulk actions bar (if rows are selected) */}
      {selectedCount > 0 && (
        <div className="p-3 bg-accent/10 border border-accent/20 rounded-2xl flex items-center justify-between gap-4 select-none animate-fade-in">
          <div className="flex items-center gap-2 text-xs font-bold text-accent">
            <CheckSquare size={16} />
            <span>{selectedCount} item(s) selected</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleBulkPublish}
              isPending={isBulkProcessing}
              className="bg-accent text-accent-foreground text-[10px] font-bold py-1.5 px-3 rounded-lg cursor-pointer flex items-center gap-1"
            >
              <Send size={12} /> Bulk Publish
            </Button>
            <Button
              size="sm"
              onClick={handleBulkArchive}
              className="bg-default text-default-foreground border border-border text-[10px] font-bold py-1.5 px-3 rounded-lg cursor-pointer flex items-center gap-1"
            >
              <Archive size={12} /> Bulk Archive
            </Button>
            <Button
              size="sm"
              onClick={handleBulkDelete}
              className="bg-danger/15 hover:bg-danger/25 text-danger border border-danger/20 text-[10px] font-bold py-1.5 px-3 rounded-lg cursor-pointer flex items-center gap-1"
            >
              <Trash2 size={12} /> Bulk Delete
            </Button>
            <Button
              size="sm"
              onClick={() => setSelectedKeys(new Set())}
              className="bg-transparent text-foreground hover:bg-surface-secondary text-[10px] font-semibold py-1.5 px-2 rounded-lg cursor-pointer"
            >
              <X size={12} /> Clear
            </Button>
          </div>
        </div>
      )}

      {/* Main Table view */}
      {isLoading ? (
        <Card className="p-12 text-center border border-border/60">
          <Spinner size="md" color="warning" />
          <span className="text-xs font-bold text-muted block mt-2">Loading hiring requirements...</span>
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center border border-dashed border-border select-none">
          <div className="size-12 rounded-xl bg-accent/15 text-accent flex items-center justify-center mx-auto mb-4">
            <BookOpen size={24} />
          </div>
          <Typography type="h4" className="font-bold text-foreground mb-1">No Requirements Found</Typography>
          <Typography type="body-xs" className="text-muted max-w-sm mx-auto mb-6">
            Try adjusting your search criteria, selecting another saved view, or create a brand new capability requirement profile.
          </Typography>
          <Button
            onClick={onCreateNew}
            className="bg-accent text-accent-foreground font-bold text-xs px-4 py-2 rounded-xl cursor-pointer"
          >
            Start Intake Wizard
          </Button>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden border border-border bg-surface/80 rounded-2xl shadow-surface">
          <div className="overflow-x-auto">
            <Table aria-label="Hiring Requirements Table" className="w-full">
              <Table.ScrollContainer>
                <Table.Content
                  aria-label="Hiring Requirements Table Content"
                  className="min-w-[800px]"
                  selectedKeys={selectedKeys}
                  selectionMode="multiple"
                  onSelectionChange={setSelectedKeys}
                >
                  <Table.Header>
                    <Table.Column className="w-10 text-center py-4 px-6 text-muted font-extrabold uppercase text-[10px] tracking-wider select-none pr-0">
                      <Checkbox aria-label="Select all" slot="selection">
                        <Checkbox.Content>
                          <Checkbox.Control className="border-2 border-border data-[selected=true]:bg-accent data-[selected=true]:border-accent rounded size-4 before:rounded">
                            <Checkbox.Indicator className="text-accent-foreground size-3" />
                          </Checkbox.Control>
                        </Checkbox.Content>
                      </Checkbox>
                    </Table.Column>
                    <Table.Column isRowHeader className="py-4 px-6 text-muted font-extrabold uppercase text-[10px] tracking-wider">
                      <button
                        type="button"
                        onClick={() => handleSort("Title")}
                        className="flex items-center gap-1 hover:text-foreground font-bold cursor-pointer"
                      >
                        Role Title <ArrowUpDown size={11} />
                      </button>
                    </Table.Column>
                    <Table.Column className="py-4 px-6 text-muted font-extrabold uppercase text-[10px] tracking-wider">
                      <button
                        type="button"
                        onClick={() => handleSort("Department")}
                        className="flex items-center gap-1 hover:text-foreground font-bold cursor-pointer"
                      >
                        Department <ArrowUpDown size={11} />
                      </button>
                    </Table.Column>
                    <Table.Column className="py-4 px-6 text-muted font-extrabold uppercase text-[10px] tracking-wider">
                      <button
                        type="button"
                        onClick={() => handleSort("Seniority")}
                        className="flex items-center gap-1 hover:text-foreground font-bold cursor-pointer"
                      >
                        Seniority <ArrowUpDown size={11} />
                      </button>
                    </Table.Column>
                    <Table.Column className="py-4 px-6 text-muted font-extrabold uppercase text-[10px] tracking-wider">
                      <button
                        type="button"
                        onClick={() => handleSort("Status")}
                        className="flex items-center gap-1 hover:text-foreground font-bold cursor-pointer"
                      >
                        Status <ArrowUpDown size={11} />
                      </button>
                    </Table.Column>
                    <Table.Column className="py-4 px-6 text-muted font-extrabold uppercase text-[10px] tracking-wider">Version</Table.Column>
                    <Table.Column className="py-4 px-6 text-muted font-extrabold uppercase text-[10px] tracking-wider">
                      <button
                        type="button"
                        onClick={() => handleSort("UpdatedAt")}
                        className="flex items-center gap-1 hover:text-foreground font-bold cursor-pointer"
                      >
                        Last Updated <ArrowUpDown size={11} />
                      </button>
                    </Table.Column>
                    <Table.Column className="py-4 px-6 text-muted font-extrabold uppercase text-[10px] tracking-wider text-right pr-6">Actions</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {items.map((req) => (
                      <Table.Row key={req.id} id={req.id} className="border-b border-separator last:border-none hover:bg-surface-secondary/40 transition-colors">
                        <Table.Cell className="py-4 px-6 text-center select-none pr-0">
                          <Checkbox aria-label={`Select ${req.title}`} slot="selection">
                            <Checkbox.Content>
                              <Checkbox.Control className="border-2 border-border data-[selected=true]:bg-accent data-[selected=true]:border-accent rounded size-4 before:rounded">
                                <Checkbox.Indicator className="text-accent-foreground size-3" />
                              </Checkbox.Control>
                            </Checkbox.Content>
                          </Checkbox>
                        </Table.Cell>
                        <Table.Cell className="font-bold text-xs py-4 px-6 text-foreground">{req.title}</Table.Cell>
                        <Table.Cell className="font-semibold text-xs py-4 px-6 text-foreground/80">{req.department}</Table.Cell>
                        <Table.Cell className="font-medium text-xs py-4 px-6 text-muted">{req.seniority}</Table.Cell>
                        <Table.Cell className="py-4 px-6 select-none">
                          <Chip
                            size="sm"
                            variant="soft"
                            className={
                              req.status.toLowerCase() === "published"
                                ? "bg-success/15 border border-success/30 text-success font-bold"
                                : req.status.toLowerCase() === "archived"
                                ? "bg-muted/20 border border-muted/30 text-muted font-bold"
                                : "bg-default/20 text-foreground font-semibold"
                            }
                          >
                            {req.status}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell className="font-mono font-bold text-xs py-4 px-6 text-accent">v{req.version}</Table.Cell>
                        <Table.Cell className="text-muted font-medium text-xs py-4 px-6">
                          {new Date(req.updatedAt).toLocaleDateString()}
                        </Table.Cell>
                        <Table.Cell className="py-4 px-6 text-right pr-6">
                          <div className="flex justify-end gap-2">
                            {req.status.toLowerCase() === "draft" && (
                              <Button
                                size="sm"
                                onClick={() => onEditRequirement(req)}
                                className="bg-default text-default-foreground hover:bg-surface-tertiary border border-border text-[10px] font-bold rounded-lg px-2.5 py-1.5 cursor-pointer"
                              >
                                Edit Draft
                              </Button>
                            )}
                            <Button
                              size="sm"
                              onClick={() => onViewRequirement(req)}
                              className="bg-accent text-accent-foreground text-[10px] font-bold rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1"
                            >
                              View Details
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setDeleteConfirmItem({ id: req.id, title: req.title })}
                              className="bg-danger/15 hover:bg-danger/25 text-danger border border-danger/20 text-[10px] font-bold rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1"
                            >
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </div>

          {/* Pagination controls */}
          <div className="p-4 bg-surface-secondary/30 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted">
              <span>Show</span>
              <SelectDropdown
                value={String(pageSize)}
                onChange={(val) => {
                  setPageSize(parseInt(val));
                  setPage(1);
                }}
                options={[
                  { value: "5", label: "5" },
                  { value: "10", label: "10" },
                  { value: "20", label: "20" },
                ]}
                placeholder="Show per page"
                className="w-20"
              />
              <span>per page</span>
              <span className="mx-2">&bull;</span>
              <span>Total: {totalCount} requirements</span>
            </div>

            <div className="flex-1 max-w-md flex justify-end">
              <PaginationWrapper
                page={page}
                totalPages={Math.max(1, Math.ceil(totalCount / pageSize))}
                totalItems={totalCount}
                itemsPerPage={pageSize}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          </div>
        </Card>
      )}

      {deleteConfirmItem && (
        <AlertDialog.Backdrop
          isOpen={!!deleteConfirmItem}
          onOpenChange={(open) => {
            if (!open) setDeleteConfirmItem(null);
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
                      Delete Hiring Requirement
                    </AlertDialog.Heading>
                  </AlertDialog.Header>
                  <AlertDialog.Body className="text-sm font-sans font-light leading-relaxed">
                    <p>
                      Are you sure you want to delete &ldquo;<strong>{deleteConfirmItem.title}</strong>&rdquo;?
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      This action will simulate the removal of this Job Description from your active dashboard.
                    </p>
                  </AlertDialog.Body>
                  <AlertDialog.Footer>
                    <Button
                      variant="tertiary"
                      onPress={() => {
                        setDeleteConfirmItem(null);
                        renderProps.close();
                      }}
                      className="rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      onPress={() => {
                        handleDeleteSingle(deleteConfirmItem.id);
                        setDeleteConfirmItem(null);
                        renderProps.close();
                      }}
                      className="bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 rounded-xl font-semibold animate-none"
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
