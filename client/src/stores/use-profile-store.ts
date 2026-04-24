import { create } from 'zustand';
import { profileApi } from '@/services/profile.service';
import {
  type ProfileResponse,
  type UpdateProfileRequest,
  type EducationEntryResponse,
  type EducationEntryRequest,
  type AcademicAchievementResponse,
  type AcademicAchievementRequest,
  type CareerPreferenceResponse,
  type UpdateCareerPreferenceRequest,
  type WorkExperienceRequest,
  type WorkExperienceResponse,
  type CareerPreferencesDashboardResponse,
} from '@/types/profile.types';

interface AxiosErrorLike {
  response?: {
    data?: {
      message?: string;
    };
  };
}

const getErrorMessage = (err: unknown, defaultMessage: string): string => {
  const axiosError = err as AxiosErrorLike;
  return axiosError.response?.data?.message || defaultMessage;
};

interface ProfileState {
  profile: ProfileResponse | null;
  education: EducationEntryResponse[];
  achievements: AcademicAchievementResponse[];
  career: CareerPreferencesDashboardResponse | null;
  loading: Record<string, boolean>;
  fetched: Record<string, boolean>;
  error: string | null;

  fetchProfile: () => Promise<void>;
  updateProfile: (data: UpdateProfileRequest) => Promise<ProfileResponse>;
  updateUsername: (username: string) => Promise<void>;

  fetchEducation: () => Promise<void>;
  addEducation: (data: EducationEntryRequest) => Promise<EducationEntryResponse>;
  updateEducation: (id: string, data: EducationEntryRequest) => Promise<EducationEntryResponse>;
  deleteEducation: (id: string) => Promise<void>;
  reorderEducation: (ids: string[]) => Promise<void>;

  fetchAchievements: () => Promise<void>;
  addAchievement: (data: AcademicAchievementRequest) => Promise<AcademicAchievementResponse>;
  updateAchievement: (id: string, data: AcademicAchievementRequest) => Promise<AcademicAchievementResponse>;
  deleteAchievement: (id: string) => Promise<void>;
  reorderAchievements: (ids: string[]) => Promise<void>;

  workExperiences: WorkExperienceResponse[];
  fetchWorkExperiences: () => Promise<void>;
  addWorkExperience: (data: WorkExperienceRequest) => Promise<WorkExperienceResponse>;
  updateWorkExperience: (id: string, data: WorkExperienceRequest) => Promise<WorkExperienceResponse>;
  deleteWorkExperience: (id: string) => Promise<void>;
  reorderWorkExperiences: (ids: string[]) => Promise<void>;

  fetchCareer: () => Promise<void>;
  updateCareer: (data: UpdateCareerPreferenceRequest) => Promise<CareerPreferencesDashboardResponse>;
  acceptAiSuggestions: (acceptRoles: boolean, acceptSkills: boolean) => Promise<CareerPreferencesDashboardResponse>;
  setError: (error: string | null) => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  education: [],
  achievements: [],
  workExperiences: [],
  career: null,
  loading: {},
  fetched: {},
  error: null,

  setError: (error) => set({ error }),

  fetchProfile: async () => {
    set((state) => ({ loading: { ...state.loading, profile: true }, error: null }));
    try {
      const profile = await profileApi.fetchProfile();
      set((state) => ({ profile, fetched: { ...state.fetched, profile: true } }));
    } catch (err: unknown) {
      set((state) => ({ 
        error: getErrorMessage(err, 'Failed to load profile settings.'),
        fetched: { ...state.fetched, profile: true }
      }));
    } finally {
      set((state) => ({ loading: { ...state.loading, profile: false } }));
    }
  },

