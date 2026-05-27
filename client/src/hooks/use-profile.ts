import { useEffect } from 'react';
import { useProfileStore } from '@/stores/use-profile-store';

export function useProfile() {
  const { 
    profile, 
    loading, 
    fetched,
    error, 
    fetchProfile, 
    updateProfile, 
    updateUsername,
    setError
  } = useProfileStore();

  useEffect(() => {
    if (!fetched.profile && !loading.profile) {
      fetchProfile();
    }
  }, [fetched.profile, fetchProfile, loading.profile]);

  return {
    profile,
    isLoading: !!loading.profile,
    isFetched: !!fetched.profile,
    isUpdating: !!loading.updateProfile,
    isUpdatingUsername: !!loading.updateUsername,
    error,
    refreshProfile: fetchProfile,
    updateProfile,
    updateUsername,
    clearError: () => setError(null)
  };
}
