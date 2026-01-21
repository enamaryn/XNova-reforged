import { ErrorBoundary } from '@/components/error-boundary';
import ResearchClient from './research-client';

export default function ResearchPage() {
  return (
    <ErrorBoundary>
      <ResearchClient />
    </ErrorBoundary>
  );
}
