import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { capture, confirmDialog } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { API, apiError, server, user } from '@/test/server';

const session = (accessToken: string) => ({
  user,
  token: { accessToken, tokenType: 'Bearer', expiresIn: '7d' },
});

/** The card whose title is `title` (buttons can share the words). */
const card = async (title: string) => {
  const titles = await screen.findAllByText(title, { selector: '[data-slot="card-title"]' });
  return within(titles[0]!.closest('[data-slot="card"]') as HTMLElement);
};

describe('account settings', () => {
  it('opens from the account menu and shows who you are', async () => {
    const { router } = renderApp('/', { token: 'good-token' });
    await userEvent.click(await screen.findByRole('button', { name: 'Account' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Account settings/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/account'));
    const profile = await card('Profile');
    expect(profile.getByText(user.email)).toBeInTheDocument();
  });

  it('changes the password and keeps this device signed in', async () => {
    // The new token must still work for /me.
    server.use(http.get(`${API}/v1/auth/me`, () => HttpResponse.json(user)));
    const change = capture('post', `${API}/v1/auth/password`, session('fresh-token'));
    const { session: s } = renderApp('/account', { token: 'good-token' });
    const form = await card('Change password');
    await userEvent.type(form.getByLabelText('Current password'), 'old-password');
    await userEvent.type(form.getByLabelText('New password'), 'new-password');
    await userEvent.type(form.getByLabelText('Confirm new password'), 'new-passwerd');
    await userEvent.click(form.getByRole('button', { name: 'Change password' }));
    expect(await form.findByText("The passwords don't match.")).toBeInTheDocument();
    await userEvent.clear(form.getByLabelText('Confirm new password'));
    await userEvent.type(form.getByLabelText('Confirm new password'), 'new-password');
    await userEvent.click(form.getByRole('button', { name: 'Change password' }));
    expect(await form.findByText(/Password changed/)).toBeInTheDocument();
    expect(change[0]?.body).toEqual({
      currentPassword: 'old-password',
      newPassword: 'new-password',
    });
    expect(s.get()).toBe('fresh-token');
  });

  it('shows a wrong current password without signing out', async () => {
    server.use(
      http.post(`${API}/v1/auth/password`, () =>
        apiError(400, 'WRONG_PASSWORD', 'Your current password is incorrect.'),
      ),
    );
    const { session: s } = renderApp('/account', { token: 'good-token' });
    const form = await card('Change password');
    await userEvent.type(form.getByLabelText('Current password'), 'nope-nope');
    await userEvent.type(form.getByLabelText('New password'), 'new-password');
    await userEvent.type(form.getByLabelText('Confirm new password'), 'new-password');
    await userEvent.click(form.getByRole('button', { name: 'Change password' }));
    expect(await form.findByText('Your current password is incorrect.')).toBeInTheDocument();
    expect(s.get()).toBe('good-token');
  });

  it('refuses to delete while you own events, listing them', async () => {
    server.use(
      http.delete(`${API}/v1/auth/me`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'OWNS_EVENTS',
              message: 'You own an event: delete it first.',
              details: [{ id: 'e1', name: 'MachZero' }],
            },
          },
          { status: 409 },
        ),
      ),
    );
    renderApp('/account', { token: 'good-token' });
    const danger = await card('Delete account');
    await userEvent.type(danger.getByLabelText('Your password'), 'password123');
    await userEvent.click(danger.getByRole('button', { name: 'Delete account' }));
    await confirmDialog('Delete account');
    expect(await danger.findByRole('link', { name: 'MachZero' })).toHaveAttribute(
      'href',
      '/events/e1/settings',
    );
  });

  it('deletes the account and signs out', async () => {
    const remove = capture('delete', `${API}/v1/auth/me`, null, 204);
    const { router, session: s } = renderApp('/account', { token: 'good-token' });
    const danger = await card('Delete account');
    await userEvent.type(danger.getByLabelText('Your password'), 'password123');
    await userEvent.click(danger.getByRole('button', { name: 'Delete account' }));
    await confirmDialog('Delete account');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(remove[0]?.body).toEqual({ password: 'password123' });
    expect(s.get()).toBeNull();
  });
});

describe('forgot and reset password', () => {
  it('asks for a link from the login page, saying the same whatever the email', async () => {
    const forgot = capture('post', `${API}/v1/auth/password/forgot`, null, 202);
    const { router } = renderApp('/login');
    await userEvent.click(await screen.findByRole('link', { name: 'Forgot password?' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/forgot-password'));
    await userEvent.type(await screen.findByLabelText('Email'), 'asha@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send the link' }));
    expect(await screen.findByText(/If an account uses that email/)).toBeInTheDocument();
    expect(forgot[0]?.body).toEqual({ email: 'asha@example.com' });
  });

  it('shows when reset is not set up', async () => {
    server.use(
      http.post(`${API}/v1/auth/password/forgot`, () =>
        apiError(409, 'RESET_UNAVAILABLE', 'Password reset is not set up on this eventKit server.'),
      ),
    );
    renderApp('/forgot-password');
    await userEvent.type(await screen.findByLabelText('Email'), 'asha@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send the link' }));
    expect(await screen.findByText(/not set up/)).toBeInTheDocument();
  });

  it('sets a new password from the link and signs in', async () => {
    const reset = capture('post', `${API}/v1/auth/password/reset`, session('good-token'));
    const { router, session: s } = renderApp('/reset-password?token=tok123');
    await userEvent.type(await screen.findByLabelText('New password'), 'new-password');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'new-password');
    await userEvent.click(screen.getByRole('button', { name: 'Save and log in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(reset[0]?.body).toEqual({ token: 'tok123', newPassword: 'new-password' });
    expect(s.get()).toBe('good-token');
  });

  it('offers a new link when this one has expired, or is missing', async () => {
    server.use(
      http.post(`${API}/v1/auth/password/reset`, () =>
        apiError(400, 'RESET_LINK_INVALID', 'This reset link has expired or was already used.'),
      ),
    );
    renderApp('/reset-password?token=old');
    await userEvent.type(await screen.findByLabelText('New password'), 'new-password');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'new-password');
    await userEvent.click(screen.getByRole('button', { name: 'Save and log in' }));
    expect(await screen.findByText(/expired or was already used/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('says so when the link has no token', async () => {
    renderApp('/reset-password');
    expect(await screen.findByText(/This link is incomplete/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save and log in' })).toBeDisabled();
  });
});
