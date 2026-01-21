import { Suspense } from 'react';
import { ResearchSkeleton } from '@/components/skeletons/research-skeleton';
import { ErrorBoundary } from '@/components/error-boundary';
import ResearchClient from './research-client';

export default function ResearchPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<ResearchSkeleton />}>
        <ResearchClient />
      </Suspense>
    </ErrorBoundary>
  );
}
