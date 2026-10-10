import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crc32 } from 'node:zlib';
import { finalizeUninstaller } from './nsis-uninstaller.mjs';

function fixture() {
  const buffer = Buffer.alloc(1568);
  buffer.write('MZ');
  buffer.writeUInt32LE(128, 60);
  buffer.write('PE\0\0', 128);
  buffer.writeUInt16LE(1, 134);
  buffer.writeUInt16LE(224, 148);
  buffer.writeUInt32LE(1024, 392);
  buffer.writeUInt32LE(512, 396);
  buffer.writeUInt32LE(1, 1536);
  Buffer.from('efbeadde4e756c6c736f6674496e7374', 'hex').copy(buffer, 1540);
  buffer.writeUInt32LE(32, 1560);
  buffer.writeUInt32LE(0x12345678, 1564);
  return buffer;
}

test('finalization repairs the extracted CRC without changing flags/code or input', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  const original = fixture();
  const result = finalizeUninstaller(original);
  assert.equal(
    result.readUInt32LE(result.length - 4),
    crc32(original.subarray(512, original.length - 4)),
  );
  assert.ok(
    result.subarray(0, result.length - 4).equals(original.subarray(0, original.length - 4)),
  );
  assert.equal(original.readUInt32LE(original.length - 4), 0x12345678);
  assert.equal(result.readUInt32LE(1536), 1);
  assert.deepEqual(finalizeUninstaller(result), result);
});

test('unknown/CRC-disabled layouts are rejected instead of bypassing integrity checks', () => {
  for (const flags of [0, 4, 5, 9]) {
    const buffer = fixture();
    buffer.writeUInt32LE(flags, 1536);
    assert.throws(() => finalizeUninstaller(buffer), /integrity flags/);
  }
});

test('truncated, mismatched or non-PE extraction fails closed', () => {
  assert.throws(() => finalizeUninstaller(Buffer.alloc(20)));
  for (const [offset, value] of [
    [60, 1560],
    [1560, 31],
    [1540, 0],
  ]) {
    const buffer = fixture();
    buffer.writeUInt32LE(value, offset);
    assert.throws(() => finalizeUninstaller(buffer));
  }
});
