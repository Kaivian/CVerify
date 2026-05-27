import { useEffect } from 'react';
import { useProfileStore } from '@/stores/use-profile-store';

export function useAchievements() {
  const {
    achievements,
    loading,
    fetched,
    error,
    fetchAchievements,
    addAchievement,
    updateAchievement,
    deleteAchievement,
    reorderAchievements,
    setError
  } = useProfileStore();

  useEffect(() => {
    if (!fetched.achievements && !loading.achievements) {
      fetchAchievements();
    }
  }, [fetched.achievements, fetchAchievements, loading.achievements]);

  return {
    achievements,
    isLoading: !!loading.achievements,
    isFetched: !!fetched.achievements,
    isAdding: !!loading.addAchievement,
    isUpdating: !!loading.updateAchievement,
    isDeleting: !!loading.deleteAchievement,
    error,
    refreshAchievements: fetchAchievements,
    addAchievement,
    updateAchievement,
    deleteAchievement,
    reorderAchievements,
    clearError: () => setError(null)
  };
}
