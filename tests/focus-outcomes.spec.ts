import { openPage } from './helpers/navigation';
import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLegacyDatabase, fixtureIds } from './fixtures/legacy-databases';

test('focus outcomes become editable drafts, cancellation writes nothing, and explicit saves stay separate from completion', async () => {
  const root = mkdtempSync(join(tmpdir(), 'study-focus-outcomes-'));
  createLegacyDatabase(join(root, 'study-companion.sqlite3'), 11);
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  const app = await electron.launch({
    args: ['.'],
    env: { ...env, STUDY_COMPANION_DATA_DIR: root },
  });
  try {
    const page = await app.firstWindow();
    const nav = (name: string) => openPage(page, name);
    await nav('学习笔记');
    await page.getByRole('button', { name: '新建笔记', exact: true }).click();
    await page.getByLabel('笔记标题', { exact: true }).fill('不能丢的原草稿');
    await nav('专注时光');
    await expect(
      page.getByRole('heading', { name: '留下一点真实成果', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('textbox', { name: '这次学会了什么', exact: true })
      .fill('我能用自己的例子解释全部回滚。');
    await page
      .getByRole('textbox', { name: '还卡在哪里', exact: true })
      .fill('并发时如何保证隔离？需要返回资料核对。');
    const before = await page.evaluate(async () => ({
      notes: await window.studyCompanion!.listNotes(),
      focus: await window.studyCompanion!.getFocusSession('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
      oldPlan: await window.studyCompanion!.planningOverview('2026-10-01'),
    }));
    await page.getByRole('button', { name: '编辑为笔记', exact: true }).click();
    const confirmation = page.getByRole('dialog');
    await confirmation.getByRole('button', { name: '取消', exact: true }).click();
    await expect(page.getByLabel('笔记标题', { exact: true })).toHaveValue('不能丢的原草稿');
    expect(await page.evaluate(() => window.studyCompanion!.listNotes())).toEqual(before.notes);
    await nav('专注时光');
    await expect(page.getByRole('textbox', { name: '这次学会了什么', exact: true })).toHaveValue(
      '我能用自己的例子解释全部回滚。',
    );
    await page.getByRole('button', { name: '编辑为笔记', exact: true }).click();
    await confirmation.getByRole('button', { name: '放弃修改并继续', exact: true }).click();
    await expect(page.getByRole('textbox', { name: /我的理解/ })).toHaveValue(
      '我能用自己的例子解释全部回滚。',
    );
    expect(await page.evaluate(() => window.studyCompanion!.listNotes())).toEqual(before.notes);
    await page.getByLabel('笔记标题', { exact: true }).fill('真实学习成果');
    await page.getByRole('button', { name: '保存笔记', exact: true }).click();
    await expect(page.getByText('笔记已保存到本机。', { exact: true })).toBeVisible();
    const notes = await page.evaluate(() => window.studyCompanion!.listNotes());
    expect(notes).toHaveLength(before.notes.length + 1);
    const note = await page.evaluate(
      (id) => window.studyCompanion!.getNote(id),
      notes.find((item) => item.title === '真实学习成果')!.id,
    );
    expect(note.questions).toContain('并发时如何保证隔离');
    expect(note.evidence).toContain(fixtureIds.focus);
    expect(note.sourceId).toBeNull();
    await nav('专注时光');
    await page.getByRole('button', { name: '编辑为下一项任务', exact: true }).click();
    const taskRegion = page.getByRole('region', { name: '学习计划', exact: true });
    await expect(taskRegion.getByLabel('标题', { exact: true })).toHaveValue('继续：当时任务');
    await expect(
      taskRegion.getByRole('textbox', { name: '具体行动与说明', exact: true }),
    ).toHaveValue(/并发时如何保证隔离/);
    const day = await taskRegion.getByLabel('安排日期', { exact: true }).inputValue();
    const plannedBefore = await page.evaluate(
      (day) => window.studyCompanion!.planningOverview(day),
      day,
    );
    expect(plannedBefore.tasks).toHaveLength(0);
    await taskRegion.getByLabel('标题', { exact: true }).fill('查证隔离的例子');
    await taskRegion.getByRole('button', { name: '确认保存到本机', exact: true }).click();
    await expect(page.getByText('任务已保存到本机。', { exact: true })).toBeVisible();
    const plan = await page.evaluate((day) => window.studyCompanion!.planningOverview(day), day);
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0]).toMatchObject({
      title: '查证隔离的例子',
      status: 'todo',
      completedAt: null,
      origin: 'manual',
    });
    expect(plan.tasks[0].details).toContain('并发时如何保证隔离');
    expect(
      await page.evaluate((id) => window.studyCompanion!.getFocusSession(id), fixtureIds.focus),
    ).toEqual(before.focus);
    expect(
      await page.evaluate(() => window.studyCompanion!.planningOverview('2026-10-01')),
    ).toEqual(before.oldPlan);
    await page.screenshot({ path: 'artifacts/focus-outcomes.png' });
  } finally {
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    });
    await app.close();
  }
});
