import { ErrorBoundary } from '@/components/error-boundary';
import FleetClient from './fleet-client';

export default function FleetPage() {
  return (
    <ErrorBoundary>
      <FleetClient />
    </ErrorBoundary>
  );
}
