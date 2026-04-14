import { useEffect } from 'react';
import { useProfileStore } from '@/stores/use-profile-store';

export function useWorkExperience() {
  const {
    workExperiences,
    loading,
    fetched,
    error,
    fetchWorkExperiences,
    addWorkExperience,
    updateWorkExperience,
    deleteWorkExperience,
    reorderWorkExperiences,
    setError
  } = useProfileStore();

  useEffect(() => {
    if (!fetched.workExperiences && !loading.workExperiences) {
      fetchWorkExperiences();
    }
  }, [fetched.workExperiences, fetchWorkExperiences, loading.workExperiences]);

  return {
    workExperiences,
    isLoading: !!loading.workExperiences,
    isFetched: !!fetched.workExperiences,
    isAdding: !!loading.addWorkExperience,
    isUpdating: !!loading.updateWorkExperience,
    isDeleting: !!loading.deleteWorkExperience,
    error,
    refreshWorkExperiences: fetchWorkExperiences,
    addWorkExperience,
    updateWorkExperience,
    deleteWorkExperience,
    reorderWorkExperiences,
    clearError: () => setError(null)
  };
}
