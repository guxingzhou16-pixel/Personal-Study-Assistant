import type { Page } from '@playwright/test';

export async function openPage(page: Page, name: string) {
  if (name === '学习笔记' || name === '学习路线') {
    await page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('button', { name: '学习首页', exact: true })
      .click();
    await page.getByRole('link', { name: `查看完整${name}`, exact: true }).click();
  } else if (['专注时光', '学习计划', '轻量复习', '长期记忆', '打开轻量复习'].includes(name)) {
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page
      .getByRole('region', { name: '学习工具', exact: true })
      .getByRole('button', { name: name === '打开轻量复习' ? '轻量复习' : name, exact: true })
      .click();
  } else {
    await page.getByRole('button', { name, exact: true }).click();
  }
}
