const home = document.querySelector('#home');
const settings = document.querySelector('#settings');
const detail = document.querySelector('#detail');
const sample = document.querySelector('#sample-data');
let current = 'home';
let detailParent = 'home';
const pages = {
  agent: [
    '学习路线',
    '示例：理解事务的原子性 · 25 分钟预算',
    '<ol><li>对照原文解释全部提交与回滚。</li><li>写出一个失败实验并核对结果。</li></ol>',
  ],
  notes: [
    '学习笔记',
    '示例：事务学习 · 共 1 份笔记',
    '<h2>事务笔记</h2><p>我的理解：事务中的操作一起成功或全部撤销。</p><p>原文依据与疑问在正式笔记页查看和编辑。</p>',
  ],
  focus: ['专注时光', '示例功能位置', '<p>正式软件在这里开始、暂停专注，查看历史并填写复盘。</p>'],
  planning: [
    '学习计划',
    '示例功能位置',
    '<p>正式软件继续管理项目与每日任务；所有保存需要明确操作。</p>',
  ],
  reviews: ['轻量复习', '示例功能位置', '<p>还没有保存的作答与复习安排。</p>'],
  memories: [
    '长期记忆',
    '示例功能位置',
    '<p>还没有保存的学习记忆。正式软件允许查看、编辑和删除。</p>',
  ],
  library: ['资料库', '示例功能位置', '<p>这里仍是资料导入、搜索与阅读的主入口。</p>'],
  chat: ['学习助手', '示例功能位置', '<p>这里仍是普通聊天、资料问答与证据核对的主入口。</p>'],
};
function show(page) {
  current = page;
  home.hidden = page !== 'home';
  settings.hidden = page !== 'settings';
  detail.hidden = ['home', 'settings'].includes(page);
  detailParent = ['focus', 'planning', 'reviews', 'memories'].includes(page) ? 'settings' : 'home';
  if (!detail.hidden) {
    document.querySelector('#detail-title').textContent = pages[page][0];
    document.querySelector('#detail-description').textContent = pages[page][1];
    document.querySelector('#detail-example').innerHTML = pages[page][2];
    if (!sample.checked && ['agent', 'notes'].includes(page)) {
      document.querySelector('#detail-description').textContent = '示例空态 · 尚无对应记录';
      document.querySelector('#detail-example').innerHTML =
        `<p>还没有${page === 'agent' ? '学习路线' : '学习笔记'}。在正式软件中按需要开始。</p>`;
    }
    document.querySelector('#back').textContent =
      detailParent === 'settings' ? '← 返回设置' : '← 返回学习首页';
  }
  const primary = ['agent', 'notes'].includes(page) ? 'home' : page;
  for (const button of document.querySelectorAll('header [data-page]')) {
    const selected = button.classList.contains('settings')
      ? page === 'settings' || detailParent === 'settings'
      : button.closest('nav') && button.dataset.page === primary;
    if (selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  window.scrollTo(0, 0);
}
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-page]');
  if (!button) return;
  event.preventDefault();
  show(button.dataset.page);
});
document.querySelector('#back').addEventListener('click', () => show(detailParent));
sample.addEventListener('change', () => {
  document.querySelector('#route-summary').innerHTML = sample.checked
    ? '<strong>理解事务的原子性</strong><p>25 分钟预算 · 草稿已保存</p><small>示例记录 · 10 月 22 日 10:30</small>'
    : '<p>还没有学习路线</p>';
  document.querySelector('#notes-summary').innerHTML = sample.checked
    ? '<strong>事务笔记</strong><p>事务学习 · 共 1 份笔记</p><small>示例更新 · 10 月 22 日 10:45</small>'
    : '<p>还没有学习笔记</p>';
  if (current === 'agent' || current === 'notes') show(current);
});
document.querySelector('#days').innerHTML = Array.from({ length: 35 }, (_, i) =>
  i < 3 || i > 33
    ? '<span></span>'
    : `<span class="${i === 24 ? 'today-mark' : ''}">${i - 2}</span>`,
).join('');
document.querySelector('#check-in').addEventListener('click', (event) => {
  event.currentTarget.textContent = '✓ 已签到 · 示例';
});
document.querySelector('#timer-button').addEventListener('click', (event) => {
  event.currentTarget.textContent = event.currentTarget.textContent.startsWith('开始')
    ? '暂停计时 · 示例'
    : '开始计时 · 示例';
});
show(current);
