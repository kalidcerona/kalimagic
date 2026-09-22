export const FRIEND_APP_TOOLS = new Set(['unlock', 'stopwatch-uni']);

export function friendAccessDecision(row) {
  if (!row) return 'create';
  return row.status === 'approved' ? 'allow' : 'pending';
}

function escapeIlikePattern(value) {
  return String(value ?? '').replace(/[\\%_]/g, '\\$&');
}

export async function findFriendAccess(supabase, userId, email, tool) {
  const columns = 'id,user_id,email,tool,lifetime,status,display_name,nickname';
  const byUser = await supabase.from('friend_app_access')
    .select(columns).eq('user_id', userId).eq('tool', tool).limit(1).maybeSingle();
  if (byUser.error || byUser.data) return byUser;
  return supabase.from('friend_app_access')
    .select(columns).ilike('email', escapeIlikePattern(email)).eq('tool', tool).limit(1).maybeSingle();
}
