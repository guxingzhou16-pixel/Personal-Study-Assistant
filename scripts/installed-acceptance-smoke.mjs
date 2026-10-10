// Run only with the offline tools mapped into a real Windows Sandbox.
// Dialog substitutions select generated fixtures; application code and workers remain unchanged.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { readFile, writeFile, mkdir, lstat, readdir, copyFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const stages = [
  'create',
  'verify-restart',
  'verify-replacement',
  'verify-reinstall',
  'verify-os-restart',
  'verify-native-resources',
  'verify-restore',
];
assert.equal(process.platform, 'win32', 'Windows Sandbox is required.');
assert.equal(process.argv.length, 4, 'Usage: node installed-acceptance-smoke.mjs --stage <stage>');
assert.equal(process.argv[2], '--stage');
const stage = process.argv[3];
assert.ok(stages.includes(stage), 'Unknown acceptance stage.');
const input = 'C:\\AcceptanceInput';
const logs = 'C:\\AcceptanceLogs';
const script = fileURLToPath(import.meta.url);
assert.equal(
  dirname(script).toLowerCase(),
  input.toLowerCase(),
  'Refusing a host/source checkout.',
);
const plan = JSON.parse(await readFile(join(input, 'plan.json'), 'utf8'));
assert.equal(plan.format, 1);
assert.equal(plan.appId, 'io.github.guxingzhou16pixel.studycompanion');
assert.equal(plan.nsisGuid, '5f82465f-540d-5d51-89d3-68470d325ee3');

// KnownFolders, ProfileList and the real Windows SID must agree before any EXE launch.
const guard = String.raw`
$ErrorActionPreference = 'Stop'
$plan = Get-Content -LiteralPath 'C:\AcceptanceInput\plan.json' -Raw -Encoding UTF8 | ConvertFrom-Json
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$profile = [Environment]::GetFolderPath('UserProfile')
$appData = [Environment]::GetFolderPath('ApplicationData')
$localData = [Environment]::GetFolderPath('LocalApplicationData')
$user = Get-LocalUser -Name 'WDAGUtilityAccount'
$registered = (Get-ItemProperty -LiteralPath ('HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList\' + $identity.User.Value)).ProfileImagePath
if ($identity.Name.Split('\')[-1] -cne 'WDAGUtilityAccount' -or
    $identity.User.Value -eq $plan.hostSid -or $identity.User.Value -ne $user.SID.Value -or
    $profile -ine 'C:\Users\WDAGUtilityAccount' -or $env:USERPROFILE -ine $profile -or
    [Environment]::ExpandEnvironmentVariables($registered) -ine $profile -or
    $appData -ine (Join-Path $profile 'AppData\Roaming') -or $env:APPDATA -ine $appData -or
    $localData -ine (Join-Path $profile 'AppData\Local')) { throw 'Refusing non-Sandbox identity/profile.' }
$entries = @(Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' |
    Get-ItemProperty | Where-Object { $_.PSChildName -eq $plan.nsisGuid })
if ($entries.Count -ne 1 -or $entries[0].UninstallString -notmatch '^"([^"]+)" /currentuser$') { throw 'Invalid installed registration.' }
$uninstaller = [IO.Path]::GetFullPath($Matches[1])
$directory = Split-Path -Parent $uninstaller
$location = (Get-ItemProperty -LiteralPath ('HKCU:\Software\' + $plan.nsisGuid)).InstallLocation
if ([IO.Path]::GetFileName($uninstaller) -cne 'Uninstall StudyCompanion.exe' -or
    -not $location -or [IO.Path]::GetFullPath($location).TrimEnd('\') -ine $directory -or
    -not $directory.StartsWith($localData + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid installed location.' }
foreach ($path in @($profile, $appData, $localData, 'C:\AcceptanceInput', 'C:\AcceptanceLogs', $uninstaller)) {
    $cursor = $path
    while ($cursor -and $cursor -ine 'C:\') {
        if ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked acceptance/install/profile path.' }
        $cursor = Split-Path -Parent $cursor
    }
}
$exe = Join-Path $directory 'StudyCompanion.exe'
$info = Get-Content -LiteralPath (Join-Path $directory 'resources\build-info.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$sources = @($plan.previous.manifest, $plan.current.manifest) | Where-Object {
    $_.gitCommit -eq $info.gitCommit -and $_.version -eq $info.version -and $_.lockfileSha256 -eq $info.lockfileSha256
}
$version = (Get-Item -LiteralPath $exe).VersionInfo
if (@($sources).Count -ne 1 -or $info.appId -ne $plan.appId -or
    $entries[0].DisplayName -cne ($plan.productName + ' ' + $info.version) -or
    $entries[0].DisplayVersion -ne $info.version -or $version.FileVersion -ne $info.version -or
    $version.ProductName -cne $plan.productName) { throw 'Installed source/version mismatch.' }
if (Get-Process -Name StudyCompanion -ErrorAction SilentlyContinue) { throw 'Close the installed app first.' }
[pscustomobject]@{ sid=$identity.User.Value; profile=$profile; appData=$appData; exe=$exe; source=$info } | ConvertTo-Json -Depth 8 -Compress
`;
const identity = JSON.parse(
  execFileSync(
    join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(guard, 'utf16le').toString('base64'),
    ],
    {
      encoding: 'utf8',
      windowsHide: true,
      env: {
        ...process.env,
        PSModulePath: join(
          process.env.SystemRoot,
          'System32',
          'WindowsPowerShell',
          'v1.0',
          'Modules',
        ),
      },
    },
  ).trim(),
);
const candidate = stage === 'create' || stage === 'verify-restart' ? plan.previous : plan.current;
assert.equal(
  identity.source.gitCommit,
  candidate.manifest.gitCommit,
  'Wrong candidate for this stage.',
);
const output = join(logs, `ui-${stage}-${randomUUID()}`);
await mkdir(output);
const expectedPath = join(logs, 'installed-expected.json');
const result = {
  format: 1,
  stage,
  startedAt: new Date().toISOString(),
  status: 'running',
  source: identity.source,
  sandboxProfile: identity.profile,
  checks: [],
  dialogSubstitutions: [],
  excluded: [
    'native dialog interaction',
    'real model quality',
    'cross-version migration',
    'OS reboot/sleep',
    'restore execution',
  ],
};
let application;
let page;
let server;
let modelFixture;
let expected;
let createdSnapshot;
let relaunchedProcessProof;
const consoleErrors = [];
const networkRequests = [];
const fakeKey = 'sandbox-acceptance-fake-key-not-a-secret';
const fixture = {
  nickname: '沙盒验收同学',
  source: '沙盒学习资料',
  note: '沙盒验收四部分笔记',
  project: '沙盒学习项目',
  todo: '阅读并写出一个例子',
  completed: '手动完成的复习任务',
  review: '实际完成了短暂专注；需要继续求证，任务仍保持待完成。',
  sections: {
    我的理解: '主动回忆需要先尝试独立回答，再核对资料。',
    原文依据: '《沙盒学习资料》复盘与检验：用问题检验自己的理解。',
    待解问题: '如何判断自己的解释是否遗漏条件？',
    下一步练习: '写一个例子，并返回资料核对。',
  },
};
// These pins match electron/core/embedding-model.ts. Never accept a path or digest
// from an arbitrary receipt as authority for copying into the guest app profile.
const embedding = {
  directory: 'Xenova--bge-small-zh-v1.5-75c43b069aac4d136ba6bc1122f995fedcfd2781',
  revision: '75c43b069aac4d136ba6bc1122f995fedcfd2781',
  files: [
    ['config.json', 716, 'd4193ead3a810fd694fa8a31d7fc72fbaebc0668b603e398734bf2f6538ff42f'],
    ['tokenizer.json', 439125, '48cea5d44424912a6fd1ea647bf4fe50b55ab8b1e5879c3275f80e339e8fae26'],
    [
      'tokenizer_config.json',
      367,
      'e6f3b96db926a37d4039995fbf5ad17de158dfb8f6343d607e4dbaad18d75f5a',
    ],
    [
      'special_tokens_map.json',
      125,
      'b6d346be366a7d1d48332dbc9fdf3bf8960b5d879522b7799ddba59e76237ee3',
    ],
    [
      'onnx/model_quantized.onnx',
      24010842,
      '15b717c382bcb518ba457b93ea6850ede7f4f1cd8937454aa06972366cd19bcc',
    ],
  ],
};

