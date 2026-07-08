import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  listGivenActivity,
  listReceivedActivity,
  parseTab,
  shapeActivityItem,
  shapeMyPost
} from '../../netlify/functions/my-activity.mjs';

function valueAtPath(row, path) {
  return String(path).split('.').reduce((value, key) => value?.[key], row);
}

function makeSupabase(fixtures) {
  const queries = [];
  return {
    queries,
    from(table) {
      const state = {
        table,
        calls: [],
        filters: [],
        limitValue: null
      };
      queries.push(state);
      return {
        select(columns) {
          state.calls.push(['select', columns]);
          return this;
        },
        eq(column, value) {
          state.calls.push(['eq', column, value]);
          state.filters.push(['eq', column, value]);
          return this;
        },
        neq(column, value) {
          state.calls.push(['neq', column, value]);
          state.filters.push(['neq', column, value]);
          return this;
        },
        order(column, options) {
          state.calls.push(['order', column, options]);
          return this;
        },
        limit(value) {
          state.calls.push(['limit', value]);
          state.limitValue = value;
          return this;
        },
        then(resolve, reject) {
          let rows = [...(fixtures[table] || [])];
          for (const [operator, column, expected] of state.filters) {
            rows = rows.filter((row) => {
              const actual = valueAtPath(row, column);
              return operator === 'eq' ? actual === expected : actual !== expected;
            });
          }
          if (state.limitValue !== null) rows = rows.slice(0, state.limitValue);
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        }
      };
    }
  };
}

function callsInclude(query, expected) {
  return query.calls.some((call) => JSON.stringify(call) === JSON.stringify(expected));
}

test('parseTab defaults to posts and accepts known tabs', () => {
  assert.equal(parseTab(undefined), 'posts');
  assert.equal(parseTab(null), 'posts');
  assert.equal(parseTab(''), 'posts');
  assert.equal(parseTab('posts'), 'posts');
  assert.equal(parseTab('received'), 'received');
  assert.equal(parseTab('given'), 'given');
});

test('parseTab rejects unknown tabs', () => {
  assert.throws(() => parseTab('answers'), /invalid_tab/);
});

test('shapeMyPost maps database columns and comment count', () => {
  const shaped = shapeMyPost({
    id: 'post-1',
    post_type: 'question',
    category: 'question',
    title: '질문 제목',
    visibility: 'public',
    status: 'visible',
    created_at: '2026-07-08T00:00:00.000Z'
  }, new Map([['post-1', 3]]));

  assert.deepEqual(shaped, {
    id: 'post-1',
    postType: 'question',
    category: 'question',
    title: '질문 제목',
    visibility: 'public',
    status: 'visible',
    createdAt: '2026-07-08T00:00:00.000Z',
    commentCount: 3
  });
});

test('shapeActivityItem maps answer and comment rows with trimmed preview body', () => {
  const shaped = shapeActivityItem({
    post_id: 'post-1',
    post_title: '질문 제목',
    body: ` ${'가'.repeat(210)} `,
    created_at: '2026-07-08T00:00:00.000Z'
  }, 'answer');

  assert.equal(shaped.type, 'answer');
  assert.equal(shaped.postId, 'post-1');
  assert.equal(shaped.postTitle, '질문 제목');
  assert.equal(shaped.body.length, 200);
  assert.equal(shaped.createdAt, '2026-07-08T00:00:00.000Z');
});

test('my activity handler uses auth, tab validation, comment counts, and visible filters', () => {
  const source = readFileSync(new URL('../../netlify/functions/my-activity.mjs', import.meta.url), 'utf8');
  assert.match(source, /requireViewer/);
  assert.match(source, /json\(401,\s*\{\s*error:\s*'auth_required'\s*\}\s*\)/);
  assert.match(source, /json\(400,\s*\{\s*error:\s*'invalid_tab'\s*\}\s*\)/);
  assert.match(source, /\.from\('comments'\)[\s\S]*\.eq\('status', 'visible'\)/);
  assert.match(source, /\.from\('answers'\)[\s\S]*\.eq\('status', 'visible'\)/);
  assert.match(source, /\.neq\('status', 'deleted'\)/);
});

