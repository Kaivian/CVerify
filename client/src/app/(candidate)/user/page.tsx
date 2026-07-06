"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { UserDashboardView } from '@/modules/user/views/user-dashboard-view';
import { Spinner } from "@heroui/react";

export default function UserDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role === "ADMIN") {
      router.replace("/admin/users");
    }
  }, [user, router]);

  if (user && user.role === "ADMIN") {
    return (
      <div className="flex items-center justify-center p-8 min-h-[400px]">
        <Spinner size="md" />
      </div>
    );
  }

  return <UserDashboardView />;
}