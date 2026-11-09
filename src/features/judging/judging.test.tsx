import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Schemas } from '@/api/client';
import { formatIST } from '@/lib/datetime';
import { asRole, capture, confirmDialog, E } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { apiError, event, server } from '@/test/server';

const R1 = '66666666-6666-4666-8666-666666666661';
const R2 = '66666666-6666-4666-8666-666666666662';
const stamp = event.createdAt;
const round = (over: Partial<Schemas['Round']> = {}): Schemas['Round'] => ({
  id: R1,
  name: 'Round 1',
  position: 0,
  kind: 'normal',
  phase: 'draft',
  createdAt: stamp,
  updatedAt: stamp,
  ...over,
});
const rounds = [round(), round({ id: R2, name: 'Finals', position: 1, phase: 'released' })];
const criteria: Schemas['Criterion'][] = [
  { id: 'c1', roundId: R1, name: 'Idea', description: 'How original', maxScore: 10, position: 0 },
  { id: 'c2', roundId: R1, name: 'Demo', description: '', maxScore: 5, position: 1 },
];
const board = (visibleToEveryone = false): Schemas['Leaderboard'] => ({
  visibleToEveryone,
  round: { id: R1, name: 'Round 1', phase: 'draft' },
  entries: [
    {
      rank: 1,
      team: { id: 't1', name: 'Byte Club' },
      total: 12.5,
      normalisedTotal: 12,
      maxTotal: 15,
      judges: 2,
      criteria: [],
    },
  ],
});
function use(list = rounds) {
  const asked: string[] = [];
  server.use(
    http.get(`${E}/rounds`, () => HttpResponse.json(list)),
    http.get(`${E}/criteria`, ({ request }) => {
      const id = new URL(request.url).searchParams.get('roundId') ?? '';
      asked.push(id);
      return HttpResponse.json(id === R1 ? criteria : []);
    }),
    http.get(`${E}/leaderboard`, () => HttpResponse.json(board())),
    http.get(`${E}/rounds/:roundId/teams`, () => HttpResponse.json({ teamIds: null })),
    http.get(`${E}/tracks`, () => HttpResponse.json([])),
    http.get(`${E}/leaderboards`, () => HttpResponse.json([])),
  );
  return asked;
}

