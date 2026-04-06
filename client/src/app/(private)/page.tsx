import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify } from 'jose';
import { ROUTES } from '../../lib/constants/auth.constants';
import { normalizeRole } from '../../lib/utils/auth-utils';

export default async function DashboardResolutionPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    redirect(ROUTES.LOGIN);
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'DbqDgBM1u2H5lNnUFBgYrRaotpSP9Wda8jASgjIbFh6');
    const { payload } = await jwtVerify(accessToken, secret);

    const isEmailVerified = payload.isEmailVerified === 'true' || payload.isEmailVerified === true;
    if (!isEmailVerified) {
      redirect(ROUTES.VERIFY_EMAIL);
    }

    const rolesRaw = (
      payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
      payload.role ||
      payload.roles
    ) as string | string[] | undefined | null;

    const userRole = normalizeRole(rolesRaw);

    let targetDashboard: string = ROUTES.DASHBOARD.USER;
    if (userRole === 'ADMIN') {
      targetDashboard = ROUTES.DASHBOARD.ADMIN;
    } else if (userRole === 'BUSINESS') {
      targetDashboard = ROUTES.DASHBOARD.BUSINESS;
    }

    redirect(targetDashboard);
  } catch {
    redirect(ROUTES.LOGIN);
  }
}
