import { PageHeader } from '@/components/PageHeader';
import { FeaturesCard } from './SettingsPage';

/** The parts of eventKit this event uses; the eventKit admin switches them. */
export function FeaturesPage() {
  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader title="Features" description="The parts of eventKit this event uses." />
      <FeaturesCard />
    </div>
  );
}
