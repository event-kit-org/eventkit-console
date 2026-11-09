import { PageHeader } from '@/components/PageHeader';
import { PortalCard } from './SettingsPage';

/** Where the event's portal lives and how it connects: address, paths, event ID and API keys. */
export function PortalConnectionPage() {
  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader
        title="Portal connection"
        description="Your portal's address, and the event ID, API URL and API key it connects with."
      />
      <PortalCard />
    </div>
  );
}
