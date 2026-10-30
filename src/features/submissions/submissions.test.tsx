import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Schemas } from '@/api/client';
import { asRole, capture, confirmDialog, E } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { apiError, event, server } from '@/test/server';

const R1 = '66666666-6666-4666-8666-666666666661';
const R2 = '66666666-6666-4666-8666-666666666662';
const stamp = event.createdAt;
const rounds: Schemas['Round'][] = [
  { id: R1, name: 'Round 1', position: 0, phase: 'released', createdAt: stamp, updatedAt: stamp },
  { id: R2, name: 'Finals', position: 1, phase: 'draft', createdAt: stamp, updatedAt: stamp },
];
const f = (over: Partial<Schemas['SubmissionField']>): Schemas['SubmissionField'] => ({
  id: 'q1',
  label: 'Repo link',
  help: null,
  type: 'short_text',
  options: [],
  required: true,
  unique: false,
  pattern: null,
  position: 0,
  ...over,
});
const sub = (over: Partial<Schemas['Submission']> = {}): Schemas['Submission'] => ({
  id: 's1',
  round: { id: R1, name: 'Round 1', phase: 'released' },
  title: 'Prototype',
  description: 'Show it',
  position: 0,
  deadline: null,
  fields: [
    f({}),
    f({ id: 'q2', label: 'Track', type: 'choice', options: ['A', 'B'], position: 1 }),
  ],
  entryCount: 1,
  createdAt: stamp,
  updatedAt: stamp,
  ...over,
});
const entry: Schemas['SubmissionEntry'] = {
  id: 'e1',
  submissionId: 's1',
  team: { id: 't1', name: 'Byte Club' },
  answers: { q1: 'https://git.test/x' },
  submittedBy: { registrationId: 'r1', name: 'Asha' },
  late: false,
  createdAt: stamp,
  updatedAt: stamp,
};
function open(
  path: string,
  list = [
    sub(),
    sub({
      id: 's2',
      title: 'Pitch',
      round: { id: R2, name: 'Finals', phase: 'draft' },
      fields: [],
      entryCount: 0,
    }),
  ],
) {
  asRole('admin');
  server.use(
    http.get(`${E}/rounds`, () => HttpResponse.json(rounds)),
    http.get(`${E}/submissions`, () => HttpResponse.json(list)),
    http.get(`${E}/submissions/s1/entries`, () => HttpResponse.json([entry])),
  );
  return renderApp(`/events/${event.id}/submissions${path}`, { token: 'good-token' });
}

describe('submissions list', () => {
  it('groups by round with phase badges, creates, duplicates and deletes', async () => {
    const made = capture('post', `${E}/submissions`, sub(), 201);
    const dup = capture('post', `${E}/submissions/s1/duplicate`, sub(), 201);
    open('');
    const r1 = await screen.findByRole('region', { name: 'Round 1' });
    expect(within(r1).getByText('Released')).toBeInTheDocument();
    expect(within(r1).getByText('Prototype')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Finals' })).getByText('Pitch'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Duplicate Prototype' }));
    await waitFor(() => expect(dup).toHaveLength(1));

    server.use(
      http.delete(`${E}/submissions/s1`, () =>
        apiError(409, 'SUBMISSION_HAS_ENTRIES', 'Teams have submitted this.'),
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete Prototype' }));
    await confirmDialog('Delete');
    expect(await screen.findByText('Teams have submitted this.')).toBeInTheDocument();

    // Creating opens the new submission, to add more questions.
    await userEvent.click(screen.getByRole('button', { name: /New submission/ }));
    await userEvent.type(screen.getByLabelText('Title'), 'Demo video');
    await userEvent.type(screen.getByLabelText('Description'), 'Two minutes');
    await userEvent.type(screen.getByLabelText('First question'), 'Video link');
    await userEvent.type(screen.getByLabelText('Deadline (optional, IST)'), '2026-10-31T17:00');
    await userEvent.selectOptions(screen.getByLabelText('Round'), R2);
    await userEvent.click(screen.getByRole('button', { name: 'Create submission' }));
    await waitFor(() =>
      expect(made[0]?.body).toEqual({
        title: 'Demo video',
        roundId: R2,
        description: 'Two minutes',
        deadline: '2026-10-31T11:30:00.000Z',
        fields: [{ label: 'Video link', type: 'long_text', required: true }],
      }),
    );
    expect(await screen.findByRole('link', { name: /All submissions/ })).toBeInTheDocument();
  });

  it('deletes a submission nobody answered', async () => {
    const del = capture('delete', `${E}/submissions/s2`);
    open('');
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Pitch' }));
    await confirmDialog('Delete');
    await waitFor(() => expect(del).toHaveLength(1));
  });

  it('needs a round first', async () => {
    open('', []);
    server.use(http.get(`${E}/rounds`, () => HttpResponse.json([])));
    expect(await screen.findByText('No rounds yet')).toBeInTheDocument();
  });

  it('lists the section in the sidebar for admins', async () => {
    open('');
    expect(
      await within(await screen.findByRole('navigation', { name: 'Event sections' })).findByRole(
        'link',
        { name: 'Submissions' },
      ),
    ).toBeInTheDocument();
  });
});

