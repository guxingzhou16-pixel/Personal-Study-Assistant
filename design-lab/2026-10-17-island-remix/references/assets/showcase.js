/* Local, in-memory interactions. No storage or external requests. */
const search = document.querySelector('[data-snippet-search]');
const snippets = [...document.querySelectorAll('[data-snippet]')];
const empty = document.querySelector('[data-search-empty]');

function filterSnippets() {
  const query = search.value.trim().toLocaleLowerCase();
  for (const snippet of snippets) {
    snippet.hidden = !snippet.textContent.toLocaleLowerCase().includes(query);
  }
  empty.hidden = snippets.some((snippet) => !snippet.hidden);
}

search?.addEventListener('input', filterSnippets);
document.querySelector('[data-clear-search]')?.addEventListener('click', () => {
  search.value = '';
  filterSnippets();
  search.focus();
});

document.querySelector('[data-bookmark]')?.addEventListener('click', (event) => {
  const button = event.currentTarget;
  const saved = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(saved));
  button.textContent = saved ? '已收藏 · 点击取消' : '收藏这个片段';
  document.querySelector('[data-action-status]').textContent = saved
    ? '已在当前页面收藏；刷新页面后重置。'
    : '已取消当前页面的收藏。';
});

document.querySelector('[data-theme-toggle]')?.addEventListener('click', (event) => {
  const root = document.documentElement;
  const key = root.hasAttribute('data-bs-theme') ? 'bsTheme' : 'theme';
  const dark = root.dataset[key] !== 'dark';
  root.dataset[key] = dark ? 'dark' : 'light';
  event.currentTarget.textContent = dark ? '切换为浅色' : '切换为暗色';
});
