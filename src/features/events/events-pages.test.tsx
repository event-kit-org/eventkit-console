import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { API, apiError, event, server } from '@/test/server';

const eventUrl = `${API}/v1/events/${event.id}`;

describe('EventsPage', () => {
  it('lists my events with role and IST dates, and links to each', async () => {
    const { router } = renderApp('/', { token: 'good-token' });
    expect(await screen.findByRole('heading', { name: 'PESOS X Silicon' })).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('31 Oct 2026 – 1 Nov 2026')).toBeInTheDocument();
    expect(screen.getByText('Asha')).toBeInTheDocument();

    server.use(
      http.get(eventUrl, () => HttpResponse.json({ event, role: 'judge' })),
      http.get(`${eventUrl}/features`, () => HttpResponse.json([])),
    );
    await userEvent.click(screen.getByRole('link', { name: /PESOS X Silicon/ }));
    expect(router.state.location.pathname).toBe(`/events/${event.id}`);
  });

  it('explains what to do when there are no events', async () => {
    server.use(http.get(`${API}/v1/events`, () => HttpResponse.json([])));
    renderApp('/', { token: 'good-token' });
    expect(await screen.findByText('No events yet')).toBeInTheDocument();
  });

  it('shows a load error', async () => {
    server.use(
      http.get(`${API}/v1/events`, () => apiError(500, 'INTERNAL_ERROR', 'Something went wrong.')),
    );
    renderApp('/', { token: 'good-token' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your events.');
  });

  it('switches the colour theme from the account menu, and remembers it', async () => {
    renderApp('/', { token: 'good-token' });
    await userEvent.click(await screen.findByRole('button', { name: 'Account' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Dark' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(window.localStorage.getItem('eventkit.theme')).toBe('dark');
    await userEvent.click(screen.getByRole('button', { name: 'Account' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'System' }));
    expect(document.documentElement).not.toHaveClass('dark');
    expect(window.localStorage.getItem('eventkit.theme')).toBeNull();
  });

  it('logs out from the account menu', async () => {
    const { router, session } = renderApp('/', { token: 'good-token' });
    await userEvent.click(await screen.findByRole('button', { name: 'Account' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Log out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(session.get()).toBeNull();
  });
});

describe('event layout', () => {
  it("shows the owner's tabs", async () => {
    server.use(
      http.get(eventUrl, () => HttpResponse.json({ event, role: 'admin' })),
      http.get(`${eventUrl}/features`, () => HttpResponse.json([])),
    );
    renderApp(`/events/${event.id}`, { token: 'good-token' });
    expect(await screen.findByRole('heading', { name: 'PESOS X Silicon' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Event sections' });
    expect(nav).toHaveTextContent('OverviewRegistrationTeamsPayments');
    expect(nav).toHaveTextContent('SetupStaffPortal & settings');
  });

  it('names the open section in the breadcrumb, and collapses the sidebar', async () => {
    server.use(
      http.get(eventUrl, () => HttpResponse.json({ event, role: 'admin' })),
      http.get(`${eventUrl}/features`, () => HttpResponse.json([])),
      http.get(`${eventUrl}/teams`, () => HttpResponse.json([])),
      http.get(`${eventUrl}/payment-proofs`, () => HttpResponse.json([])),
    );
    const { container } = renderApp(`/events/${event.id}`, { token: 'good-token' });
    const crumbs = await screen.findByRole('navigation', { name: 'breadcrumb' });
    await waitFor(() => expect(crumbs).toHaveTextContent('EventsPESOS X Silicon'));
    const nav = screen.getByRole('navigation', { name: 'Event sections' });
    await userEvent.click(within(nav).getByRole('link', { name: 'Teams' }));
    await waitFor(() => expect(crumbs).toHaveTextContent('EventsPESOS X SiliconTeams'));
    expect(within(nav).getByRole('link', { name: 'Teams' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    const sidebar = () => container.querySelector('[data-slot="sidebar"]');
    expect(sidebar()).toHaveAttribute('data-state', 'expanded');
    await userEvent.click(screen.getAllByRole('button', { name: 'Toggle Sidebar' })[0]!);
    expect(sidebar()).toHaveAttribute('data-state', 'collapsed');
  });

  it('sends staff to the portal', async () => {
    server.use(
      http.get(eventUrl, () => HttpResponse.json({ event, role: 'judge' })),
      http.get(`${eventUrl}/features`, () => HttpResponse.json([])),
    );
    renderApp(`/events/${event.id}`, { token: 'good-token' });
    expect(await screen.findByRole('alert')).toHaveTextContent("event's own portal");
  });

  it('says so when the event is missing or private', async () => {
    server.use(http.get(eventUrl, () => apiError(404, 'EVENT_NOT_FOUND', 'Event not found.')));
    renderApp(`/events/${event.id}`, { token: 'good-token' });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'does not exist or you are not part of it',
    );
  });

  it('shows other errors as they come', async () => {
    server.use(
      http.get(eventUrl, () =>
        apiError(403, 'API_KEY_INVALID', 'The API key is invalid or revoked.'),
      ),
    );
    renderApp(`/events/${event.id}`, { token: 'good-token' });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The API key is invalid or revoked.',
    );
  });
});

describe('NotFoundPage', () => {
  it('renders for unknown paths', async () => {
    renderApp('/nope');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
