import { useState, useCallback } from 'react';
import { profileApi } from '@/services/profile.service';
import { type AttachmentResponse } from '@/types/profile.types';

export interface UploadProgress {
  fileName: string;
  loaded: number;
  total: number;
  progress: number; // 0 to 100
  status: 'idle' | 'uploading' | 'success' | 'failed';
  error?: string;
  result?: AttachmentResponse;
}

export function useAttachmentUpload() {
  const [uploads, setUploads] = useState<Record<string, UploadProgress>>({});

  const uploadFile = useCallback(async (file: File, entityType: string, entityId?: string) => {
    const fileKey = `${file.name}-${Date.now()}`;
    
    setUploads((prev) => ({
      ...prev,
      [fileKey]: {
        fileName: file.name,
        loaded: 0,
        total: file.size,
        progress: 0,
        status: 'uploading',
      },
    }));

    try {
      const result = await profileApi.uploadEvidence(file, entityType, entityId, (progressEvent) => {
        const loaded = progressEvent.loaded;
        const total = progressEvent.total ?? file.size;
        const progress = Math.round((loaded * 100) / total);

        setUploads((prev) => {
          if (!prev[fileKey]) return prev;
          return {
            ...prev,
            [fileKey]: {
              ...prev[fileKey],
              loaded,
              total,
              progress,
            },
          };
        });
      });

      setUploads((prev) => {
        if (!prev[fileKey]) return prev;
        return {
          ...prev,
          [fileKey]: {
            ...prev[fileKey],
            progress: 100,
            status: 'success',
            result,
          },
        };
      });

      return result;
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'File upload failed.';
      setUploads((prev) => {
        if (!prev[fileKey]) return prev;
        return {
          ...prev,
          [fileKey]: {
            ...prev[fileKey],
            status: 'failed',
            error: errMsg,
          },
        };
      });
      throw err;
    }
  }, []);

  const clearUpload = useCallback((fileKey: string) => {
    setUploads((prev) => {
      const next = { ...prev };
      delete next[fileKey];
      return next;
    });
  }, []);

  return {
    uploads,
    uploadFile,
    clearUpload,
  };
}
export type UseAttachmentUploadType = ReturnType<typeof useAttachmentUpload>;
