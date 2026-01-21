import { Suspense } from 'react';
import { GalaxySkeleton } from '@/components/skeletons/galaxy-skeleton';
import { ErrorBoundary } from '@/components/error-boundary';
import GalaxyClient from './galaxy-client';

export default function GalaxyPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<GalaxySkeleton />}>
        <GalaxyClient />
      </Suspense>
    </ErrorBoundary>
  );
}
