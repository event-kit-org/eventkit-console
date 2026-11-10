import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';

describe('LandingPage', () => {
  it('is what anonymous visitors see at /', async () => {
    renderApp('/');
    expect(
      await screen.findByRole('heading', { name: /run your whole event/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('opens the console at the login page', async () => {
    const { router } = renderApp('/');
    await userEvent.click(await screen.findByRole('link', { name: 'Open the console' }));
    await screen.findByRole('heading', { name: 'Log in' });
    expect(router.state.location.pathname).toBe('/login');
  });

  it('leads to sign-up from the closing call to action', async () => {
    const { router } = renderApp('/');
    await userEvent.click(await screen.findByRole('link', { name: /create an account/i }));
    expect(router.state.location.pathname).toBe('/signup');
  });

  it('is skipped when signed in', async () => {
    renderApp('/', { token: 'good-token' });
    await screen.findByRole('heading', { name: 'PESOS X Silicon' });
    expect(screen.queryByRole('heading', { name: /run your whole event/i })).toBeNull();
  });
});
