import { useEffect } from 'react';
import { useProfileStore } from '@/stores/use-profile-store';

export function useEducation() {
  const {
    education,
    loading,
    fetched,
    error,
    fetchEducation,
    addEducation,
    updateEducation,
    deleteEducation,
    reorderEducation,
    setError
  } = useProfileStore();

  useEffect(() => {
    if (!fetched.education && !loading.education) {
      fetchEducation();
    }
  }, [fetched.education, fetchEducation, loading.education]);

  return {
    education,
    isLoading: !!loading.education,
    isAdding: !!loading.addEducation,
    isUpdating: !!loading.updateEducation,
    isDeleting: !!loading.deleteEducation,
    error,
    refreshEducation: fetchEducation,
    addEducation,
    updateEducation,
    deleteEducation,
    reorderEducation,
    clearError: () => setError(null)
  };
}
