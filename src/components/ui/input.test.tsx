import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Input } from './input';

describe('Input', () => {
  it('shows and hides a password with the eye button', async () => {
    render(<Input aria-label="Password" type="password" defaultValue="hunter22" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('hunter22');
    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('adds no button to other inputs', () => {
    render(<Input aria-label="Email" type="email" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
