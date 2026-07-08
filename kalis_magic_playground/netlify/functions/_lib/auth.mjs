import { getSupabaseAdmin } from './supabase.mjs';

export function bearerToken(event) {
  const value = event.headers.authorization || event.headers.Authorization || '';
  return value.startsWith('Bearer ') ? value.slice('Bearer '.length) : null;
}

export function defaultProfileNickname(email, random = Math.random) {
  const localPart = String(email || '').split('@')[0].trim();
  const nickname = Array.from(localPart).slice(0, 24).join('');
  if (nickname.length >= 2) return nickname;

  const value = Number(random());
  const number = Number.isFinite(value) ? Math.floor(value < 1 ? value * 100 : value) : 0;
  const suffix = String(Math.abs(number) % 100).padStart(2, '0');
  return `마술인${suffix}`;
}

async function createProfileForUser(supabase, user) {
  const { data: created, error } = await supabase
    .from('profiles')
    .upsert({
      user_id: user.id,
      nickname: defaultProfileNickname(user.email),
      role: 'member',
      nickname_set: false
    }, {
      onConflict: 'user_id',
      ignoreDuplicates: true
    })
    .select('user_id,nickname,role')
    .maybeSingle();
  if (error) throw error;
  if (created) return created;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id,nickname,role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  return profile;
}

export async function requireViewer(event) {
  const token = bearerToken(event);
  if (!token) throw new Error('auth_required');
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('auth_invalid');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id,nickname,role')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  const viewerProfile = profile || await createProfileForUser(supabase, data.user);
  return {
    userId: data.user.id,
    email: data.user.email,
    nickname: viewerProfile?.nickname || defaultProfileNickname(data.user.email),
    role: viewerProfile?.role || 'member'
  };
}

export async function requireAdmin(event) {
  const viewer = await requireViewer(event);
  if (!['admin', 'kali'].includes(viewer.role)) throw new Error('admin_required');
  return viewer;
}
