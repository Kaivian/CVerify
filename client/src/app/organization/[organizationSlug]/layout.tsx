import { type Metadata } from "next";

interface Props {
  children: React.ReactNode;
  params: Promise<{ organizationSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { organizationSlug } = await params;
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5247/api";
    const res = await fetch(`${apiUrl}/workspace/${organizationSlug}`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const data = await res.json();
      const orgName = data.organizationName || "Partner Enterprise";
      const orgDesc = data.description || `Workspace for ${orgName} on CVerify`;
      return {
        title: `${orgName} - Workspace | CVerify`,
        description: orgDesc,
        openGraph: {
          title: `${orgName} - Workspace | CVerify`,
          description: orgDesc,
          images: data.logoUrl ? [{ url: data.logoUrl }] : [],
        },
      };
    }
  } catch (error) {
    console.error("Failed to generate metadata dynamically on server:", error);
  }

  return {
    title: "Workspace | CVerify",
    description: "CVerify developer credentials and enterprise verification workspace.",
  };
}

export default function WorkspaceParentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
