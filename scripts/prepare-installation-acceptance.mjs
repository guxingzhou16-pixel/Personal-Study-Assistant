import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Preparation only: no Sandbox, installer, app, database, account or OS feature is started.
const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (
  process.platform !== 'win32' ||
  args.length !== 4 ||
  args[0] !== '--previous' ||
  args[2] !== '--current'
)
  throw new Error(
    'Windows: node scripts/prepare-installation-acceptance.mjs --previous <NSIS目录> --current <NSIS目录>',
  );
const gitFile = (commit, file) =>
  execFileSync('git', ['show', `${commit}:${file}`], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
const powershell = (command, env = {}) =>
  JSON.parse(
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30_000,
      env: { ...process.env, ...env },
    }).trim(),
  );
const signature = (path) =>
  powershell(
    'Get-AuthenticodeSignature -LiteralPath $env:STUDY_ACCEPTANCE_SETUP | Select-Object @{Name="Status";Expression={$_.Status.ToString()}} | ConvertTo-Json -Compress',
    { STUDY_ACCEPTANCE_SETUP: path },
  ).Status;
async function plainFile(path, maxBytes = Number.MAX_SAFE_INTEGER) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size <= 0 || info.size > maxBytes)
    throw new Error(`拒绝非普通文件或不正确大小：${path}`);
  return info;
}
async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
async function candidate(input) {
  const directory = await realpath(resolve(input));
  const receipts = {};
  for (const name of [
    'build-manifest.json',
    'build-info.json',
    'package-audit.json',
    'SHA256SUMS.txt',
  ]) {
    await plainFile(join(directory, name), 2 * 1024 * 1024);
    receipts[name] = await readFile(join(directory, name));
  }
  const manifest = JSON.parse(receipts['build-manifest.json'].toString('utf8'));
  const info = JSON.parse(receipts['build-info.json'].toString('utf8'));
  const audit = JSON.parse(receipts['package-audit.json'].toString('utf8'));
  if (
    manifest.format !== 1 ||
    manifest.mode !== 'nsis' ||
    manifest.appId !== 'io.github.guxingzhou16pixel.studycompanion' ||
    manifest.platform !== 'win32' ||
    manifest.arch !== 'x64' ||
    manifest.trackedWorktreeDirty !== false ||
    typeof manifest.signed !== 'boolean' ||
    manifest.functionalAcceptance !== 'pending' ||
    !/^[a-f0-9]{40}$/.test(manifest.gitCommit) ||
    !/^[a-f0-9]{64}$/.test(manifest.lockfileSha256) ||
    !/^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(manifest.version) ||
    typeof manifest.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(manifest.createdAt)) ||
    JSON.stringify(manifest.packageAudit) !== JSON.stringify(audit) ||
    audit.status !== 'passed' ||
    audit.kind !== 'static-package-contents' ||
    audit.nativeRuntime !== 'win32-x64' ||
    audit.workers !== 3 ||
    audit.functionalAcceptance !== 'pending' ||
    !Number.isSafeInteger(audit.archiveEntries) ||
    audit.archiveEntries <= 0 ||
    !Array.isArray(manifest.files) ||
    manifest.files.length !== 1 ||
    Object.keys(info).some((key) => JSON.stringify(info[key]) !== JSON.stringify(manifest[key])) ||
    Object.keys(manifest).filter((key) => !['mode', 'packageAudit', 'files'].includes(key))
      .length !== Object.keys(info).length
  )
    throw new Error(`候选来源/模式/静态回执不一致：${directory}`);
  const metadata = JSON.parse(gitFile(manifest.gitCommit, 'package.json').toString('utf8'));
  const config = JSON.parse(gitFile(manifest.gitCommit, 'electron-builder.json').toString('utf8'));
  const sourceLock = gitFile(manifest.gitCommit, 'package-lock.json');
  const lock = JSON.parse(sourceLock.toString('utf8'));
  if (
    metadata.version !== manifest.version ||
    config.appId !== manifest.appId ||
    config.productName !== '拾知' ||
    config.win?.executableName !== 'StudyCompanion' ||
    config.nsis?.perMachine !== false ||
    config.nsis?.runAfterFinish !== false ||
    config.nsis?.deleteAppDataOnUninstall !== false ||
    config.nsis?.guid !== undefined ||
    metadata.devDependencies['electron-builder'] !== '26.15.3' ||
    lock.packages?.['node_modules/electron']?.version !== manifest.electronVersion ||
    metadata.devDependencies?.['electron-builder'] !== manifest.builderVersion ||
    createHash('sha256').update(sourceLock).digest('hex') !== manifest.lockfileSha256
  )
    throw new Error(`Git源码、版本、安装政策或锁摘要不一致：${directory}`);
  const file = manifest.files[0];
  if (
    file.file !== `StudyCompanion-${manifest.version}-win-x64-setup.exe` ||
    basename(file.file) !== file.file ||
    !Number.isSafeInteger(file.bytes) ||
    file.bytes <= 0 ||
    !/^[a-f0-9]{64}$/.test(file.sha256)
  )
    throw new Error('安装器清单必须只含规范名称的一个setup。');
  const setup = join(directory, file.file);
  const actual = await plainFile(setup);
  const sums = receipts['SHA256SUMS.txt'].toString('utf8');
  const actualSignature = signature(setup);
  if (
    actual.size !== file.bytes ||
    (await sha256(setup)) !== file.sha256 ||
    sums.trim() !== `${file.sha256}  ${file.file}` ||
    actualSignature !== (manifest.signed ? 'Valid' : 'NotSigned')
  )
    throw new Error(`安装器字节/摘要/签名与回执不一致：${directory}`);
  return { directory, manifest, setup, signature: actualSignature, receipts };
}
const previous = await candidate(args[1]);
const current = await candidate(args[3]);
if (
  previous.directory === current.directory ||
  previous.manifest.gitCommit === current.manifest.gitCommit ||
  previous.manifest.files[0].sha256 === current.manifest.files[0].sha256
)
  throw new Error('请提供两个不同源码的候选，不重复使用同一安装器。');
