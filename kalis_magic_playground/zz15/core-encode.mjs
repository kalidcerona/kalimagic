// ---------- URLEncoder.encode(s, "UTF-8") with %20 for spaces ----------

const utf8 = new TextEncoder();
export function encodeValue(s) {
  let out = '';
  for (const byte of utf8.encode(String(s))) {
    const c = String.fromCharCode(byte);
    if (/[A-Za-z0-9.\-*_]/.test(c)) out += c;
    else if (byte === 0x20) out += '%20';
    else out += '%' + byte.toString(16).toUpperCase().padStart(2, '0');
  }
  return out;
}
