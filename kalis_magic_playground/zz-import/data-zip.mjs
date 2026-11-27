// A's archive contract uses uncompressed ZIP entries. Reject unsupported variants.
export async function readZip(buffer) {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer), files = new Map();
  const fail = () => {
    throw new Error('손상되었거나 지원하지 않는 ZIP 파일입니다.');
  };
  const u16 = (offset) => offset + 2 <= bytes.length ? view.getUint16(offset, true) : fail();
  const u32 = (offset) => offset + 4 <= bytes.length ? view.getUint32(offset, true) : fail();
  if (bytes.length < 22) fail();
  const end = bytes.length - 22;
  if (u32(end) !== 0x06054b50 || u16(end + 4) !== 0 || u16(end + 6) !== 0 || u16(end + 20) !== 0) fail();
  const count = u16(end + 10), size = u32(end + 12), start = u32(end + 16);
  if (count !== u16(end + 8) || count > 4096 || start + size !== end) fail();
  let at = start, total = 0;
  for (let i = 0; i < count; i++) {
    if (u32(at) !== 0x02014b50 || u16(at + 8) !== 0 || u16(at + 10) !== 0) fail();
    const compressed = u32(at + 20),
      length = u32(at + 24),
      nameLength = u16(at + 28),
      extra = u16(at + 30),
      comment = u16(at + 32),
      local = u32(at + 42);
    if (compressed !== length || length > 100 * 1024 * 1024 || at + 46 + nameLength + extra + comment > end) {
      fail();
    }
    const name = new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(at + 46, at + 46 + nameLength));
    if (name !== 'manifest.json' && !/^media\/[a-f0-9]{64}$/.test(name)) fail();
    if (
      files.has(name) || u32(local) !== 0x04034b50 || u16(local + 6) !== 0 || u16(local + 8) !== 0 ||
      u32(local + 18) !== length || u32(local + 22) !== length
    ) fail();
    const localName = u16(local + 26),
      localExtra = u16(local + 28),
      dataStart = local + 30 + localName + localExtra;
    if (
      new TextDecoder().decode(bytes.slice(local + 30, local + 30 + localName)) !== name ||
      dataStart + length > start
    ) fail();
    const data = bytes.slice(dataStart, dataStart + length);
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    if ((~crc >>> 0) !== u32(at + 16) || u32(local + 14) !== u32(at + 16)) fail();
    total += length;
    if (total > 256 * 1024 * 1024) fail();
    files.set(name, data);
    at += 46 + nameLength + extra + comment;
  }
  if (at !== end) fail();
  return files;
}
