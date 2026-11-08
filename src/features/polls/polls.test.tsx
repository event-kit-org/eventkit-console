import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Schemas } from '@/api/client';
import { asRole, capture, confirmDialog, E } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { apiError, event, server } from '@/test/server';

function poll(over: Partial<Schemas['Poll']> = {}): Schemas['Poll'] {
  return {
    id: 'p1',
    question: 'Lunch?',
    type: 'choice',
    scaleMax: null,
    audience: ['participant', 'volunteer', 'judge', 'admin'],
    closesAt: '2026-10-31T06:30:00.000Z',
    closed: false,
    resultsVisible: false,
    defaultOptionId: 'o2',
    createdBy: { id: 'u', name: 'Asha' },
    createdAt: event.createdAt,
    options: [
      { id: 'o1', label: 'Veg thali', position: 0, votes: null },
      { id: 'o2', label: 'Curd rice', position: 1, votes: null },
    ],
    totalVotes: null,
    stats: null,
    myVote: null,
    myAnswer: null,
    canVote: true,
    canManage: false,
    optionsLocked: false,
    mealCheckpoints: [{ id: 'c', name: 'Lunch' }],
    group: null,
    ...over,
  };
}
const usePolls = (list: Schemas['Poll'][]) =>
  server.use(http.get(`${E}/polls`, () => HttpResponse.json(list)));
const go = () => renderApp(`/events/${event.id}/polls`, { token: 'good-token' });

