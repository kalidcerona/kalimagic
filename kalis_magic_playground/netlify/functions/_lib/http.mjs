export function json(statusCode, data, headers = {}) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    },
    body: JSON.stringify(data)
  };
}

export function methodNotAllowed() {
  return json(405, { error: 'method_not_allowed' });
}

export function readJsonBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    throw new Error('invalid_json');
  }
}

export function requireMethod(event, allowed) {
  if (!allowed.includes(event.httpMethod)) throw new Error('method_not_allowed');
}
