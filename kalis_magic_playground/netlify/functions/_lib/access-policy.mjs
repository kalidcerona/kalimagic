const ELEVATED_ROLES = new Set(['admin', 'kali']);

export function isElevated(viewer) {
  return Boolean(viewer && ELEVATED_ROLES.has(viewer.role));
}

export function isExpertOrHigher(viewer) {
  return Boolean(viewer && (viewer.role === 'expert' || viewer.role === 'god' || ELEVATED_ROLES.has(viewer.role)));
}

export function isAuthor(post, viewer) {
  return Boolean(viewer && post.authorUserId && post.authorUserId === viewer.userId);
}

export function canReadPostBody(post, viewer) {
  if (post.visibility === 'public') return true;
  if (isAuthor(post, viewer)) return true;
  if (post.visibility === 'kali_only') return isElevated(viewer);
  if (post.visibility === 'expert_only') return isExpertOrHigher(viewer);
  return false;
}

export function canReadAuthor(post, viewer) {
  if (post.visibility === 'public') return true;
  return canReadPostBody(post, viewer);
}

export function canPublishAnswer(question, answerVisibility) {
  if (answerVisibility === 'author_only') return true;
  if (answerVisibility !== 'public') return false;
  return question.visibility === 'public';
}

export function canReadAnswer(question, answer, viewer) {
  if (answer.visibility === 'public') return canReadPostBody(question, viewer);
  if (answer.visibility === 'author_only') return isAuthor(question, viewer) || isElevated(viewer);
  return false;
}
