import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUEST_TRACKS,
  awardQuestBadges,
  getQuestProgress
} from '../../netlify/functions/_lib/quest-badges.mjs';
import { changeAnswerHelpful } from '../../netlify/functions/answer-helpful.mjs';

function valueAtPath(row, path) {
  return String(path).split('.').reduce((value, key) => value?.[key], row);
}

function queryRows(rows, calls) {
  let selected = rows.slice();
  return {
    select() {
      return this;
    },
    eq(column, value) {
      calls.filters.push(['eq', column, value]);
      selected = selected.filter((row) => valueAtPath(row, column) === value);
      return this;
    },
    neq(column, value) {
      calls.filters.push(['neq', column, value]);
      selected = selected.filter((row) => valueAtPath(row, column) !== value);
      return this;
    },
    in(column, values) {
      calls.filters.push(['in', column, values]);
      const allowed = new Set(values || []);
      selected = selected.filter((row) => allowed.has(valueAtPath(row, column)));
      return this;
    },
    order(column, options = {}) {
      selected = selected.slice().sort((a, b) => String(valueAtPath(a, column) || '').localeCompare(String(valueAtPath(b, column) || '')));
      if (options.ascending === false) selected.reverse();
      return this;
    },
    then(resolve) {
      return Promise.resolve({ data: selected, error: null }).then(resolve);
    }
  };
}

function makeProgressSupabase({ posts = [], answers = [], helpfulVotes = [] }) {
  const calls = { filters: [] };
  return {
    calls,
    from(table) {
      if (table === 'posts') return queryRows(posts, calls);
      if (table === 'answers') return queryRows(answers, calls);
      if (table === 'answer_helpful_votes') return queryRows(helpfulVotes, calls);
      throw new Error(`unexpected table ${table}`);
    }
  };
}

test('QUEST_TRACKS exposes the seven public quest tracks in product order', () => {
  assert.deepEqual(QUEST_TRACKS, [
    'total_records',
    'questions',
    'answers',
    'answer_helpful_votes',
    'free_posts',
    'event_reviews',
    'tool_reviews'
  ]);
});

test('getQuestProgress counts visible records, Seoul day-capped free posts, and received helpful votes', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const otherId = '22222222-2222-4222-8222-222222222222';
  const longBody = '가'.repeat(80);
  const posts = [
    { id: 'q1', author_user_id: userId, post_type: 'question', category: 'question', status: 'visible', body: '질문', created_at: '2026-07-01T00:00:00.000Z' },
    { id: 'q2', author_user_id: userId, post_type: 'question', category: 'question', status: 'hidden', body: '숨김', created_at: '2026-07-01T00:01:00.000Z' },
    { id: 'q3', author_user_id: otherId, post_type: 'question', category: 'question', status: 'visible', body: '타인', created_at: '2026-07-01T00:02:00.000Z' },
    { id: 'f1', author_user_id: userId, post_type: 'free', category: 'free', status: 'visible', body: longBody, created_at: '2026-07-01T00:03:00.000Z' },
    { id: 'f2', author_user_id: userId, post_type: 'free', category: 'free', status: 'visible', body: longBody, created_at: '2026-07-01T00:04:00.000Z' },
    { id: 'f3', author_user_id: userId, post_type: 'free', category: 'free', status: 'visible', body: longBody, created_at: '2026-07-01T00:05:00.000Z' },
    { id: 'f4', author_user_id: userId, post_type: 'free', category: 'free', status: 'visible', body: longBody, created_at: '2026-07-01T00:06:00.000Z' },
    { id: 'f5', author_user_id: userId, post_type: 'free', category: 'free', status: 'visible', body: '짧음', created_at: '2026-07-01T00:07:00.000Z' },
    { id: 'e1', author_user_id: userId, post_type: 'event_review', category: 'event_review', status: 'visible', body: '모임', created_at: '2026-07-02T00:00:00.000Z' },
    { id: 't1', author_user_id: userId, post_type: 'review_comment', category: 'review', status: 'visible', body: '도구', created_at: '2026-07-03T00:00:00.000Z' },
    { id: 't2', author_user_id: userId, post_type: 'event_review', category: 'review', status: 'visible', body: '제외', created_at: '2026-07-04T00:00:00.000Z' }
  ];
  const answers = [
    { id: 'a1', author_user_id: userId, question_post_id: 'q1', posts: { status: 'visible' }, created_at: '2026-07-01T01:00:00.000Z' },
    { id: 'a2', author_user_id: userId, question_post_id: 'q2', posts: { status: 'hidden' }, created_at: '2026-07-01T02:00:00.000Z' },
    { id: 'a3', author_user_id: otherId, question_post_id: 'q1', posts: { status: 'visible' }, created_at: '2026-07-01T03:00:00.000Z' }
  ];
  const helpfulVotes = [
    { answer_id: 'a1', user_id: otherId },
    { answer_id: 'a1', user_id: '33333333-3333-4333-8333-333333333333' },
    { answer_id: 'a2', user_id: otherId }
  ];

  const progress = await getQuestProgress(makeProgressSupabase({ posts, answers, helpfulVotes }), userId);

  assert.deepEqual(progress, {
    questions: 1,
    answers: 1,
    free_posts: 3,
    event_reviews: 1,
    tool_reviews: 1,
    total_records: 7,
    answer_helpful_votes: 2
  });
});