function powershell(body) {
  return execFileSync(
    join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(body, 'utf16le').toString('base64'),
    ],
    {
      encoding: 'utf8',
      windowsHide: true,
      env: {
        ...process.env,
        PSModulePath: join(
          process.env.SystemRoot,
          'System32',
          'WindowsPowerShell',
          'v1.0',
          'Modules',
        ),
      },
    },
  ).trim();
}
function psLiteral(text) {
  return "'" + text.replaceAll("'", "''") + "'";
}
function closeRelaunched(processProof) {
  powershell(
    `$ErrorActionPreference='Stop'; $p=Get-Process -Id ${processProof.pid}; if ($p.Path -ine ${psLiteral(identity.exe)} -or $p.StartTime.ToUniversalTime().ToString('o') -cne ${psLiteral(processProof.createdAt)} -or $p.MainWindowHandle -eq 0) {throw 'Relaunched process identity changed.'}; $null=$p.Handle; if (-not $p.CloseMainWindow()) {throw 'Normal close request failed.'}; if (-not $p.WaitForExit(30000)) {throw 'Relaunched app did not close normally.'}; if ($p.ExitCode -ne 0) {throw ('Relaunched app exit code: ' + $p.ExitCode)}`,
  );
}
async function fixedFiles(directory) {
  const receipts = [];
  for (const [name, bytes, sha256] of embedding.files) {
    const path = join(directory, name);
    let cursor = path;
    while (cursor.toLowerCase() !== dirname(cursor).toLowerCase()) {
      assert.equal((await lstat(cursor)).isSymbolicLink(), false, 'Linked model path refused.');
      cursor = dirname(cursor);
    }
    const info = await lstat(path);
    assert.ok(info.isFile() && info.nlink === 1, 'Model must be an ordinary single-link file.');
    assert.equal(info.size, bytes, `Model file size: ${name}`);
    const actual = createHash('sha256')
      .update(await readFile(path))
      .digest('hex');
    assert.equal(actual, sha256, `Pinned model digest: ${name}`);
    receipts.push({ path: name, bytes, sha256: actual });
  }
  return receipts;
}

