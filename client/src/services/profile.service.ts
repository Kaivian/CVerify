import { axiosClient } from './axios-client';
import {
  type ProfileResponse,
  type UpdateProfileRequest,
  type UpdateUsernameRequest,
  type EducationEntryResponse,
  type EducationEntryRequest,
  type AcademicAchievementResponse,
  type AcademicAchievementRequest,
  type CareerPreferenceResponse,
  type UpdateCareerPreferenceRequest,
  type AttachmentResponse,
} from '../types/profile.types';

export const profileApi = {
  // General Profile Settings
  fetchProfile: async (): Promise<ProfileResponse> => {
    const response = await axiosClient.get<ProfileResponse>('/v1/users/profile');
    return response.data;
  },

  updateProfile: async (data: UpdateProfileRequest): Promise<ProfileResponse> => {
    const response = await axiosClient.put<ProfileResponse>('/v1/users/profile', data);
    return response.data;
  },

  updateUsername: async (data: UpdateUsernameRequest): Promise<void> => {
    await axiosClient.put('/v1/users/profile/username', data);
  },

  // Education history CRUD & display orders
  fetchEducation: async (): Promise<EducationEntryResponse[]> => {
    const response = await axiosClient.get<EducationEntryResponse[]>('/v1/users/education');
    return response.data;
  },

  addEducation: async (data: EducationEntryRequest): Promise<EducationEntryResponse> => {
    const response = await axiosClient.post<EducationEntryResponse>('/v1/users/education', data);
    return response.data;
  },

  updateEducation: async (id: string, data: EducationEntryRequest): Promise<EducationEntryResponse> => {
    const response = await axiosClient.put<EducationEntryResponse>(`/v1/users/education/${id}`, data);
    return response.data;
  },

  deleteEducation: async (id: string): Promise<void> => {
    await axiosClient.delete(`/v1/users/education/${id}`);
  },

  reorderEducation: async (orderedIds: string[]): Promise<void> => {
    await axiosClient.put('/v1/users/education/reorder', { orderedIds });
  },

  // Academic Achievements / Certifications CRUD
  fetchAchievements: async (): Promise<AcademicAchievementResponse[]> => {
    const response = await axiosClient.get<AcademicAchievementResponse[]>('/v1/users/achievements');
    return response.data;
  },

  addAchievement: async (data: AcademicAchievementRequest): Promise<AcademicAchievementResponse> => {
    const response = await axiosClient.post<AcademicAchievementResponse>('/v1/users/achievements', data);
    return response.data;
  },

  updateAchievement: async (id: string, data: AcademicAchievementRequest): Promise<AcademicAchievementResponse> => {
    const response = await axiosClient.put<AcademicAchievementResponse>(`/v1/users/achievements/${id}`, data);
    return response.data;
  },

  deleteAchievement: async (id: string): Promise<void> => {
    await axiosClient.delete(`/v1/users/achievements/${id}`);
  },

  reorderAchievements: async (orderedIds: string[]): Promise<void> => {
    await axiosClient.put('/v1/users/achievements/reorder', { orderedIds });
  },

  // Career hiring availability and localizations
  fetchCareer: async (): Promise<CareerPreferenceResponse> => {
    const response = await axiosClient.get<CareerPreferenceResponse>('/v1/users/career');
    return response.data;
  },

  updateCareer: async (data: UpdateCareerPreferenceRequest): Promise<CareerPreferenceResponse> => {
    const response = await axiosClient.put<CareerPreferenceResponse>('/v1/users/career', data);
    return response.data;
  },

  // Evidence attachments upload and delete
  uploadEvidence: async (
    file: File, 
    entityType: string, 
    entityId?: string, 
    onUploadProgress?: (progressEvent: { loaded: number; total?: number }) => void
  ): Promise<AttachmentResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', entityType);
    if (entityId) {
      formData.append('entityId', entityId);
    }

    const response = await axiosClient.post<AttachmentResponse>('/v1/users/evidence/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress) {
          onUploadProgress({
            loaded: progressEvent.loaded,
            total: progressEvent.total ?? undefined,
          });
        }
      },
    });
    return response.data;
  },

  deleteEvidence: async (id: string): Promise<void> => {
    await axiosClient.delete(`/v1/users/evidence/${id}`);
  },
};
