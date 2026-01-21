import { Suspense } from 'react';
import { BuildingsSkeleton } from '@/components/skeletons/buildings-skeleton';
import { ErrorBoundary } from '@/components/error-boundary';
import BuildingsClient from './buildings-client';

export default function BuildingsPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<BuildingsSkeleton />}>
        <BuildingsClient />
      </Suspense>
    </ErrorBoundary>
  );
}
