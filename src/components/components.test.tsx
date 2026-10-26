import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormField } from './FormField';
import { Button } from './ui/button';

describe('Button', () => {
  it('renders as its child with asChild', () => {
    render(
      <Button asChild variant="outline">
        <a href="/x">Go</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Go' })).toHaveClass('border');
  });
});

describe('FormField', () => {
  it('links the hint, or the error when there is one', () => {
    const { rerender } = render(<FormField label="Name" hint="Your full name" />);
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Your full name');
    rerender(<FormField label="Name" hint="Your full name" error="Required" />);
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Required');
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
  });
});
