import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { Credentials, type SecretProtector } from '../credentials';

const directories: string[] = [];
function fixture(available = true) {
  const directory = mkdtempSync(join(tmpdir(), 'study-key-'));
  directories.push(directory);
  const path = join(directory, 'credentials.enc.json');
  const testKey = randomBytes(32);
  const protector: SecretProtector = {
    isEncryptionAvailable: () => available,
    encryptString(value) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', testKey, iv);
      const encrypted = Buffer.concat([cipher.update(value), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
    },
    decryptString(value) {
      const decipher = createDecipheriv('aes-256-gcm', testKey, value.subarray(0, 12));
      decipher.setAuthTag(value.subarray(12, 28));
      return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString();
    },
  };
  return { path, credentials: new Credentials(path, protector), protector };
}
afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

it('binds encrypted keys to normalized endpoints and preserves them after reopening', () => {
  const { path, credentials, protector } = fixture();
  credentials.store('https://example.com/v1/', 'fake-secret-marker');
  expect(readFileSync(path, 'utf8')).not.toContain('fake-secret-marker');
  const reopened = new Credentials(path, protector);
  expect(reopened.load('https://example.com/v1')).toBe('fake-secret-marker');
  expect(reopened.load('https://different.example/v1')).toBeUndefined();
  expect(reopened.load('https://example.com/another-path')).toBeUndefined();
  reopened.remove('https://example.com/v1');
  expect(reopened.has('https://example.com/v1')).toBe(false);
});

it('refuses plaintext fallback when operating system encryption is unavailable', () => {
  const { path, credentials } = fixture(false);
  expect(() => credentials.store('https://example.com', 'fake-key')).toThrow('加密不可用');
  expect(existsSync(path)).toBe(false);
});

it('reports corrupt ciphertext instead of ignoring or overwriting it', () => {
  const { path, credentials } = fixture();
  writeFileSync(path, 'broken');
  expect(() => credentials.has('https://example.com')).toThrow('损坏');
  expect(() => credentials.store('https://example.com', 'fake-key')).toThrow('损坏');
  expect(readFileSync(path, 'utf8')).toBe('broken');
});
