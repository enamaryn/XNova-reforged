import { ErrorBoundary } from '@/components/error-boundary';
import GalaxyClient from './galaxy-client';

export default function GalaxyPage() {
  return (
    <ErrorBoundary>
      <GalaxyClient />
    </ErrorBoundary>
  );
}
