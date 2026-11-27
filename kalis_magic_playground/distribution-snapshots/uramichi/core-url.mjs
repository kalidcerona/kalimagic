// ---------- UrlValidator (java.net.URI rules: http/https with a server host) ----------

const ALNUM = 'A-Za-z0-9';
const UNRESERVED = ALNUM + "\\-_.!\\x7e*'()"; // \x7e is the tilde
const PCHAR = UNRESERVED + ':@&=+$,';
// Path: pchar plus ;/ . Query and fragment: reserved (incl. []) plus unreserved.
const PATH_RE = new RegExp(`^(?:[${PCHAR};/]|%[0-9A-Fa-f]{2}|[^\\x00-\\x80\\s\\u0080-\\u009f])*$`);
const URIC_RE = new RegExp(`^(?:[${UNRESERVED};/?:@&=+$,\\[\\]]|%[0-9A-Fa-f]{2}|[^\\x00-\\x80\\s\\u0080-\\u009f])*$`);
const USERINFO_RE = new RegExp(`^(?:[${UNRESERVED};:&=+$,]|%[0-9A-Fa-f]{2}|[^\\x00-\\x80\\s\\u0080-\\u009f])*$`);
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function validHostname(host) {
  if (!host) return false;
  const t = host.endsWith('.') ? host.slice(0, -1) : host;
  const labels = t.split('.');
  if (labels.some((l) => !/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(l))) return false;
  // A dotted hostname's rightmost label must start with a letter (java.net.URI).
  return labels.length === 1 || /^[A-Za-z]/.test(labels[labels.length - 1]);
}

function validHost(host) {
  if (/^\[[0-9A-Fa-f:.]+\]$/.test(host)) return host.includes(':');
  const v4 = IPV4_RE.exec(host);
  if (v4) return v4.slice(1).every((n) => Number(n) <= 255);
  return validHostname(host);
}

export function isValidWebUrl(input) {
  const text = typeof input === 'string' ? input.trim() : '';
  if (!text || /\s/.test(text)) return false;
  const m = /^([A-Za-z][A-Za-z0-9+.-]*):(.*)$/s.exec(text);
  if (!m) return false;
  const scheme = m[1].toLowerCase();
  if (scheme !== 'http' && scheme !== 'https') return false;
  let rest = m[2];
  let fragment = null;
  const hash = rest.indexOf('#');
  if (hash >= 0) { fragment = rest.slice(hash + 1); rest = rest.slice(0, hash); }
  if (fragment !== null && !URIC_RE.test(fragment)) return false;
  if (!rest.startsWith('//')) return false;
  rest = rest.slice(2);
  const end = rest.search(/[/?]/);
  const authority = end < 0 ? rest : rest.slice(0, end);
  let tail = end < 0 ? '' : rest.slice(end);
  if (!authority) return false;
  let query = null;
  const q = tail.indexOf('?');
  if (q >= 0) { query = tail.slice(q + 1); tail = tail.slice(0, q); }
  if (!PATH_RE.test(tail)) return false;
  if (query !== null && !URIC_RE.test(query)) return false;
  let hostPort = authority;
  const at = authority.lastIndexOf('@');
  if (at >= 0) {
    if (!USERINFO_RE.test(authority.slice(0, at))) return false;
    hostPort = authority.slice(at + 1);
  }
  let host = hostPort;
  const pm = /^(.*?)(?::(\d*))?$/.exec(hostPort);
  if (!hostPort.startsWith('[')) host = pm[1];
  else {
    const close = hostPort.indexOf(']');
    if (close < 0) return false;
    host = hostPort.slice(0, close + 1);
    const after = hostPort.slice(close + 1);
    if (after && !/^:\d*$/.test(after)) return false;
  }
  return validHost(host);
}
