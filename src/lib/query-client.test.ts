import { expect, it } from 'vitest';
import { createQueryClient } from './query-client';

it('does not refetch on window focus', () => {
  expect(createQueryClient().getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
});
