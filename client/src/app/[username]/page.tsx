import React, { cache } from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { API_URL } from '@/services/axios-client';
import {
  type PublicProfileResponse,
  type CandidateAssessmentDetailResponse
} from '@/types/profile.types';
import { ProfileContainer } from './components/ProfileContainer';
import { isReservedUsername } from '@/config/routes';
import { PublicPageShell } from '@/components/ui/public-page-shell';
import { AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    username: string;
  }>;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Data fetching helper wrapped in React cache to share requests between generateMetadata and page rendering
const getPublicProfile = cache(async (username: string): Promise<PublicProfileResponse | null> => {
  const isDev = process.env.NODE_ENV === 'development';
  const fetchOptions: RequestInit = isDev
    ? { 
        cache: 'no-store',
        headers: { 'Accept-Encoding': 'identity' }
      }
    : { 
        next: { 
          revalidate: 60,
          tags: [`profile-${username.toLowerCase()}`]
        },
        headers: { 'Accept-Encoding': 'identity' }
      };

  try {
    const res = await fetch(`${API_URL}/v1/users/profile/public/${encodeURIComponent(username.toLowerCase())}`, fetchOptions);
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new ApiError(res.status, `Backend returned status ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error('Error fetching public profile:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new Error('Failed to connect to the profile service. Please try again later.');
  }
});

const getPublicAssessment = cache(async (username: string): Promise<CandidateAssessmentDetailResponse | null> => {
  const isDev = process.env.NODE_ENV === 'development';
  const fetchOptions: RequestInit = isDev
    ? { 
        cache: 'no-store',
        headers: { 'Accept-Encoding': 'identity' }
      }
    : { 
        next: { 
          revalidate: 60,
          tags: [`assessment-${username.toLowerCase()}`]
        },
        headers: { 'Accept-Encoding': 'identity' }
      };

  try {
    const res = await fetch(`${API_URL}/v1/candidate-assessments/public/${encodeURIComponent(username.toLowerCase())}`, fetchOptions);
    if (res.status === 404 || res.status === 204) {
      return null;
    }
    if (!res.ok) {
      throw new ApiError(res.status, `Backend returned status ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error('Error fetching public assessment:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new Error('Failed to connect to the assessment service. Please try again later.');
  }
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  
  if (isReservedUsername(username)) {
    return {
      title: 'Not Found | CVerify',
    };
  }

  try {
    const profile = await getPublicProfile(username);
    if (!profile) {
      return {
        title: 'Profile Not Found | CVerify',
        description: 'The requested developer profile could not be found.',
      };
    }

    const name = profile.fullName || username;
    const headline = profile.headline ? ` - ${profile.headline}` : '';
    return {
      title: `${name}${headline} | CVerify Profile`,
      description: profile.bio || `View ${name}'s verified technical skills, trust score, and assessment report on CVerify.`,
      openGraph: {
        title: `${name} | CVerify Profile`,
        description: profile.bio || `View ${name}'s verified technical skills, trust score, and assessment report on CVerify.`,
        images: profile.avatarUrl ? [{ url: profile.avatarUrl }] : undefined,
      }
    };
  } catch (error) {
    return {
      title: 'Profile Unavailable | CVerify',
      description: 'The requested profile is temporarily unavailable due to a service error.',
    };
  }
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;

  // 1. Reserved username check
  if (isReservedUsername(username)) {
    notFound();
  }

  // 2. Canonical lowercase redirect (decode first to avoid percent-encoding casing redirect loops)
  let decodedUsername = username;
  try {
    decodedUsername = decodeURIComponent(username);
  } catch (err) {
    console.error('Failed to decode username:', err);
  }
  if (decodedUsername !== decodedUsername.toLowerCase()) {
    permanentRedirect(`/${encodeURIComponent(decodedUsername.toLowerCase())}`);
  }

  // 3. Fetch public profile and assessment data
  let profile: PublicProfileResponse | null = null;
  let assessment: CandidateAssessmentDetailResponse | null = null;
  let connectionError: string | null = null;

  try {
    const [profileRes, assessmentRes] = await Promise.all([
      getPublicProfile(username),
      getPublicAssessment(username)
    ]);
    profile = profileRes;
    assessment = assessmentRes;
  } catch (error: any) {
    console.error('Gracefully caught profile service connection error:', error);
    connectionError = error.message || 'Failed to connect to the profile service. Please try again later.';
  }

  if (connectionError) {
    return (
      <PublicPageShell
        authenticatedClassName="flex items-center justify-center min-h-[75vh] w-full p-4"
        guestContainerClassName="relative min-h-screen w-full bg-background text-foreground flex flex-col justify-between overflow-x-hidden antialiased"
        guestBackdrop={<div className="absolute inset-0 bg-[radial-gradient(var(--separator)_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none opacity-40" />}
        guestMainClassName="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-20 flex flex-col items-center justify-center gap-6"
      >
        <div className="w-full max-w-xl bg-surface border border-border rounded-2xl shadow-lg p-8 sm:p-10 flex flex-col items-center text-center gap-6">
          <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-danger/10 border border-danger/20 text-danger">
            <AlertCircle size={32} />
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Profile Temporarily Unavailable
            </h1>
            <p className="text-sm text-muted max-w-md leading-relaxed">
              The profile at <code className="px-1.5 py-0.5 rounded bg-surface-secondary text-xs border border-border font-mono">/{username}</code> cannot be loaded due to a temporary service error. Please try again later.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <p className="text-xs text-danger/80 mt-2 font-mono break-all max-w-md">
                Development connection error detail: {connectionError}
              </p>
            )}
          </div>
        </div>
      </PublicPageShell>
    );
  }

  if (!profile) {
    notFound();
  }

  return (
    <ProfileContainer
      profile={profile}
      assessment={assessment}
      username={username}
    />
  );
}