async function launch() {
  // Reserve the saved loopback fixture before Electron allocates its debugging ports.
  if (stage !== 'create' && !server) {
    const saved = JSON.parse(await readFile(expectedPath, 'utf8'));
    assert.equal(saved.sandboxSid, identity.sid);
    const address = new URL(saved.snapshot.settings.openai.baseUrl);
    assert.equal(address.protocol, 'http:');
    assert.equal(address.hostname, '127.0.0.1');
    await modelServer(Number(address.port));
  }
  const { _electron } = await import(
    pathToFileURL(join(input, 'tools', 'playwright-core', 'index.mjs')).href
  );
  const {
    ELECTRON_RUN_AS_NODE: _node,
    STUDY_COMPANION_DATA_DIR: _data,
    STUDY_COMPANION_DEV_URL: _dev,
    ...environment
  } = process.env;
  application = await _electron.launch({
    executablePath: identity.exe,
    args: [],
    cwd: identity.profile,
    env: environment,
    timeout: 60_000,
  });
  page = await application.firstWindow({ timeout: 60_000 });
  page.setDefaultTimeout(30_000);
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) networkRequests.push(request.url());
  });
  const runtime = await application.evaluate(({ app }) => ({
    packaged: app.isPackaged,
    appPath: app.getAppPath(),
    appData: app.getPath('appData'),
    dataDir: app.getPath('userData'),
    version: app.getVersion(),
  }));
  assert.equal(runtime.packaged, true, 'Must run the formal packaged application.');
  assert.equal(runtime.appData.toLowerCase(), identity.appData.toLowerCase());
  assert.equal(
    runtime.dataDir.toLowerCase(),
    join(identity.appData, 'StudyCompanion').toLowerCase(),
  );
  assert.equal(
    runtime.appPath.toLowerCase(),
    join(dirname(identity.exe), 'resources', 'app.asar').toLowerCase(),
  );
  assert.equal(runtime.version, identity.source.version);
  await until(
    () => page.evaluate(() => Boolean(window.studyCompanion)),
    Boolean,
    'real preload bridge',
  );
  assert.equal((await api('bootstrap')).dataDir.toLowerCase(), runtime.dataDir.toLowerCase());
  return runtime;
}

async function closeServer() {
  if (!server) return;
  await new Promise((done) => {
    server.closeAllConnections();
    server.close(done);
  });
  server = undefined;
  modelFixture = undefined;
}

async function until(read, predicate, description, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await read();
    if (predicate(value)) return value;
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`Timed out: ${description}; last value: ${JSON.stringify(value)}`);
}
async function visible(locator) {
  await locator.waitFor({ state: 'visible', timeout: 30_000 });
}
async function value(locator, wanted) {
  await until(
    () => locator.inputValue(),
    (actual) => actual === wanted,
    `UI value ${wanted}`,
  );
}
async function navigate(name) {
  const navigation = name === '设置' ? page : page.getByRole('navigation', { name: '主导航' });
  await navigation.getByRole('button', { name, exact: true }).click();
}
async function api(method, ...args) {
  return page.evaluate(async ({ method, args }) => window.studyCompanion[method](...args), {
    method,
    args,
  });
}
async function screenshot(name) {
  await page.screenshot({ path: join(output, `${name}.png`), fullPage: true });
}
async function choose(path) {
  await application.evaluate(({ dialog }, selected) => {
    globalThis.__acceptanceOriginalOpenDialog ??= dialog.showOpenDialog;
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] });
  }, path);
}
async function restoreDialog() {
  await application.evaluate(({ dialog }) => {
    if (globalThis.__acceptanceOriginalOpenDialog) {
      dialog.showOpenDialog = globalThis.__acceptanceOriginalOpenDialog;
      delete globalThis.__acceptanceOriginalOpenDialog;
    }
  });
}
async function snapshot(day) {
  const [year, month] = day.split('-').map(Number);
  const boot = await api('bootstrap');
  const sources = await api('listSources');
  const notes = await api('listNotes');
  const planning = await api('planningOverview', day);
  const focus = await api('focusHistory', { day: null, page: 1 });
  const study = await api('studyOverview', year, month);
  assert.equal((await api('focusOverview')).current, null, 'No active focus may remain.');
  assert.equal(study.running, false, 'Home timer must be paused.');
  return {
    day,
    schemaVersion: boot.schemaVersion,
    dataDir: boot.dataDir,
    settings: boot.settings,
    hasApiKey: await api('hasApiKey', boot.settings.openai.baseUrl),
    sources: sources
      .map(({ openedAt: _openedAt, ...source }) => source)
      .sort((a, b) => a.id.localeCompare(b.id)),
    notes: await Promise.all(notes.map((note) => api('getNote', note.id))),
    projects: planning.projects,
    tasks: planning.tasks,
    focus: focus.sessions,
    focusTotal: focus.total,
    studyDay: study.days.find((entry) => entry.day === day),
  };
}
async function modelServer(port = 0) {
  if (server) {
    assert.equal(server.listening, true);
    assert.equal(server.address().port, port);
    return modelFixture;
  }
  let authorized = 0;
  server = createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.url === '/v1/models' && request.headers.authorization === `Bearer ${fakeKey}`) {
      authorized++;
      response.end(JSON.stringify({ data: [{ id: 'sandbox-fixture-model' }] }));
    } else {
      response.statusCode = 401;
      response.end(JSON.stringify({ error: 'Synthetic loopback fixture only' }));
    }
  });
  await new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', done);
  });
  modelFixture = {
    baseUrl: `http://127.0.0.1:${server.address().port}/v1`,
    authorized: () => authorized,
  };
  return modelFixture;
}

