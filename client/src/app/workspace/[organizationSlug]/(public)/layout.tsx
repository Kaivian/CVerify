"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/features/workspace/store/use-workspace-store";
import { Card } from "@/components/ui/card";
import { Typography, Chip, toast } from "@heroui/react";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Briefcase, ShieldCheck, AlertTriangle, Share2, Plus, Check, Camera } from "lucide-react";
import { SkeletonLoader } from "@/components/ui/states";
import Link from "next/link";
import { ImageCropperModal } from "@/components/ui/image-cropper-modal";
import { validateImageDimensions } from "@/lib/utils/image-crop.utils";
import { workspaceService } from "@/features/workspace/services/workspace.service";

export default function PublicWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  const fetchWorkspace = useWorkspaceStore((s) => s.fetchWorkspace);
  const workspaceDetails = useWorkspaceStore((s) => s.workspaces[organizationSlug]);
  const isDetailsLoading = useWorkspaceStore((s) => s.loading[organizationSlug]);
  const detailsError = useWorkspaceStore((s) => s.errors[organizationSlug]);
  const toggleFollowWorkspace = useWorkspaceStore((s) => s.toggleFollowWorkspace);

  const [shareSuccess, setShareSuccess] = useState(false);

  // Profile/Banner upload states & refs
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  
  const [cropperType, setCropperType] = useState<"avatar" | "banner" | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lastSelectedFile, setLastSelectedFile] = useState<File | null>(null);

  const canManageProfile = workspaceDetails?.permissions?.includes("organization:profile:edit");

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.danger("File size exceeds the maximum allowed limit of 2MB.");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      toast.danger("Only JPEG, PNG, WebP, and GIF images are supported.");
      return;
    }

    try {
      await validateImageDimensions(file, 1152, 208);
      setLastSelectedFile(file);
      setCropperType("banner");
      const objectUrl = URL.createObjectURL(file);
      setCropImageSrc(objectUrl);
      setIsCropModalOpen(true);
    } catch (err: unknown) {
      toast.danger(typeof err === "string" ? err : "Selected image does not meet size requirements (min 1152x208px).");
    } finally {
      if (bannerInputRef.current) {
        bannerInputRef.current.value = "";
      }
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.danger("File size exceeds the maximum allowed limit of 2MB.");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      toast.danger("Only JPEG, PNG, WebP, and GIF images are supported.");
      return;
    }

    try {
      await validateImageDimensions(file, 256, 256);
      setLastSelectedFile(file);
      setCropperType("avatar");
      const objectUrl = URL.createObjectURL(file);
      setCropImageSrc(objectUrl);
      setIsCropModalOpen(true);
    } catch (err: unknown) {
      toast.danger(typeof err === "string" ? err : "Selected image does not meet size requirements (min 256x256px).");
    } finally {
      if (logoInputRef.current) {
        logoInputRef.current.value = "";
      }
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setIsCropModalOpen(false);
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
    }

    const fileExt = lastSelectedFile
      ? lastSelectedFile.name.split(".").pop()
      : "jpg";
    const originalName = lastSelectedFile
      ? lastSelectedFile.name.substring(0, lastSelectedFile.name.lastIndexOf("."))
      : "image";
    const croppedFile = new File(
      [croppedBlob],
      `${originalName}_cropped.${fileExt}`,
      { type: "image/jpeg" }
    );

    setIsUploading(true);
    setUploadProgress(0);

    try {
      if (cropperType === "banner") {
        const result = await workspaceService.uploadBanner(organizationSlug, croppedFile);
        useWorkspaceStore.getState().updateWorkspaceDetails(organizationSlug, {
          bannerUrl: result.avatarUrl,
        });
        toast.success("Organization banner updated successfully.");
      } else {
        const result = await workspaceService.uploadAvatar(organizationSlug, croppedFile);
        useWorkspaceStore.getState().updateWorkspaceDetails(organizationSlug, {
          logoUrl: result.avatarUrl,
        });
        toast.success("Organization logo updated successfully.");
      }
      setLastSelectedFile(null);
    } catch (error: unknown) {
      console.error("Failed to upload image:", error);
      toast.danger("Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleCropCancel = () => {
    setIsCropModalOpen(false);
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
    }
  };

  useEffect(() => {
    if (organizationSlug) {
      fetchWorkspace(organizationSlug);
    }
  }, [organizationSlug, fetchWorkspace]);

  if (isDetailsLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto p-6 font-outfit text-foreground mt-4">
        <div className="h-40 bg-card border border-border animate-pulse rounded-2xl" />
        <div className="h-10 w-48 bg-card border border-border animate-pulse rounded-lg" />
        <Card className="p-6">
          <SkeletonLoader rows={6} columns={4} />
        </Card>
      </div>
    );
  }

  if (detailsError || !workspaceDetails) {
    return (
      <div className="max-w-xl mx-auto py-20 font-outfit text-foreground">
        <Card className="p-8 border border-border bg-surface text-center">
          <div className="size-16 rounded-2xl bg-danger/10 flex items-center justify-center border border-danger/20 mx-auto mb-5 text-danger">
            <AlertTriangle size={28} />
          </div>
          <Typography type="h4" className="font-bold text-foreground mb-2">
            Profile Loading Error
          </Typography>
          <Typography type="body-xs" className="text-muted leading-relaxed mb-6">
            {detailsError || "The requested organization profile could not be loaded."}
          </Typography>
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="font-bold text-xs cursor-pointer"
          >
            Go Back Home
          </Button>
        </Card>
      </div>
    );
  }

  // Determine active tab based on route
  const getActiveTab = () => {
    if (pathname.endsWith("/about")) return "about";
    if (pathname.endsWith("/jobs")) return "jobs";
    if (pathname.endsWith("/posts")) return "posts";
    if (pathname.endsWith("/people")) return "people";
    return "home";
  };

  const activeTab = getActiveTab();

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    }
  };

  const baseRoute = `/workspace/${organizationSlug}`;

  const tabs = [
    { id: "home", label: "Home", href: baseRoute },
    { id: "about", label: "About", href: `${baseRoute}/about` },
    { id: "jobs", label: "Jobs", href: `${baseRoute}/jobs` },
    { id: "posts", label: "Posts", href: `${baseRoute}/posts` },
    { id: "people", label: "People", href: `${baseRoute}/people` },
  ];

  return (
    <div className="min-h-screen bg-background font-outfit text-foreground pb-12 relative">
      {/* Visual Background Glow Container */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-accent/5 blur-[120px]" />
        <div className="absolute top-[20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-6 relative z-10 space-y-6">
        {/* Main Header Card */}
        <Card className="p-0 overflow-hidden border border-border bg-surface shadow-lg rounded-2xl">
          {/* Banner Frame */}
          <div className="h-44 md:h-52 w-full relative border-b border-border overflow-hidden bg-neutral-900 flex items-center justify-center">
            {workspaceDetails.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={workspaceDetails.bannerUrl}
                alt={`${workspaceDetails.organizationName} Banner`}
                className="w-full h-full object-cover"
              />
            ) : (
              <>
                <div className="absolute inset-0 bg-linear-to-r from-accent/20 via-indigo-950/40 to-accent/10" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:16px_16px]" />
              </>
            )}

            {/* Change Banner Button */}
            {canManageProfile && (
              <div className="absolute top-4 left-4 z-20">
                <Button
                  size="sm"
                  variant="bordered"
                  className="bg-black/50 hover:bg-black/70 border border-white/20 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 backdrop-blur-md shadow-sm h-8 px-3 cursor-pointer"
                  onClick={() => bannerInputRef.current?.click()}
                >
                  <Camera size={14} />
                  Change Banner
                </Button>
              </div>
            )}
          </div>

          {/* Identity Info Container */}
          <div className="px-6 pb-6 relative">
            {/* Logo */}
            <div className="absolute -top-16 left-6 w-28 h-28 rounded-2xl bg-surface border border-border flex items-center justify-center shadow-xl overflow-hidden group">
              {workspaceDetails.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={workspaceDetails.logoUrl}
                  alt={`${workspaceDetails.organizationName} Logo`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-linear-to-br from-accent/10 to-indigo-500/10 flex items-center justify-center text-accent">
                  <Building2 size={44} />
                </div>
              )}

              {/* Change Logo Hover Overlay */}
              {canManageProfile && (
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-white gap-1 cursor-pointer border-none outline-none"
                  aria-label="Change Logo"
                >
                  <Camera size={18} />
                  <span className="text-[10px] font-bold">Edit</span>
                </button>
              )}
            </div>

            {/* Actions (Follow, Share, Manage Profile Link) */}
            <div className="flex justify-end items-center gap-3 pt-4 h-16">
              <Button
                onClick={() => toggleFollowWorkspace(organizationSlug)}
                variant={workspaceDetails.isFollowing ? "bordered" : "solid"}
                size="sm"
                className={`font-bold text-xs cursor-pointer h-9 px-4 rounded-xl ${
                  workspaceDetails.isFollowing
                    ? "border-border text-foreground hover:bg-card/50"
                    : "bg-accent text-background hover:bg-accent/90 border-none"
                }`}
              >
                {workspaceDetails.isFollowing ? (
                  <>
                    <Check size={14} className="mr-1.5" />
                    Following
                  </>
                ) : (
                  <>
                    <Plus size={14} className="mr-1.5" />
                    Follow
                  </>
                )}
              </Button>

              <span title="Share Profile">
                <Button
                  onClick={handleShare}
                  variant="bordered"
                  size="sm"
                  className="font-bold text-xs h-9 w-9 p-0 flex items-center justify-center rounded-xl border-border text-muted hover:text-foreground cursor-pointer"
                >
                  {shareSuccess ? <Check size={14} className="text-success" /> : <Share2 size={14} />}
                </Button>
              </span>

              {/* Link to Private Management Dashboard */}
              {canManageProfile && (
                <Link href={`${baseRoute}/information`}>
                  <Button
                    variant="bordered"
                    size="sm"
                    className="font-bold text-xs h-9 px-3 rounded-xl border-accent/30 text-accent hover:bg-accent/10 cursor-pointer"
                  >
                    Manage Profile
                  </Button>
                </Link>
              )}
            </div>

            {/* Core Info */}
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Typography type="h1" className="text-2xl font-extrabold text-foreground">
                  {workspaceDetails.organizationName}
                </Typography>
                <Chip color="success" variant="soft" size="sm" className="font-semibold text-[10px] py-0.5 px-2">
                  <ShieldCheck size={11} className="inline mr-1 -mt-0.5" />
                  Verified Enterprise
                </Chip>
              </div>

              <Typography type="body-xs" className="text-muted max-w-3xl leading-relaxed">
                {workspaceDetails.description}
              </Typography>

              {/* Attributes line */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground pt-1 select-none">
                {workspaceDetails.industry && (
                  <span className="flex items-center gap-1.5">
                    <Briefcase size={13} className="text-accent" />
                    {workspaceDetails.industry}
                  </span>
                )}
                {workspaceDetails.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={13} className="text-accent" />
                    {workspaceDetails.location}
                  </span>
                )}
                {workspaceDetails.companySize && (
                  <span className="flex items-center gap-1.5">
                    <Building2 size={13} className="text-accent" />
                    {workspaceDetails.companySize} employees
                  </span>
                )}
                {workspaceDetails.followersCount !== undefined && (
                  <span className="font-semibold text-foreground">
                    {workspaceDetails.followersCount.toLocaleString()} followers
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Tabs Bar */}
          <div className="border-t border-border bg-card/30 flex px-6 select-none">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`py-4 px-4 font-bold text-sm tracking-wide border-b-2 transition-colors relative cursor-pointer ${
                    isActive
                      ? "border-accent text-accent font-extrabold"
                      : "border-transparent text-muted hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </Card>

        {/* Tab Subview render */}
        <main className="min-w-0">
          {children}
        </main>
      </div>

      {/* Hidden file inputs for uploads */}
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleBannerChange}
      />
      <input
        ref={logoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleLogoChange}
      />

      {/* Unified Cropper Modal */}
      <ImageCropperModal
        key={cropImageSrc || "closed"}
        isOpen={isCropModalOpen}
        onOpenChange={setIsCropModalOpen}
        imageSrc={cropImageSrc}
        type={cropperType || "avatar"}
        onCropComplete={handleCropComplete}
        onCancel={handleCropCancel}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
      />
    </div>
  );
}
