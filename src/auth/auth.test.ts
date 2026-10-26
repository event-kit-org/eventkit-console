import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from './context';
import { safeNext } from './safe-next';
import { Session } from './session';
import { tokenStore } from './token-store';

afterEach(() => vi.restoreAllMocks());

describe('tokenStore', () => {
  it('persists, reads and clears the token', () => {
    tokenStore.set('abc');
    expect(tokenStore.get()).toBe('abc');
    tokenStore.clear();
    expect(tokenStore.get()).toBeNull();
  });

  it('survives storage being unavailable', () => {
    const boom = () => {
      throw new Error('denied');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(boom);
    expect(() => tokenStore.set('x')).not.toThrow();
    expect(tokenStore.get()).toBeNull();
    expect(() => tokenStore.clear()).not.toThrow();
  });
});

describe('Session', () => {
  it('starts from the stored token and notifies subscribers on change', () => {
    tokenStore.set('stored');
    const session = new Session();
    expect(session.get()).toBe('stored');

    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    session.set('next');
    session.set('next'); // no change, no notification
    expect(listener).toHaveBeenCalledTimes(1);
    expect(tokenStore.get()).toBe('next');

    session.set(null);
    expect(tokenStore.get()).toBeNull();
    unsubscribe();
    session.set('again');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('safeNext', () => {
  it.each([
    ['?next=%2Fevents%2F1', '/events/1'],
    ['?next=%2F%2Fevil.test', '/'],
    ['?next=https%3A%2F%2Fevil.test', '/'],
    ['', '/'],
  ])('%s → %s', (search, expected) => {
    expect(safeNext(search)).toBe(expected);
  });
});

describe('useAuth', () => {
  it('throws outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used inside <AuthProvider>.',
    );
  });
});
