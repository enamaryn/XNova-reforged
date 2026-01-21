import { Suspense } from 'react';
import { FleetSkeleton } from '@/components/skeletons/fleet-skeleton';
import { ErrorBoundary } from '@/components/error-boundary';
import FleetClient from './fleet-client';

export default function FleetPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<FleetSkeleton />}>
        <FleetClient />
      </Suspense>
    </ErrorBoundary>
  );
}
