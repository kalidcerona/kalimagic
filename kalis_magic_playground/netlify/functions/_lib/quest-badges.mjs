export const QUEST_TRACKS = [
  'total_records',
  'questions',
  'answers',
  'answer_helpful_votes',
  'free_posts',
  'event_reviews',
  'tool_reviews'
];

export function shouldIgnoreQuestBadgeInsertError(error) {
  return error?.code === '23505';
}

function charLength(value) {
  return Array.from(String(value || '')).length;
}

function seoulDayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function countDayCappedFreePosts(rows) {
  const perDay = new Map();
  let count = 0;
  for (const row of rows || []) {
    if (charLength(row.body) < 80) continue;
    const day = seoulDayKey(row.created_at);
    if (!day) continue;
    const current = perDay.get(day) || 0;
    if (current >= 3) continue;
    perDay.set(day, current + 1);
    count += 1;
  }
  return count;
}

async function fetchRows(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getQuestProgress(supabase, userId) {
  if (!userId) {
    return {
      questions: 0,
      answers: 0,
      free_posts: 0,
      event_reviews: 0,
      tool_reviews: 0,
      total_records: 0,
      answer_helpful_votes: 0
    };
  }

  const questions = await fetchRows(supabase
    .from('posts')
    .select('id')
    .eq('author_user_id', userId)
    .eq('post_type', 'question')
    .eq('status', 'visible'));

  const answers = await fetchRows(supabase
    .from('answers')
    .select('id,question_post_id,posts!inner(status)')
    .eq('author_user_id', userId)
    .eq('posts.status', 'visible'));

  const freeRows = await fetchRows(supabase
    .from('posts')
    .select('id,body,created_at')
    .eq('author_user_id', userId)
    .eq('post_type', 'free')
    .eq('status', 'visible')
    .order('created_at', { ascending: true }));

  const eventReviews = await fetchRows(supabase
    .from('posts')
    .select('id')
    .eq('author_user_id', userId)
    .eq('category', 'event_review')
    .eq('status', 'visible'));

  const toolReviews = await fetchRows(supabase
    .from('posts')
    .select('id')
    .eq('author_user_id', userId)
    .eq('category', 'review')
    .neq('post_type', 'event_review')
    .eq('status', 'visible'));

  const answerIds = answers.map((answer) => answer.id).filter(Boolean);
  const helpfulVotes = answerIds.length > 0
    ? await fetchRows(supabase
      .from('answer_helpful_votes')
      .select('answer_id')
      .in('answer_id', answerIds))
    : [];

  const progress = {
    questions: questions.length,
    answers: answers.length,
    free_posts: countDayCappedFreePosts(freeRows),
    event_reviews: eventReviews.length,
    tool_reviews: toolReviews.length,
    answer_helpful_votes: helpfulVotes.length
  };
  progress.total_records = progress.questions +
    progress.answers +
    progress.free_posts +
    progress.event_reviews +
    progress.tool_reviews;
  return progress;
}

export async function awardQuestBadge(supabase, userId, badgeCode, options = {}) {
  const payload = {
    user_id: userId,
    badge_code: badgeCode
  };
  if (options.awardedReason) payload.awarded_reason = options.awardedReason;
  if (options.awardedBy) payload.awarded_by = options.awardedBy;

  const { error } = await supabase.from('user_quest_badges').insert(payload);
  if (error && shouldIgnoreQuestBadgeInsertError(error)) return false;
  if (error) throw error;
  return true;
}

export async function awardQuestBadges(supabase, userId) {
  const progress = await getQuestProgress(supabase, userId);
  const [badges, ownedRows] = await Promise.all([
    fetchRows(supabase
      .from('quest_badges')
      .select('code,track,threshold,is_secret,sort_order')
      .eq('is_secret', false)
      .order('sort_order', { ascending: true })),
    fetchRows(supabase
      .from('user_quest_badges')
      .select('badge_code')
      .eq('user_id', userId))
  ]);

  const owned = new Set(ownedRows.map((row) => row.badge_code));
  const awarded = [];
  for (const badge of badges) {
    const current = progress[badge.track] || 0;
    const threshold = Number(badge.threshold);
    if (!Number.isFinite(threshold) || current < threshold || owned.has(badge.code)) continue;
    const inserted = await awardQuestBadge(supabase, userId, badge.code, {
      awardedReason: 'quest_threshold'
    });
    if (inserted) awarded.push(badge.code);
  }
  return awarded;
}

function shapePublicBadge(badge, owned, progress) {
  const current = progress[badge.track] || 0;
  const required = Number(badge.threshold) || 0;
  const percent = required > 0 ? Math.min(100, Math.floor((current / required) * 100)) : 0;
  return {
    code: badge.code,
    track: badge.track,
    level: badge.level,
    name: badge.name,
    material: badge.material,
    symbol: badge.symbol,
    rarity: badge.rarity,
    threshold: badge.threshold,
    publicDescription: badge.public_description,
    owned,
    progress: {
      current,
      required,
      percent
    }
  };
}

function shapeSecretBadge(badge, owned) {
  return {
    code: badge.code,
    isSecret: true,
    secretHint: badge.secret_hint,
    owned
  };
}

export async function shapeQuestCatalog(supabase, userId) {
  const [progress, badges, ownedRows] = await Promise.all([
    getQuestProgress(supabase, userId),
    fetchRows(supabase
      .from('quest_badges')
      .select('code,track,level,name,material,symbol,rarity,threshold,is_secret,manual_only,public_description,secret_hint,sort_order')
      .order('sort_order', { ascending: true })),
    fetchRows(supabase
      .from('user_quest_badges')
      .select('badge_code')
      .eq('user_id', userId))
  ]);
  const ownedCodes = new Set(ownedRows.map((row) => row.badge_code));
  return badges.flatMap((badge) => {
    const owned = ownedCodes.has(badge.code);
    if (badge.is_secret) {
      if (badge.manual_only && !owned) return [];
      return [shapeSecretBadge(badge, owned)];
    }
    return [shapePublicBadge(badge, owned, progress)];
  });
}