async function create() {
  const boot = await api('bootstrap');
  assert.equal(boot.schemaVersion, 12);
  assert.equal(
    (await api('listSources')).length,
    0,
    'Create requires a fresh guest learning library.',
  );
  assert.equal((await api('listNotes')).length, 0);
  const day = await page.evaluate(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const initialPlanning = await api('planningOverview', day);
  assert.equal(initialPlanning.projects.length, 0);
  assert.equal(initialPlanning.tasks.length, 0);
  assert.equal((await api('focusHistory', { day: null, page: 1 })).total, 0);
  const model = await modelServer();
  await navigate('设置');
  await page.getByLabel('怎么称呼你').fill(fixture.nickname);
  await page.getByLabel(/每日学习目标/).fill('60');
  await page.locator('input[name="theme"][value="study"]').check();
  await page.getByRole('button', { name: /兼容 OpenAI 的接口/ }).click();
  await page.getByLabel('服务基础地址').fill(model.baseUrl);
  await page.locator('input[name="apiKey"]').fill(fakeKey);
  await page.locator('input[name="model"]').fill('sandbox-fixture-model');
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await visible(page.getByText('此地址已有保存的密钥', { exact: true }));
  await page.getByRole('button', { name: '检测连接', exact: true }).click();
  await until(
    () => model.authorized(),
    (count) => count > 0,
    'saved encrypted key reached loopback fixture',
  );
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'study');
  result.checks.push('UI preferences/theme and real Windows-encrypted synthetic API key saved');
  await screenshot('settings');

  const sourcePath = join(output, `${fixture.source}.md`);
  await writeFile(
    sourcePath,
    `# ${fixture.source}\n\n## 主动回忆\n\n先尝试独立回答，再核对资料。\n\n${'练习：写出自己的解释。\n\n'.repeat(45)}## 复盘与检验\n\n用问题检验自己的理解。\n\n| 方法 | 行动 |\n| --- | --- |\n| 主动回忆 | 独立回答 |\n\n${'复盘：返回资料核对遗漏的条件。\n\n'.repeat(35)}`,
  );
  await navigate('资料库');
  result.dialogSubstitutions.push('open-file selection for synthetic Markdown');
  await choose(sourcePath);
  try {
    await page.getByRole('button', { name: '导入资料', exact: true }).click();
    await visible(page.getByText('导入完成：1 份新增，0 份重复，0 份失败。'));
  } finally {
    await restoreDialog();
  }
  await page.getByRole('button', { name: `阅读 ${fixture.source}`, exact: true }).click();
  await page.getByRole('button', { name: '复盘与检验', exact: true }).click();
  await visible(page.getByRole('heading', { name: '复盘与检验', exact: true }));
  await page.getByRole('button', { name: '护眼', exact: true }).click();
  await visible(page.getByText('阅读位置已保存', { exact: true }));
  const source = (await api('listSources'))[0];
  assert.equal(source.position.tone, 'warm');
  assert.equal(
    source.position.anchor,
    source.outline.find((item) => item.title === '复盘与检验').anchor,
  );
  result.checks.push(
    'installed parser imported synthetic Markdown; UI outline/tone/position saved',
  );
  await screenshot('reader');
  await page.getByRole('button', { name: '返回资料库', exact: true }).click();

  await navigate('学习笔记');
  await page.getByRole('button', { name: '新建笔记', exact: true }).click();
  await page.getByLabel('笔记标题', { exact: true }).fill(fixture.note);
  await page.getByRole('combobox', { name: '关联资料', exact: true }).selectOption(source.id);
  for (const [label, text] of Object.entries(fixture.sections))
    await page.getByLabel(label, { exact: false }).fill(text);
  await page.getByRole('button', { name: '保存笔记', exact: true }).click();
  await until(
    () => api('listNotes'),
    (notes) => notes.length === 1,
    'note save',
  );
  const note = await api('getNote', (await api('listNotes'))[0].id);
  assert.equal(note.title, fixture.note);
  assert.deepEqual(
    [note.understanding, note.evidence, note.questions, note.nextStep],
    Object.values(fixture.sections),
  );
  result.checks.push('all four note fields and source association saved through UI');
  await screenshot('note');

  await navigate('学习计划');
  await page.getByRole('button', { name: '新建项目', exact: true }).click();
  await page.getByLabel('标题', { exact: true }).fill(fixture.project);
  await page
    .getByRole('textbox', { name: '学习目标', exact: true })
    .fill('完成阅读、作品和专注复盘。');
  await page.getByRole('button', { name: '确认保存到本机', exact: true }).click();
  await until(
    () => api('planningOverview', day),
    (planning) => planning.projects.length === 1,
    'project save',
  );
  const project = (await api('planningOverview', day)).projects[0];
  for (const title of [fixture.todo, fixture.completed]) {
    await page.getByRole('button', { name: '新建任务', exact: true }).click();
    await page.getByLabel('标题', { exact: true }).fill(title);
    await page.getByLabel('安排日期', { exact: true }).fill(day);
    await page.getByLabel('预计分钟', { exact: true }).fill('25');
    await page.getByRole('combobox', { name: '关联项目', exact: true }).selectOption(project.id);
    await page.getByLabel('具体行动与说明', { exact: true }).fill('合成验收资料；不代表知识掌握。');
    await page.getByRole('button', { name: '确认保存到本机', exact: true }).click();
    await until(
      () => api('planningOverview', day),
      (planning) => planning.tasks.some((task) => task.title === title),
      'task save',
    );
    if (title === fixture.completed) {
      await page.getByRole('button', { name: '手动标记完成', exact: true }).click();
      await until(
        () => api('planningOverview', day),
        (planning) => planning.tasks.find((task) => task.title === title)?.status === 'completed',
        'manual task completion',
      );
    }
  }
  const todo = (await api('planningOverview', day)).tasks.find(
    (task) => task.title === fixture.todo,
  );
  result.checks.push('UI project/two task creation and explicit manual completion');
  await screenshot('planning');

  await navigate('专注时光');
  await page.getByRole('combobox', { name: '关联任务', exact: true }).selectOption(todo.id);
  await page.getByLabel('本轮专注分钟', { exact: true }).fill('5');
  await page.getByRole('button', { name: '确认并开始本轮', exact: true }).click();
  await until(
    () => api('focusOverview'),
    (focus) => focus.current?.elapsedMs >= 1500,
    'real monotonic focus timing',
  );
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const paused = await until(
    () => api('focusOverview'),
    (focus) => focus.current?.status === 'paused',
    'focus pause',
  );
  await new Promise((done) => setTimeout(done, 1200));
  assert.equal(
    (await api('focusOverview')).current.elapsedMs,
    paused.current.elapsedMs,
    'Paused elapsed must stay fixed.',
  );
  await page.getByRole('button', { name: '提前结束本轮', exact: true }).click();
  await until(
    () => api('focusOverview'),
    (focus) => focus.current === null && focus.recent[0]?.status === 'stopped',
    'focus stop',
  );
  await page.getByLabel('一句收获、一个疑问或下一步', { exact: true }).fill(fixture.review);
  await page.getByRole('button', { name: '保存复盘', exact: true }).click();
  await until(
    () => api('focusOverview'),
    (focus) => focus.recent[0]?.review === fixture.review,
    'review save',
  );
  const reviewed = (await api('focusOverview')).recent[0];
  assert.equal(reviewed.reason, 'user-stop');
  assert.ok(reviewed.elapsedMs >= 1500 && reviewed.elapsedMs < 5 * 60_000);
  assert.equal(
    (await api('planningOverview', day)).tasks.find((task) => task.id === todo.id).status,
    'todo',
  );
  await page.getByRole('button', { name: '签到今天', exact: true }).click();
  await until(
    () => api('studyOverview', ...day.split('-').slice(0, 2).map(Number)),
    (study) => study.today.checkedIn,
    'actual check-in',
  );
  result.checks.push('UI real focus timing/pause/stop/review; explicit check-in; todo unchanged');
  await screenshot('focus');

  await navigate('设置');
  const destination = join(output, 'backup-export');
  await mkdir(destination);
  result.dialogSubstitutions.push('backup destination selection');
  await choose(destination);
  try {
    await page.getByRole('button', { name: '导出完整备份', exact: true }).click();
    await visible(page.getByText('备份已导出', { exact: true }));
  } finally {
    await restoreDialog();
  }
  const backup = await api('backupState');
  assert.equal(backup.lastError, null);
  assert.equal(backup.operation, 'idle');
  assert.ok(resolve(backup.lastExport.directory).startsWith(resolve(destination) + '\\'));
  const manifest = JSON.parse(
    await readFile(join(backup.lastExport.directory, 'manifest.json'), 'utf8'),
  );
  assert.equal(manifest.mainVersion, 12);
  assert.equal(manifest.activityVersion, 1);
  assert.equal(manifest.counts.sources, 1);
  assert.equal(manifest.counts.notes, 1);
  assert.equal(manifest.counts.projects, 1);
  assert.equal(manifest.counts.tasks, 2);
  assert.equal(manifest.counts.focusSessions, 1);
  assert.ok(
    manifest.files.every((file) => !/credential|embedding|secret/i.test(file.path ?? file.file)),
  );
  result.backup = { directory: backup.lastExport.directory, counts: manifest.counts };
  result.checks.push(
    'real installed utility backup worker exported exact synthetic learning counts; no credentials/models in manifest',
  );
  await screenshot('backup');
  createdSnapshot = await snapshot(day);
  assert.equal(createdSnapshot.studyDay.checkedIn, true);
  assert.equal(
    createdSnapshot.studyDay.studySeconds,
    0,
    'Focus must not increment home cumulative timer.',
  );
  assert.equal(createdSnapshot.hasApiKey, true);
}

