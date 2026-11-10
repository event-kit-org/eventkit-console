import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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

  it('lists submissions and assignments among the features', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Submissions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Assignments' })).toBeInTheDocument();
  });

  it('glides to the features instead of jumping', async () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    renderApp('/');
    await userEvent.click(await screen.findByRole('link', { name: 'See what it does' }));
    expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(window.location.hash).toBe('#features');
    scroll.mockRestore();
  });

  it('leads from the hero to the SDK docs', async () => {
    const { router } = renderApp('/');
    await userEvent.click(await screen.findByRole('link', { name: /build with the sdk/i }));
    expect(router.state.location.pathname).toBe('/docs/sdk');
    expect(
      await screen.findByRole('heading', { name: /build your event's own site/i }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'eventKit' }));
    await screen.findByRole('heading', { name: /run your whole event/i });
    expect(document.title).toBe('eventKit');
  });
});

describe('SdkDocsPage', () => {
  it('is public: no sign-in needed', async () => {
    const { router } = renderApp('/docs/sdk');
    expect(
      await screen.findByRole('heading', { name: /build your event's own site/i }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/docs/sdk');
    expect(document.title).toBe('SDK docs · eventKit');
  });

  it('lists every section and links to it', async () => {
    renderApp('/docs/sdk');
    const contents = await screen.findByRole('navigation', { name: 'On this page' });
    for (const name of [
      'Install',
      'Create a client',
      'Register a team',
      'Volunteers and scanning',
    ]) {
      expect(screen.getByRole('heading', { name, level: 2 })).toBeInTheDocument();
      expect(within(contents).getByRole('link', { name })).toHaveAttribute(
        'href',
        expect.stringMatching(/^#/),
      );
    }
  });

  it('copies a code sample', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    renderApp('/docs/sdk');
    const [first] = await screen.findAllByRole('button', { name: 'Copy code' });
    await user.click(first!);
    expect(writeText).toHaveBeenCalledWith('npm install github:event-kit-org/eventkit-sdk');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('leads home and to sign-up', async () => {
    renderApp('/docs/sdk');
    expect(await screen.findByRole('link', { name: 'Create an event' })).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(screen.getByRole('link', { name: 'eventKit' })).toHaveAttribute('href', '/');
  });

  it('shows the same page when signed in', async () => {
    renderApp('/docs/sdk', { token: 'good-token' });
    expect(
      await screen.findByRole('heading', { name: /build your event's own site/i }),
    ).toBeInTheDocument();
  });
});