describe('submission detail', () => {
  it('edits details, builds questions and shows entries', async () => {
    const details = capture('patch', `${E}/submissions/s1`, sub());
    const patchField = capture('patch', `${E}/submissions/s1/fields/q1`, f({}));
    const created = capture('post', `${E}/submissions/s1/fields`, f({ id: 'q3' }), 201);
    const removed = capture('delete', `${E}/submissions/s1/fields/q1`);
    open('/s1');
    const title = await screen.findByLabelText('Title');
    expect(screen.getByText(/stays in the round it was created in/)).toBeInTheDocument();
    await userEvent.clear(title);
    await userEvent.type(title, 'Prototype v2');
    await userEvent.click(screen.getByRole('button', { name: 'Save details' }));
    await waitFor(() =>
      expect(details[0]?.body).toEqual({
        title: 'Prototype v2',
        description: 'Show it',
        deadline: null,
      }),
    );

    // Edit a saved question, then delete it.
    await userEvent.click(screen.getByRole('button', { name: 'Edit Repo link' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Required' }));
    await waitFor(() => expect(patchField[0]?.body).toEqual({ required: false }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete Repo link' }));
    await confirmDialog('Delete');
    await waitFor(() => expect(removed).toHaveLength(1));

    // Add a question.
    await userEvent.click(screen.getByRole('button', { name: 'Add question' }));
    await userEvent.type(screen.getByLabelText('Question'), 'Notes');
    await userEvent.selectOptions(screen.getByLabelText('Question type'), 'choice');
    await userEvent.click(screen.getAllByRole('button', { name: 'Add question' }).at(-1)!);
    await waitFor(() =>
      expect(created[0]?.body).toEqual({
        label: 'Notes',
        type: 'choice',
        required: true,
        unique: false,
        options: ['Option 1'],
      }),
    );

    // Entries expand to answers.
    await userEvent.click(await screen.findByRole('button', { name: 'Answers from Byte Club' }));
    expect(await screen.findByText('https://git.test/x')).toBeInTheDocument();
    expect(screen.getByText(/Saved last by Asha/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Answers from Byte Club' }));
    expect(screen.queryByText('https://git.test/x')).not.toBeInTheDocument();
  });

  it('moves and duplicates questions, and cancels a draft', async () => {
    const patchQ1 = capture('patch', `${E}/submissions/s1/fields/q1`, f({}));
    const patchQ2 = capture('patch', `${E}/submissions/s1/fields/q2`, f({ id: 'q2' }));
    const dup = capture('post', `${E}/submissions/s1/fields`, f({ id: 'q9' }), 201);
    open('/s1');
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Repo link' }));
    await userEvent.click(screen.getByRole('button', { name: 'Move down Repo link' }));
    await waitFor(() => expect(patchQ1[0]?.body).toEqual({ position: 1 }));
    expect(patchQ2[0]?.body).toEqual({ position: 0 });
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate Repo link' }));
    await waitFor(() => expect(dup[0]?.body).toMatchObject({ label: 'Repo link (copy)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add question' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('has no entries yet, or is not found', async () => {
    open('/s1', [sub({ entryCount: 0 })]);
    server.use(http.get(`${E}/submissions/s1/entries`, () => HttpResponse.json([])));
    expect(await screen.findByText('No team has submitted yet.')).toBeInTheDocument();
  });

  it('says when the submission is gone', async () => {
    open('/nope');
    expect(await screen.findByText('Submission not found')).toBeInTheDocument();
  });
});
