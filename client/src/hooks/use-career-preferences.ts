import { useEffect } from 'react';
import { useProfileStore } from '@/stores/use-profile-store';

export function useCareerPreferences() {
  const {
    career,
    loading,
    fetched,
    error,
    fetchCareer,
    updateCareer,
    setError
  } = useProfileStore();

  useEffect(() => {
    if (!fetched.career && !loading.career) {
      fetchCareer();
    }
  }, [fetched.career, fetchCareer, loading.career]);

  return {
    career,
    isLoading: !!loading.career,
    isUpdating: !!loading.updateCareer,
    error,
    refreshCareer: fetchCareer,
    updateCareer,
    clearError: () => setError(null)
  };
}
