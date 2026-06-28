import React from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import { API_URL } from '@/services/axios-client';
import {
  type PublicProfileResponse,
  type CandidateAssessmentDetailResponse
} from '@/types/profile.types';
import { ProfileContainer } from './components/ProfileContainer';

const RESERVED_USERNAMES = new Set([
  "admin", "api", "login", "register", "settings", "dashboard", "profile", "privacy", "terms", "support", "help",
  "chat", "business", "user", "organization", "auth", "system", "unauthorized", "company-onboarding",
  "company-verification", "continue-with-email", "forgot-password", "gateway", "reset-password", "verify-email", "workspace-setup",
  "company-setup", "cv", "ranking"
]);

interface PageProps {
  params: Promise<{
    username: string;
  }>;
}

async function getPublicProfile(username: string): Promise<PublicProfileResponse | null> {
  try {
    const isDev = process.env.NODE_ENV === 'development';
    const fetchOptions: RequestInit = isDev
      ? { cache: 'no-store' }
      : { next: { revalidate: 60 } };

    const res = await fetch(`${API_URL}/v1/users/profile/public/${username}`, fetchOptions);
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

async function getPublicAssessment(username: string): Promise<CandidateAssessmentDetailResponse | null> {
  try {
    const isDev = process.env.NODE_ENV === 'development';
    const fetchOptions: RequestInit = isDev
      ? { cache: 'no-store' }
      : { next: { revalidate: 60 } };

    const res = await fetch(`${API_URL}/v1/candidate-assessments/public/${username}`, fetchOptions);
    if (res.status === 404 || res.status === 204) {
      return null;
    }
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error('Error fetching public assessment:', error);
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

