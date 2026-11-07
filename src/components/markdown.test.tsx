import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { Markdown } from './Markdown';
import { MarkdownTextarea } from './MarkdownTextarea';
import { TooltipProvider } from './ui/tooltip';

describe('Markdown', () => {
  it('renders formatting and opens links in a new tab', () => {
    render(<Markdown>{'**UPI**: [pay here](https://pay.example)\n- one\n- two'}</Markdown>);
    expect(screen.getByText('UPI').tagName).toBe('STRONG');
    const link = screen.getByRole('link', { name: 'pay here' });
    expect(link).toHaveAttribute('href', 'https://pay.example');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('keeps single line breaks, so plain text reads as before', () => {
    const { container } = render(<Markdown>{'Bank: Canara\nIFSC: CNRB0001234'}</Markdown>);
    expect(container.querySelector('br')).not.toBeNull();
  });

  it('does not render raw HTML', () => {
    const { container } = render(<Markdown>{'<img src=x onerror="alert(1)"> hi'}</Markdown>);
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows links as text when inert', () => {
    render(<Markdown inert>{'[site](https://x.example)'}</Markdown>);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('site')).toBeInTheDocument();
  });
});

function Controlled() {
  const [value, setValue] = useState('');
  return (
    <MarkdownTextarea aria-label="Body" value={value} onChange={(e) => setValue(e.target.value)} />
  );
}

function Registered() {
  const { register, control } = useForm({ defaultValues: { body: '' } });
  const body = useWatch({ control, name: 'body' });
  return (
    <>
      <MarkdownTextarea aria-label="Body" preview={body} {...register('body')} />
      <output>{body}</output>
    </>
  );
}

describe('MarkdownTextarea', () => {
  it('bolds the selection and previews the result', async () => {
    const user = userEvent.setup();
    render(<Controlled />, { wrapper: TooltipProvider });
    const box = screen.getByRole('textbox', { name: 'Body' });
    await user.type(box, 'pay now');
    (box as HTMLTextAreaElement).setSelectionRange(4, 7);
    await user.click(screen.getByRole('button', { name: 'Bold' }));
    expect(box).toHaveValue('pay **now**');

    await user.click(screen.getByRole('tab', { name: 'Preview' }));
    expect(screen.getByText('now').tagName).toBe('STRONG');
    await user.click(screen.getByRole('tab', { name: 'Write' }));
    expect(screen.getByRole('textbox', { name: 'Body' })).toHaveValue('pay **now**');
  });

  it('works with react-hook-form register', async () => {
    const user = userEvent.setup();
    render(<Registered />, { wrapper: TooltipProvider });
    const box = screen.getByRole('textbox', { name: 'Body' });
    await user.type(box, 'a\nb');
    (box as HTMLTextAreaElement).setSelectionRange(0, 3);
    await user.click(screen.getByRole('button', { name: 'Bulleted list' }));
    expect(screen.getByRole('status')).toHaveTextContent('- a - b');
  });
});

it('counts characters against maxLength', () => {
  render(
    <MarkdownTextarea aria-label="Body" maxLength={2000} value="hello" onChange={() => {}} />,
    {
      wrapper: TooltipProvider,
    },
  );
  expect(screen.getByRole('textbox', { name: 'Body' })).toHaveAttribute('maxLength', '2000');
  expect(screen.getByText('5/2000')).toBeInTheDocument();
});
