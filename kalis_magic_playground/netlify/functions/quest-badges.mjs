import { requireViewer } from './_lib/auth.mjs';
import { json } from './_lib/http.mjs';
import { shapeQuestCatalog } from './_lib/quest-badges.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';

export async function handler(event) {
  if (event.httpMethod !== 'GET') return json(405, { error: 'method_not_allowed' });

  let viewer;
  try {
    viewer = await requireViewer(event);
  } catch {
    return json(401, { error: 'auth_required' });
  }

  const supabase = getSupabaseAdmin();
  try {
    return json(200, {
      userId: viewer.userId,
      catalog: await shapeQuestCatalog(supabase, viewer.userId)
    });
  } catch {
    return json(500, { error: 'db_error' });
  }
}