async function verify() {
  expected = JSON.parse(await readFile(expectedPath, 'utf8'));
  assert.equal(expected.format, 1);
  assert.equal(
    expected.sandboxSid,
    identity.sid,
    'Expected data belongs to a different Sandbox session.',
  );
  const current = await snapshot(expected.snapshot.day);
  assert.deepEqual(current, expected.snapshot, 'Actual persisted business records differ.');
  result.checks.push(
    'all persisted settings/source position/note/project/task/focus/review/check-in values equal create snapshot',
  );
  await visible(
    page.getByRole('heading', { name: `${fixture.nickname}，开始今天的小进步`, exact: true }),
  );
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'study');
  await screenshot('restored-home');
  const model = await modelServer(Number(new URL(current.settings.openai.baseUrl).port));
  assert.equal(model.baseUrl, current.settings.openai.baseUrl);
  await navigate('设置');
  await value(page.getByLabel('怎么称呼你'), fixture.nickname);
  await visible(page.getByText('此地址已有保存的密钥', { exact: true }));
  await page.getByRole('button', { name: '检测连接', exact: true }).click();
  await until(
    () => model.authorized(),
    (count) => count > 0,
    'recovered encrypted key reached synthetic loopback fixture',
  );
  result.checks.push('Windows-encrypted synthetic key decrypted after this install stage');
  await navigate('资料库');
  await page.getByRole('button', { name: `阅读 ${fixture.source}`, exact: true }).click();
  await visible(page.getByRole('heading', { name: '复盘与检验', exact: true }));
  const heading = page.getByRole('heading', { name: '复盘与检验', exact: true });
  const box = await heading.boundingBox();
  assert.ok(
    box && box.y >= 0 && box.y < (await page.evaluate(() => innerHeight)),
    'Saved Markdown outline position must be visible.',
  );
  assert.equal(
    await page.getByRole('button', { name: '护眼', exact: true }).getAttribute('aria-pressed'),
    'true',
  );
  await screenshot('restored-reader');
  await page.getByRole('button', { name: '返回资料库', exact: true }).click();
  await navigate('学习笔记');
  await page.getByRole('button', { name: new RegExp(fixture.note) }).click();
  await value(page.getByLabel('笔记标题', { exact: true }), fixture.note);
  for (const [label, text] of Object.entries(fixture.sections))
    await value(page.getByLabel(label, { exact: false }), text);
  await screenshot('restored-note');
  await navigate('学习计划');
  await page
    .locator('.planning-page')
    .getByLabel('任务日期', { exact: true })
    .fill(expected.snapshot.day);
  await page
    .locator('.planning-task-list')
    .getByRole('button', { name: new RegExp(fixture.completed) })
    .click();
  await visible(page.getByRole('button', { name: '重新打开任务', exact: true }));
  await value(page.getByLabel('标题', { exact: true }), fixture.completed);
  await screenshot('restored-planning');
  await navigate('专注时光');
  await page.getByRole('button', { name: '全部专注记录', exact: true }).click();
  await page
    .getByRole('list', { name: '已结束的专注记录' })
    .getByRole('button', { name: new RegExp(fixture.todo) })
    .click();
  await visible(page.getByText(fixture.review, { exact: true }));
  await screenshot('restored-focus');
  assert.deepEqual(
    await snapshot(expected.snapshot.day),
    expected.snapshot,
    'Read-only UI verification changed saved business values.',
  );
  result.checks.push(
    'actual UI displays recovered reader/note/completed task/all focus history/review without changing business state',
  );
}

