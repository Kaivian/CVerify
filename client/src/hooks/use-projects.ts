import { useEffect } from 'react';
import { useProfileStore } from '@/stores/use-profile-store';

export function useProjects() {
  const {
    projects,
    loading,
    fetched,
    error,
    fetchProjects,
    addProject,
    updateProject,
    deleteProject,
    reorderProjects,
    setError
  } = useProfileStore();

  useEffect(() => {
    if (!fetched.projects && !loading.projects) {
      fetchProjects();
    }
  }, [fetched.projects, fetchProjects, loading.projects]);

  return {
    projects,
    isLoading: !!loading.projects,
    isFetched: !!fetched.projects,
    isAdding: !!loading.addProject,
    isUpdating: !!loading.updateProject,
    isDeleting: !!loading.deleteProject,
    error,
    refreshProjects: fetchProjects,
    addProject,
    updateProject,
    deleteProject,
    reorderProjects,
    clearError: () => setError(null)
  };
}
