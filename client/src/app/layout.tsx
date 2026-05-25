import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter, Lato } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { cookies } from "next/headers";

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
  const theme = themeVal || "dark";

  // Determine layout direction (English and Vietnamese are Left-to-Right)
  const dir = "ltr";

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
        <Providers locale={locale}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
