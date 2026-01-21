import { ReportDetailClient } from './ReportDetailClient';

export default async function ReportDetailPage({
  params
}: {
  params: Promise<{ reportId: string; locale: string }>
}) {
  const { reportId } = await params;
  return <ReportDetailClient reportId={reportId} />;
}