const versions = [previous, current].map(({ manifest }) => manifest.version.split('.').map(Number));
const difference = versions[1].findIndex((value, index) => value !== versions[0][index]);
if (difference !== -1 && versions[1][difference] < versions[0][difference])
  throw new Error('当前版本低于上一版本，本材料不执行降级。');
const hostSid = powershell(
  '[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value | ConvertTo-Json -Compress',
);
if (!/^S-1-5-21-(\d+-){3}\d+$/.test(hostSid))
  throw new Error('需要可识别的本地Windows宿主账户SID。');
const artifacts = join(root, 'artifacts');
await mkdir(artifacts, { recursive: true });
if ((await lstat(artifacts)).isSymbolicLink() || !(await lstat(artifacts)).isDirectory())
  throw new Error('artifacts必须是工作区内的真实目录。');
const output = join(artifacts, `installation-acceptance-${randomUUID()}`);
if (/[\r\n%]/.test(output)) throw new Error('映射路径不能含换行或环境变量展开符号。');
await mkdir(output);
await mkdir(join(output, 'input'));
await mkdir(join(output, 'logs'));
const plan = {
  format: 1,
  preparedAt: new Date().toISOString(),
  status: 'prepared-not-executed',
  hostSid,
  kind: difference === -1 ? 'same-version-replacement' : 'version-upgrade',
  appId: current.manifest.appId,
  // Builder 26.15.3 UUID.v5(appId, 50e065bc-3134-11e6-9bab-38c9862bdaf3).
  nsisGuid: '5f82465f-540d-5d51-89d3-68470d325ee3',
  productName: '拾知',
  previous: { manifest: previous.manifest, signature: previous.signature },
  current: { manifest: current.manifest, signature: current.signature },
};
for (const [label, entry] of [
  ['previous', previous],
  ['current', current],
]) {
  const destination = join(output, 'input', label);
  await mkdir(destination);
  await copyFile(entry.setup, join(destination, entry.manifest.files[0].file));
  if (
    (await sha256(join(destination, entry.manifest.files[0].file))) !==
    entry.manifest.files[0].sha256
  )
    throw new Error('复制后的setup摘要不一致，材料不完整；保留失败UUID。');
  for (const [name, contents] of Object.entries(entry.receipts))
    await writeFile(join(destination, name), contents, { flag: 'wx' });
}
await writeFile(join(output, 'input', 'plan.json'), JSON.stringify(plan, null, 2) + '\n');
const script = String.raw`param(
  [ValidateSet('Inspect','InstallPrevious','InstallCurrent','ReinstallCurrent','Uninstall','Record')]
  [string]$Action = 'Inspect',
  [ValidatePattern('^[a-z0-9-]{1,48}$')][string]$Stage = 'inspection'
)
$ErrorActionPreference = 'Stop'
$plan = Get-Content -LiteralPath 'C:\AcceptanceInput\plan.json' -Raw -Encoding UTF8 | ConvertFrom-Json
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$profile = [Environment]::GetFolderPath('UserProfile')
$appData = [Environment]::GetFolderPath('ApplicationData')
$localData = [Environment]::GetFolderPath('LocalApplicationData')
$localUser = Get-LocalUser -Name 'WDAGUtilityAccount' -ErrorAction Stop
if ($identity.Name.Split('\')[-1] -cne 'WDAGUtilityAccount' -or
    $identity.User.Value -eq $plan.hostSid -or $localUser.SID.Value -ne $identity.User.Value -or
    $profile -ine 'C:\Users\WDAGUtilityAccount' -or $env:USERPROFILE -ine $profile -or
    $appData -ine (Join-Path $profile 'AppData\Roaming') -or
    $localData -ine (Join-Path $profile 'AppData\Local') -or $env:APPDATA -ine $appData -or
    $PSScriptRoot -ine 'C:\AcceptanceInput') { throw '身份/真实profile与Sandbox不符；禁止运行安装器。' }
$registryProfile = (Get-ItemProperty -LiteralPath ('HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList\' + $identity.User.Value)).ProfileImagePath
if ([Environment]::ExpandEnvironmentVariables($registryProfile) -ine $profile -or
    ((Get-Item -LiteralPath $profile).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
  throw '真实Windows profile校验失败。'
}
function Candidate([string]$label) {
  $entry = $plan.$label
  $setup = Join-Path ('C:\AcceptanceInput\' + $label) $entry.manifest.files[0].file
  $manifest = Get-Content -LiteralPath ('C:\AcceptanceInput\' + $label + '\build-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($manifest.gitCommit -ne $entry.manifest.gitCommit -or $manifest.version -ne $entry.manifest.version -or
      $manifest.mode -ne 'nsis' -or $manifest.appId -ne $plan.appId -or
      (Get-Item -LiteralPath $setup).Length -ne $entry.manifest.files[0].bytes -or
      (Get-FileHash -LiteralPath $setup -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.manifest.files[0].sha256 -or
      (Get-AuthenticodeSignature -LiteralPath $setup).Status.ToString() -ne $entry.signature) {
    throw '沙盒内安装器来源/摘要/签名校验失败。'
  }
  return $setup
}
function Installed {
  $names = @($plan.previous.manifest.version, $plan.current.manifest.version) | ForEach-Object { $plan.productName + ' ' + $_ }
  $entries = @(Get-ChildItem -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' -ErrorAction SilentlyContinue |
    Get-ItemProperty | Where-Object { $_.DisplayName -cin $names })
  if ($entries.Count -eq 0) { return $null }
  if ($entries.Count -ne 1 -or $entries[0].PSChildName -ne $plan.nsisGuid -or
      $entries[0].UninstallString -notmatch '^"([^"]+)" /currentuser$') {
    throw '卸载项不唯一或不是规范的当前用户卸载命令。'
  }
  $uninstaller = [IO.Path]::GetFullPath($Matches[1])
  if (-not $uninstaller.StartsWith($localData + '\', [StringComparison]::OrdinalIgnoreCase) -or
      -not (Test-Path -LiteralPath $uninstaller -PathType Leaf)) { throw '卸载器不属于沙盒用户。' }
  $directory = Split-Path -Parent $uninstaller
  $location = (Get-ItemProperty -LiteralPath ('HKCU:\Software\' + $plan.nsisGuid) -ErrorAction Stop).InstallLocation
  if ([IO.Path]::GetFileName($uninstaller) -cne ('Uninstall ' + $plan.productName + '.exe') -or
      -not $location -or [IO.Path]::GetFullPath($location).TrimEnd('\') -ine $directory) {
    throw '卸载文件名/真实NSIS安装位置不一致。'
  }
  $cursor = $uninstaller
  while ($cursor.StartsWith($localData, [StringComparison]::OrdinalIgnoreCase)) {
    if ((Get-Item -LiteralPath $cursor).Attributes -band [IO.FileAttributes]::ReparsePoint) {
      throw '卸载路径含链接，禁止执行。'
    }
    if ($cursor -ieq $localData) { break }
    $cursor = Split-Path -Parent $cursor
  }
  $exe = Join-Path $directory 'StudyCompanion.exe'
  $info = Get-Content -LiteralPath (Join-Path $directory 'resources\build-info.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  $sources = @($plan.previous.manifest, $plan.current.manifest) | Where-Object {
    $_.gitCommit -eq $info.gitCommit -and $_.version -eq $info.version -and $_.lockfileSha256 -eq $info.lockfileSha256
  }
  $exeVersion = (Get-Item -LiteralPath $exe).VersionInfo
  if ($sources.Count -ne 1 -or $info.appId -ne $plan.appId -or
      $entries[0].DisplayName -cne ($plan.productName + ' ' + $info.version) -or
      $entries[0].DisplayVersion -ne $info.version -or $exeVersion.FileVersion -ne $info.version -or
      $exeVersion.ProductName -cne $plan.productName -or -not (Test-Path -LiteralPath $exe -PathType Leaf)) {
    throw '实际安装来源/appId/DisplayName/版本不匹配。'
  }
  return [pscustomobject]@{ registryKey=$entries[0].PSPath; displayName=$entries[0].DisplayName;
    displayVersion=$entries[0].DisplayVersion; uninstallString=$entries[0].UninstallString;
    uninstaller=$uninstaller; exe=$exe; productVersion=$exeVersion.ProductVersion; fileVersion=$exeVersion.FileVersion;
    source=$info; shortcut=(Test-Path -LiteralPath (Join-Path ([Environment]::GetFolderPath('Programs')) '拾知.lnk'));
    desktopShortcut=(Test-Path -LiteralPath (Join-Path ([Environment]::GetFolderPath('Desktop')) '拾知.lnk')) }
}
if (-not (Test-Path -LiteralPath 'C:\AcceptanceLogs' -PathType Container)) { throw '缺少本次日志映射。' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
Start-Transcript -LiteralPath ('C:\AcceptanceLogs\' + $stamp + '-' + $Action + '.txt')
try {
  Write-Host ('验收类型：' + $plan.kind + '。所有功能结果仍待真实UI核对。')
  $installed = Installed
  if ($Action -in @('InstallPrevious','InstallCurrent','ReinstallCurrent','Uninstall')) {
    if (@(Get-Process -Name StudyCompanion -ErrorAction SilentlyContinue).Count) { throw '请先正常退出应用，保存草稿并结束计时。' }
    if ($Action -eq 'Uninstall') {
      if (-not $installed) { throw '没有确切匹配的安装项，禁止猜测卸载路径。' }
      $process = Start-Process -FilePath $installed.uninstaller -ArgumentList '/currentuser' -Wait -PassThru -WindowStyle Normal
    } else {
      if ($Action -eq 'InstallCurrent' -and (-not $installed -or $installed.source.gitCommit -ne $plan.previous.manifest.gitCommit)) { throw '请先安装上一候选并通过真实UI保存数据。' }
      if ($Action -in @('InstallPrevious','ReinstallCurrent') -and $installed) { throw '存在安装项，不能冒称首次安装/卸载后重装。' }
      $label = if ($Action -eq 'InstallPrevious') { 'previous' } else { 'current' }
      $setup = Candidate $label
      $process = Start-Process -FilePath $setup -Wait -PassThru -WindowStyle Normal
    }
    Write-Host ('程序退出码：' + $process.ExitCode)
    if ($process.ExitCode -ne 0) { throw '安装/卸载未返回成功；保留失败证据，不自动重试。' }
    Start-Sleep -Seconds 3
    if ($Action -ne 'Uninstall' -and @(Get-Process -Name StudyCompanion -ErrorAction SilentlyContinue).Count) { throw '安装后意外自动启动应用；未通过runAfterFinish核对。' }
    $installed = Installed
    if (($Action -eq 'Uninstall' -and $installed) -or ($Action -ne 'Uninstall' -and -not $installed)) { throw '安装/卸载结果与实际注册项不一致。' }
    if ($Action -ne 'Uninstall') {
      $expected = $plan.$label.manifest
      if ($installed.source.gitCommit -ne $expected.gitCommit -or
          $installed.source.version -ne $expected.version -or
          $installed.source.lockfileSha256 -ne $expected.lockfileSha256) {
        throw '实际安装仍是另一候选；本次安装未通过，不自动重试。'
      }
    }
  }
  $dataRoot = Join-Path $appData 'StudyCompanion'
  $data = @()
  if ($Action -eq 'Record') {
    if (@(Get-Process -Name StudyCompanion -ErrorAction SilentlyContinue).Count) { throw '请先正常退出应用再记录文件摘要。' }
    if (Test-Path -LiteralPath $dataRoot) {
      $data = @(Get-ChildItem -LiteralPath $dataRoot -File -Recurse | ForEach-Object {
        [pscustomobject]@{ file=$_.FullName.Substring($dataRoot.Length + 1); bytes=$_.Length;
          sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
      })
    }
  }
  [pscustomobject]@{ recordedAt=(Get-Date).ToUniversalTime().ToString('o'); action=$Action; stage=$Stage;
    sid=$identity.User.Value; profile=$profile; appData=$appData; windows=[Environment]::OSVersion.VersionString;
    kind=$plan.kind; installed=$installed; dataRoot=$dataRoot; dataFiles=$data;
    functionalAcceptance='pending-manual-ui'; warning='文件存在或摘要相同不证明数据库迁移/业务值完整。' } |
    ConvertTo-Json -Depth 12 | Set-Content -LiteralPath ('C:\AcceptanceLogs\' + $stamp + '-' + $Stage + '.json') -Encoding UTF8
  Write-Host '请按输入目录manual.md进行真实UI操作、截图和逐项记录。不得关闭Sandbox再继续同一轮。'
} finally { Stop-Transcript }
`;
await writeFile(
  join(output, 'input', 'acceptance.ps1'),
  Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(script)]),
);
await copyFile(
  join(root, 'docs', 'testing', 'isolated-installation-acceptance.md'),
  join(output, 'input', 'manual.md'),
);
const xml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
await writeFile(
  join(output, 'acceptance.wsb'),
  `<Configuration>
  <vGPU>Disable</vGPU>
  <Networking>Disable</Networking>
  <ClipboardRedirection>Disable</ClipboardRedirection>
  <AudioInput>Disable</AudioInput><VideoInput>Disable</VideoInput><PrinterRedirection>Disable</PrinterRedirection>
  <MappedFolders>
    <MappedFolder><HostFolder>${xml(join(output, 'input'))}</HostFolder><SandboxFolder>C:\\AcceptanceInput</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder>
    <MappedFolder><HostFolder>${xml(join(output, 'logs'))}</HostFolder><SandboxFolder>C:\\AcceptanceLogs</SandboxFolder><ReadOnly>false</ReadOnly></MappedFolder>
  </MappedFolders>
  <LogonCommand><Command>powershell.exe -NoProfile -NoExit -ExecutionPolicy RemoteSigned -File C:\\AcceptanceInput\\acceptance.ps1 -Action Inspect</Command></LogonCommand>
</Configuration>\n`,
);
await writeFile(
  join(output, 'preparation.json'),
  JSON.stringify(
    {
      ...plan,
      hostSid: undefined,
      mappedInput: join(output, 'input'),
      mappedLogs: join(output, 'logs'),
    },
    null,
    2,
  ) + '\n',
);
console.log(`隔离验收材料已准备，尚未启动或执行：${output}`);
console.log(
  `类型：${plan.kind}；两候选${previous.manifest.version} → ${current.manifest.version}；不要把同版替换称为跨版本升级。`,
);
