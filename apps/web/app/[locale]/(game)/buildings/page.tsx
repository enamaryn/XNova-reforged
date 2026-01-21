import { ErrorBoundary } from '@/components/error-boundary';
import BuildingsClient from './buildings-client';

export default function BuildingsPage() {
  return (
    <ErrorBoundary>
      <BuildingsClient />
    </ErrorBoundary>
  );
}