function makeAwardSupabase({ posts = [], answers = [], helpfulVotes = [], badges = [], owned = [], insertErrors = {} }) {
  const progressSupabase = makeProgressSupabase({ posts, answers, helpfulVotes });
  const calls = { ...progressSupabase.calls, inserts: [] };
  return {
    calls,
    from(table) {
      if (table === 'quest_badges') return queryRows(badges, calls);
      if (table === 'user_quest_badges') {
        return {
          select() {
            return {
              eq() { return this; },
              then(resolve) {
                return Promise.resolve({
                  data: owned.map((badge_code) => ({ badge_code })),
                  error: null
                }).then(resolve);
              }
            };
          },
          insert(payload) {
            calls.inserts.push(payload);
            return { error: insertErrors[payload.badge_code] || null };
          }
        };
      }
      return progressSupabase.from(table);
    }
  };
}

test('awardQuestBadges inserts newly reached public badges and ignores already owned badges', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const supabase = makeAwardSupabase({
    posts: [{ id: 'q1', author_user_id: userId, post_type: 'question', status: 'visible', body: '질문', created_at: '2026-07-01T00:00:00.000Z' }],
    answers: [{ id: 'a1', author_user_id: userId, posts: { status: 'visible' }, created_at: '2026-07-01T01:00:00.000Z' }],
    badges: [
      { code: 'questions_1', track: 'questions', threshold: 1, is_secret: false },
      { code: 'answers_1', track: 'answers', threshold: 1, is_secret: false },
      { code: 'questions_5', track: 'questions', threshold: 5, is_secret: false },
      { code: 'secret_hidden', track: 'secret', threshold: null, is_secret: true }
    ],
    owned: ['questions_1']
  });

  const awarded = await awardQuestBadges(supabase, userId);

  assert.deepEqual(awarded, ['answers_1']);
  assert.deepEqual(supabase.calls.inserts, [{
    user_id: userId,
    badge_code: 'answers_1',
    awarded_reason: 'quest_threshold'
  }]);
});

test('awardQuestBadges ignores duplicate insert races without reporting a new badge', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const supabase = makeAwardSupabase({
    posts: [{ id: 'q1', author_user_id: userId, post_type: 'question', status: 'visible', body: '질문', created_at: '2026-07-01T00:00:00.000Z' }],
    badges: [{ code: 'questions_1', track: 'questions', threshold: 1, is_secret: false }],
    insertErrors: { questions_1: { code: '23505' } }
  });

  assert.deepEqual(await awardQuestBadges(supabase, userId), []);
});

function makeHelpfulSupabase({ answer, insertError = null }) {
  const calls = { inserts: [], deletes: [] };
  return {
    calls,
    from(table) {
      if (table === 'answers') {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle() {
            return { data: answer, error: null };
          }
        };
      }
      if (table === 'answer_helpful_votes') {
        return {
          insert(payload) {
            calls.inserts.push(payload);
            return { error: insertError };
          },
          delete() { return this; },
          eq(column, value) {
            calls.deletes.push([column, value]);
            return this;
          }
        };
      }
      throw new Error(`unexpected table ${table}`);
    }
  };
}

test('changeAnswerHelpful rejects self-votes before inserting a helpful vote', async () => {
  const viewer = { userId: '11111111-1111-4111-8111-111111111111' };
  const supabase = makeHelpfulSupabase({
    answer: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      author_user_id: viewer.userId,
      posts: { id: 'q1', author_user_id: 'asker-1', status: 'visible', created_at: '2026-07-01T00:00:00.000Z' }
    }
  });

  const response = await changeAnswerHelpful({
    httpMethod: 'POST',
    body: JSON.stringify({ answerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
  }, viewer, supabase);

  assert.equal(response.statusCode, 403);
  assert.deepEqual(JSON.parse(response.body), { error: 'self_vote_forbidden' });
  assert.deepEqual(supabase.calls.inserts, []);
});

test('changeAnswerHelpful ignores duplicate helpful-vote inserts and skips badge awards', async () => {
  const viewer = { userId: '22222222-2222-4222-8222-222222222222' };
  const awards = [];
  const supabase = makeHelpfulSupabase({
    answer: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      author_user_id: '11111111-1111-4111-8111-111111111111',
      created_at: '2026-07-01T00:00:00.000Z',
      posts: { id: 'q1', author_user_id: viewer.userId, status: 'visible', created_at: '2026-07-01T00:00:00.000Z' }
    },
    insertError: { code: '23505' }
  });

  const response = await changeAnswerHelpful({
    httpMethod: 'POST',
    body: JSON.stringify({ answerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
  }, viewer, supabase, {
    awardQuestBadges: async (database, userId) => awards.push(['public', userId]),
    awardQuestBadge: async (database, userId, code) => awards.push(['secret', userId, code])
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { ok: true, helpful: true, inserted: false });
  assert.deepEqual(awards, []);
});
