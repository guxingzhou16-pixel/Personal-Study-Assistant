import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function signingThumbprint(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/i.test(value))
    throw new Error(
      '请设置 STUDY_COMPANION_SIGNING_CERT_SHA1 为可信代码签名证书指纹（40 位十六进制）。',
    );
  return value.toUpperCase();
}

export function assertSignedFile(signature, expectedThumbprint) {
  if (signature?.status !== 'Valid')
    throw new Error(`Windows 签名验证未通过：${signature?.status ?? 'missing'}。`);
  if (signature.signatureType !== 'Authenticode')
    throw new Error('必须是嵌入文件的 Authenticode 签名，不能用目录签名替代。');
  if (signature.signerThumbprint !== signingThumbprint(expectedThumbprint))
    throw new Error('实际签署证书与指定证书不一致。');
  if (signature.signerCodeSigning !== true) throw new Error('签署证书没有代码签名用途。');
  if (!/^[a-f0-9]{40}$/i.test(signature.timestampThumbprint ?? ''))
    throw new Error('缺少有效的签名时间戳。');
}

function windowsJson(command, env) {
  if (process.platform !== 'win32') throw new Error('签名核对需要 Windows。');
  return JSON.parse(
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 45_000,
      env: {
        ...process.env,
        ...env,
        // Do not inherit PowerShell 7 modules into Windows PowerShell 5.
        PSModulePath: join(
          process.env.SystemRoot,
          'System32',
          'WindowsPowerShell',
          'v1.0',
          'Modules',
        ),
      },
    }).trim(),
  );
}

// Read the existing Windows certificate store; never create/import certificates or export keys.
export function signingCertificate(value) {
  const thumbprint = signingThumbprint(value);
  const certificate = windowsJson(
    String.raw`$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$certificates = @(Get-ChildItem -Path Cert:\CurrentUser\My,Cert:\LocalMachine\My |
  Where-Object { $_.Thumbprint -eq $env:STUDY_SIGNING_THUMBPRINT })
if ($certificates.Count -ne 1) { throw 'The selected signing certificate must exist in exactly one My store.' }
$certificate = $certificates[0]
if (-not $certificate.HasPrivateKey -or
    @($certificate.EnhancedKeyUsageList | Where-Object { $_.ObjectId -eq '1.3.6.1.5.5.7.3.3' }).Count -ne 1 -or
    $certificate.NotBefore -gt (Get-Date) -or $certificate.NotAfter -le (Get-Date) -or
    $certificate.Subject -eq $certificate.Issuer) { throw 'An unexpired, non-self-signed code signing certificate with a private key is required.' }
$chain = [Security.Cryptography.X509Certificates.X509Chain]::new()
try {
  [void]$chain.ChainPolicy.ApplicationPolicy.Add([Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.3'))
  $chain.ChainPolicy.UrlRetrievalTimeout = [TimeSpan]::FromSeconds(15)
  if (-not $chain.Build($certificate)) { throw 'Windows cannot validate the code signing certificate chain.' }
  [pscustomobject]@{ thumbprint=$certificate.Thumbprint; subject=$certificate.Subject;
    issuer=$certificate.Issuer; expiresAt=$certificate.NotAfter.ToUniversalTime().ToString('o') } | ConvertTo-Json -Compress
} finally { $chain.Dispose() }`,
    { STUDY_SIGNING_THUMBPRINT: thumbprint },
  );
  if (certificate.thumbprint !== thumbprint) throw new Error('证书存储返回了不同的证书。');
  return certificate;
}

export function windowsSignature(path) {
  return windowsJson(
    String.raw`$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$signature = Get-AuthenticodeSignature -LiteralPath $env:STUDY_SIGNING_FILE
[pscustomobject]@{ status=$signature.Status.ToString(); signatureType=$signature.SignatureType.ToString();
  signerThumbprint=$signature.SignerCertificate.Thumbprint; signerSubject=$signature.SignerCertificate.Subject;
  signerCodeSigning=(@($signature.SignerCertificate.EnhancedKeyUsageList |
    Where-Object { $_.ObjectId -eq '1.3.6.1.5.5.7.3.3' }).Count -eq 1);
  timestampThumbprint=$signature.TimeStamperCertificate.Thumbprint } | ConvertTo-Json -Compress`,
    { STUDY_SIGNING_FILE: resolve(path) },
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw new Error('证书预检不接受额外参数。');
  const certificate = signingCertificate(process.env.STUDY_COMPANION_SIGNING_CERT_SHA1);
  console.log(`代码签名证书预检通过：${certificate.thumbprint}；安装包尚未签名。`);
}
