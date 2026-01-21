import { ErrorBoundary } from '@/components/error-boundary';
import OverviewClient from './overview-client';

export const dynamic = 'force-dynamic';

export default function OverviewPage() {
  return (
    <ErrorBoundary>
      <OverviewClient />
    </ErrorBoundary>
  );
}
