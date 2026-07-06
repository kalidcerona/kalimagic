import { json } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';

export async function handler(event) {
  if (event.httpMethod !== 'GET') return json(405, { error: 'method_not_allowed' });
  const eventCode = event.queryStringParameters?.eventCode || '2026-08';
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('event_photos')
    .select('id,image_src,alt_text,sort_order')
    .eq('event_code', eventCode)
    .eq('status', 'visible')
    .order('sort_order', { ascending: true });

  if (error) return json(500, { error: 'db_error' });
  return json(200, { photos: data });
}
