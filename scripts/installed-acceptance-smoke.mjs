// Run only with the offline tools mapped into a real Windows Sandbox.
// Dialog substitutions select generated fixtures; application code and workers remain unchanged.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const stages = ['create', 'verify-restart', 'verify-replacement', 'verify-reinstall'];
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
        if ((Get-Item -LiteralPath $cursor).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked acceptance/install/profile path.' }
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
let expected;
let createdSnapshot;
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
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('button', { name, exact: true })
    .click();
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
  return { baseUrl: `http://127.0.0.1:${server.address().port}/v1`, authorized: () => authorized };
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
  await page.getByLabel('关联资料', { exact: true }).selectOption(source.id);
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
  await page.getByLabel('学习目标', { exact: true }).fill('完成阅读、作品和专注复盘。');
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
    await page.getByLabel('关联项目', { exact: true }).selectOption(project.id);
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
  await page.getByLabel('关联任务', { exact: true }).selectOption(todo.id);
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
  await page.getByLabel('任务日期', { exact: true }).fill(expected.snapshot.day);
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
  await value(page.getByLabel('一句收获、一个疑问或下一步', { exact: true }), fixture.review);
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

try {
  if (stage === 'create') {
    await assert.rejects(
      lstat(expectedPath),
      { code: 'ENOENT' },
      'Expected snapshot already exists; refusing overwrite.',
    );
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
  result.runtime = runtime;
  await until(
    () => page.evaluate(() => Boolean(window.studyCompanion)),
    Boolean,
    'real preload bridge',
  );
  const boot = await api('bootstrap');
  assert.equal(boot.dataDir.toLowerCase(), runtime.dataDir.toLowerCase());
  if (stage === 'create') await create();
  else await verify();
  assert.deepEqual(consoleErrors, [], 'Renderer reported an uncaught error.');
  assert.deepEqual(networkRequests, [], 'Unexpected renderer HTTP request.');
  result.status = 'passed';
} catch (error) {
  result.status = 'failed';
  result.error = { name: error.name, message: error.message, stack: error.stack };
  if (page && !page.isClosed())
    await screenshot('failure').catch((failure) => {
      result.failureScreenshotError = failure.message;
    });
  process.exitCode = 1;
} finally {
  if (application) {
    try {
      await application.close();
    } catch (error) {
      result.status = 'failed';
      result.closeError = error.message;
      process.exitCode = 1;
    }
  }
  if (server)
    await new Promise((done) => {
      server.closeAllConnections();
      server.close(done);
    });
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
