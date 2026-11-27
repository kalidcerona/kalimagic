import {event, getOffer, getEvent} from './_lib/seminar-events.mjs';
import {json} from './_lib/http.mjs';

export function createOfferHandler(config = null, now = () => new Date()) {
  return async request => {
    if (request.httpMethod !== 'GET') return json(405, {error: 'method_not_allowed'}, {Allow: 'GET'});
    const id = request.queryStringParameters?.eventId;
    const settings = config || getEvent(id);
    if (!settings || (id !== undefined && id !== settings.id)) return json(404, {error: 'unknown_event'});
    return json(200, getOffer(now(), settings));
  };
}

export const handler = createOfferHandler();
