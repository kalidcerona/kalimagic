export async function handler() {
  return {
    statusCode: 302,
    headers: { location: '/playground.html', 'cache-control': 'no-store' },
    body: ''
  };
}
