import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { asRole, capture, E } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { event } from '@/test/server';

const go = () => renderApp(`/events/${event.id}/settings`, { token: 'good-token' });

describe('RSVP setting', () => {
  it('confirms before switching RSVP off', async () => {
    asRole('admin');
    const save = capture('patch', E, { event: { ...event, rsvpEnabled: false }, role: 'admin' });
    go();
    const toggle = await screen.findByRole('switch', { name: 'Ask participants to RSVP' });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('marked as attending');
    await userEvent.click(screen.getByRole('button', { name: 'Keep asking' }));
    expect(save).toHaveLength(0);
    await userEvent.click(toggle);
    await userEvent.click(await screen.findByRole('button', { name: 'Turn off RSVP' }));
    await waitFor(() => expect(save[0]?.body).toEqual({ rsvpEnabled: false }));
  });

  it('switches it back on without asking', async () => {
    asRole('admin', { rsvpEnabled: false });
    const save = capture('patch', E, { event, role: 'admin' });
    go();
    await userEvent.click(await screen.findByRole('switch', { name: 'Ask participants to RSVP' }));
    await waitFor(() => expect(save[0]?.body).toEqual({ rsvpEnabled: true }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