  updateProfile: async (data) => {
    set((state) => ({ loading: { ...state.loading, updateProfile: true }, error: null }));
    try {
      const updated = await profileApi.updateProfile(data);
      set({ profile: updated });
      return updated;
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err, 'Failed to update profile settings.');
      set({ error: errMsg });
      throw err;
    } finally {
      set((state) => ({ loading: { ...state.loading, updateProfile: false } }));
    }
  },

  updateUsername: async (username) => {
    set((state) => ({ loading: { ...state.loading, updateUsername: true }, error: null }));
    try {
      await profileApi.updateUsername({ newUsername: username });
      // Update local profile username if loaded
      const currentProfile = get().profile;
      if (currentProfile) {
        set({ profile: { ...currentProfile, username } });
      }
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err, 'Failed to update username.');
      set({ error: errMsg });
      throw err;
    } finally {
      set((state) => ({ loading: { ...state.loading, updateUsername: false } }));
    }
  },

  fetchEducation: async () => {
    console.log('[Zustand Store] fetchEducation triggered');
    set((state) => ({ loading: { ...state.loading, education: true }, error: null }));
    try {
      const education = await profileApi.fetchEducation();
      set((state) => ({ education, fetched: { ...state.fetched, education: true } }));
    } catch (err: unknown) {
      set((state) => ({ 
        error: getErrorMessage(err, 'Failed to load educational history.'),
        fetched: { ...state.fetched, education: true }
      }));
    } finally {
      set((state) => ({ loading: { ...state.loading, education: false } }));
    }
  },

  addEducation: async (data) => {
    set((state) => ({ loading: { ...state.loading, addEducation: true }, error: null }));
    try {
      const newEntry = await profileApi.addEducation(data);
      set((state) => ({ education: [...state.education, newEntry].sort((a, b) => a.displayOrder - b.displayOrder) }));
      return newEntry;
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err, 'Failed to add education entry.');
      set({ error: errMsg });
      throw err;
    } finally {
      set((state) => ({ loading: { ...state.loading, addEducation: false } }));
    }
  },

  updateEducation: async (id, data) => {
    set((state) => ({ loading: { ...state.loading, updateEducation: true }, error: null }));
    try {
      const updated = await profileApi.updateEducation(id, data);
      set((state) => ({
        education: state.education.map((ee) => (ee.id === id ? updated : ee)).sort((a, b) => a.displayOrder - b.displayOrder),
      }));
      return updated;
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err, 'Failed to update education entry.');
      set({ error: errMsg });
      throw err;
    } finally {
      set((state) => ({ loading: { ...state.loading, updateEducation: false } }));
    }
  },

  deleteEducation: async (id) => {
    set((state) => ({ loading: { ...state.loading, deleteEducation: true }, error: null }));
    try {
      await profileApi.deleteEducation(id);
      set((state) => ({ education: state.education.filter((ee) => ee.id !== id) }));
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err, 'Failed to delete education entry.');
      set({ error: errMsg });
      throw err;
    } finally {
      set((state) => ({ loading: { ...state.loading, deleteEducation: false } }));
    }
  },

  reorderEducation: async (ids) => {
    // Optimistic local update
    const currentList = [...get().education];
    const reorderedList = ids
      .map((id, index) => {
        const item = currentList.find((x) => x.id === id);
        return item ? { ...item, displayOrder: index } : null;
      })
      .filter((x): x is EducationEntryResponse => x !== null);

    set({ education: reorderedList });

    try {
      await profileApi.reorderEducation(ids);
    } catch (err: unknown) {
      // Revert on error
      set({ education: currentList, error: getErrorMessage(err, 'Failed to save new education order.') });
      throw err;
    }
  },

  fetchAchievements: async () => {
    console.log('[Zustand Store] fetchAchievements triggered');
    set((state) => ({ loading: { ...state.loading, achievements: true }, error: null }));
    try {
      const achievements = await profileApi.fetchAchievements();
      set((state) => ({ achievements, fetched: { ...state.fetched, achievements: true } }));
    } catch (err: unknown) {
      set((state) => ({ 
        error: getErrorMessage(err, 'Failed to load achievements.'),
        fetched: { ...state.fetched, achievements: true }
      }));
    } finally {
      set((state) => ({ loading: { ...state.loading, achievements: false } }));
    }
  },

  addAchievement: async (data) => {
    set((state) => ({ loading: { ...state.loading, addAchievement: true }, error: null }));
    try {
      const newEntry = await profileApi.addAchievement(data);
      set((state) => ({ achievements: [...state.achievements, newEntry].sort((a, b) => a.displayOrder - b.displayOrder) }));
      return newEntry;
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err, 'Failed to add achievement.');
      set({ error: errMsg });
      throw err;
    } finally {
      set((state) => ({ loading: { ...state.loading, addAchievement: false } }));
    }
  },

  updateAchievement: async (id, data) => {
    set((state) => ({ loading: { ...state.loading, updateAchievement: true }, error: null }));
    try {
      const updated = await profileApi.updateAchievement(id, data);
      set((state) => ({
        achievements: state.achievements.map((aa) => (aa.id === id ? updated : aa)).sort((a, b) => a.displayOrder - b.displayOrder),
      }));
      return updated;
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err, 'Failed to update achievement.');
      set({ error: errMsg });
      throw err;
    } finally {
      set((state) => ({ loading: { ...state.loading, updateAchievement: false } }));
    }
  },

  deleteAchievement: async (id) => {
    set((state) => ({ loading: { ...state.loading, deleteAchievement: true }, error: null }));
    try {
      await profileApi.deleteAchievement(id);
      set((state) => ({ achievements: state.achievements.filter((aa) => aa.id !== id) }));
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err, 'Failed to delete achievement.');
      set({ error: errMsg });
      throw err;
    } finally {
      set((state) => ({ loading: { ...state.loading, deleteAchievement: false } }));
    }
  },

  reorderAchievements: async (ids) => {
    // Optimistic local update
    const currentList = [...get().achievements];
    const reorderedList = ids
      .map((id, index) => {
        const item = currentList.find((x) => x.id === id);
        return item ? { ...item, displayOrder: index } : null;
      })
      .filter((x): x is AcademicAchievementResponse => x !== null);

    set({ achievements: reorderedList });

    try {
      await profileApi.reorderAchievements(ids);
    } catch (err: unknown) {
      // Revert on error
      set({ achievements: currentList, error: getErrorMessage(err, 'Failed to save new achievements order.') });
      throw err;
    }
  },

  fetchWorkExperiences: async () => {
    console.log('[Zustand Store] fetchWorkExperiences triggered');
    set((state) => ({ loading: { ...state.loading, workExperiences: true }, error: null }));
    try {
      const workExperiences = await profileApi.fetchWorkExperience();
      set((state) => ({ workExperiences, fetched: { ...state.fetched, workExperiences: true } }));
    } catch (err: unknown) {
      set((state) => ({
        error: getErrorMessage(err, 'Failed to load work experiences.'),
        fetched: { ...state.fetched, workExperiences: true }
      }));
    } finally {
      set((state) => ({ loading: { ...state.loading, workExperiences: false } }));
    }
  },

  addWorkExperience: async (data) => {
    set((state) => ({ loading: { ...state.loading, addWorkExperience: true }, error: null }));
    try {
      const newEntry = await profileApi.addWorkExperience(data);
      set((state) => ({ workExperiences: [...state.workExperiences, newEntry].sort((a, b) => a.displayOrder - b.displayOrder) }));
      return newEntry;
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err, 'Failed to add work experience entry.');
      set({ error: errMsg });
      throw err;
    } finally {
      set((state) => ({ loading: { ...state.loading, addWorkExperience: false } }));
    }
  },

  updateWorkExperience: async (id, data) => {
    set((state) => ({ loading: { ...state.loading, updateWorkExperience: true }, error: null }));
    try {
      const updated = await profileApi.updateWorkExperience(id, data);
      set((state) => ({
        workExperiences: state.workExperiences.map((we) => (we.id === id ? updated : we)).sort((a, b) => a.displayOrder - b.displayOrder),
      }));
      return updated;
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err, 'Failed to update work experience entry.');
      set({ error: errMsg });
      throw err;
    } finally {
      set((state) => ({ loading: { ...state.loading, updateWorkExperience: false } }));
    }
  },

  deleteWorkExperience: async (id) => {
    set((state) => ({ loading: { ...state.loading, deleteWorkExperience: true }, error: null }));
    try {
      await profileApi.deleteWorkExperience(id);
      set((state) => ({ workExperiences: state.workExperiences.filter((we) => we.id !== id) }));
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err, 'Failed to delete work experience entry.');
      set({ error: errMsg });
      throw err;
    } finally {
      set((state) => ({ loading: { ...state.loading, deleteWorkExperience: false } }));
    }
  },

  reorderWorkExperiences: async (ids) => {
    // Optimistic local update
    const currentList = [...get().workExperiences];
    const reorderedList = ids
      .map((id, index) => {
        const item = currentList.find((x) => x.id === id);
        return item ? { ...item, displayOrder: index } : null;
      })
      .filter((x): x is WorkExperienceResponse => x !== null);

    set({ workExperiences: reorderedList });

    try {
      await profileApi.reorderWorkExperience(ids);
    } catch (err: unknown) {
      // Revert on error
      set({ workExperiences: currentList, error: getErrorMessage(err, 'Failed to save new work experiences order.') });
      throw err;
    }
  },


  fetchCareer: async () => {
    set((state) => ({ loading: { ...state.loading, career: true }, error: null }));
    try {
      const career = await profileApi.fetchCareer();
      set((state) => ({ career, fetched: { ...state.fetched, career: true } }));
    } catch (err: unknown) {
      set((state) => ({ 
        error: getErrorMessage(err, 'Failed to load career preferences.'),
        fetched: { ...state.fetched, career: true }
      }));
    } finally {
      set((state) => ({ loading: { ...state.loading, career: false } }));
    }
  },

  updateCareer: async (data) => {
    set((state) => ({ loading: { ...state.loading, updateCareer: true }, error: null }));
    try {
      const updated = await profileApi.updateCareer(data);
      set({ career: updated });
      return updated;
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err, 'Failed to update career preferences.');
      set({ error: errMsg });
      throw err;
    } finally {
      set((state) => ({ loading: { ...state.loading, updateCareer: false } }));
    }
  },

  acceptAiSuggestions: async (acceptRoles, acceptSkills) => {
    const currentCareer = get().career;
    const version = currentCareer?.declaredPreferences?.version ?? 0;
    set((state) => ({ loading: { ...state.loading, acceptAiSuggestions: true }, error: null }));
    try {
      const updated = await profileApi.acceptAiSuggestions({ acceptRoles, acceptSkills, version });
      set({ career: updated });
      return updated;
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err, 'Failed to accept AI suggestions.');
      set({ error: errMsg });
      throw err;
    } finally {
      set((state) => ({ loading: { ...state.loading, acceptAiSuggestions: false } }));
    }
  },
}));
