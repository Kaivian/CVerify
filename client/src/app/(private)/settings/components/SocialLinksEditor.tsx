"use client";

import React, { useState } from "react";
import { Button, Input, Link } from "@heroui/react";
import { Typography } from "@heroui/react";
import {
  Globe,
  Plus,
  Trash2,
  AlertCircle,
  Building2
} from "lucide-react";

// Inline brand SVGs to bypass Lucide member mismatch errors
const GitHubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" {...props}>
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const LinkedInIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" {...props}>
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
  </svg>
);

const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const YouTubeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" {...props}>
    <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.002 3.002 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

// Helper to extract a clean brand slug from a URL domain name
const getBrandSlug = (urlStr: string): string | null => {
  try {
    const trimmed = urlStr.trim().toLowerCase();
    if (!trimmed) return null;

    const urlWithProtocol = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;

    const parsedUrl = new URL(urlWithProtocol);
    let host = parsedUrl.hostname;
    if (host.startsWith("www.")) {
      host = host.substring(4);
    }

    if (host === "x.com" || host.includes("twitter.com")) return "twitter";
    if (host.includes("youtu.be")) return "youtube";

    const parts = host.split(".");
    if (parts.length === 0) return null;
    if (parts.length === 1) return parts[0];

    const last = parts[parts.length - 1];
    const secondLast = parts[parts.length - 2];

    // Common sub-TLDs specifically for registered domains
    const countrySubTlds = ["com", "co", "net", "org", "edu", "gov", "biz", "info", "mil", "ac"];

    if (parts.length >= 3 && countrySubTlds.includes(secondLast) && last.length === 2) {
      return parts[parts.length - 3];
    } else {
      return secondLast;
    }
  } catch {
    return null;
  }
};

// Known social and developer platforms where "Globe" is the most appropriate fallback
const personalSocialSlugs = [
  "github",
  "linkedin",
  "twitter",
  "x",
  "youtube",
  "facebook",
  "instagram",
  "tiktok",
  "medium",
  "behance",
  "dribbble",
  "pinterest",
  "reddit",
  "twitch",
  "spotify",
  "threads",
  "discord",
  "slack",
  "gitlab",
  "bitbucket"
];

// Dynamic Brand Icon Component using https://thesvg.org/ with beautiful fallbacks
const DynamicBrandIcon: React.FC<{ url: string; className?: string }> = ({ url, className }) => {
  const [hasError, setHasError] = useState(false);
  const slug = getBrandSlug(url);

  // Determine appropriate fallback based on platform type (personal social vs. company website)
  const isPersonal = slug ? personalSocialSlugs.includes(slug) : false;
  const FallbackIcon = isPersonal ? Globe : Building2;

  if (!slug || hasError) {
    return <FallbackIcon className={className} />;
  }

  // Pre-rendered local SVGs for the top platforms (guarantees instant render with no flashing)
  if (slug === "github") return <GitHubIcon className={className} />;
  if (slug === "linkedin") return <LinkedInIcon className={className} />;
  if (slug === "twitter") return <TwitterIcon className={className} />;
  if (slug === "youtube") return <YouTubeIcon className={className} />;

  // Fetch from thesvg.org CDN. Handles dynamic fallback beautifully if the brand doesn't exist
  return (
    <img
      src={`https://thesvg.org/icons/${slug}/default.svg`}
      alt={`${slug} logo`}
      className={`${className} object-contain max-w-full max-h-full`}
      onError={() => {
        setHasError(true);
      }}
    />
  );
};

interface SocialLink {
  id: string;
  url: string;
}

interface SocialLinksEditorProps {
  links: SocialLink[];
  onChange: (links: SocialLink[]) => void;
}

export const SocialLinksEditor: React.FC<SocialLinksEditorProps> = ({
  links,
  onChange,
}) => {
  const [newUrl, setNewUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAddLink = () => {
    setError(null);
    const trimmed = newUrl.trim();
    if (!trimmed) return;

    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
    if (!urlPattern.test(trimmed)) {
      setError("Please enter a valid URL (e.g. github.com/username)");
      return;
    }

    const formattedUrl = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;

    if (links.some((l) => l.url.toLowerCase() === formattedUrl.toLowerCase())) {
      setError("This link has already been added.");
      return;
    }

    const updatedLinks = [...links, { id: Math.random().toString(), url: formattedUrl }];
    onChange(updatedLinks);
    setNewUrl("");
  };

  const handleRemoveLink = (id: string) => {
    const updatedLinks = links.filter((link) => link.id !== id);
    onChange(updatedLinks);
  };

  return (
    <div className="flex flex-col gap-4 w-full text-left">
      {/* List of existing links */}
      {links.length > 0 ? (
        <div className="flex flex-col gap-2">
          {links.map((link) => {
            return (
              <div
                key={link.id}
                className="flex items-center justify-between gap-3 px-2 py-2 rounded-xl border border-tertiary"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-surface-secondary text-muted flex items-center justify-center border border-tertiary">
                    <DynamicBrandIcon url={link.url} className="size-4 shrink-0" />
                  </div>
                  <Link
                    href={link.url}
                  >
                    {link.url}
                    <Link.Icon />
                  </Link>
                </div>
                <Button
                  isIconOnly
                  variant="danger-soft"
                  aria-label="Remove link"
                  onClick={() => handleRemoveLink(link.id)}
                  className="rounded-lg"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-4 px-4 rounded-xl">
          <Globe className="text-muted size-6  mb-2" />
          <Typography type="body-xs" className="text-muted font-semibold font-outfit uppercase tracking-wider">
            No links added yet
          </Typography>
          <Typography type="body-xs" className="text-muted text-[10px] text">
            Add your GitHub profile, portfolio website, or social media handles below.
          </Typography>
        </div>
      )}

      {/* Input row to add links */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder="e.g. github.com/username"
              value={newUrl}
              onChange={(e) => {
                setError(null);
                setNewUrl(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddLink();
                }
              }}
              className="w-full rounded-xl"
            />
          </div>
          <Button
            variant="primary"
            onClick={handleAddLink}
            className="rounded-xl"
          >
            <Plus size={14} />
            Add
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-danger">
            <AlertCircle size={12} className="shrink-0" />
            <Typography type="body-xs" className="text-[10px] text-danger">
              {error}
            </Typography>
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialLinksEditor;
