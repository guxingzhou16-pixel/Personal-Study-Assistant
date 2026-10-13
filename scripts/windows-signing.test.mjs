import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { assertSignedFile, signingThumbprint } from './windows-signing.mjs';

const thumbprint = '1234567890ABCDEF1234567890ABCDEF12345678';
const validSignature = {
  status: 'Valid',
  signatureType: 'Authenticode',
  signerThumbprint: thumbprint,
  signerCodeSigning: true,
  timestampThumbprint: 'ABCDEF1234567890ABCDEF1234567890ABCDEF12',
};

test('requires an explicit certificate, rejects malformed values and normalizes hex case', () => {
  assert.throws(() => signingThumbprint(undefined), /证书指纹/);
  for (const value of ['', ' ', thumbprint + ';', 'G'.repeat(40), 'A'.repeat(39)])
    assert.throws(() => signingThumbprint(value), /证书指纹/);
  assert.equal(signingThumbprint(thumbprint.toLowerCase()), thumbprint);
});

test('accepts a trusted embedded signature only from the selected code signing certificate', () => {
  assert.doesNotThrow(() => assertSignedFile(validSignature, thumbprint));
  assert.throws(
    () => assertSignedFile({ ...validSignature, signerThumbprint: 'A'.repeat(40) }, thumbprint),
    /签署证书/,
  );
});

test('rejects unsigned, untrusted and changed files without an unsigned fallback', () => {
  for (const status of ['NotSigned', 'NotTrusted', 'HashMismatch', 'UnknownError'])
    assert.throws(() => assertSignedFile({ ...validSignature, status }, thumbprint), /签名验证/);
});

test('rejects catalog signatures and certificates without the code signing purpose', () => {
  assert.throws(
    () => assertSignedFile({ ...validSignature, signatureType: 'Catalog' }, thumbprint),
    /嵌入/,
  );
  assert.throws(
    () => assertSignedFile({ ...validSignature, signerCodeSigning: false }, thumbprint),
    /代码签名/,
  );
});

test('requires a timestamp rather than treating a signature alone as release ready', () => {
  for (const timestampThumbprint of [null, '', 'invalid'])
    assert.throws(
      () => assertSignedFile({ ...validSignature, timestampThumbprint }, thumbprint),
      /时间戳/,
    );
});

test('the real certificate preflight exits unsuccessfully when no certificate is selected', () => {
  const env = { ...process.env };
  delete env.STUDY_COMPANION_SIGNING_CERT_SHA1;
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('./windows-signing.mjs', import.meta.url))],
    {
      encoding: 'utf8',
      env,
      windowsHide: true,
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /证书指纹/);
  assert.doesNotMatch(result.stdout, /预检通过/);
});
