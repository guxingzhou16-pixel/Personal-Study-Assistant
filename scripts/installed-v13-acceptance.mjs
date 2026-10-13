// Loaded only by the guarded, real-Sandbox installed acceptance harness.
// The context reuses its identity, EXE, dialog, model, snapshot and relaunch checks.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile, lstat, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const response = '全部操作成功才提交，发生失败则全部回滚；底层实现仍需求证。';
const outcome = '我能用例子解释全部提交或回滚，尚未完成真实失败实验。';
const question = '还需要查找失败观测与并发隔离的依据。';

export async function runV13Acceptance(ctx) {
  const { stage, api, until, visible, navigate, result } = ctx;
  const button = (name) => ctx.page.getByRole('button', { name, exact: true });
  const click = (name) => button(name).click();
  const expectedPath = join(ctx.logs, 'installed-v13-expected.json');
  const oldPath = join(ctx.logs, 'installed-ai-expected.json');
  const load = async (path) => JSON.parse(await readFile(path, 'utf8'));

  async function snapshot(day) {
    return { ...(await ctx.snapshot(day)), reviews: await api('listReviews', null) };
  }

  async function verifySaved(receipt) {
    assert.equal(receipt.sandboxSid, ctx.identity.sid);
    assert.equal(receipt.source.gitCommit, ctx.plan.current.manifest.gitCommit);
    assert.equal(receipt.snapshot.schemaVersion, 13);
    assert.deepEqual(await snapshot(receipt.snapshot.day), receipt.snapshot);
    assert.deepEqual(await ctx.modelFiles(), receipt.modelFiles);
    const probe = await api('probeEmbedding');
    assert.equal(probe.available, true);
    assert.match(probe.message, /512 维/);
    const evidence = await api(
      'prepareQuestion',
      '数据库索引如何使查询更快？',
      receipt.originalSourceId,
    );
    assert.match(evidence.notice, /混合检索/);
    assert.doesNotMatch(evidence.notice, /已使用关键词检索|未完成|进程退出|超时/);
    assert.ok(
      evidence.hits.some(
        (hit) =>
          hit.sourceId === receipt.originalSourceId && hit.text.includes('数据库索引使查询更快。'),
      ),
    );
    result.cpu = { probe, evidence };
    const model = ctx.model();
    await navigate('设置');
    await click('检测连接');
    await until(
      () => model.authorized(),
      (count) => count > 0,
      'retained Windows-encrypted key',
    );
    await navigate('轻量复习');
    await ctx.page.locator('.review-list-item').first().click();
    await visible(
      ctx.page.getByRole('heading', { name: receipt.snapshot.reviews[0].question, exact: true }),
    );
    await click('查看上次保存的作答');
    await visible(
      ctx.page
        .getByRole('region', { name: '轻量复习', exact: true })
        .getByText(response, { exact: true }),
    );
    await click('查看参考答案与出处');
    await click('复习出处 [1]');
    await visible(ctx.page.locator('.markdown-reading'));
    await click('返回复习');
    await navigate('学习路线');
    await ctx.page
      .getByRole('combobox', { name: '选择草稿', exact: true })
      .selectOption(receipt.routeId);
    await visible(ctx.page.getByRole('region', { name: '结构化学习路线', exact: true }));
    await navigate('学习计划');
    await ctx.page
      .locator('.planning-datebar')
      .getByLabel('任务日期', { exact: true })
      .fill(receipt.snapshot.day);
    for (const title of receipt.taskTitles)
      await visible(ctx.page.locator('.planning-task-list').getByText(title, { exact: true }));
    await navigate('专注时光');
    await click('全部专注记录');
    await ctx.page
      .getByRole('list', { name: '已结束的专注记录' })
      .getByRole('button')
      .first()
      .click();
    assert.equal(
      await ctx.page
        .getByRole('textbox', { name: '一句收获、一个疑问或下一步', exact: true })
        .inputValue(),
      '已核对原文，实验和机制问题仍待完成。',
    );
    assert.deepEqual(await snapshot(receipt.snapshot.day), receipt.snapshot);
    assert.equal(model.generations().length, 0, 'Read-back must not regenerate model answers.');
    result.checks.push(
      'v13 full saved values and UI recall/route/tasks/focus equal the independent create receipt; key decrypted; no model generation',
    );
    await ctx.screenshot('v13-retained-records');
  }

  if (stage === 'v13-reset-legacy') {
    await assert.rejects(lstat(expectedPath), { code: 'ENOENT' });
    const failed = [];
    for (const directory of (await readdir(ctx.logs)).filter((name) =>
      name.startsWith('ui-v13-create-'),
    )) {
      const receipt = await load(join(ctx.logs, directory, 'result.json'));
      if (
        receipt.format === 1 &&
        receipt.stage === 'v13-create' &&
        receipt.status === 'failed' &&
        receipt.sandboxProfile === ctx.identity.profile &&
        receipt.source.gitCommit === ctx.plan.current.manifest.gitCommit
      )
        failed.push(directory);
    }
    assert.ok(
      failed.length,
      'Reset requires a preserved failed create receipt and no completed v13 baseline.',
    );
    await ctx.restore(await load(oldPath), 'ai-create', ctx.verifyLegacy);
    assert.deepEqual(await api('listReviews', null), []);
    result.failedCreateReceipts = failed;
    result.checks.push(
      'explicit fixture reset after failed create used the real legacy backup restore and retained the original failure receipts',
    );
    return;
  }

  if (stage === 'v13-upgrade' || stage === 'v13-restore-legacy') {
    const old = await load(oldPath);
    await ctx.verifyLegacy();
    assert.deepEqual(await api('listReviews', null), []);
    if (stage === 'v13-upgrade') {
      const directory = (await api('backupState')).learningDirectory;
      const files = (await readdir(directory)).filter((name) =>
        /^study-companion\.sqlite3\.before-v13-[a-f0-9-]{36}\.sqlite3$/.test(name),
      );
      assert.equal(files.length, 1, 'Actual v12 upgrade must retain one before-v13 backup.');
      const path = join(directory, files[0]);
      const db = new DatabaseSync(path, { readOnly: true });
      try {
        assert.equal(db.prepare('PRAGMA user_version').get().user_version, 12);
        assert.equal(
          db
            .prepare("SELECT count(*) AS count FROM sqlite_schema WHERE name='practice_reviews'")
            .get().count,
          0,
        );
        for (const [table, count] of [
          ['chat_turns', 4],
          ['notes', 1],
          ['memories', 1],
          ['daily_tasks', 1],
        ])
          assert.equal(db.prepare(`SELECT count(*) AS count FROM ${table}`).get().count, count);
      } finally {
        db.close();
      }
      result.migration = {
        from: 12,
        to: 13,
        backup: path,
        backupSha256: createHash('sha256')
          .update(await readFile(path))
          .digest('hex'),
      };
      result.excluded = result.excluded.filter((item) => item !== 'cross-version migration');
      result.checks.push(
        'same 0.1.1 app version replacement performed actual schema 12-to-13 migration; v12 consistent backup and all original AI values retained',
      );
    } else {
      await ctx.restore(old, 'ai-create', ctx.verifyLegacy);
      assert.equal((await api('bootstrap')).schemaVersion, 13);
      assert.deepEqual(await api('listReviews', null), []);
      result.checks.push(
        'real v12 backup restored and migrated to v13 through actual app exit/relaunch; all old AI values retained, new review table empty',
      );
    }
    return;
  }

  if (stage !== 'v13-create') {
    const receipt = await load(expectedPath);
    await verifySaved(receipt);
    if (stage === 'v13-restore') {
      await ctx.restore(receipt, 'v13-create', () => verifySaved(receipt));
      const root = join(ctx.identity.appData, 'StudyCompanion');
      const proof = {
        active: await load(join(root, 'active-learning.json')),
        credentialSha256: createHash('sha256')
          .update(await readFile(join(root, 'credentials.enc.json')))
          .digest('hex'),
      };
      await writeFile(
        join(ctx.logs, 'installed-v13-restored.json'),
        JSON.stringify(proof, null, 2) + '\n',
        { flag: 'wx' },
      );
    } else {
      const root = join(ctx.identity.appData, 'StudyCompanion');
      const proof = await load(join(ctx.logs, 'installed-v13-restored.json'));
      assert.deepEqual(await load(join(root, 'active-learning.json')), proof.active);
      assert.equal(
        createHash('sha256')
          .update(await readFile(join(root, 'credentials.enc.json')))
          .digest('hex'),
        proof.credentialSha256,
      );
      await assert.rejects(lstat(join(root, 'pending-restore.json')), { code: 'ENOENT' });
      result.checks.push(
        'reopen/reinstall retained actual v13 restored active pointer and identical encrypted key bytes, with no pending restore',
      );
    }
    return;
  }

  await assert.rejects(lstat(expectedPath), { code: 'ENOENT' });
  const old = await load(oldPath);
  const day = old.snapshot.day;
  assert.equal((await api('bootstrap')).schemaVersion, 13);
  assert.deepEqual(await snapshot(day), { ...old.snapshot, schemaVersion: 13, reviews: [] });
  const model = ctx.model();
  await navigate('设置');
  await click('检查已保存连接');
  await visible(ctx.page.getByText('本次列表存在所选模型；生成仍需另测。', { exact: false }));
  model.setAnswer('固定文本生成校验：可以继续核对资料。');
  await click('测试一次实际生成');
  await visible(
    ctx.page.getByText('本次固定文本生成成功；不代表 RAG 回答质量已验收。', { exact: false }),
  );
  await click('测试本地嵌入推理');
  await until(
    () => ctx.page.locator('.model-health li').last().textContent(),
    (text) => text.includes('512') && !text.includes('未通过'),
    'packaged embedding capability CPU inference',
    60_000,
  );
  result.checks.push(
    'separate saved-model list, synthetic fixed generation, file readiness and real packaged CPU embedding checks displayed',
  );

  await navigate('学习首页');
  await ctx.page.locator('.first-use-guide').evaluate((element) => {
    element.open = true;
  });
  await click('导入学习示例');
  await until(
    () => api('listSources'),
    (sources) => sources.length === old.snapshot.sources.length + 1,
    'public learning example imported',
  );
  await visible(button('先阅读示例'));

  // Start a real five-minute round; navigation below must not stop it.
  await navigate('学习计划');
  await ctx.page.locator('.planning-datebar').getByLabel('任务日期', { exact: true }).fill(day);
  await ctx.page.locator('.planning-task-list').getByRole('button').first().click();
  await click('为这项任务安排专注');
  await ctx.page.getByLabel('本轮专注分钟', { exact: true }).fill('5');
  await ctx.page
    .getByRole('checkbox', { name: '计满后提醒休息（仅本次运行，应用内提示）', exact: true })
    .check();
  const startedAt = Date.now();
  await click('确认并开始本轮');
  const running = await until(
    () => api('focusOverview'),
    (state) => state.current?.status === 'running',
    'real focus started',
  );
  const focusId = running.current.id;

  await navigate('资料库');
  await click(`阅读 ${ctx.fixture.source}`);
  await visible(ctx.page.locator('.markdown-reading'));
  // Opening a saved anchor schedules a scroll event that clears the old selection.
  // Select after the browser delivers that event and the actual position is saved.
  await ctx.page.locator('.markdown-reading p').first().scrollIntoViewIfNeeded();
  await ctx.page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  await visible(ctx.page.locator('.reader-save').getByText('阅读位置已保存', { exact: true }));
  await ctx.page
    .locator('.markdown-reading p')
    .first()
    .evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });
  await ctx.page.locator('.reader-scroll').dispatchEvent('mouseup');
  await visible(ctx.page.locator('.reader-selection').getByText(/^已选中 \d+ 字$/));
  await click('提问选中原文');
  model.setAnswer('事务要求全部提交或者全部回滚。[1]');
  await click('检索原文');
  await visible(ctx.page.getByText(/已加入你选中的确切原文/).first());
  await click('发送问题');
  await visible(ctx.page.getByText('事务要求全部提交或者全部回滚。', { exact: false }));
  await click('加入笔记草稿');
  await ctx.page
    .locator('.note-section textarea')
    .first()
    .fill('我的理解：不能提交一半，需要核对原文。');
  await ctx.page.getByLabel('笔记标题', { exact: true }).fill('v13 阅读选文笔记');
  await click('问答');
  await ctx.page.getByRole('textbox', { name: '输入学习问题' }).fill('尚未发送的侧栏问题');
  await ctx.page
    .getByRole('paragraph')
    .filter({ hasText: '事务要求全部提交或者全部回滚。' })
    .getByRole('button', { name: '引用 1', exact: true })
    .click();
  await click('返回选中原文');
  assert.equal(
    await ctx.page.getByRole('textbox', { name: '输入学习问题' }).inputValue(),
    '尚未发送的侧栏问题',
  );
  await click('笔记草稿');
  assert.equal(
    await ctx.page.locator('.note-section textarea').first().inputValue(),
    '我的理解：不能提交一半，需要核对原文。',
  );
  assert.equal((await api('listNotes')).length, old.snapshot.notes.length);
  await click('保存笔记');
  await until(
    () => api('listNotes'),
    (notes) => notes.length === old.snapshot.notes.length + 1,
    'explicit selected-text note save',
  );
  result.checks.push(
    'first-use public example and installed reading sidebars preserved exact selected text/question/unsaved note across citation navigation; explicit save only',
  );
  await click('问答');
  await ctx.page.getByRole('textbox', { name: '输入学习问题', exact: true }).fill('');

  const pdfPath = join(ctx.input, 'native-resources', 'Learning Notes.pdf');
  await navigate('资料库');
  result.dialogSubstitutions.push('open-file selection for the generated two-page PDF');
  await ctx.choose(pdfPath);
  try {
    await click('导入资料');
    await visible(ctx.page.getByText('导入完成：1 份新增，0 份重复，0 份失败。'));
  } finally {
    await ctx.restoreDialog();
  }
  const pdf = (await api('listSources')).find((source) => source.name === 'Learning Notes');
  assert.equal(pdf.kind, 'pdf');
  await click('阅读 Learning Notes');
  await visible(ctx.page.getByTestId('pdf-text-layer'));
  await click('下一页');
  await until(
    () => ctx.page.getByTestId('pdf-text-layer').textContent(),
    (text) => text.includes('Evidence matters.'),
    'real second-page PDF text layer',
  );
  await ctx.page.getByTestId('pdf-text-layer').evaluate((layer) => {
    const span = Array.from(layer.querySelectorAll('span')).find((item) =>
      item.textContent?.startsWith('Evidence matters.'),
    );
    const range = document.createRange();
    range.setStart(span.firstChild, 0);
    range.setEnd(span.firstChild, 16);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    span.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await click('提问选中原文');
  await visible(
    ctx.page.locator('.reading-context').getByText('《Learning Notes》 · 第 2 页', { exact: true }),
  );
  await visible(
    ctx.page.locator('.reading-context').getByText('Evidence matters', { exact: true }),
  );
  await click('检索原文');
  await visible(ctx.page.getByText(/已加入你选中的确切原文/).first());
  const pdfPreview = await ctx.page.locator('.evidence-preview').innerText();
  assert.ok(pdfPreview.includes('Learning Notes') && pdfPreview.includes('Evidence matters'));
  await click('加入笔记草稿');
  await ctx.page.getByLabel('笔记标题', { exact: true }).fill('v13 PDF 第二页笔记');
  await ctx.page
    .locator('.note-section textarea')
    .first()
    .fill('I will check the original evidence.');
  assert.equal(
    await ctx.page.getByRole('spinbutton', { name: 'PDF 页码', exact: true }).inputValue(),
    '2',
  );
  await click('保存笔记');
  const pdfNotes = await until(
    () => api('listNotes'),
    (notes) => notes.some((note) => note.title === 'v13 PDF 第二页笔记'),
    'explicit PDF sidebar note save',
  );
  const pdfNote = await api(
    'getNote',
    pdfNotes.find((note) => note.title === 'v13 PDF 第二页笔记').id,
  );
  assert.equal(pdfNote.sourceId, pdf.id);
  assert.match(pdfNote.evidence, /Evidence matters/);
  assert.ok(pdfNote.evidence.includes(`study-companion://source/${pdf.id}#page-2`));
  result.pdf = { sourceId: pdf.id, page: 2, preview: pdfPreview, note: pdfNote };
  result.checks.push(
    'packaged real PDF worker/canvas/text layer selected page-two original into question preview and saved sidebar note with exact page-two source link',
  );
  await ctx.screenshot('v13-pdf-sidebar');

  await navigate('学习助手');
  await click('新会话');
  await ctx.page.getByRole('combobox', { name: '问答方式', exact: true }).selectOption('quiz');
  await ctx.page
    .getByRole('combobox', { name: '资料范围', exact: true })
    .selectOption(old.snapshot.sources[0].id);
  await ctx.page
    .getByRole('textbox', { name: '输入练习主题', exact: true })
    .fill('事务全部提交回滚');
  model.setAnswer(
    JSON.stringify({
      items: [1, 2, 3].map((index) => ({
        question: `v13 事务回忆 ${index}`,
        answer: '事务必须全部提交，或者全部回滚。',
        citations: [1],
      })),
    }),
  );
  await click('检索原文');
  await visible(ctx.page.locator('.evidence-preview'));
  await click('生成 3 项练习');
  await ctx.page.getByRole('textbox', { name: '第 1 题 · 我的作答', exact: true }).fill(response);
  await ctx.page.getByRole('checkbox', { name: '第 1 题仍有疑问', exact: true }).check();
  await ctx.page.getByLabel('第 1 题复习日期', { exact: true }).fill(day);
  assert.deepEqual(await api('listReviews', null), []);
  await click('保存第 1 题作答与安排');
  const reviews = await until(
    () => api('listReviews', null),
    (items) => items.length === 1,
    'saved quiz recall',
  );
  assert.equal(reviews[0].response, response);
  assert.equal(reviews[0].reviewDay, day);
  assert.equal(reviews[0].hasQuestion, true);
  await navigate('轻量复习');
  await ctx.page.locator('.review-list-item').first().click();
  const exportPath = join(ctx.output, 'saved-recall.md');
  result.dialogSubstitutions.push('save-file destination for synthetic v13 recall Markdown');
  await ctx.application.evaluate(({ dialog }, path) => {
    const original = dialog.showSaveDialog;
    dialog.showSaveDialog = async () => {
      dialog.showSaveDialog = original;
      return { canceled: false, filePath: path };
    };
  }, exportPath);
  await click('导出已保存作答（不含未保存输入）');
  await until(
    async () => {
      try {
        return await readFile(exportPath, 'utf8');
      } catch (error) {
        if (error.code === 'ENOENT') return '';
        throw error;
      }
    },
    (text) => text.includes(response) && text.includes('v13 事务回忆 1'),
    'saved recall Markdown export',
  );
  result.checks.push(
    'quiz answer/question/manual date persisted only after explicit save; independent Markdown export contains saved recall and original question',
  );

  await navigate('学习路线');
  const agent = ctx.page.getByRole('region', { name: '学习路线 Agent', exact: true });
  await agent
    .getByRole('textbox', { name: '学习目标', exact: true })
    .fill('核对事务规则并写出自己的解释');
  await agent
    .getByRole('textbox', { name: '用来查找原文的概念或问题', exact: true })
    .fill('事务全部提交回滚');
  await agent.getByRole('spinbutton', { name: '可用时间（分钟）', exact: true }).fill('30');
  model.setAnswer(
    JSON.stringify({
      limitations: '底层机制需要另找资料核对。',
      steps: [15, 15].map((minutes, index) => ({
        title: `v13 路线步骤 ${index + 1}`,
        action: '返回原文核对全部提交或回滚，并用自己的例子解释。',
        artifact: '用户写下的解释与待求证问题',
        minutes,
        citations: [1],
      })),
    }),
  );
  await click('准备路线证据');
  await visible(ctx.page.getByRole('region', { name: '学习路线请求预览' }));
  const previousRoutes = new Set((await api('listLearningDrafts')).map((item) => item.id));
  await click('起草学习路线');
  const route = await until(
    async () => (await api('listLearningDrafts')).find((item) => !previousRoutes.has(item.id)),
    (item) => item && item.status !== 'streaming',
    'validated structured route',
  );
  assert.equal(route.status, 'completed');
  assert.equal(JSON.parse(route.answer).steps.length, 2);
  const routeId = route.id;
  const panel = ctx.page.getByRole('region', { name: '结构化学习路线', exact: true });
  await panel.getByRole('spinbutton', { name: '步骤 1 预计分钟', exact: true }).fill('16');
  await until(
    () => panel.getByRole('button', { name: '核对并确认路线建议', exact: true }).isDisabled(),
    Boolean,
    '31-minute edited budget refused',
  );
  await panel.getByRole('spinbutton', { name: '步骤 2 预计分钟', exact: true }).fill('14');
  await panel.getByRole('button', { name: '核对原文 [1]', exact: true }).first().click();
  await visible(ctx.page.locator('.markdown-reading'));
  await click('返回路线');
  assert.equal(
    await panel.getByRole('spinbutton', { name: '步骤 1 预计分钟', exact: true }).inputValue(),
    '16',
  );
  await panel.getByRole('button', { name: '核对并确认路线建议', exact: true }).click();
  for (const index of [1, 2])
    await panel.getByRole('checkbox', { name: `选择步骤 ${index} 生成任务`, exact: true }).check();
  const tasksBefore = (await api('planningOverview', day)).tasks;
  await panel.getByLabel('多步骤任务日期', { exact: true }).fill(day);
  await panel.getByRole('button', { name: '预览所选步骤任务', exact: true }).click();
  await visible(ctx.page.getByRole('region', { name: '多步骤任务最终预览', exact: true }));
  assert.deepEqual((await api('planningOverview', day)).tasks, tasksBefore);
  await panel.getByRole('button', { name: '取消多步骤预览', exact: true }).click();
  assert.deepEqual((await api('planningOverview', day)).tasks, tasksBefore);
  await panel.getByRole('button', { name: '预览所选步骤任务', exact: true }).click();
  await panel.getByRole('button', { name: '确认新增这 2 项待完成任务', exact: true }).click();
  const planned = await until(
    () => api('planningOverview', day),
    (state) => state.tasks.length === tasksBefore.length + 2,
    'actual confirmed route task batch',
  );
  const added = planned.tasks.filter(
    (task) => !tasksBefore.some((oldTask) => oldTask.id === task.id),
  );
  assert.deepEqual(
    added.map((task) => task.minutes).sort((a, b) => a - b),
    [14, 16],
  );
  for (const task of added) {
    assert.equal(task.status, 'todo');
    assert.equal(task.completedAt, null);
    assert.equal(task.originTurnId, routeId);
  }
  result.checks.push(
    'installed structured route rejected invalid edited budget, kept draft across original lookup, cancelled preview without writing, then saved exactly two todo tasks with source provenance',
  );

  await navigate('专注时光');
  console.log(JSON.stringify({ stage, waitingFor: 'real-five-minute-completion', focusId }));
  await until(
    () => api('getFocusSession', focusId),
    (item) => item.status === 'completed',
    'actual five-minute package timer with opt-in rest reminder',
    330_000,
  );
  const completed = await api('getFocusSession', focusId);
  assert.equal(completed.elapsedMs, 300_000);
  assert.equal(completed.reason, 'elapsed');
  assert.ok(Date.now() - startedAt >= 299_000);
  await visible(button('关闭休息提示'));
  assert.deepEqual(
    (await api('planningOverview', day)).tasks.find((task) => task.id === running.current.taskId),
    old.snapshot.tasks.find((task) => task.id === running.current.taskId),
  );
  await ctx.page
    .getByRole('textbox', { name: '一句收获、一个疑问或下一步', exact: true })
    .fill('已核对原文，实验和机制问题仍待完成。');
  await click('保存复盘');
  await visible(ctx.page.getByText('复盘已保存到本机。', { exact: true }));
  await ctx.page.getByRole('textbox', { name: '这次学会了什么', exact: true }).fill(outcome);
  await ctx.page.getByRole('textbox', { name: '还卡在哪里', exact: true }).fill(question);
  const focusBeforeDrafts = await api('getFocusSession', focusId);
  const notesBefore = (await api('listNotes')).length;
  await click('编辑为笔记');
  assert.equal((await api('listNotes')).length, notesBefore);
  await ctx.page.getByLabel('笔记标题', { exact: true }).fill('v13 专注真实成果');
  await click('保存笔记');
  await until(
    () => api('listNotes'),
    (notes) => notes.length === notesBefore + 1,
    'explicit focus outcome note save',
  );
  await navigate('专注时光');
  await click('编辑为下一项任务');
  const planning = ctx.page.getByRole('region', { name: '学习计划', exact: true });
  await planning.getByLabel('安排日期', { exact: true }).fill(day);
  await planning.getByLabel('标题', { exact: true }).fill('v13 继续查证隔离机制');
  await planning.getByRole('button', { name: '确认保存到本机', exact: true }).click();
  await visible(ctx.page.getByText('任务已保存到本机。', { exact: true }));
  assert.deepEqual(await api('getFocusSession', focusId), focusBeforeDrafts);
  result.focus = { id: focusId, actualWallMs: Date.now() - startedAt, record: focusBeforeDrafts };
  result.checks.push(
    'actual five-minute completion displayed opt-in in-app rest prompt; original task unchanged; focus outcomes became separately confirmed note/manual task, with no focus rewrite or mastery record',
  );
  await ctx.screenshot('v13-focus-outcomes');

  const saved = await snapshot(day);
  assert.equal(saved.reviews.length, 1);
  assert.equal(saved.notes.length, old.snapshot.notes.length + 3);
  assert.equal(saved.sources.length, old.snapshot.sources.length + 2);
  assert.equal(saved.tasks.length, old.snapshot.tasks.length + 3);
  assert.equal(saved.memories.length, old.snapshot.memories.length);
  const outcomeNote = saved.notes.find((note) => note.title === 'v13 专注真实成果');
  assert.equal(outcomeNote.understanding, outcome);
  assert.equal(outcomeNote.questions, question);
  const outcomeTask = saved.tasks.find((task) => task.title === 'v13 继续查证隔离机制');
  assert.ok(outcomeTask.details.includes(question));
  assert.equal(outcomeTask.status, 'todo');
  assert.equal(outcomeTask.origin, 'manual');
  assert.equal(model.generations().length, 4);
  result.modelGenerations = model.generations().length;
  await navigate('设置');
  await visible(
    ctx.page.locator('.model-health').getByText('固定文件已校验；不代表能推理。', { exact: false }),
  );
  await visible(
    ctx.page
      .locator('.embedding-settings')
      .getByRole('button', { name: '模型文件已校验', exact: true }),
  );
  await visible(ctx.page.getByText('此地址已有保存的密钥', { exact: true }));
  const destination = join(ctx.output, 'backup-export');
  await mkdir(destination);
  result.dialogSubstitutions.push('destination folder for synthetic v13 learning backup');
  await ctx.choose(destination);
  try {
    await click('导出完整备份');
    await visible(ctx.page.getByText('备份已导出', { exact: true }));
  } finally {
    await ctx.restoreDialog();
  }
  const backupState = await api('backupState');
  assert.equal(backupState.operation, 'idle');
  assert.equal(backupState.lastError, null);
  const backup = backupState.lastExport;
  assert.ok(backup.directory.toLowerCase().startsWith(destination.toLowerCase() + '\\'));
  const manifest = await load(join(backup.directory, 'manifest.json'));
  assert.equal(manifest.mainVersion, 13);
  assert.equal(manifest.activityVersion, 1);
  assert.equal(manifest.counts.reviews, 1);
  assert.equal(manifest.counts.sources, saved.sources.length);
  assert.equal(manifest.counts.notes, saved.notes.length);
  assert.equal(manifest.counts.tasks, saved.tasks.length);
  assert.equal(manifest.counts.focusSessions, saved.focusTotal);
  assert.ok(manifest.files.every((file) => !/credential|embedding|secret/i.test(file.path)));
  result.backup = { directory: backup.directory, counts: manifest.counts };
  result.v13Expected = {
    format: 1,
    sandboxSid: ctx.identity.sid,
    source: ctx.identity.source,
    snapshot: saved,
    routeId,
    originalSourceId: old.snapshot.sources[0].id,
    modelFiles: await ctx.modelFiles(),
    taskTitles: saved.tasks.map((task) => task.title),
  };
  await ctx.screenshot('v13-backup-export');
}
