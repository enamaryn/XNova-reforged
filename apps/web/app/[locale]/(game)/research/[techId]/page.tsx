import { ResearchDetailClient } from './ResearchDetailClient';

export default async function ResearchDetailPage({
  params
}: {
  params: Promise<{ techId: string; locale: string }>
}) {
  const { techId } = await params;
  return <ResearchDetailClient techId={techId} />;
}
