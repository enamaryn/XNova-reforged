import { SpyReportDetailClient } from './SpyReportDetailClient';

export default async function SpyReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string; locale: string }>;
}) {
  const { reportId } = await params;
  return <SpyReportDetailClient reportId={reportId} />;
}
