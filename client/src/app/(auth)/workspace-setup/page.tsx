'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function WorkspaceSetupRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = searchParams.toString();
    router.replace(`/company-setup${params ? `?${params}` : ''}`);
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center p-8 min-h-[400px]">
      <div className="w-8 h-8 border-2 border-t-foreground border-border rounded-full animate-spin" />
    </div>
  );
}

export default function WorkspaceSetupPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8 min-h-[400px]">
        <div className="w-8 h-8 border-2 border-t-foreground border-border rounded-full animate-spin" />
      </div>
    }>
      <WorkspaceSetupRedirectContent />
    </Suspense>
  );
}