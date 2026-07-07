export interface CvMetadata {
  templateId: string;
  templateVersion: number;
}

export const cvMetadataService = {
  getMetadata(cvId: string = "default"): CvMetadata {
    try {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(`cverify_cv_meta_${cvId}`);
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch (e) {
      console.error("Failed to read CV metadata:", e);
    }
    return { templateId: "professional", templateVersion: 1 };
  },

  saveMetadata(cvId: string = "default", meta: CvMetadata): void {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(`cverify_cv_meta_${cvId}`, JSON.stringify(meta));
      }
    } catch (e) {
      console.error("Failed to save CV metadata:", e);
    }
  }
};
