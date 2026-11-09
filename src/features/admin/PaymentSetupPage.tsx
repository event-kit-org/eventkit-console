import { PageHeader } from '@/components/PageHeader';
import { useEventContext } from '@/features/events/event-context';
import { EditEventCard, PaymentInstructionsFileCard, PaymentQrCard } from './SettingsPage';

/** How teams pay: the fee and when, the instructions file and the UPI QR shown on the portal. */
export function PaymentSetupPage() {
  const { event } = useEventContext();
  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader title="Payment setup" description="What teams pay, when, and how." />
      <EditEventCard
        key={`${event.paymentMode}-${event.registrationFee}-${event.paymentDeadline}`}
        title="Payment"
        description="Payment mode, fee basis and currency lock once anyone has registered. The fee can still change; teams that already paid keep what they paid, and any difference is settled by hand."
        steps={[3]}
      />
      <PaymentInstructionsFileCard />
      <PaymentQrCard />
    </div>
  );
}
