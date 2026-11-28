import { json } from './http.mjs';

export const communityPaused = true;

export function pausedWrite() {
  return json(503, { error: 'community_paused' });
}
