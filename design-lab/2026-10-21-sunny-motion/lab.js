/* All content and outcomes in this file are synthetic. No desktop bridge or network. */
const scenes = [
  ['navigation', '页面与导航', '240 ms', '让选中状态与页面有连续的方向；连续点击也能即时响应。'],
  ['startup', '启动与重试', '240 ms', '真实内容就绪后再出现。不给启动增加人为等待。'],
  ['reading', '最近阅读', '120–240 ms', '主卡与列表轻入场，悬停和按下帮助确认操作对象。'],
  [
    'calendar',
    '切月与签到',
    '180–220 ms',
    '保留操作按钮的位置，只移动日期；成功后才改变签到状态。',
  ],
  ['timer', '开始与暂停', '160 ms', '计时状态有反馈，时长数字保持稳定，不逐秒表演。'],
  ['import', '导入与取消', '180 ms', '准备、进度、取消和结果清晰衔接；正式软件只展示真实进度。'],
  ['search', '搜索与筛选', '180 ms', '输入立即生效，只给结果一个短暂的视觉过渡。'],
  ['reader', '阅读与出处', '180–240 ms', '目录展开、护眼与出处强调；正文和 PDF 坐标保持准确。'],
  ['chat', '提问与流式回答', '180–240 ms', '只在提问和会话变化时动画，回答增量更新不重复入场。'],
  ['evidence', '检索与证据', '180–200 ms', '预览轻入场，原文局部展开；取消始终可操作。'],
  ['settings', '设置与状态', '180 ms', '服务表单与保存结果自然衔接，错误保留明确文字。'],
  ['download', '模型下载', '160–180 ms', '下载、取消、失败与就绪各有状态；不虚构正式下载进度。'],
];
const lab = document.querySelector('#lab');
const screen = document.querySelector('#screen');
const menu = document.querySelector('#scene-list');
let current = 0;
let state = 0;
let pending = [];
let controller;
function schedule(action, ms) {
  const id = setTimeout(action, ms);
  pending.push(id);
}
function clearPending() {
  pending.forEach(clearTimeout);
  pending = [];
}
function announce(text) {
  document.querySelector('#playback-status').textContent = text;
}
function calendarDays() {
  return `<div class="demo-calendar" data-motion="month" data-motion-key="10">${['一', '二', '三', '四', '五', '六', '日', ...Array.from({ length: 28 }, (_, i) => String(i + 1))].map((d, i) => `<span class="${i === 27 ? 'today' : ''}">${d}</span>`).join('')}</div>`;
}
function contents(id) {
  const actions = (buttons) =>
    `<div class="scene-actions">${buttons.map(([a, t]) => `<button data-action="${a}">${t}</button>`).join('')}</div>`;
  switch (id) {
    case 'navigation':
      return `<div class="hero-mini"><p class="overline">YOUR LITTLE LEARNING ISLAND</p><h3>今天，也长出<br />一点新想法</h3><p>点点上方导航，看界面跟上你的想法。</p><span aria-hidden="true">✳</span></div>${actions(
        [
          ['tab', '切换到资料库'],
          ['back', '返回首页'],
        ],
      )}`;
    case 'startup':
      return `<div class="mini-card centered"><p class="overline">OPEN YOUR OWN SPACE</p><h3>准备好，继续探索</h3><p>这里演示加载 → 内容，以及失败 → 重试。</p><div id="startup-state" data-motion="fade" data-motion-key="idle" class="notice">学习空间已就绪</div>${actions(
        [
          ['load', '重新打开'],
          ['failure', '模拟启动失败'],
          ['load', '重试'],
        ],
      )}</div>`;
    case 'reading':
      return `<div class="mini-card mint recent-document" data-motion="fade"><div class="book-row"><span class="book-mark" aria-hidden="true">MD</span><div><strong>从阅读到理解</strong><p>读到「先问一个好问题」</p></div></div>${actions([['open', '继续阅读 ↗']])}</div><div class="soft-row" data-motion="fade" data-motion-delay="40">PDF · Learning Notes　↗</div><div class="soft-row" data-motion="fade" data-motion-delay="80">Markdown · 设计学习札记　↗</div>`;
    case 'calendar':
      return `<div class="mini-card"><div class="calendar-top"><strong id="month-label">2026 年 10 月</strong><div><button data-action="month-back" aria-label="示例上个月">‹</button><button data-action="month-next" aria-label="示例下个月">›</button></div></div>${calendarDays()}<div class="scene-actions"><button class="primary" data-action="check" data-motion="state" data-motion-key="false" id="check-button">✓ 今日签到</button><p id="check-status">给今天留个脚印</p></div></div>`;
    case 'timer':
      return `<div class="mini-card lavender centered"><p>☼ 今日学习时间</p><div class="clock" id="clock">00:12:40</div><p>示例数字保持稳定，重点是操作状态的变化。</p><div class="scene-actions"><button id="timer-button" data-action="timer" data-motion="state" data-motion-key="idle">▷ 开始学习</button></div></div>`;
    case 'import':
      return `<div class="mini-card"><h3>为好奇，添一份资料</h3><p>从本机导入 PDF 或 Markdown。此处不读取任何文件。</p><div id="job-status" class="notice" data-motion="fade" data-motion-key="idle">等待选择示例资料</div><div class="mini-progress"><span id="job-progress"></span></div>${actions(
        [
          ['job', '开始示例导入'],
          ['cancel', '取消'],
          ['failure', '模拟失败'],
          ['job', '重试'],
        ],
      )}</div>`;
    case 'search':
      return `<input class="demo-search" id="demo-search" aria-label="示例搜索资料" placeholder="搜索“阅读”或“设计”试试看…" /><div class="sample-library" data-motion="fade" data-motion-key="all" id="sample-results"><button class="source-card" data-name="阅读" data-action="open"><span>▤</span>从阅读到理解</button><button class="source-card" data-name="设计" data-action="open"><span>▥</span>设计学习札记</button><button class="source-card" data-name="英文" data-action="open"><span>▤</span>Learning Notes</button></div>${actions(
        [
          ['filter', '只看 Markdown'],
          ['all', '显示全部'],
        ],
      )}<p id="search-status" class="chat-meta">3 份示例资料</p>`;
    case 'reader':
      return `<div class="reader-demo" id="reader-demo"><aside class="reader-outline" id="outline" aria-label="示例资料目录">阅读路线<br />先提一个问题<br />用自己的话解释<br />对照原文核实</aside><article class="paper" id="paper" data-motion="fade" data-motion-key="1"><h3>从阅读到理解</h3><p id="page-copy">先写下你想理解的一个问题。把自己的解释与原文对照，给理解留下出处。</p><p class="chat-meta" id="page-number">第 1 页 / 2（示例）</p></article></div>${actions(
        [
          ['toc', '展开／收起目录'],
          ['tone', '切换护眼'],
          ['page', '翻页'],
          ['cite', '定位出处'],
          ['copy', '复制引用反馈'],
          ['back', '返回资料库'],
        ],
      )}`;
    case 'chat':
      return `<div id="conversation"><p class="overline">LEARN THROUGH QUESTIONS</p><h3>和拾知一起想明白</h3><p>点击发送，观察问题出现和回答逐段更新。</p></div>${actions(
        [
          ['send', '发送示例问题'],
          ['stop', '停止生成'],
          ['conversation', '切换会话'],
        ],
      )}`;
    case 'evidence':
      return `<div id="evidence-area"><div class="notice" data-motion="fade">资料问答 · 先检索原文，再组织回答</div><div class="evidence" style="margin-top:12px" data-motion="fade"><details><summary>[1] 从阅读到理解 · 阅读与求证</summary><p>先用自己的话解释，再回到原文核对。这是一段示例证据，不代表真实检索结果。</p></details></div></div>${actions(
        [
          ['retrieve', '重新检索'],
          ['cancel', '取消检索'],
          ['cite-evidence', '查看原文'],
        ],
      )}`;
    case 'settings':
      return `<div class="provider-switch"><button data-action="local" aria-pressed="true">◫ 本地 Ollama</button><button data-action="remote" aria-pressed="false">☁ 兼容接口</button></div><div id="provider-form" data-motion="fade" data-motion-key="local"><label class="demo-field">服务基础地址<input value="http://127.0.0.1:11434" readonly /></label></div><div id="job-status" class="notice" data-motion="fade" data-motion-key="idle">示例设置，不保存实际配置</div>${actions(
        [
          ['save', '保存设置'],
          ['detect', '检测连接'],
          ['delete', '删除示例密钥'],
          ['failure', '模拟失败'],
        ],
      )}`;
    case 'download':
      return `<div class="mini-card"><p class="overline">LOCAL SEMANTIC SEARCH</p><h3>本地语义检索模型</h3><p>中文 BGE-small · 检索独立于聊天模型</p><div class="mini-progress"><span id="job-progress"></span></div><div id="job-status" class="notice" data-motion="fade" data-motion-key="idle">尚未下载，仍可使用关键词检索</div>${actions(
        [
          ['job', '下载示例模型'],
          ['cancel', '取消下载'],
          ['failure', '模拟失败'],
          ['job', '重试'],
        ],
      )}</div>`;
    default:
      return '';
  }
}
function show(index, reset = false) {
  if (current === index && !reset && screen.children.length) return;
  clearPending();
  lab.dataset.motionDirection = index < current ? 'back' : 'forward';
  current = index;
  state = 0;
  const [id, title, duration, intent] = scenes[index];
  screen.innerHTML = `<div class="scene" data-motion="page">${contents(id)}</div>`;
  screen.scrollTop = 0;
  document.querySelector('#scene-title').textContent = title;
  document.querySelector('#scene-number').textContent =
    `${String(index + 1).padStart(2, '0')} / ${scenes.length}`;
  document.querySelector('#scene-duration').textContent = duration;
  document.querySelector('#scene-intent').textContent = intent;
  menu
    .querySelectorAll('button')
    .forEach((button, i) => button.setAttribute('aria-current', String(i === index)));
  announce('直接操作示例界面，或点击「播放主动作」。');
}
function feedback(text, error = false) {
  let element = screen.querySelector('#job-status');
  if (!element) {
    element = document.createElement('div');
    element.id = 'job-status';
    element.className = 'notice';
    element.dataset.motion = 'fade';
    screen.firstElementChild.append(element);
  }
  element.classList.toggle('error', error);
  element.textContent = text;
  element.dataset.motionKey = String(++state);
  announce(text);
}
function selectTab(name) {
  document.querySelectorAll('[data-tab]').forEach((button) => {
    if (button.dataset.tab === name) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}
function act(action) {
  const id = scenes[current][0];
  switch (action) {
    case 'tab':
      selectTab('library');
      show(6);
      break;
    case 'back':
      selectTab(id === 'reader' ? 'library' : 'home');
      show(id === 'reader' ? 6 : 0);
      break;
    case 'open':
      show(7);
      break;
    case 'load':
      clearPending();
      screen.querySelector('#startup-state').textContent = '正在打开学习空间…';
      screen.querySelector('#startup-state').dataset.motionKey = String(++state);
      schedule(() => {
        screen.querySelector('#startup-state').textContent = '学习空间已就绪 · 可以继续阅读';
        screen.querySelector('#startup-state').dataset.motionKey = String(++state);
      }, 650);
      break;
    case 'failure':
      clearPending();
      if (id === 'startup') {
        screen.querySelector('#startup-state').textContent = '示例加载失败，请重试';
        screen.querySelector('#startup-state').dataset.motionKey = String(++state);
      } else feedback('示例操作失败，请检查后重试。', true);
      break;
    case 'month-back':
    case 'month-next': {
      const days = screen.querySelector('.demo-calendar');
      days.dataset.motionDirection = action === 'month-back' ? 'back' : 'forward';
      const month = 10 + (action === 'month-back' ? -1 : 1);
      screen.querySelector('#month-label').textContent = `2026 年 ${month} 月`;
      days.dataset.motionKey = String(++state);
      break;
    }
    case 'check': {
      const b = screen.querySelector('#check-button');
      b.textContent = '✓ 今日已签到';
      b.disabled = true;
      b.dataset.motionKey = 'true';
      screen.querySelector('.today').classList.add('signed');
      screen.querySelector('#check-status').textContent = '示例签到成功';
      break;
    }
    case 'timer': {
      const b = screen.querySelector('#timer-button');
      const running = b.dataset.motionKey !== 'running';
      b.dataset.motionKey = running ? 'running' : 'paused';
      b.textContent = running ? 'Ⅱ 暂停计时' : '▷ 开始学习';
      announce(running ? '示例计时已开始，数字不使用翻牌动画。' : '示例计时已暂停。');
      break;
    }
    case 'job': {
      clearPending();
      feedback(id === 'download' ? '示例模型下载中…' : '正在解析示例资料…');
      const bar = screen.querySelector('#job-progress');
      bar.style.width = '15%';
      schedule(() => (bar.style.width = '58%'), 650);
      schedule(() => {
        bar.style.width = '100%';
        feedback(id === 'download' ? '示例模型已就绪' : '导入完成：2 份新增，0 份失败（示例）');
      }, 1400);
      break;
    }
    case 'cancel':
      clearPending();
      feedback('示例操作已取消，仍可重试。');
      break;
    case 'all':
    case 'filter': {
      const cards = screen.querySelectorAll('[data-name]');
      cards.forEach((card, i) => (card.hidden = action === 'filter' && i === 2));
      screen.querySelector('#sample-results').dataset.motionKey = String(++state);
      break;
    }
    case 'toc': {
      const outline = screen.querySelector('#outline');
      outline.hidden = !outline.hidden;
      outline.inert = outline.hidden;
      break;
    }
    case 'tone':
      screen.querySelector('#reader-demo').classList.toggle('warm');
      break;
    case 'page': {
      const paper = screen.querySelector('#paper');
      const next = (paper.dataset.page || '1') === '1' ? '2' : '1';
      paper.dataset.page = next;
      paper.dataset.motion = 'fade';
      paper.dataset.motionKey = String(Number(paper.dataset.motionKey) + 1);
      screen.querySelector('#page-number').textContent = `第 ${next} 页 / 2（示例）`;
      screen.querySelector('#page-copy').textContent =
        next === '2'
          ? '用一个贴近生活的例子检验理解，再记录仍有疑问的地方。'
          : '先写下你想理解的一个问题。把自己的解释与原文对照，给理解留下出处。';
      break;
    }
    case 'cite':
      SunnyMotion.emphasizeReadingTarget(screen.querySelector('#paper'));
      break;
    case 'copy':
      feedback('引用已复制，包含资料位置（示例反馈，不写剪贴板）。');
      break;
    case 'send': {
      clearPending();
      const box = screen.querySelector('#conversation');
      box.innerHTML =
        '<div class="chat-bubble" data-motion="reveal">怎么检验自己是否读懂了？</div><div class="chat-answer" id="answer"></div><p class="chat-meta" id="chat-state" data-motion="state" data-motion-key="running">正在回答…</p>';
      const chunks = [
        '先用自己的话解释，',
        '再找一个具体例子。',
        '最后回到原文核对，留下还没弄懂的问题。',
      ];
      chunks.forEach((text, i) =>
        schedule(
          () => {
            screen.querySelector('#answer').textContent += text;
            if (i === 2) {
              screen.querySelector('#chat-state').textContent = '回答完成（示例）';
              screen.querySelector('#chat-state').dataset.motionKey = 'complete';
            }
          },
          350 + i * 400,
        ),
      );
      break;
    }
    case 'stop':
      clearPending();
      if (screen.querySelector('#chat-state')) {
        screen.querySelector('#chat-state').textContent = '已停止，保留当前内容（示例）';
        screen.querySelector('#chat-state').dataset.motionKey = 'stopped';
      }
      break;
    case 'conversation':
      clearPending();
      screen.querySelector('#conversation').innerHTML =
        '<div class="chat-bubble" data-motion="fade">上一次的学习问题</div><div class="chat-answer">把问题写清楚，再用证据慢慢核对。</div><p class="chat-meta">示例历史会话</p>';
      break;
    case 'retrieve':
      clearPending();
      feedback('正在检索示例原文…');
      schedule(() => feedback('找到 1 个示例片段；点击上方原文展开查看。'), 800);
      break;
    case 'cite-evidence':
      show(7);
      schedule(() => SunnyMotion.emphasizeReadingTarget(screen.querySelector('#paper')), 260);
      break;
    case 'local':
    case 'remote': {
      const remote = action === 'remote';
      screen
        .querySelectorAll('.provider-switch button')
        .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.action === action)));
      const form = screen.querySelector('#provider-form');
      form.innerHTML = `<label class="demo-field">服务基础地址<input value="${remote ? 'https://api.example.invalid/v1' : 'http://127.0.0.1:11434'}" readonly /></label>${remote ? '<p class="chat-meta">API 密钥由正式软件安全保存；本演示不提供密钥输入。</p>' : ''}`;
      form.dataset.motionKey = action;
      break;
    }
    case 'save':
      feedback('示例设置已保存。');
      break;
    case 'detect':
      feedback('模拟连接成功，发现 1 个示例模型。');
      break;
    case 'delete':
      feedback('示例密钥已删除；未操作系统密钥。');
      break;
  }
}
menu.innerHTML = scenes
  .map(
    (scene, i) =>
      `<button class="scene-option" data-scene="${i}" aria-current="${i === 0}"><small>${String(i + 1).padStart(2, '0')}</small>${scene[1]}</button>`,
  )
  .join('');
