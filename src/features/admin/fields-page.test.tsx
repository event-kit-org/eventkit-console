import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '@/api/client';
import { asRole, capture, confirmDialog, E, registeredTeam } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { event, server } from '@/test/server';

afterEach(() => vi.restoreAllMocks());

const field = (over: Partial<Schemas['EventField']>): Schemas['EventField'] => ({
  id: 'f',
  scope: 'member',
  label: 'Field',
  help: null,
  type: 'short_text',
  options: [],
  required: true,
  unique: false,
  pattern: null,
  position: 0,
  ...over,
});
const DEPT = field({ id: 'dept', label: 'Department', type: 'choice', options: ['CSE', 'ECE'] });
const SRN = field({ id: 'srn', label: 'SRN', unique: true, pattern: 'PES\\d+' });
const PROJECT = field({ id: 'project', scope: 'team', label: 'Project title', required: false });

function open(fields: Schemas['EventField'][] = [PROJECT, DEPT, SRN], rules: object[] = []) {
  asRole('admin');
  server.use(
    http.get(`${E}/fields`, () => HttpResponse.json(fields)),
    http.get(`${E}/team-rules`, () => HttpResponse.json(rules)),
  );
  return renderApp(`/events/${event.id}/form`, { token: 'good-token' });
}

const RULE = {
  id: 'rule',
  fieldId: 'dept',
  fieldLabel: 'Department',
  value: 'CSE',
  minCount: 2,
  description: 'At least 2 members with Department: CSE',
};

const section = (name: string) => screen.getByRole('region', { name }) as HTMLElement;

