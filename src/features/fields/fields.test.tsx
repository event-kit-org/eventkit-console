import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/api/client';
import { teamDisplayStatus } from '@/lib/status';
import { AnswerList, FieldInputs, RuleChecklist } from './FieldInputs';
import {
  checkRules,
  type Draft,
  type Field,
  fieldErrors,
  memberFields,
  missingRequired,
  teamFields,
  answerText,
  toAnswers,
  toDraft,
  toggleOption,
} from './fields';

const f = (over: Partial<Field>): Field => ({
  id: 'f',
  scope: 'member',
  label: 'Field',
  help: null,
  type: 'short_text',
  options: [],
  required: false,
  unique: false,
  pattern: null,
  position: 0,
  ...over,
});

const dept = f({
  id: 'dept',
  label: 'Department',
  type: 'choice',
  options: ['CSE', 'ECE'],
  required: true,
});
const srn = f({ id: 'srn', label: 'SRN', required: true, help: 'From your ID card' });
const year = f({ id: 'year', label: 'Year', type: 'number' });
const idea = f({ id: 'idea', label: 'Idea', type: 'long_text', scope: 'team' });

describe('field helpers', () => {
  it('splits fields by who fills them in', () => {
    const all = [dept, srn, year, idea];
    expect(teamFields(all)).toEqual([idea]);
    expect(memberFields(all)).toEqual([dept, srn, year]);
  });

  it('converts between form state and payloads', () => {
    expect(toDraft({ dept: 'CSE', year: 2 })).toEqual({ dept: 'CSE', year: '2' });
    expect(toDraft(undefined)).toEqual({});
    expect(toAnswers([dept, srn, year], { dept: 'CSE', srn: '  ', year: '3' })).toEqual({
      dept: 'CSE',
      srn: null,
      year: 3,
    });
    expect(missingRequired([dept, srn, year], { dept: 'CSE', srn: ' ' })).toEqual([srn]);
  });

  it('maps API answer errors to fields', () => {
    const err = new ApiError(400, 'INVALID_ANSWERS', 'x', [
      { path: '/answers/dept', message: 'Department is required.' },
      { path: '/memberAnswers/srn', message: 'SRN: bad' },
    ]);
    expect(fieldErrors(err, '/answers')).toEqual({ dept: 'Department is required.' });
    expect(fieldErrors(err, '/memberAnswers')).toEqual({ srn: 'SRN: bad' });
    expect(fieldErrors(new ApiError(409, 'OTHER', 'x'), '/answers')).toEqual({});
    expect(fieldErrors(new Error('x'), '/answers')).toEqual({});
  });

  it('checks team rules', () => {
    const rule = {
      id: 'r',
      fieldId: 'dept',
      fieldLabel: 'Department',
      value: 'CSE',
      minCount: 2,
      description: 'At least 2 members with Department: CSE',
    };
    expect(checkRules([rule], [{ dept: 'CSE' }, { dept: 'ECE' }])).toEqual([
      { rule, count: 1, met: false },
    ]);
    expect(checkRules([rule], [{ dept: 'CSE' }, { dept: 'CSE' }, {}])[0]!.met).toBe(true);
  });

  it('shows a registered team waiting for review as "Confirmation pending"', () => {
    expect(
      teamDisplayStatus({
        status: 'registered',
        latestProofStatus: 'pending',
      }),
    ).toBe('confirmation_pending');
    expect(
      teamDisplayStatus({
        status: 'shortlisted',
        latestProofStatus: 'pending',
      }),
    ).toBe('confirmation_pending');
    expect(
      teamDisplayStatus({
        status: 'registered',
        latestProofStatus: 'rejected',
      }),
    ).toBe('registered');
  });
});

