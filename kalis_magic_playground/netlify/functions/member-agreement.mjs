import { POLICY_VERSION } from '../../member-policy-config.mjs';
import { bearerToken, requireViewer } from './_lib/auth.mjs';
import { json } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';

const columns = 'terms_version,privacy_version,agreed_at';

function checkSchema(error) {
  if (!error) return true;
  if (['42703', 'PGRST204'].includes(error.code)) return false;
  throw error;
}

export function createAgreementHandler({ getAdmin = getSupabaseAdmin, viewer = requireViewer, now = Date.now } = {}) {
  return async function recordAgreement(event) {
    if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (!bearerToken(event)) return json(401, { error: 'auth_required' });
    let input;
    try { input = JSON.parse(event.body); } catch { return json(400, { error: 'invalid_agreement' }); }
    const time = typeof input?.agreedAt === 'string' ? Date.parse(input.agreedAt) : NaN;
    if (input?.version !== POLICY_VERSION || input.ageConfirmed !== true ||
        !Number.isFinite(time) || new Date(time).toISOString() !== input.agreedAt || time > now() + 300000) {
      return json(400, { error: 'invalid_agreement' });
    }
    try {
      const db = getAdmin();
      const { userId } = await viewer(event, db);
      const current = await db.from('profiles').select(columns).eq('user_id', userId).maybeSingle();
      if (!checkSchema(current.error) || !current.data) return json(200, { recorded: false });
      const row = current.data;
      if (row.terms_version === POLICY_VERSION && row.privacy_version === POLICY_VERSION && row.agreed_at) {
        return json(200, { recorded: true });
      }
      if (row.terms_version > POLICY_VERSION || row.privacy_version > POLICY_VERSION) {
        return json(200, { recorded: false });
      }

      // Compare the observed versions so concurrent requests cannot replace the first receipt.
      let write = db.from('profiles').update({
        terms_version: POLICY_VERSION, privacy_version: POLICY_VERSION, agreed_at: input.agreedAt
      }).eq('user_id', userId);
      for (const name of columns.split(',')) {
        write = row[name] === null ? write.is(name, null) : write.eq(name, row[name]);
      }
      const saved = await write.select('user_id').maybeSingle();
      return json(200, { recorded: checkSchema(saved.error) && Boolean(saved.data) });
    } catch (error) {
      if (['auth_invalid', 'auth_required'].includes(error.message)) return json(401, { error: 'auth_required' });
      return json(503, { error: 'temporarily_unavailable' });
    }
  };
}

export const handler = createAgreementHandler();
