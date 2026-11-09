import { Link } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { PaymentInstructionsFileCard, PaymentQrCard } from './SettingsPage';

/** How teams pay: the instructions file and the UPI QR shown to them on the portal. */
export function PaymentSetupPage() {
  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader
        title="Payment setup"
        description={
          <>
            What teams see when they pay. The fee, when they pay and written instructions are in{' '}
            <Link to="../settings" relative="path" className="underline underline-offset-4">
              Settings, under Event details
            </Link>
            .
          </>
        }
      />
      <PaymentInstructionsFileCard />
      <PaymentQrCard />
    </div>
  );
}