show(0, true);
controller = SunnyMotion.mountMotion(lab);
menu.addEventListener('click', (event) => {
  const button = event.target.closest('[data-scene]');
  if (button) show(Number(button.dataset.scene));
});
screen.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (button) act(button.dataset.action);
});
document.querySelector('.app-nav').addEventListener('click', (event) => {
  const tab = event.target.closest('[data-tab]');
  if (tab) {
    selectTab(tab.dataset.tab);
    show(tab.dataset.tab === 'home' ? 0 : tab.dataset.tab === 'library' ? 6 : 8);
  }
});
document
  .querySelector('#play')
  .addEventListener('click', () =>
    act(
      [
        'tab',
        'load',
        'open',
        'month-next',
        'timer',
        'job',
        'filter',
        'toc',
        'send',
        'retrieve',
        'remote',
        'job',
      ][current],
    ),
  );
document.querySelector('#replay').addEventListener('click', () => show(current, true));
document.querySelector('#slow').addEventListener('change', (event) => {
  lab.dataset.motionSlow = String(event.target.checked);
  announce(event.target.checked ? '半速查看已开启。' : '已恢复正常速度。');
});
document.querySelector('#reduce').addEventListener('change', (event) => {
  lab.dataset.motionReduced = String(event.target.checked);
  announce(
    event.target.checked
      ? '减少动态效果：状态即时切换，保留文字反馈。'
      : '已恢复跟随系统的动效偏好。',
  );
});
screen.addEventListener('input', (event) => {
  if (event.target.id === 'demo-search') {
    const query = event.target.value.trim();
    let count = 0;
    screen.querySelectorAll('[data-name]').forEach((card) => {
      card.hidden = !!query && !card.textContent.includes(query);
      if (!card.hidden) count++;
    });
    screen.querySelector('#sample-results').dataset.motionKey = query;
    screen.querySelector('#search-status').textContent = count
      ? `${count} 份示例资料`
      : '没有匹配的示例资料。';
  }
});
window.addEventListener(
  'pagehide',
  () => {
    clearPending();
    controller.dispose();
  },
  { once: true },
);
