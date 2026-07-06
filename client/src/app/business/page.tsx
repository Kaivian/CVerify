import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_URL } from "@/infrastructure/http/axios-client";
import { jwtVerify } from "jose";
import { normalizeRole } from "@/lib/utils/auth-utils";

export default async function BusinessLandingPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;

  if (!accessToken) {
    redirect("/login?callbackUrl=%2Fbusiness");
  }

  // Parse user role from JWT to decide fallback route
  let userRole = "USER";
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'DbqDgBM1u2H5lNnUFBgYrRaotpSP9Wda8jASgjIbFh6');
    const { payload } = await jwtVerify(accessToken, secret);
    const roles = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ?? payload.role ?? payload.roles;
    userRole = normalizeRole(roles as string | string[] | null | undefined);
  } catch (err) {
    console.warn("[BusinessLandingPage SSR] Failed to parse JWT access_token:", err);
  }

  // Admin users are always directed to the Company Directory management page
  if (userRole === "ADMIN") {
    redirect("/business/companies");
  }

  let orgs = [];
  try {
    const res = await fetch(`${API_URL}/workspace/my-organizations`, {
      headers: {
        Cookie: `access_token=${accessToken}`,
      },
      next: { revalidate: 0 },
    });

    if (res.ok) {
      orgs = await res.json();
    } else if (res.status === 401) {
      redirect("/login?callbackUrl=%2Fbusiness");
    }
  } catch (error) {
    console.error("[BusinessLandingPage SSR] Failed to fetch user organizations:", error);
  }

  if (orgs && orgs.length > 0) {
    redirect(`/business/${orgs[0].slug}/dashboard`);
  } else {
    redirect("/unauthorized");
  }
}
