import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { API, apiError, server, user } from '@/test/server';

const session = {
  user,
  token: { accessToken: 'good-token', tokenType: 'Bearer', expiresIn: '7d' },
};

describe('route protection', () => {
  it('sends anonymous visitors to login, remembering where they were going', async () => {
    const { router } = renderApp('/events/abc');
    await screen.findByRole('heading', { name: 'Log in' });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('?next=%2Fevents%2Fabc');
  });

  it('logs out when the stored token is rejected', async () => {
    const { session: s } = renderApp('/', { token: 'expired-token' });
    await screen.findByRole('heading', { name: 'Log in' });
    expect(s.get()).toBeNull();
  });

  it('keeps the token on other errors and shows loading', async () => {
    server.use(http.get(`${API}/v1/auth/me`, () => apiError(500, 'INTERNAL_ERROR', 'oops')));
    const { session: s } = renderApp('/', { token: 'good-token' });
    expect(await screen.findByText('Loading…')).toBeInTheDocument();
    await waitFor(() => expect(s.get()).toBe('good-token'));
  });
});

describe('LoginPage', () => {
  it('validates before sending', async () => {
    renderApp('/login');
    await userEvent.click(await screen.findByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Enter a valid email.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
  });

  it('logs in and goes to the remembered page', async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/v1/auth/login`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(session);
      }),
    );
    const { router, session: s } = renderApp('/login?next=%2Fsomewhere');
    await userEvent.type(await screen.findByLabelText('Email'), 'asha@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/somewhere'));
    expect(body).toEqual({ email: 'asha@example.com', password: 'password123' });
    expect(s.get()).toBe('good-token');
    expect(window.localStorage.getItem('eventkit.accessToken')).toBe('good-token');
  });

  it('shows the API error', async () => {
    server.use(
      http.post(`${API}/v1/auth/login`, () =>
        apiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.'),
      ),
    );
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'asha@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  });

  it('shows a connection message when the network fails', async () => {
    server.use(http.post(`${API}/v1/auth/login`, () => HttpResponse.error()));
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'asha@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Check your connection');
  });

  it('skips the form when already logged in', async () => {
    const { router } = renderApp('/login', { token: 'good-token' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('links to sign-up, keeping ?next', async () => {
    const { router } = renderApp('/login?next=%2Fx');
    await userEvent.click(await screen.findByRole('link', { name: 'Create an account' }));
    expect(router.state.location.pathname).toBe('/signup');
    expect(router.state.location.search).toBe('?next=%2Fx');
  });
});

describe('SignupPage', () => {
  async function fill(phone = '') {
    await userEvent.type(await screen.findByLabelText('Name'), 'Asha');
    await userEvent.type(screen.getByLabelText('Email'), 'asha@example.com');
    if (phone) await userEvent.type(screen.getByLabelText('Phone (optional)'), phone);
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  }

  it('signs up without a phone and lands on the events page', async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/v1/auth/signup`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(session, { status: 201 });
      }),
    );
    const { router } = renderApp('/signup');
    await fill();
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(body).toEqual({ name: 'Asha', email: 'asha@example.com', password: 'password123' });
  });

  it('sends the phone when given', async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${API}/v1/auth/signup`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(session, { status: 201 });
      }),
    );
    renderApp('/signup');
    await fill('+91 98765 43210');
    await waitFor(() => expect(body.phone).toBe('+91 98765 43210'));
  });

  it('enforces the 8-character minimum and a sane phone', async () => {
    renderApp('/signup');
    await userEvent.type(await screen.findByLabelText('Phone (optional)'), 'call me');
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid phone number, or leave it empty.')).toBeInTheDocument();
    expect(screen.getByText('Enter your name.')).toBeInTheDocument();
  });

  it('shows a taken email', async () => {
    server.use(
      http.post(`${API}/v1/auth/signup`, () =>
        apiError(409, 'EMAIL_TAKEN', 'An account with this email already exists.'),
      ),
    );
    renderApp('/signup');
    await fill();
    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
  });

  it('shows a connection message when the network fails', async () => {
    server.use(http.post(`${API}/v1/auth/signup`, () => HttpResponse.error()));
    renderApp('/signup');
    await fill();
    expect(await screen.findByRole('alert')).toHaveTextContent('Check your connection');
  });

  it('links back to login', async () => {
    const { router } = renderApp('/signup');
    await userEvent.click(await screen.findByRole('link', { name: 'Log in' }));
    expect(router.state.location.pathname).toBe('/login');
  });

  it('skips the form when already logged in', async () => {
    const { router } = renderApp('/signup?next=%2Fevents%2F1', { token: 'good-token' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/events/1'));
  });
});