describe('registration form builder', () => {
  it('shows questions as a preview, grouped into sections by who answers them', async () => {
    open([PROJECT, DEPT, SRN], [RULE]);
    const team = await screen.findByRole('region', { name: 'Team details' });
    expect(
      await within(team).findByRole('button', { name: 'Edit Project title' }),
    ).toBeInTheDocument();
    const leader = section('Member details');
    const dept = within(leader).getByRole('button', { name: 'Edit Department' });
    expect(dept).toHaveTextContent('1. CSE · at least 2 per team');
    expect(dept).toHaveTextContent('2. ECE');
    expect(within(leader).getByRole('button', { name: 'Edit SRN' })).toHaveTextContent(
      'Unique answers · Format: PES\\d+',
    );
    const nav = screen.getByRole('navigation', { name: 'Event sections' });
    expect(within(nav).getByRole('link', { name: 'Registration form' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('edits a saved question in place, saving each change', async () => {
    const patch = capture('patch', `${E}/fields/dept`, DEPT);
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Department' }));
    expect(screen.getByLabelText('Question type')).toBeDisabled();

    const label = screen.getByLabelText('Question');
    await userEvent.clear(label);
    await userEvent.type(label, 'Branch{Enter}');
    await userEvent.click(screen.getByRole('switch', { name: 'Required' }));
    await userEvent.type(screen.getByLabelText('Add option'), 'ME{Enter}');
    const second = screen.getByLabelText('Option 2');
    await userEvent.clear(second);
    await userEvent.type(second, 'EEE{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Remove CSE' }));
    await userEvent.click(screen.getByRole('button', { name: 'More options' }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: /Unique answers/ }));
    await waitFor(() =>
      expect(patch.map((c) => c.body)).toEqual([
        { label: 'Branch' },
        { required: false },
        { options: ['CSE', 'ECE', 'ME'] },
        { options: ['CSE', 'EEE'] },
        { options: ['ECE'] },
        { unique: true },
      ]),
    );
  });

  it('adds a description and an answer format from the menu', async () => {
    const patch = capture('patch', `${E}/fields/srn`, SRN);
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit SRN' }));
    expect(screen.getByLabelText('Answer format')).toHaveValue('PES\\d+');
    await userEvent.click(screen.getByRole('button', { name: 'More options' }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: /Description/ }));
    await userEvent.type(screen.getByLabelText('Description'), 'From your ID card{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'More options' }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: /Answer format/ }));
    expect(screen.queryByLabelText('Answer format')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(patch.map((c) => c.body)).toEqual([{ help: 'From your ID card' }, { pattern: null }]),
    );
  });

  it('sets team minimums next to dropdown options', async () => {
    const create = capture('post', `${E}/team-rules`, { ...RULE, value: 'ECE', minCount: 1 }, 201);
    const remove = capture('delete', `${E}/team-rules/rule`, null, 204);
    open([PROJECT, DEPT, SRN], [RULE]);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Department' }));
    expect(screen.getByLabelText('Minimum members per team choosing CSE')).toHaveValue(2);
    await userEvent.type(
      screen.getByLabelText('Minimum members per team choosing ECE'),
      '1{Enter}',
    );
    await waitFor(() =>
      expect(create.map((c) => c.body)).toEqual([{ fieldId: 'dept', value: 'ECE', minCount: 1 }]),
    );
    // Changing a minimum replaces its rule; clearing it removes the rule.
    await userEvent.clear(screen.getByLabelText('Minimum members per team choosing CSE'));
    await userEvent.tab();
    await waitFor(() => expect(remove).toHaveLength(1));
    expect(create).toHaveLength(1);
  });

  it('has no team minimums on team questions', async () => {
    open([field({ id: 'track', scope: 'team', label: 'Track', type: 'choice', options: ['AI'] })]);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Track' }));
    expect(screen.getByLabelText('Option 1')).toHaveValue('AI');
    expect(screen.queryByLabelText(/Minimum members/)).not.toBeInTheDocument();
  });

  it('adds a dropdown question with team minimums to a section', async () => {
    const create = capture('post', `${E}/fields`, { ...DEPT, id: 'new' }, 201);
    const rule = capture('post', `${E}/team-rules`, RULE, 201);
    open([]);
    const leader = await screen.findByRole('region', { name: 'Member details' });
    await userEvent.click(within(leader).getByRole('button', { name: 'Add question' }));
    const add = within(leader).getByRole('button', { name: 'Add question' });
    expect(add).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Question'), 'Department');
    await userEvent.selectOptions(screen.getByLabelText('Question type'), 'choice');
    const first = screen.getByLabelText('Option 1');
    await userEvent.clear(first);
    await userEvent.type(first, 'CSE{Enter}');
    await userEvent.type(screen.getByLabelText('Add option'), 'ECE{Enter}');
    await userEvent.type(
      screen.getByLabelText('Minimum members per team choosing CSE'),
      '2{Enter}',
    );
    await userEvent.click(add);
    await waitFor(() =>
      expect(create[0]?.body).toEqual({
        scope: 'member',
        label: 'Department',
        type: 'choice',
        required: true,
        unique: false,
        options: ['CSE', 'ECE'],
      }),
    );
    await waitFor(() =>
      expect(rule[0]?.body).toEqual({ fieldId: 'new', value: 'CSE', minCount: 2 }),
    );
  });

  it('adds a text question with a format, or cancels a draft', async () => {
    const create = capture('post', `${E}/fields`, PROJECT, 201);
    open([]);
    const team = await screen.findByRole('region', { name: 'Team details' });
    await userEvent.click(within(team).getByRole('button', { name: 'Add question' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Question')).not.toBeInTheDocument();

    await userEvent.click(within(team).getByRole('button', { name: 'Add question' }));
    await userEvent.type(screen.getByLabelText('Question'), 'Team code');
    await userEvent.click(screen.getByRole('switch', { name: 'Required' }));
    await userEvent.click(screen.getByRole('button', { name: 'More options' }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: /Answer format/ }));
    await userEvent.type(screen.getByLabelText('Answer format'), 'T\\d+');
    await userEvent.click(within(team).getByRole('button', { name: 'Add question' }));
    await waitFor(() =>
      expect(create[0]?.body).toEqual({
        scope: 'team',
        label: 'Team code',
        type: 'short_text',
        required: false,
        unique: false,
        pattern: 'T\\d+',
      }),
    );
  });

  it('reorders, duplicates and deletes questions', async () => {
    const deptMoves = capture('patch', `${E}/fields/dept`, DEPT);
    const srnMoves = capture('patch', `${E}/fields/srn`, SRN);
    const copy = capture('post', `${E}/fields`, { ...SRN, id: 'copy' }, 201);
    const remove = capture('delete', `${E}/fields/srn`, null, 204);
    open([
      { ...PROJECT, position: 0 },
      { ...DEPT, position: 1 },
      { ...SRN, position: 2 },
    ]);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit SRN' }));
    expect(screen.getByRole('button', { name: 'Move down SRN' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Move up SRN' }));
    await waitFor(() => {
      expect(srnMoves.map((c) => c.body)).toEqual([{ position: 1 }]);
      expect(deptMoves.map((c) => c.body)).toEqual([{ position: 2 }]);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate SRN' }));
    await waitFor(() =>
      expect(copy[0]?.body).toEqual({
        scope: 'member',
        label: 'SRN (copy)',
        type: 'short_text',
        required: true,
        unique: true,
        pattern: 'PES\\d+',
      }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Edit SRN' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete SRN' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Delete "SRN"?');
    await confirmDialog('Delete');
    await waitFor(() => expect(remove).toHaveLength(1));
  });
});

describe('answers on admin team pages', () => {
  it('team detail shows team and member answers, and "Confirmation pending"', async () => {
    asRole('admin');
    const t = registeredTeam('registered', {
      answers: { project: 'Smart canteen' },
      payment: {
        mode: 'at_registration',
        amountDue: 100000,
        currency: 'INR',
        deadline: null,
        proofs: [
          {
            id: 'p',
            teamId: 't',
            status: 'pending',
            amount: 100000,
            currency: 'INR',
            memberCount: 2,
            uploadedAt: event.createdAt,
            verifiedAt: null,
            rejectionNote: null,
          },
        ],
      },
    });
    t.members = t.members.map((m, i) => ({ ...m, answers: { dept: i === 0 ? 'CSE' : 'ECE' } }));
    server.use(
      http.get(`${E}/fields`, () => HttpResponse.json([PROJECT, DEPT])),
      http.get(`${E}/teams/${t.id}`, () => HttpResponse.json(t)),
    );
    renderApp(`/events/${event.id}/teams/${t.id}`, { token: 'good-token' });
    expect(await screen.findByText('Confirmation pending')).toBeInTheDocument();
    expect(await screen.findByText('Smart canteen')).toBeInTheDocument();
    expect(screen.getByText('ECE')).toBeInTheDocument();
  });

  it('teams list can filter by "Confirmation pending"', async () => {
    asRole('admin');
    const row = (name: string, latestProofStatus: string | null) => ({
      id: name,
      name,
      leader: { id: 'l', name: 'L', email: 'l@example.com' },
      stage: 'registered',
      status: 'registered',
      memberCount: 3,
      belowMinimum: false,
      latestProofStatus,
      createdAt: event.createdAt,
    });
    server.use(
      http.get(`${E}/teams`, () =>
        HttpResponse.json([row('Waiting', 'pending'), row('Rejected', 'rejected')]),
      ),
    );
    renderApp(`/events/${event.id}/teams`, { token: 'good-token' });
    expect(await screen.findByRole('link', { name: 'Rejected' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Show'), 'confirmation_pending');
    expect(screen.getByRole('link', { name: 'Waiting' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Rejected' })).not.toBeInTheDocument();
  });
});
