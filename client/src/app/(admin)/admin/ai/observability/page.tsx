"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RedirectToRepository() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/ai/repository");
  }, [router]);

  return (
    <div className="flex h-[50vh] items-center justify-center text-muted-foreground">
      Redirecting to AI Operations Center...
    </div>
  );
}
