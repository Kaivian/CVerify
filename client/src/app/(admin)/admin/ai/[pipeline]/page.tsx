import { AiPipelineDashboardView } from "@/modules/admin/views/ai-pipeline-dashboard-view";

interface PageProps {
  params: Promise<{ pipeline: string }>;
}

export default async function AiPipelinePage({ params }: PageProps) {
  const { pipeline } = await params;
  return <AiPipelineDashboardView pipelineSlug={pipeline} />;
}