describe('multi-select and date-time helpers', () => {
  const stack = f({ id: 'stack', type: 'multi_choice', options: ['A', 'B'], required: true });
  const at = f({ id: 'at', type: 'datetime' });
  it('turn drafts into answers and back', () => {
    expect(toAnswers([stack, at], { stack: ['B'], at: '2026-10-31T09:30' })).toEqual({
      stack: ['B'],
      at: '2026-10-31T09:30+05:30',
    });
    expect(toAnswers([stack, at], { stack: [], at: '' })).toEqual({ stack: null, at: null });
    expect(toDraft({ stack: ['A'], at: '2026-10-31T04:00:00Z' }, [stack, at])).toEqual({
      stack: ['A'],
      at: '2026-10-31T09:30',
    });
    expect(missingRequired([stack], { stack: [] })).toEqual([stack]);
    expect(toggleOption(['A'], 'A')).toEqual([]);
    expect(toggleOption(undefined, 'B')).toEqual(['B']);
    expect(answerText(['A', 'B'])).toBe('A, B');
    expect(answerText('2026-10-31T04:00:00Z', 'datetime')).toBe('31 Oct 2026, 9:30 am IST');
    expect(answerText(undefined)).toBe('');
    expect(answerText(4)).toBe('4');
  });
});

describe('FieldInputs', () => {
  function Harness({ fields, errors }: { fields: Field[]; errors?: Record<string, string> }) {
    const [draft, setDraft] = useState<Draft>({});
    return (
      <>
        <FieldInputs fields={fields} draft={draft} onChange={setDraft} errors={errors} />
        <output>{JSON.stringify(draft)}</output>
      </>
    );
  }

  it('renders each type and collects values', async () => {
    render(<Harness fields={[dept, srn, year, idea]} />);
    await userEvent.selectOptions(screen.getByLabelText('Department'), 'CSE');
    await userEvent.type(screen.getByLabelText('SRN'), 'PES1');
    await userEvent.type(screen.getByLabelText(/Idea/), 'Queue app');
    expect(screen.getByLabelText(/Year/)).toHaveAttribute('type', 'number');
    expect(screen.getByLabelText('SRN')).toHaveAccessibleDescription('From your ID card');
    expect(screen.getAllByText('(optional)', { exact: false })).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent(
      '{"dept":"CSE","srn":"PES1","idea":"Queue app"}',
    );
  });

  it('ticks checkboxes for a multi-select and takes a date and time', async () => {
    const stack = f({ id: 'stack', label: 'Stack', type: 'multi_choice', options: ['A', 'B'] });
    const at = f({ id: 'at', label: 'Demo at', type: 'datetime' });
    render(<Harness fields={[stack, at]} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'B' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'A' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'B' }));
    expect(screen.getByLabelText(/Demo at/)).toHaveAttribute('type', 'datetime-local');
    expect(screen.getByRole('status')).toHaveTextContent('{"stack":["A"]}');
  });

  it('shows errors in place of help', () => {
    render(<Harness fields={[srn]} errors={{ srn: 'SRN: Does not match the expected format.' }} />);
    expect(screen.getByLabelText('SRN')).toHaveAccessibleDescription(
      'SRN: Does not match the expected format.',
    );
    expect(screen.getByLabelText('SRN')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders nothing for no fields', () => {
    const { container } = render(<FieldInputs fields={[]} draft={{}} onChange={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('AnswerList and RuleChecklist', () => {
  it('lists answered fields only', () => {
    render(<AnswerList fields={[dept, srn]} answers={{ dept: 'CSE' }} />);
    expect(screen.getByText('Department:')).toBeInTheDocument();
    expect(screen.queryByText('SRN:')).not.toBeInTheDocument();
    const { container } = render(<AnswerList fields={[dept]} answers={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('marks met and unmet rules', () => {
    const rule = { id: 'r', description: 'At least 2 members with Department: CSE', minCount: 2 };
    render(
      <RuleChecklist
        checks={[
          { rule, count: 3, met: true },
          { rule: { ...rule, id: 'r2' }, count: 1, met: false },
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual([
      '✓ At least 2 members with Department: CSE (2 of 2)',
      '✗ At least 2 members with Department: CSE (1 of 2)',
    ]);
    const { container } = render(<RuleChecklist checks={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
