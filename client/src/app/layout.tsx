import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter, Lato } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { normalizeRole } from "@/lib/utils/auth-utils";
import { type User, type ResourceActionPermission } from "@/types/auth.types";

// Premium Typography setup
const outfit = Plus_Jakarta_Sans({
  variable: "--font-outfit",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
});

export const metadata: Metadata = {
  title: "CVerify",
  description: "Access technical truth",
  icons: {
    icon: "/brand/logo.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get("i18next")?.value;
  const locale = (cookieVal === "en" || cookieVal === "vi") ? cookieVal : "vi";

  // Read and clean cookie theme to match server state
  const themeVal = cookieStore.get("theme")?.value;
  const theme = themeVal || "light";

  // Determine layout direction (English and Vietnamese are Left-to-Right)
  const dir = "ltr";

  // Parse access_token JWT on the server to prevent layout flicker
  let initialUser = null;
  const accessToken = cookieStore.get("access_token")?.value;
  if (accessToken) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'DbqDgBM1u2H5lNnUFBgYrRaotpSP9Wda8jASgjIbFh6');
      const { payload } = await jwtVerify(accessToken, secret);

      // .NET JwtSecurityTokenHandler maps ClaimTypes to short JWT names:
      // ClaimTypes.NameIdentifier → "sub", ClaimTypes.Email → "email", ClaimTypes.Name → "unique_name"
      // Custom claims (username, avatarUrl, isEmailVerified, etc.) keep their original names.
      const id = (payload.sub ?? payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']) as string;
      const email = (payload.email ?? payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress']) as string;
      const fullName = (payload.unique_name ?? payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']) as string;
      const username = payload.username as string | undefined;
      const avatarUrl = (payload.avatarUrl as string) || undefined;
      const roles = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ?? payload.role ?? payload.roles;

      initialUser = {
        id,
        email,
        username,
        fullName,
        avatarUrl,
        role: normalizeRole(roles as string | string[] | undefined | null),
        permissions: ((payload.permissions as string[]) || []) as ResourceActionPermission[],
        isEmailVerified: payload.isEmailVerified === 'true' || payload.isEmailVerified === true,
      } as User;
    } catch (err) {
      console.warn("[RootLayout SSR] Failed to parse JWT access_token:", err);
    }
  }

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${outfit.variable} ${inter.variable} ${lato.variable} h-full antialiased ${theme}`}
      data-theme={theme}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col font-sans bg-background text-foreground transition-colors duration-300"
        suppressHydrationWarning
      >
        <Providers locale={locale} initialUser={initialUser}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
