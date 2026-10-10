import { crc32 } from 'node:zlib';

// Pinned builder 26.15.3 joins the original PE stub with an extracted NSIS
// uninstaller block. Its stored CRC belongs to a different stub. NSIS checks
// bytes from offset 512 through the payload, excluding the final CRC DWORD.
// Recompute that DWORD; preserve the code, flags and enabled integrity check.
export function finalizeUninstaller(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 1024 || buffer.toString('ascii', 0, 2) !== 'MZ')
    throw new Error('Invalid uninstaller PE.');
  const pe = buffer.readUInt32LE(60);
  if (pe + 24 > buffer.length || buffer.toString('ascii', pe, pe + 4) !== 'PE\0\0')
    throw new Error('Invalid uninstaller PE header.');
  const count = buffer.readUInt16LE(pe + 6);
  const sections = pe + 24 + buffer.readUInt16LE(pe + 20);
  if (!count || sections + count * 40 > buffer.length)
    throw new Error('Invalid uninstaller sections.');
  let offset = 0;
  for (let index = 0; index < count; index++) {
    const section = sections + index * 40;
    offset = Math.max(
      offset,
      buffer.readUInt32LE(section + 16) + buffer.readUInt32LE(section + 20),
    );
  }
  const signature = Buffer.from('efbeadde4e756c6c736f6674496e7374', 'hex');
  if (
    offset < 512 ||
    offset + 32 > buffer.length ||
    !buffer.subarray(offset + 4, offset + 20).equals(signature) ||
    buffer.readUInt32LE(offset) !== 1 ||
    offset + buffer.readUInt32LE(offset + 24) !== buffer.length
  )
    throw new Error('Unexpected NSIS uninstaller layout or integrity flags.');
  const result = Buffer.from(buffer);
  result.writeUInt32LE(crc32(result.subarray(512, result.length - 4)), result.length - 4);
  return result;
}
