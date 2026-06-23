import { useMemo } from 'react';
import { useWorkspaceStore } from '../store/use-workspace-store';

export const useActiveWorkspace = (orgSlug: string) => {
  const activeWorkspaceIds = useWorkspaceStore((s) => s.activeWorkspaceIds || {});
  const setActiveWorkspaceIdInStore = useWorkspaceStore((s) => s.setActiveWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces[orgSlug]?.workspaces || []);

  const activeWorkspaceId = useMemo(() => {
    const storeActive = activeWorkspaceIds[orgSlug];
    if (storeActive && workspaces.some((w) => w.id === storeActive)) {
      return storeActive;
    }
    if (typeof window !== 'undefined') {
      const localActive = localStorage.getItem(`cverify:active-workspace:${orgSlug}`);
      if (localActive && workspaces.some((w) => w.id === localActive)) {
        return localActive;
      }
    }
    return workspaces[0]?.id || null;
  }, [orgSlug, activeWorkspaceIds, workspaces]);

  const setActiveWorkspaceId = (id: string) => {
    setActiveWorkspaceIdInStore?.(orgSlug, id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`cverify:active-workspace:${orgSlug}`, id);
    }
  };

  return { activeWorkspaceId, setActiveWorkspaceId, workspaces };
};