test('listGivenActivity filters unreadable post titles and excludes self answers by query', async () => {
  const viewer = { userId: 'viewer-1', role: 'member' };
  const supabase = makeSupabase({
    comments: [
      {
        id: 'comment-1',
        post_id: 'post-readable',
        body: '볼 수 있는 댓글',
        created_at: '2026-07-08T00:00:03.000Z',
        author_user_id: viewer.userId,
        status: 'visible',
        posts: {
          id: 'post-readable',
          title: '읽을 수 있는 글',
          status: 'visible',
          visibility: 'public',
          author_user_id: 'author-1'
        }
      },
      {
        id: 'comment-2',
        post_id: 'post-secret',
        body: '비공개 댓글',
        created_at: '2026-07-08T00:00:02.000Z',
        author_user_id: viewer.userId,
        status: 'visible',
        posts: {
          id: 'post-secret',
          title: '노출되면 안 되는 제목',
          status: 'visible',
          visibility: 'kali_only',
          author_user_id: 'author-2'
        }
      }
    ],
    answers: [
      {
        id: 'answer-1',
        question_post_id: 'question-readable',
        body: '볼 수 있는 답변',
        created_at: '2026-07-08T00:00:01.000Z',
        author_user_id: viewer.userId,
        status: 'visible',
        posts: {
          id: 'question-readable',
          title: '읽을 수 있는 질문',
          status: 'visible',
          visibility: 'public',
          author_user_id: 'author-3'
        }
      },
      {
        id: 'answer-2',
        question_post_id: 'question-self',
        body: '내 질문에 단 답변',
        created_at: '2026-07-08T00:00:04.000Z',
        author_user_id: viewer.userId,
        status: 'visible',
        posts: {
          id: 'question-self',
          title: '내 질문',
          status: 'visible',
          visibility: 'public',
          author_user_id: viewer.userId
        }
      }
    ]
  });

  const items = await listGivenActivity(supabase, viewer);

  assert.deepEqual(items.map((item) => item.postTitle), ['읽을 수 있는 글', '읽을 수 있는 질문']);
  const commentsQuery = supabase.queries.find((query) => query.table === 'comments');
  const answersQuery = supabase.queries.find((query) => query.table === 'answers');
  assert.match(commentsQuery.calls[0][1], /status/);
  assert.match(commentsQuery.calls[0][1], /visibility/);
  assert.match(commentsQuery.calls[0][1], /author_user_id/);
  assert.match(answersQuery.calls[0][1], /status/);
  assert.match(answersQuery.calls[0][1], /visibility/);
  assert.match(answersQuery.calls[0][1], /author_user_id/);
  assert.equal(callsInclude(commentsQuery, ['eq', 'posts.status', 'visible']), true);
  assert.equal(callsInclude(answersQuery, ['eq', 'posts.status', 'visible']), true);
  assert.equal(callsInclude(answersQuery, ['neq', 'posts.author_user_id', viewer.userId]), true);
});

test('listReceivedActivity excludes self answers like self comments', async () => {
  const viewer = { userId: 'viewer-1', role: 'member' };
  const supabase = makeSupabase({
    answers: [
      {
        id: 'answer-other',
        question_post_id: 'question-1',
        body: '다른 사람이 쓴 답변',
        created_at: '2026-07-08T00:00:02.000Z',
        author_user_id: 'answerer-1',
        status: 'visible',
        posts: {
          id: 'question-1',
          title: '내 질문',
          author_user_id: viewer.userId,
          post_type: 'question'
        }
      },
      {
        id: 'answer-self',
        question_post_id: 'question-1',
        body: '내가 쓴 답변',
        created_at: '2026-07-08T00:00:03.000Z',
        author_user_id: viewer.userId,
        status: 'visible',
        posts: {
          id: 'question-1',
          title: '내 질문',
          author_user_id: viewer.userId,
          post_type: 'question'
        }
      }
    ],
    comments: []
  });

  const items = await listReceivedActivity(supabase, viewer);

  assert.deepEqual(items.map((item) => item.body), ['다른 사람이 쓴 답변']);
  const answersQuery = supabase.queries.find((query) => query.table === 'answers');
  assert.equal(callsInclude(answersQuery, ['neq', 'author_user_id', viewer.userId]), true);
});
