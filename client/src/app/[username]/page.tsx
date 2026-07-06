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
  const [profile, assessment] = await Promise.all([
    getPublicProfile(username),
    getPublicAssessment(username)
  ]);

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
