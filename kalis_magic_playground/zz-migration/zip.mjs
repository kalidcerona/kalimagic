const encode = new TextEncoder();

const crcTable = Array.from({length: 256}, (_, value) => {
  for (let i = 0; i < 8; i++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});

function header(size, fields) {
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  for (const [offset, width, value] of fields) view[width === 2 ? 'setUint16' : 'setUint32'](offset, value, true);
  return bytes;
}

export async function zip(files) {
  const parts = [], directory = [];
  let offset = 0, centralSize = 0;
  if (files.size >= 65535) throw new Error('ZIP 파일 수 제한을 넘었습니다.');
  for (const [path, blob] of files) {
    const name = encode.encode(path);
    let crc = 0xffffffff;
    for (const byte of new Uint8Array(await blob.arrayBuffer())) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
    crc = ~crc >>> 0;
    const local = header(30, [[0,4,0x04034b50],[4,2,20],[12,2,33],[14,4,crc],[18,4,blob.size],[22,4,blob.size],[26,2,name.length]]);
    const central = header(46, [[0,4,0x02014b50],[4,2,20],[6,2,20],[14,2,33],[16,4,crc],[20,4,blob.size],[24,4,blob.size],[28,2,name.length],[42,4,offset]]);
    parts.push(local, name, blob);
    directory.push(central, name);
    offset += local.length + name.length + blob.size;
    centralSize += central.length + name.length;
    if (offset + centralSize >= 0xffffffff) throw new Error('ZIP 용량 제한을 넘었습니다.');
  }
  const end = header(22, [[0,4,0x06054b50],[8,2,files.size],[10,2,files.size],[12,4,centralSize],[16,4,offset]]);
  return new Blob([...parts, ...directory, end], {type: 'application/zip'});
}