describe('polls', () => {
  it('votes when in the audience; results stay hidden', async () => {
    asRole('admin');
    usePolls([poll()]);
    const vote = capture('put', `${E}/polls/p1/vote`, poll({ myVote: 'o1' }));
    go();
    expect(await screen.findByText('Lunch?')).toBeInTheDocument();
    expect(
      screen.getByText(/Everyone · closes 31 Oct 2026, 12:00 pm IST · used at Lunch/),
    ).toBeInTheDocument();
    expect(screen.getByText('default')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Vote' });
    expect(button).toBeDisabled();
    await userEvent.click(screen.getByLabelText('Veg thali'));
    await userEvent.click(button);
    await waitFor(() => expect(vote[0]?.body).toEqual({ optionId: 'o1' }));
    expect(screen.queryByText(/votes in total/)).not.toBeInTheDocument();
  });

  it('shows results when allowed, and closed polls without voting', async () => {
    asRole('admin');
    usePolls([
      poll({
        closed: true,
        canVote: false,
        myVote: 'o2',
        totalVotes: 3,
        options: [
          { id: 'o1', label: 'Veg thali', position: 0, votes: 1 },
          { id: 'o2', label: 'Curd rice', position: 1, votes: 2 },
        ],
      }),
    ]);
    go();
    expect(await screen.findByText('Closed')).toBeInTheDocument();
    expect(screen.getByText('3 votes in total.')).toBeInTheDocument();
    expect(screen.getByText(/Curd rice \(your choice\)/)).toBeInTheDocument();
  });

  it('staff create polls, add options and show results', async () => {
    asRole('admin');
    usePolls([poll({ canManage: true, canVote: false, mealCheckpoints: [] })]);
    const created = capture('post', `${E}/polls`, poll(), 201);
    const patched = capture('patch', `${E}/polls/p1`, poll({ resultsVisible: true }));
    const added = capture('post', `${E}/polls/p1/options`, poll(), 201);
    go();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Show results to the audience' }),
    );
    await waitFor(() => expect(patched[0]?.body).toEqual({ resultsVisible: true }));
    await userEvent.type(screen.getByLabelText('New option'), 'Pasta');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(added[0]?.body).toEqual({ label: 'Pasta' }));

    await userEvent.click(screen.getByRole('button', { name: 'New poll' }));
    const create = screen.getByRole('button', { name: 'Create poll' });
    await userEvent.type(screen.getByLabelText('Question'), 'Dinner?');
    await userEvent.type(screen.getByLabelText('Options, one per line'), 'Biryani\nDosa\n');
    await userEvent.selectOptions(screen.getByLabelText('Default option'), '1');
    await userEvent.click(screen.getByLabelText('Volunteers'));
    await userEvent.click(screen.getByLabelText('The audience can see the results'));
    await userEvent.type(screen.getByLabelText('Closes (IST, optional)'), '2026-10-31T20:00');
    await userEvent.click(create);
    await waitFor(() =>
      expect(created[0]?.body).toEqual({
        question: 'Dinner?',
        type: 'choice',
        options: ['Biryani', 'Dosa'],
        audience: ['participant', 'volunteer'],
        closesAt: '2026-10-31T14:30:00.000Z',
        resultsVisible: true,
        defaultOptionIndex: 1,
      }),
    );
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Create poll' })).toBeNull());
  });

  it('creating can be cancelled; errors and an empty list show', async () => {
    asRole('admin');
    usePolls([]);
    server.use(http.post(`${E}/polls`, () => apiError(400, 'VALIDATION_ERROR', 'Bad poll.')));
    go();
    expect(await screen.findByText('No polls yet.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New poll' }));
    await userEvent.type(screen.getByLabelText('Question'), 'Q');
    await userEvent.type(screen.getByLabelText('Options, one per line'), 'a\nb');
    await userEvent.click(screen.getByRole('button', { name: 'Create poll' }));
    expect(await screen.findByText('Bad poll.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'New poll' })).toBeInTheDocument();
  });

  it('multi-select polls take several options', async () => {
    asRole('admin');
    usePolls([
      poll({
        type: 'multi_choice',
        defaultOptionId: null,
        mealCheckpoints: [],
        options: [
          { id: 'o1', label: 'AI', position: 0, votes: null },
          { id: 'o2', label: 'Web', position: 1, votes: null },
          { id: 'o3', label: 'Chips', position: 2, votes: null },
        ],
      }),
    ]);
    const voted = capture('put', `${E}/polls/p1/vote`, poll());
    go();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'AI' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chips' }));
    await userEvent.click(screen.getByRole('button', { name: 'Vote' }));
    await waitFor(() => expect(voted[0]?.body).toEqual({ optionIds: ['o1', 'o3'] }));
  });

  it('rating polls answer on a scale and show the spread', async () => {
    asRole('admin');
    usePolls([
      poll({
        type: 'rating',
        scaleMax: 4,
        options: [],
        defaultOptionId: null,
        mealCheckpoints: [],
        totalVotes: 3,
        stats: {
          count: 3,
          average: 3.33,
          min: 2,
          max: 4,
          distribution: [1, 2, 3, 4].map((value) => ({ value, count: value === 1 ? 0 : 1 })),
        },
      }),
    ]);
    const voted = capture('put', `${E}/polls/p1/vote`, poll());
    go();
    await userEvent.click(await screen.findByRole('radio', { name: '3' }));
    await userEvent.click(screen.getByRole('button', { name: 'Answer' }));
    await waitFor(() => expect(voted[0]?.body).toEqual({ value: 3 }));
    expect(screen.getByText('3.33')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'How many gave each rating' })).toBeInTheDocument();
  });

  it('text polls take an answer and list the answers on request, with search', async () => {
    asRole('admin');
    usePolls([
      poll({
        type: 'short_text',
        options: [],
        defaultOptionId: null,
        mealCheckpoints: [],
        totalVotes: 2,
        myAnswer: { optionId: null, optionIds: [], value: 'Loved it' },
      }),
    ]);
    server.use(
      http.get(`${E}/polls/p1/answers`, () =>
        HttpResponse.json([
          { value: 'More coffee', respondedAt: event.createdAt, by: 'Ravi' },
          { value: 'Loved it', respondedAt: event.createdAt, by: 'Asha' },
        ]),
      ),
    );
    const voted = capture('put', `${E}/polls/p1/vote`, poll());
    go();
    const box = await screen.findByRole('textbox', { name: 'Lunch?' });
    expect(box).toHaveValue('Loved it');
    await userEvent.clear(box);
    await userEvent.type(box, 'Great');
    await userEvent.click(screen.getByRole('button', { name: 'Change answer' }));
    await waitFor(() => expect(voted[0]?.body).toEqual({ value: 'Great' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show answers (2)' }));
    expect(await screen.findByText('More coffee')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search answers' }), 'coffee');
    expect(screen.getByText('More coffee')).toBeInTheDocument();
    expect(screen.queryByText('Loved it')).not.toBeInTheDocument();
  });

  it('creates a rating poll without options', async () => {
    asRole('admin');
    usePolls([]);
    const created = capture('post', `${E}/polls`, poll(), 201);
    go();
    await userEvent.click(await screen.findByRole('button', { name: 'New poll' }));
    await userEvent.type(screen.getByLabelText('Question'), 'Rate the food');
    await userEvent.click(screen.getByRole('combobox', { name: 'Answer type' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Rating' }));
    expect(screen.queryByLabelText('Options, one per line')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Default option')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', { name: 'Scale' }));
    await userEvent.click(await screen.findByRole('option', { name: '1 to 10' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create poll' }));
    await waitFor(() =>
      expect(created[0]?.body).toMatchObject({
        question: 'Rate the food',
        type: 'rating',
        scaleMax: 10,
      }),
    );
    expect(created[0]?.body).not.toHaveProperty('options');
  });

  it('managers close a poll now, and reopen a closed one', async () => {
    asRole('admin');
    usePolls([
      poll({ id: 'p1', canManage: true, closesAt: null }),
      poll({ id: 'p2', question: 'Venue?', canManage: true, closed: true, canVote: false }),
    ]);
    const closed = capture('patch', `${E}/polls/p1`, poll());
    const reopened = capture('patch', `${E}/polls/p2`, poll());
    go();
    await userEvent.click(await screen.findByRole('button', { name: 'Close poll' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('default');
    await confirmDialog('Close poll');
    await waitFor(() => expect(closed[0]?.body).toEqual({ closesAt: expect.any(String) }));
    const at = Date.parse((closed[0]!.body as { closesAt: string }).closesAt);
    expect(Math.abs(Date.now() - at)).toBeLessThan(60_000);
    await userEvent.click(screen.getByRole('button', { name: 'Reopen poll' }));
    await waitFor(() => expect(reopened[0]?.body).toEqual({ closesAt: null }));
  });

  it('only managers see close and reopen', async () => {
    asRole('admin');
    usePolls([poll({ canManage: false })]);
    go();
    expect(await screen.findByText('Lunch?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close poll' })).not.toBeInTheDocument();
  });

  it('creates a question set with several questions', async () => {
    asRole('admin');
    usePolls([]);
    const created = capture('post', `${E}/polls/groups`, [], 201);
    go();
    await userEvent.click(await screen.findByRole('button', { name: 'New question set' }));
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Title'), 'Day 1 feedback');
    await userEvent.type(dialog.getByLabelText('Question 1 text'), 'Best talk?');
    await userEvent.type(dialog.getByLabelText('Options, one per line'), 'Keynote\nPanel');
    await userEvent.click(dialog.getByRole('button', { name: 'Add question' }));
    await userEvent.type(dialog.getByLabelText('Question 2 text'), 'Rate the food');
    const types = dialog.getAllByRole('combobox', { name: 'Answer type' });
    await userEvent.click(types[1]!);
    await userEvent.click(await screen.findByRole('option', { name: 'Rating' }));
    await userEvent.click(dialog.getByRole('button', { name: 'Create set' }));
    await waitFor(() =>
      expect(created[0]?.body).toMatchObject({
        title: 'Day 1 feedback',
        audience: ['participant'],
        questions: [
          { question: 'Best talk?', type: 'choice', options: ['Keynote', 'Panel'] },
          { question: 'Rate the food', type: 'rating', scaleMax: 5 },
        ],
      }),
    );
  });

  it('shows a set as one card with its questions in order, managed from the card', async () => {
    asRole('admin');
    const group = (position: number) => ({
      id: 'g1',
      title: 'Feedback',
      description: 'Two minutes.',
      position,
    });
    usePolls([
      poll({
        id: 'q2',
        question: 'Second?',
        type: 'long_text',
        options: [],
        group: group(1),
        canManage: true,
      }),
      poll({ id: 'q1', question: 'First?', group: group(0), canManage: true }),
      poll({ id: 'solo', question: 'Alone?' }),
    ]);
    const patched = capture('patch', `${E}/polls/groups/g1`, []);
    const removed = capture('delete', `${E}/polls/groups/g1`);
    go();
    const card = (await screen.findByRole('heading', { name: 'Feedback' })).closest(
      '[data-slot=card]',
    )!;
    const inCard = within(card as HTMLElement);
    expect(inCard.getByText('2 questions')).toBeInTheDocument();
    const order = inCard.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(order[0]).toContain('1. First?');
    expect(order[1]).toContain('2. Second?');
    expect(screen.getByText('Alone?')).toBeInTheDocument();
    await userEvent.click(inCard.getByRole('button', { name: 'Show results to the audience' }));
    await waitFor(() => expect(patched[0]?.body).toEqual({ resultsVisible: true }));
    await userEvent.click(inCard.getByRole('button', { name: 'Delete set' }));
    await confirmDialog('Delete set');
    await waitFor(() => expect(removed).toHaveLength(1));
  });
});
