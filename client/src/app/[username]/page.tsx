import React from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import { Compass, Briefcase, MapPin, Link as LinkIcon, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Typography, Card, Button } from '@heroui/react';
import { API_URL } from '@/services/axios-client';
import { type PublicProfileResponse } from '@/types/profile.types';

const RESERVED_USERNAMES = new Set([
  "admin", "api", "login", "register", "settings", "dashboard", "profile", "privacy", "terms", "support", "help",
  "chat", "business", "user", "organization", "auth", "system", "unauthorized", "company-onboarding", 
  "company-verification", "continue-with-email", "forgot-password", "gateway", "reset-password", "verify-email", "workspace-setup"
]);

interface PageProps {
  params: Promise<{
    username: string;
  }>;
}

async function getPublicProfile(username: string): Promise<PublicProfileResponse | null> {
  try {
    const res = await fetch(`${API_URL}/v1/users/profile/public/${username}`, {
      next: { revalidate: 60 }, // Cache public profile for 1 minute
    });
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error('Error fetching public profile:', error);
    return null;
  }
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;

  // 1. Reserved username check
  if (RESERVED_USERNAMES.has(username.toLowerCase())) {
    notFound();
  }

  // 2. Canonical lowercase redirect
  if (username !== username.toLowerCase()) {
    permanentRedirect(`/${username.toLowerCase()}`);
  }

  // 3. Fetch public profile data
  const profile = await getPublicProfile(username);
  if (!profile) {
    notFound();
  }

  return (
    <div className="dark relative min-h-screen w-full bg-background text-foreground flex flex-col justify-between overflow-hidden">
      {/* Dynamic colorful blur highlights */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[150px] pointer-events-none" />

      {/* Grid backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-size-[32px_32px] pointer-events-none opacity-80" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 h-20 flex items-center justify-between border-b border-border/20 backdrop-blur-md bg-background/20 select-none">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <div className="w-9 h-9 rounded-xl bg-foreground text-background flex items-center justify-center shadow-lg font-bold">
            <Compass size={20} />
          </div>
          <Typography type="body-sm" className="font-extrabold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-foreground to-muted">
            CVerify
          </Typography>
        </Link>
        <Link href="/login">
          <Button size="sm" variant="outline" className="font-semibold text-xs rounded-xl bg-foreground/10 text-foreground border border-border/40 backdrop-blur-sm">
            Sign In
          </Button>
        </Link>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-3xl w-full mx-auto px-6 py-12 flex flex-col justify-center">
        <Card className="p-8 md:p-12 rounded-3xl border border-border/30 bg-background/30 backdrop-blur-xl shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
          {/* Subtle glowing ring behind avatar */}
          <div className="absolute top-12 w-28 h-28 rounded-full bg-indigo-500/20 blur-xl pointer-events-none" />

          {/* User Avatar */}
          <div className="relative w-28 h-28 rounded-full border-2 border-indigo-500/30 overflow-hidden shadow-xl mb-6">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt={profile.fullName}
                width={112}
                height={112}
                className="w-full h-full object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full bg-linear-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-3xl font-extrabold text-white">
                {profile.fullName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="flex items-center gap-2 mb-2">
            <Typography type="h2" className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {profile.fullName}
            </Typography>
            <ShieldCheck size={20} className="text-emerald-500" />
          </div>
          
          <Typography type="body-sm" className="text-indigo-400 font-semibold mb-4">
            @{profile.username}
          </Typography>

          {profile.headline && (
            <Typography type="body-sm" className="text-muted-foreground max-w-lg mb-6">
              {profile.headline}
            </Typography>
          )}

          {/* Meta Details Grid */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mb-8 text-sm text-muted-foreground/80">
            {profile.company && (
              <span className="flex items-center gap-1.5">
                <Briefcase size={16} className="text-indigo-400" />
                {profile.company}
              </span>
            )}
            {profile.location && (
              <span className="flex items-center gap-1.5">
                <MapPin size={16} className="text-indigo-400" />
                {profile.location}
              </span>
            )}
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="w-full max-w-xl border-t border-border/20 pt-6 mb-8">
              <Typography type="body-sm" className="text-left text-muted-foreground leading-relaxed whitespace-pre-line">
                {profile.bio}
              </Typography>
            </div>
          )}

          {/* Social Links */}
          {profile.socialLinks && profile.socialLinks.length > 0 && (
            <div className="w-full max-w-xl border-t border-border/20 pt-6">
              <Typography type="body-sm" className="font-semibold text-xs tracking-wider uppercase text-muted-foreground/60 mb-4 text-center">
                Connected Links
              </Typography>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {profile.socialLinks.map((url, idx) => {
                  let displayUrl = url.replace(/https?:\/\/(www\.)?/, '');
                  if (displayUrl.length > 28) displayUrl = displayUrl.substring(0, 26) + '...';
                  return (
                    <a
                      key={idx}
                      href={url.startsWith('http') ? url : `https://${url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border/40 bg-foreground/5 hover:bg-foreground/10 hover:border-indigo-500/30 transition-all text-xs font-semibold text-muted hover:text-foreground"
                    >
                      <LinkIcon size={14} className="text-indigo-400" />
                      {displayUrl}
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 h-16 flex items-center justify-center border-t border-border/20 text-xs text-muted-foreground bg-background/20 select-none">
        &copy; {new Date().getFullYear()} CVerify. All rights reserved.
      </footer>
    </div>
  );
}