/** Picks an option from a shadcn (Radix) select by its label. */
async function pick(label: string, option: string | RegExp) {
  await userEvent.click(screen.getByRole('combobox', { name: label }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

/** Runs an action from the selected round's menu. */
async function menu(item: string) {
  await userEvent.click(await screen.findByRole('button', { name: /^Actions for / }));
  await userEvent.click(await screen.findByRole('menuitem', { name: item }));
}
const go = (page = 'judging') => renderApp(`/events/${event.id}/${page}`, { token: 'good-token' });

describe('judging', () => {
  it('admins edit the rubric of the selected round and the leaderboard visibility', async () => {
    asRole('admin');
    use();
    const added = capture('post', `${E}/criteria`, criteria[0], 201);
    const removed = capture('delete', `${E}/criteria/c2`);
    const edited = capture('patch', `${E}/criteria/c1`, criteria[0]);
    go();
    expect(await screen.findByText('How original')).toBeInTheDocument();
    // The ranking lives on its own page now.
    expect(screen.queryByText('Byte Club')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Criterion'), 'Impact');
    await userEvent.type(screen.getByLabelText('Description for judges'), 'Who it helps');
    await userEvent.clear(screen.getByLabelText('Maximum score'));
    await userEvent.type(screen.getByLabelText('Maximum score'), '20');
    await userEvent.click(screen.getByRole('button', { name: 'Add criterion' }));
    await waitFor(() =>
      expect(added[0]?.body).toEqual({
        name: 'Impact',
        description: 'Who it helps',
        maxScore: 20,
        roundId: R1,
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Edit Idea' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit Idea' }));
    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), 'Originality');
    await userEvent.clear(screen.getByLabelText('Max score'));
    await userEvent.type(screen.getByLabelText('Max score'), '8');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(edited[0]?.body).toEqual({
        name: 'Originality',
        description: 'How original',
        maxScore: 8,
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove Demo' }));
    await waitFor(() => expect(removed).toHaveLength(1));
  });

  it('shows the round’s leaderboard on its own page, where admins set who sees it', async () => {
    asRole('admin');
    use();
    const shown = capture('patch', E, {
      event: { ...event, leaderboardVisible: true },
      role: 'admin',
    });
    go('leaderboards');
    expect(await screen.findByText('Byte Club')).toBeInTheDocument();
    expect(screen.queryByText('How original')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Leaderboard settings' }));
    await userEvent.click(
      await screen.findByRole('menuitemcheckbox', { name: 'Show to everyone' }),
    );
    await waitFor(() => expect(shown[0]?.body).toEqual({ leaderboardVisible: true }));
  });

  it('keeps the picked round in the address and links the two pages', async () => {
    asRole('admin');
    const asked = use();
    const { router } = go();
    await screen.findByText('How original');
    await pick('Round', /Finals/);
    await waitFor(() => expect(router.state.location.search).toBe(`?round=${R2}`));
    await userEvent.click(screen.getByRole('link', { name: 'See leaderboard' }));
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/leaderboards$/));
    expect(router.state.location.search).toBe(`?round=${R2}`);
    expect(asked).toContain(R2);
  });

  it('picks rounds from a dropdown; phase, rename, add and delete from its menu', async () => {
    asRole('admin');
    const asked = use();
    const patch = capture('patch', `${E}/rounds/${R1}`, round());
    const made = capture('post', `${E}/rounds`, round({ id: 'new', name: 'Semis' }), 201);
    const removed = capture('delete', `${E}/rounds/${R1}`);
    go();
    expect(await screen.findByText(/Only admins and judges see this round/)).toBeInTheDocument();
    await pick('Round', /Finals/);
    await waitFor(() => expect(asked).toContain(R2));
    expect(screen.getByText(/Participants see this round and its submissions/)).toBeInTheDocument();
    await pick('Round', /Round 1/);
    await pick('Round phase', 'Closed');
    await waitFor(() => expect(patch[0]?.body).toEqual({ phase: 'closed' }));

    await menu('Rename');
    await userEvent.clear(screen.getByLabelText('Round name'));
    await userEvent.type(screen.getByLabelText('Round name'), 'Qualifier');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(patch[1]?.body).toEqual({ name: 'Qualifier' }));

    await menu('Make an elimination round');
    await waitFor(() => expect(patch[2]?.body).toEqual({ kind: 'elimination' }));

    await userEvent.click(screen.getByRole('button', { name: /Add round/ }));
    await userEvent.type(screen.getByLabelText('Round name'), 'Semis');
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Add round' }),
    );
    await waitFor(() => expect(made[0]?.body).toEqual({ name: 'Semis' }));

    server.use(
      http.delete(`${E}/rounds/${R1}`, () =>
        apiError(409, 'ROUND_HAS_SCORES', 'This round has scores.'),
      ),
    );
    await menu('Delete round');
    await confirmDialog('Delete round');
    expect(await screen.findByText('This round has scores.')).toBeInTheDocument();
    expect(removed).toHaveLength(0);
  });

  it('closing an elimination round asks who goes on, with the top half ticked', async () => {
    asRole('admin');
    use([round({ kind: 'elimination' }), rounds[1]!]);
    const three: Schemas['Leaderboard'] = {
      ...board(),
      entries: ['Alpha', 'Beta', 'Gamma'].map((name, i) => ({
        rank: i + 1,
        team: { id: `t${i}`, name },
        total: 10 - i,
        normalisedTotal: 10 - i,
        maxTotal: 10,
        judges: 1,
        criteria: [],
      })),
    };
    server.use(http.get(`${E}/leaderboard`, () => HttpResponse.json(three)));
    capture('patch', `${E}/rounds/${R1}`, round({ kind: 'elimination', phase: 'closed' }));
    const sent = capture('put', `${E}/rounds/${R2}/teams`, { teamIds: ['t0', 't2'] });
    go();
    expect(await screen.findByText('Elimination')).toBeInTheDocument();
    await pick('Round phase', 'Closed');
    const dialog = await screen.findByRole('dialog', { name: /Who goes on from Round 1/ });
    await waitFor(() => expect(within(dialog).getByLabelText('Top')).toHaveValue(2));
    expect(within(dialog).getByRole('checkbox', { name: /Alpha/ })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: /Beta/ })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: /Gamma/ })).not.toBeChecked();
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Beta/ }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Gamma/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send 2 teams to Finals' }));
    await waitFor(() => expect(sent[0]?.body).toEqual({ teamIds: ['t0', 't2'] }));
  });

  it('says when only some teams take part, and lets every team back in', async () => {
    asRole('admin');
    use();
    server.use(http.get(`${E}/rounds/${R1}/teams`, () => HttpResponse.json({ teamIds: ['t1'] })));
    const opened = capture('put', `${E}/rounds/${R1}/teams`, { teamIds: null });
    go();
    expect(await screen.findByText('Only 1 team takes part in this round.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Let every team in' }));
    await waitFor(() => expect(opened[0]?.body).toEqual({ teamIds: null }));
  });

  it('admins open a team on the leaderboard to see who scored what', async () => {
    asRole('admin');
    use();
    server.use(
      http.get(`${E}/judging/teams/t1/breakdown`, () =>
        HttpResponse.json({
          round: { id: R1, name: 'Round 1', phase: 'draft' },
          team: { id: 't1', name: 'Byte Club' },
          inRound: true,
          total: 12.5,
          maxTotal: 15,
          criteria: [
            { id: 'c1', name: 'Idea', maxScore: 10, average: 8.5 },
            { id: 'c2', name: 'Demo', maxScore: 5, average: 4 },
          ],
          judges: [
            {
              judge: { id: 'j1', name: 'Meera' },
              total: 13,
              updatedAt: stamp,
              comment: 'Clever',
              scores: [
                { criterionId: 'c1', value: 9 },
                { criterionId: 'c2', value: 4 },
              ],
            },
          ],
        } satisfies Schemas['ScoreBreakdown']),
      ),
    );
    const removed = capture('delete', `${E}/judging/teams/t1/scores/j1`);
    go('leaderboards');
    await userEvent.click(await screen.findByRole('button', { name: 'Byte Club' }));
    const sheet = await screen.findByRole('dialog', { name: 'Byte Club' });
    expect(await within(sheet).findByText('Meera')).toBeInTheDocument();
    expect(within(sheet).getByText('Clever')).toBeInTheDocument();
    expect(within(sheet).getByText(`Last saved ${formatIST(stamp)}`)).toBeInTheDocument();
    expect(within(sheet).getByText('12.50 / 15')).toBeInTheDocument();
    expect(within(sheet).getByText('8.50 / 10')).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: /Open team page/ })).toHaveAttribute(
      'href',
      `/events/${event.id}/teams/t1`,
    );

    // An admin clears a judge's scores so they can score the team again.
    await userEvent.click(within(sheet).getByRole('button', { name: 'Remove scores' }));
    await confirmDialog('Remove scores');
    await waitFor(() => expect(removed).toHaveLength(1));
    expect(new URL(removed[0]!.url).searchParams.get('roundId')).toBe(R1);
  });

  it('reviewers see team names but no breakdown', async () => {
    asRole('reviewer');
    use();
    go('leaderboards');
    expect(await screen.findByText('Byte Club')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Byte Club' })).not.toBeInTheDocument();
  });

  it("downloads a round's submissions as one CSV, a row per team in the round", async () => {
    asRole('admin');
    use();
    const blobs: Blob[] = [];
    // jsdom has no object URLs; catch the file instead.
    Object.assign(URL, {
      createObjectURL: (b: Blob) => (blobs.push(b), 'blob:x'),
      revokeObjectURL: () => {},
    });
    const sub = (id: string, title: string): Schemas['Submission'] => ({
      id,
      round: { id: R1, name: 'Round 1', phase: 'draft' },
      title,
      description: '',
      position: 0,
      deadline: null,
      closesAt: null,
      allowMultiple: false,
      fields: [
        {
          id: `${id}-f`,
          label: 'Link',
          help: null,
          type: 'short_text',
          options: [],
          required: false,
          unique: false,
          pattern: null,
          position: 0,
        },
      ],
      entryCount: 1,
      createdAt: stamp,
      updatedAt: stamp,
    });
    server.use(
      http.get(`${E}/submissions`, () => HttpResponse.json([sub('s1', 'Repo')])),
      http.get(`${E}/submissions/s1/entries`, () =>
        HttpResponse.json([
          {
            id: 'e1',
            submissionId: 's1',
            team: { id: 'a', name: 'Alpha' },
            answers: { 's1-f': 'https://x.test' },
            submittedBy: { registrationId: 'r', name: 'Asha' },
            late: false,
            createdAt: stamp,
            updatedAt: stamp,
          },
        ]),
      ),
      http.get(`${E}/teams`, () =>
        HttpResponse.json([
          { id: 'a', name: 'Alpha', status: 'confirmed' },
          { id: 'b', name: 'Beta', status: 'confirmed' },
          { id: 'c', name: 'Gone', status: 'cancelled' },
        ]),
      ),
    );
    go();
    await menu('Download submissions (CSV)');
    await waitFor(() => expect(blobs).toHaveLength(1));
    const [header, alpha, beta, extra] = (await blobs[0]!.text())
      .replace('\ufeff', '')
      .split('\r\n');
    expect(header).toBe('Team,Repo › Submitted by,Repo › Sent (IST),Repo › Late,Repo › Link');
    expect(alpha).toMatch(/^Alpha,Asha,.+,,https:\/\/x\.test$/);
    expect(beta).toBe('Beta,,,,');
    expect(extra).toBeUndefined();
  });

  it('duplicates criteria from another round', async () => {
    asRole('admin');
    use();
    const dup = capture('post', `${E}/rounds/${R1}/criteria/duplicate`, [], 201);
    go();
    await userEvent.click(await screen.findByRole('button', { name: /Duplicate criteria from/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Finals' }));
    await waitFor(() => expect(dup[0]?.body).toEqual({ fromRoundId: R2 }));
  });

  it('asks for a first round when there are none', async () => {
    asRole('admin');
    use([]);
    go();
    expect(await screen.findByText('No rounds yet')).toBeInTheDocument();
  });

  it('an empty leaderboard says so', async () => {
    asRole('admin');
    use();
    server.use(
      http.get(`${E}/leaderboard`, () =>
        HttpResponse.json({ visibleToEveryone: false, round: null, entries: [] }),
      ),
    );
    go('leaderboards');
    expect(await screen.findByText('No scores yet.')).toBeInTheDocument();
  });
});

describe('scores, tracks and leaderboards', () => {
  const saved = (over: Partial<Schemas['SavedLeaderboard']> = {}): Schemas['SavedLeaderboard'] => ({
    id: 'lb1',
    name: 'Overall',
    method: 'sum',
    normalise: false,
    track: null,
    topN: null,
    visibility: 'public',
    position: 0,
    rounds: [
      { round: { id: R1, name: 'Round 1', phase: 'draft' }, weight: 1 },
      { round: { id: R2, name: 'Finals', phase: 'draft' }, weight: 2 },
    ],
    ...over,
  });

  it('ranks by normalised totals on request', async () => {
    asRole('admin');
    use();
    const asked: (string | null)[] = [];
    server.use(
      http.get(`${E}/leaderboard`, ({ request }) => {
        asked.push(new URL(request.url).searchParams.get('normalise'));
        return HttpResponse.json(board());
      }),
    );
    go('leaderboards');
    expect(await screen.findByText('12.50 / 15')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Leaderboard settings' }));
    await userEvent.click(
      await screen.findByRole('menuitemcheckbox', { name: 'Even out lenient and harsh judges' }),
    );
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByText('12.00 / 15')).toBeInTheDocument();
    expect(screen.getByText('raw 12.50')).toBeInTheDocument();
    expect(asked).toContain('true');
  });

  it('downloads the leaderboard and each judge’s scores as CSV', async () => {
    asRole('admin');
    use();
    const blobs: Blob[] = [];
    Object.assign(URL, {
      createObjectURL: (b: Blob) => (blobs.push(b), 'blob:x'),
      revokeObjectURL: () => {},
    });
    server.use(
      http.get(`${E}/judging/teams/t1/breakdown`, () =>
        HttpResponse.json({
          round: { id: R1, name: 'Round 1', phase: 'draft' },
          team: { id: 't1', name: 'Byte Club' },
          inRound: true,
          total: 12.5,
          maxTotal: 15,
          criteria: [],
          judges: [
            {
              judge: { id: 'j1', name: 'Meera' },
              total: 13,
              updatedAt: stamp,
              comment: 'Clever, needs polish',
              scores: [
                { criterionId: 'c1', value: 9 },
                { criterionId: 'c2', value: 4 },
              ],
            },
          ],
        } satisfies Schemas['ScoreBreakdown']),
      ),
    );
    go('leaderboards');
    await screen.findByText('12.50 / 15');
    await userEvent.click(screen.getByRole('button', { name: 'Leaderboard settings' }));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Download leaderboard (CSV)' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Leaderboard settings' }));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: "Download each judge's scores (CSV)" }),
    );
    await waitFor(() => expect(blobs).toHaveLength(2));
    const [boardCsv, judges] = await Promise.all(blobs.map((b) => b.text()));
    expect(boardCsv!.split('\r\n')[0]).toContain('Rank,Team,Total,Normalised total');
    expect(judges!.split('\r\n')[1]).toMatch(/^Byte Club,Meera,9,4,13,"Clever, needs polish",/);
  });

  it('sets up a saved leaderboard over rounds, and shows its ranking', async () => {
    asRole('admin');
    use();
    const made = capture('post', `${E}/leaderboards`, saved(), 201);
    server.use(
      http.get(`${E}/leaderboards`, () => HttpResponse.json([saved()])),
      http.get(`${E}/leaderboards/lb1/results`, () =>
        HttpResponse.json({
          leaderboard: saved(),
          entries: [
            {
              rank: 1,
              team: { id: 't1', name: 'Byte Club' },
              total: 32,
              maxTotal: 45,
              rounds: [
                { roundId: R1, total: 12, maxTotal: 15 },
                { roundId: R2, total: 10, maxTotal: 15 },
              ],
              lastRoundId: R2,
            },
          ],
        }),
      ),
    );
    const removed = capture('delete', `${E}/leaderboards/lb1`);
    const { router } = go('leaderboards');
    // One board at a time: the round's, until a saved one is picked.
    await screen.findByText('Byte Club');
    await pick('Leaderboard', 'Overall');
    await waitFor(() => expect(router.state.location.search).toMatch(/board=lb1/));
    expect(
      await screen.findByText(/Every team · Round 1 \+ Finals ×2 · Add up · Everyone/),
    ).toBeInTheDocument();
    expect(await screen.findByText('32 / 45')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'New leaderboard' }));
    const dialog = await screen.findByRole('dialog', { name: 'New leaderboard' });
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Finals top 3');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Finals' }));
    await userEvent.clear(within(dialog).getByLabelText('Show the top (optional)'));
    await userEvent.type(within(dialog).getByLabelText('Show the top (optional)'), '3');
    await userEvent.selectOptions(within(dialog).getByLabelText('Who sees it'), 'judges');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(made[0]?.body).toEqual({
        name: 'Finals top 3',
        method: 'sum',
        normalise: false,
        trackId: null,
        topN: 3,
        visibility: 'judges',
        rounds: [{ roundId: R2, weight: 1 }],
      }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Leaderboard settings' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete leaderboard' }));
    await confirmDialog('Delete leaderboard');
    await waitFor(() => expect(removed).toHaveLength(1));
  });

  it('keeps a list of tracks', async () => {
    asRole('admin');
    use();
    server.use(
      http.get(`${E}/tracks`, () =>
        HttpResponse.json([{ id: 'tr1', name: 'AI', position: 0, teamCount: 2 }]),
      ),
    );
    const added = capture(
      'post',
      `${E}/tracks`,
      { id: 'tr2', name: 'Web', position: 1, teamCount: 0 },
      201,
    );
    const renamed = capture('patch', `${E}/tracks/tr1`, {
      id: 'tr1',
      name: 'ML',
      position: 0,
      teamCount: 2,
    });
    const removed = capture('delete', `${E}/tracks/tr1`);
    go('leaderboards');
    const list = await screen.findByRole('list', { name: 'Tracks' });
    expect(within(list).getByText('2 teams')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('New track'), 'Web');
    await userEvent.click(screen.getByRole('button', { name: 'Add track' }));
    await waitFor(() => expect(added[0]?.body).toEqual({ name: 'Web' }));
    await userEvent.click(within(list).getByRole('button', { name: 'Rename AI' }));
    const name = within(list).getByLabelText('Name of AI');
    await userEvent.clear(name);
    await userEvent.type(name, 'ML');
    await userEvent.click(within(list).getByRole('button', { name: 'Save name' }));
    await waitFor(() => expect(renamed[0]?.body).toEqual({ name: 'ML' }));
    await userEvent.click(within(list).getByRole('button', { name: 'Delete AI' }));
    await confirmDialog('Delete track');
    await waitFor(() => expect(removed).toHaveLength(1));
  });
});
