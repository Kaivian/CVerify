import React, { useRef, useState, useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button, Typography, Label, FieldError } from "@heroui/react";
import { PersonalInfoFormValues, EvidenceFile } from "./types";

interface UploadDropzoneProps {
  achievementIndex: number;
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  achievementIndex,
}) => {
  const { control, setValue, getValues } =
    useFormContext<PersonalInfoFormValues>();
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep actual File instances completely out of RHF state to ensure form is 100% serializable
  const fileInstancesRef = useRef<Record<string, File>>({});
  
  // Track active intervals to clean them up properly and prevent memory leaks
  const intervalsRef = useRef<Record<string, NodeJS.Timeout>>({});

  const evidence =
    useWatch({
      control,
      name: `achievements.${achievementIndex}.evidence`,
    }) || [];

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      Object.values(intervalsRef.current).forEach((interval) =>
        clearInterval(interval)
      );
    };
  }, []);

  const triggerMockUpload = (fileId: string) => {
    // Clear any existing timer for this file
    if (intervalsRef.current[fileId]) {
      clearInterval(intervalsRef.current[fileId]);
    }

    let progress = 0;
    
    // Simulate gradual progress ticking
    const interval = setInterval(() => {
      const currentEvidence =
        getValues(`achievements.${achievementIndex}.evidence`) || [];
      const fileIndex = currentEvidence.findIndex((f) => f.id === fileId);

      if (fileIndex === -1) {
        // File has been removed during upload, cancel timer
        clearInterval(interval);
        delete intervalsRef.current[fileId];
        return;
      }

      progress += Math.floor(Math.random() * 15) + 8; // Tick up between 8% and 23%
      
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        delete intervalsRef.current[fileId];

        // Mark as success
        const updated = [...currentEvidence];
        updated[fileIndex] = {
          ...updated[fileIndex],
          progress: 100,
          status: "success",
        };

        setValue(`achievements.${achievementIndex}.evidence`, updated, {
          shouldDirty: true,
          shouldValidate: true,
        });
      } else {
        // Update progress
        const updated = [...currentEvidence];
        updated[fileIndex] = {
          ...updated[fileIndex],
          progress,
        };

        setValue(`achievements.${achievementIndex}.evidence`, updated, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    }, 200);

    intervalsRef.current[fileId] = interval;
  };

  const handleFilesUpload = (files: FileList | File[]) => {
    const validFiles: EvidenceFile[] = [];
    const currentEvidence =
      getValues(`achievements.${achievementIndex}.evidence`) || [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isAccepted = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/webp",
      ].includes(file.type);

      if (!isAccepted) {
        alert(
          `File type ${file.type || "unknown"} is not supported. Please upload PDF, PNG, JPG, or WEBP.`
        );
        continue;
      }

      // Max size: 5MB
      if (file.size > 5 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Max size is 5MB.`);
        continue;
      }

      const id = `ev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Store actual File instance in local Ref mapping
      fileInstancesRef.current[id] = file;

      // Local object URL for preview purposes (strictly string representation in state)
      const objectUrl = URL.createObjectURL(file);

      validFiles.push({
        id,
        name: file.name,
        size: file.size,
        type: file.type,
        progress: 0,
        status: "uploading",
        url: objectUrl,
      });
    }

    if (validFiles.length === 0) return;

    const updatedEvidence = [...currentEvidence, ...validFiles];
    setValue(`achievements.${achievementIndex}.evidence`, updatedEvidence, {
      shouldDirty: true,
      shouldValidate: true,
    });

    // Fire off mock upload simulation for each file
    validFiles.forEach((fileInfo) => {
      triggerMockUpload(fileInfo.id);
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFilesUpload(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFilesUpload(e.target.files);
    }
  };

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      triggerFilePicker();
    }
  };

  const handleCancelUpload = (fileId: string) => {
    // Abort active simulation timer
    if (intervalsRef.current[fileId]) {
      clearInterval(intervalsRef.current[fileId]);
      delete intervalsRef.current[fileId];
    }

    const current =
      getValues(`achievements.${achievementIndex}.evidence`) || [];
    const targetFile = current.find((f) => f.id === fileId);

    // Clean up local resources (Object URLs) to prevent leaks
    if (targetFile?.url) {
      URL.revokeObjectURL(targetFile.url);
    }
    delete fileInstancesRef.current[fileId];

    // Remove from form state
    setValue(
      `achievements.${achievementIndex}.evidence`,
      current.filter((f) => f.id !== fileId),
      { shouldDirty: true, shouldValidate: true }
    );
  };

  const handleRetryUpload = (fileId: string) => {
    const current =
      getValues(`achievements.${achievementIndex}.evidence`) || [];
    const fileIndex = current.findIndex((f) => f.id === fileId);

    if (fileIndex !== -1) {
      const updated = [...current];
      updated[fileIndex] = {
        ...updated[fileIndex],
        progress: 0,
        status: "uploading",
      };

      setValue(`achievements.${achievementIndex}.evidence`, updated, {
        shouldDirty: true,
        shouldValidate: true,
      });

      triggerMockUpload(fileId);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    handleCancelUpload(fileId);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <Label className="text-xs font-semibold text-foreground/80">
        Evidence & Verification Files
      </Label>

      {/* Accessible Drag & Drop Zone Container */}
      <div
        tabIndex={0}
        role="button"
        aria-label="Upload evidence files. Drag and drop PDF, PNG, JPG, or WEBP files here, or press enter to browse."
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFilePicker}
        onKeyDown={handleKeyDown}
        className={[
          "relative border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 select-none outline-hidden",
          isDragActive
            ? "border-primary bg-primary/10 scale-[0.99] ring-2 ring-primary/30"
            : "border-border hover:border-primary/60 hover:bg-surface-secondary/50",
          "focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary",
        ].join(" ")}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          onChange={handleFileChange}
          aria-hidden="true"
        />

        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-surface border border-border/80 rounded-xl shadow-xs">
            <Upload className="size-6 text-muted-foreground/80 animate-pulse" />
          </div>
          <div>
            <Typography className="text-sm font-semibold text-foreground">
              Drag & drop evidence here, or{" "}
              <span className="text-primary font-semibold hover:underline">
                browse
              </span>
            </Typography>
            <Typography className="text-xs text-muted-foreground mt-1.5 font-medium">
              Supports PDF, PNG, JPG, or WEBP (Max 5MB)
            </Typography>
          </div>
        </div>
      </div>

      {/* Uploaded File List and Previews */}
      {evidence.length > 0 && (
        <div className="flex flex-col gap-3 w-full bg-surface-secondary/20 p-4 border border-border/40 rounded-2xl mt-1">
          <Typography className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-1">
            Attached Evidence ({evidence.length})
          </Typography>

          <div className="flex flex-col gap-2.5">
            {evidence.map((file) => {
              const isImage = file.type.startsWith("image/");
              
              return (
                <div
                  key={file.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-surface border border-border/50 rounded-xl gap-3 shadow-xs hover:border-border transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Thumbnail Preview Area */}
                    <div className="relative size-10 rounded-lg overflow-hidden border border-border/40 bg-surface flex items-center justify-center shrink-0">
                      {isImage && file.url ? (
                        // Render instant crisp high-fidelity thumbnail preview
                        <img
                          src={file.url}
                          alt={file.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        // Document Preview icon for PDF/Text
                        <FileText className="size-5 text-danger" />
                      )}
                    </div>

                    {/* Filename & Info */}
                    <div className="flex flex-col min-w-0 text-left">
                      <Typography className="text-xs font-bold text-foreground truncate max-w-[200px] sm:max-w-[320px]">
                        {file.name}
                      </Typography>
                      <Typography className="text-[10px] text-muted-foreground font-medium mt-0.5">
                        {formatFileSize(file.size)}
                      </Typography>
                    </div>
                  </div>

                  {/* Actions / Status Indicators */}
                  <div className="flex items-center gap-3 self-end sm:self-auto select-none">
                    {/* Progress Bar & Badges */}
                    {file.status === "uploading" && (
                      <div className="flex items-center gap-2.5">
                        <div className="flex flex-col items-end min-w-[70px]">
                          <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                            <Loader2 className="size-3 animate-spin shrink-0" />
                            {file.progress}%
                          </span>
                          {/* Slim, smooth progress indicator */}
                          <div className="w-16 bg-muted rounded-full h-1 overflow-hidden mt-1">
                            <div
                              className="bg-primary h-full transition-all duration-300 rounded-full"
                              style={{ width: `${file.progress}%` }}
                            />
                          </div>
                        </div>
                        <Button
                          isIconOnly
                          variant="ghost"
                          className="h-7 w-7 min-w-7 rounded-lg text-muted-foreground hover:text-foreground"
                          aria-label={`Cancel uploading ${file.name}`}
                          onPress={() => handleCancelUpload(file.id)}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    )}

                    {file.status === "success" && (
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] font-bold text-success flex items-center gap-1.5 px-2.5 py-1 bg-success/10 border border-success/15 rounded-full uppercase tracking-wider">
                          <CheckCircle className="size-3 shrink-0" />
                          Ready
                        </span>
                        <Button
                          isIconOnly
                          variant="ghost"
                          className="h-7 w-7 min-w-7 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/5"
                          aria-label={`Remove ${file.name}`}
                          onPress={() => handleRemoveFile(file.id)}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    )}

                    {file.status === "failed" && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-danger flex items-center gap-1 px-2.5 py-1 bg-danger/10 border border-danger/15 rounded-full uppercase tracking-wider">
                          <AlertCircle className="size-3 shrink-0" />
                          Failed
                        </span>
                        <Button
                          isIconOnly
                          variant="ghost"
                          className="h-7 w-7 min-w-7 rounded-lg text-muted-foreground hover:text-foreground"
                          aria-label={`Retry uploading ${file.name}`}
                          onPress={() => handleRetryUpload(file.id)}
                        >
                          <RefreshCw className="size-3" />
                        </Button>
                        <Button
                          isIconOnly
                          variant="ghost"
                          className="h-7 w-7 min-w-7 rounded-lg text-muted-foreground hover:text-danger"
                          aria-label={`Remove ${file.name}`}
                          onPress={() => handleRemoveFile(file.id)}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadDropzone;