async function verifyNativeResources() {
  await verify();
  const root = join(identity.appData, 'StudyCompanion');
  const previousLocation = await api('backupState');
  assert.equal(previousLocation.learningDirectory.toLowerCase(), root.toLowerCase());
  assert.equal(
    previousLocation.restoreReceipt,
    null,
    'Native resource stage requires an unrestored baseline.',
  );
  await assert.rejects(lstat(join(root, 'active-learning.json')), { code: 'ENOENT' });
  await assert.rejects(lstat(join(root, 'pending-restore.json')), { code: 'ENOENT' });
  const credentialSha256 = createHash('sha256')
    .update(await readFile(join(root, 'credentials.enc.json')))
    .digest('hex');

  const modelInput = join(input, 'embedding-model');
  const modelDirectory = join(root, 'embedding-models', embedding.directory);
  const inputModels = await fixedFiles(modelInput);
  let cursor = join(root, 'embedding-models');
  while (cursor.toLowerCase() !== dirname(cursor).toLowerCase()) {
    try {
      assert.equal(
        (await lstat(cursor)).isSymbolicLink(),
        false,
        'Linked model destination refused.',
      );
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    cursor = dirname(cursor);
  }
  await mkdir(join(root, 'embedding-models')).catch(async (error) => {
    if (error.code !== 'EEXIST' || !(await lstat(join(root, 'embedding-models'))).isDirectory())
      throw error;
  });
  await mkdir(modelDirectory);
  await mkdir(join(modelDirectory, 'onnx'));
  for (const [name] of embedding.files)
    await copyFile(join(modelInput, name), join(modelDirectory, name), constants.COPYFILE_EXCL);
  assert.deepEqual(await fixedFiles(modelDirectory), inputModels);
  const modelStatus = await api('embeddingStatus');
  assert.equal(modelStatus.state, 'ready');
  assert.equal(modelStatus.revision, embedding.revision);
  result.preseededModel = { directory: modelDirectory, downloaded: false, files: inputModels };
  result.checks.push(
    'five pinned offline model files preseeded into real guest root cache; size/SHA verified independently and by installed app',
  );

  const resources = join(input, 'native-resources');
  for (const [name, kind] of [
    ['Learning Notes', 'pdf'],
    ['语义检索验收', 'markdown'],
  ]) {
    const path = join(resources, name + (kind === 'pdf' ? '.pdf' : '.md'));
    const info = await lstat(path);
    assert.ok(
      info.isFile() &&
        !info.isSymbolicLink() &&
        info.nlink === 1 &&
        info.size > 0 &&
        info.size < 1024 * 1024,
    );
    await navigate('资料库');
    result.dialogSubstitutions.push(
      `open-file selection for generated ${kind} native resource fixture`,
    );
    await choose(path);
    try {
      await page.getByRole('button', { name: '导入资料', exact: true }).click();
      await until(
        () => api('listSources'),
        (sources) => sources.some((source) => source.name === name && source.kind === kind),
        `installed ${kind} parser import`,
        60_000,
      );
    } finally {
      await restoreDialog();
    }
  }
  const sources = await api('listSources');
  assert.equal(sources.length, expected.snapshot.sources.length + 2);
  const pdf = sources.find((source) => source.name === 'Learning Notes');
  assert.equal(pdf.pageCount, 2);
  assert.equal(pdf.textStatus, 'ready');
  await page.getByRole('button', { name: '阅读 Learning Notes', exact: true }).click();
  await until(
    () => page.getByTestId('pdf-text-layer').textContent(),
    (text) => text.includes('Active recall'),
    'installed PDF first text layer',
    60_000,
  );
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await until(
    () => page.getByTestId('pdf-text-layer').textContent(),
    (text) => text.includes('Evidence matters'),
    'installed PDF second text layer',
  );
  await page.getByRole('combobox', { name: 'PDF 缩放', exact: true }).selectOption('1.25');
  await value(page.getByRole('spinbutton', { name: 'PDF 页码', exact: true }), '2');
  await visible(page.getByText('阅读位置已保存', { exact: true }));
  const canvas = await until(
    () =>
      page.locator('canvas[aria-label="PDF 第 2 页原始版式"]').evaluate((element) => {
        const data = element
          .getContext('2d')
          .getImageData(0, 0, element.width, element.height).data;
        return {
          width: element.width,
          height: element.height,
          pixels: data.some(
            (channel, index) => index % 4 === 0 && data[index + 3] > 0 && channel < 240,
          ),
        };
      }),
    (value) => value.pixels,
    'actual PDF canvas paint',
  );
  assert.ok(
    canvas.width > 0 && canvas.height > 0 && canvas.pixels,
    'Installed PDF canvas must contain rendered page content.',
  );
  await until(
    () => api('listSources'),
    (items) => items.find((item) => item.id === pdf.id)?.position.zoom === 1.25,
    'saved PDF zoom',
  );
  result.pdf = {
    id: pdf.id,
    pageCount: pdf.pageCount,
    textStatus: pdf.textStatus,
    page: 2,
    zoom: 1.25,
    canvas,
  };
  await screenshot('installed-pdf-page2');
  result.checks.push(
    'installed PDF utility parser and packaged renderer assets produced two-page text layers and visible page-2 canvas at 125% zoom',
  );
  await page.getByRole('button', { name: '返回资料库', exact: true }).click();
  const semantic = sources.find((source) => source.name === '语义检索验收');
  const evidence = await api('prepareQuestion', '怎样让查找更迅速？', semantic.id);
  assert.match(evidence.notice, /混合检索/);
  assert.doesNotMatch(evidence.notice, /已使用关键词检索|未完成|进程退出|超时/);
  assert.ok(
    evidence.hits.some(
      (hit) =>
        hit.sourceId === semantic.id &&
        hit.anchor === 'md-line-5' &&
        hit.text.includes('数据库索引使查询更快。'),
    ),
    'Real installed CPU embedding must retrieve the fixed synonym target.',
  );
  result.hybridRetrieval = evidence;
  result.checks.push(
    'real packaged ONNX CPU worker returned pinned semantic md-line-5 evidence with hybrid notice and no fallback; no model generation requested',
  );

  await restoreBaseline(root, credentialSha256, inputModels);
}

async function restoreBaseline(root, credentialSha256, inputModels) {
  const modelDirectory = join(root, 'embedding-models', embedding.directory);
  const before = await api('backupState');
  let previousId = null;
  try {
    const previous = JSON.parse(await readFile(join(root, 'active-learning.json'), 'utf8'));
    assert.equal(previous.format, 1);
    assert.match(previous.id, /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
    previousId = previous.id;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  assert.equal(
    before.learningDirectory.toLowerCase(),
    (previousId ? join(root, 'learning-restores', previousId) : root).toLowerCase(),
  );
  const sourcesBeforePreview = await api('listSources');

  const creates = [];
  for (const entry of await readdir(logs, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^ui-create-[a-f0-9-]{36}$/.test(entry.name)) continue;
    try {
      const receipt = JSON.parse(await readFile(join(logs, entry.name, 'result.json'), 'utf8'));
      if (
        receipt.format === 1 &&
        receipt.stage === 'create' &&
        receipt.status === 'passed' &&
        receipt.source.gitCommit === expected.source.gitCommit &&
        receipt.sandboxProfile === identity.profile
      )
        creates.push(receipt);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  assert.equal(creates.length, 1, 'Require the unique successful baseline create backup receipt.');
  const backupDirectory = resolve(creates[0].backup.directory);
  assert.ok(
    backupDirectory.toLowerCase().startsWith(resolve(logs).toLowerCase() + '\\') &&
      /\\ui-create-[a-f0-9-]{36}\\backup-export\\/i.test(backupDirectory),
    'Restore may use only this Sandbox baseline backup.',
  );
  const manifest = JSON.parse(await readFile(join(backupDirectory, 'manifest.json'), 'utf8'));
  assert.equal(manifest.counts.sources, expected.snapshot.sources.length);
  assert.equal(manifest.counts.notes, expected.snapshot.notes.length);
  assert.equal(manifest.counts.tasks, expected.snapshot.tasks.length);
  await navigate('设置');
  result.dialogSubstitutions.push('restore baseline backup folder selection');
  await choose(backupDirectory);
  try {
    await page.getByRole('button', { name: '选择备份并预览', exact: true }).click();
    await visible(page.getByRole('heading', { name: '恢复内容预览', exact: true }));
  } finally {
    await restoreDialog();
  }
  const preview = (await api('backupState')).preview;
  assert.ok(preview && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(preview.id));
  assert.deepEqual(preview.counts, manifest.counts);
  assert.deepEqual(
    await api('listSources'),
    sourcesBeforePreview,
    'Preview must not replace live records.',
  );
  await page
    .getByRole('checkbox', {
      name: '我已保存需要保留的输入，理解应用会重启，尚未保存的内容会丢失。',
      exact: true,
    })
    .check();
  await screenshot('installed-restore-preview');
  const originalProcess = application.process();
  const previousPid = originalProcess.pid;
  result.dialogSubstitutions.push(
    'restore final native confirmation: response 1; app.relaunch/app.quit unchanged',
  );
  await application.evaluate(({ dialog }) => {
    const original = dialog.showMessageBox;
    dialog.showMessageBox = async (...args) => {
      const options = args.at(-1);
      if (options.title === '恢复学习数据并重启' && options.buttons[1] === '恢复并重启') {
        dialog.showMessageBox = original;
        return { response: 1, checkboxChecked: false };
      }
      return original.apply(dialog, args);
    };
  });
  const confirmedAt = new Date().toISOString();
  result.relaunch = { previousPid, confirmedAt };
  await page.getByRole('button', { name: '恢复并重启', exact: true }).click();
  await until(
    () => originalProcess.exitCode,
    (code) => code === 0,
    'actual restore-triggered original app exit',
    60_000,
  );
  result.relaunch.originalExitCode = originalProcess.exitCode;
  application = undefined;
  const processes = () =>
    JSON.parse(
      powershell(
        `$ErrorActionPreference='Stop'; $rows=@(Get-Process -Name StudyCompanion -ErrorAction SilentlyContinue | Where-Object { $_.Path -ieq ${psLiteral(identity.exe)} -and $_.Id -ne ${previousPid} -and $_.MainWindowHandle -ne 0 } | ForEach-Object { [pscustomobject]@{pid=$_.Id; path=$_.Path; createdAt=$_.StartTime.ToUniversalTime().ToString('o'); mainWindowHandle=$_.MainWindowHandle.ToString()} }); ConvertTo-Json -InputObject $rows -Compress`,
      ),
    );
  const relaunched = await until(
    processes,
    (rows) => rows.length === 1,
    'actual relaunched installed app PID and window',
    60_000,
  );
  relaunchedProcessProof = relaunched[0];
  result.relaunch.process = relaunchedProcessProof;
  assert.ok(
    Date.parse(relaunchedProcessProof.createdAt) >= Date.parse(confirmedAt),
    'Replacement process must have started after restore confirmation.',
  );
  const active = await until(
    async () => {
      try {
        return JSON.parse(await readFile(join(root, 'active-learning.json'), 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },
    (value) => value?.id === preview.id,
    'actual restore startup activated the copied learning directory',
  );
  assert.equal(active.format, 1);
  assert.equal(active.previousId, previousId);
  assert.ok(Number.isFinite(Date.parse(active.restoredAt)));
  await assert.rejects(lstat(join(root, 'pending-restore.json')), { code: 'ENOENT' });
  result.relaunch.active = active;
  closeRelaunched(relaunchedProcessProof);
  relaunchedProcessProof = undefined;
  await closeServer();
  result.restoredRuntime = await launch();
  await verify();
  const restored = await api('backupState');
  assert.equal(
    restored.learningDirectory.toLowerCase(),
    join(root, 'learning-restores', preview.id).toLowerCase(),
  );
  assert.equal(
    restored.restoreReceipt.preservedDirectory.toLowerCase(),
    before.learningDirectory.toLowerCase(),
  );
  assert.equal(restored.restoreReceipt.restoredAt, active.restoredAt);
  assert.equal(
    (await api('bootstrap')).dataDir.toLowerCase(),
    root.toLowerCase(),
    'Bootstrap stays bound to root credentials/model profile after restore.',
  );
  assert.equal(
    createHash('sha256')
      .update(await readFile(join(root, 'credentials.enc.json')))
      .digest('hex'),
    credentialSha256,
  );
  assert.deepEqual(await fixedFiles(modelDirectory), inputModels);
  assert.equal((await api('embeddingStatus')).state, 'ready');
  result.restore = {
    backupDirectory,
    previewId: preview.id,
    state: restored,
    credentialSha256,
    modelFiles: inputModels,
  };
  result.excluded = result.excluded.filter((item) => item !== 'restore execution');
  result.checks.push(
    'real installed backup workers restored baseline with actual app relaunch/new PID/window/active UUID/pending cleanup; old directory retained and all business values, credentials/model hashes unchanged',
  );
  await navigate('设置');
  await visible(page.getByText('已恢复学习数据', { exact: true }));
  await screenshot('installed-restored-data');
}

async function verifyRestore() {
  await verify();
  const root = join(identity.appData, 'StudyCompanion');
  const modelDirectory = join(root, 'embedding-models', embedding.directory);
  const files = await fixedFiles(modelDirectory);
  assert.equal((await api('embeddingStatus')).state, 'ready');
  const credentialSha256 = createHash('sha256')
    .update(await readFile(join(root, 'credentials.enc.json')))
    .digest('hex');
  await restoreBaseline(root, credentialSha256, files);
}

try {
  if (stage === 'create') {
    await assert.rejects(
      lstat(expectedPath),
      { code: 'ENOENT' },
      'Expected snapshot already exists; refusing overwrite.',
    );
  }
  result.runtime = await launch();
  if (stage === 'create') await create();
  else if (stage === 'verify-native-resources') await verifyNativeResources();
  else if (stage === 'verify-restore') await verifyRestore();
  else await verify();
  assert.deepEqual(consoleErrors, [], 'Renderer reported an uncaught error.');
  assert.deepEqual(networkRequests, [], 'Unexpected renderer HTTP request.');
  result.status = 'passed';
} catch (error) {
  result.status = 'failed';
  result.error = { name: error.name, message: error.message, stack: error.stack };
  await writeFile(
    join(output, 'failure-before-close.json'),
    JSON.stringify(result, null, 2) + '\n',
    {
      flag: 'wx',
    },
  );
  if (page && !page.isClosed())
    await screenshot('failure').catch((failure) => {
      result.failureScreenshotError = failure.message;
    });
  process.exitCode = 1;
} finally {
  if (relaunchedProcessProof) {
    try {
      closeRelaunched(relaunchedProcessProof);
      result.relaunchedFailureCleanup = 'verified replacement process closed with exit code 0';
    } catch (error) {
      result.relaunchedFailureCleanupError = error.message;
    }
  }
  if (application) {
    try {
      if (result.status === 'failed') {
        // A failed fixture can leave a dirty note. Record failure before allowing
        // normal shutdown; otherwise the native discard prompt blocks reporting.
        result.dialogSubstitutions.push('failure-only dirty note discard on normal exit');
        await application.evaluate(({ dialog }) => {
          dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
        });
      }
      await application.close();
    } catch (error) {
      result.status = 'failed';
      result.closeError = error.message;
      process.exitCode = 1;
    }
  }
  await closeServer();
  try {
    if (result.status === 'passed') {
      const credentials = await readFile(
        join(identity.appData, 'StudyCompanion', 'credentials.enc.json'),
      );
      assert.equal(
        credentials.includes(Buffer.from(fakeKey)),
        false,
        'Synthetic API key appears in plaintext credential storage.',
      );
      if (stage === 'create') {
        await writeFile(
          expectedPath,
          JSON.stringify(
            {
              format: 1,
              sandboxSid: identity.sid,
              createdAt: new Date().toISOString(),
              source: identity.source,
              snapshot: createdSnapshot,
            },
            null,
            2,
          ) + '\n',
          { flag: 'wx' },
        );
      }
    }
  } catch (error) {
    result.status = 'failed';
    result.finalizationError = error.message;
    process.exitCode = 1;
  }
  result.consoleErrors = consoleErrors;
  result.rendererHttpRequests = networkRequests;
  result.finishedAt = new Date().toISOString();
  result.scriptSha256 = createHash('sha256')
    .update(await readFile(script))
    .digest('hex');
  await writeFile(join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n', {
    flag: 'wx',
  });
  console.log(
    JSON.stringify({ stage, status: result.status, result: join(output, 'result.json') }),
  );
}
