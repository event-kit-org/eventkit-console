import { PageHeader } from '@/components/PageHeader';
import { FeaturesCard } from './SettingsPage';

/** Switches for the parts of eventKit this event uses. */
export function FeaturesPage() {
  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader title="Features" description="Switch on the parts of eventKit this event uses." />
      <FeaturesCard />
    </div>
  );
}
