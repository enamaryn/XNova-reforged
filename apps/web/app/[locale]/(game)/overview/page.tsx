import { Suspense } from 'react';
import { OverviewSkeleton } from '@/components/skeletons/overview-skeleton';
import { ErrorBoundary } from '@/components/error-boundary';
import OverviewClient from './overview-client';

export const dynamic = 'force-dynamic';

export default function OverviewPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewClient />
      </Suspense>
    </ErrorBoundary>
  );
}
