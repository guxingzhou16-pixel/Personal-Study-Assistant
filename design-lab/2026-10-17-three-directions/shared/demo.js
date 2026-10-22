/* Static design study. All content and interactions are browser-only examples. */
(() => {
  'use strict';

  const paths = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
    book: '<path d="M12 5v16m0-16C9 3 5 3 2 4v15c4-1 7-1 10 2m0-16c3-2 7-2 10-1v15c-4-1-7-1-10 2"/>',
    folder:
      '<path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
    note: '<path d="M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9M9 15l3-.5L22 4l-3-3L8.5 12Z"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
    play: '<path d="m8 4 12 8-12 8Z"/>',
    pause: '<path d="M8 4v16M16 4v16"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    settings:
      '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
    leaf: '<path d="M20 3C5 2 1 9 6 15s15 0 14-12ZM4 21 16 9"/>',
    back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
    send: '<path d="m21 3-7 18-4-7-7-4 18-7ZM10 14 21 3"/>',
    link: '<path d="m10 13 4-4M8 15l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 3 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(1 0)"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  };
  const icon = (name) =>
    `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`;
  const theme = document.body.dataset.theme;
  const themes = {
    paper: { number: '01', name: '纸间', english: 'PAPER ROOM', file: '01-paper' },
    night: { number: '02', name: '深潜', english: 'DEEP WORK', file: '02-deep' },
    garden: { number: '03', name: '晴岛', english: 'SUNNY ISLE', file: '03-island' },
  };
  const current = themes[theme];
  const sources = [
    {
      title: '检索增强生成：从原理到实践',
      kind: 'PDF',
      meta: '第 12 / 36 页',
      topic: '人工智能',
      color: 'sage',
      tag: '正在阅读',
    },
    {
      title: '把知识连起来：双向链接笔记',
      kind: 'MD',
      meta: '第二章 · 知识的连接',
      topic: '学习方法',
      color: 'rose',
      tag: '最近加入',
    },
    {
      title: '深入理解向量与相似度',
      kind: 'PDF',
      meta: '第 3 / 24 页',
      topic: '人工智能',
      color: 'sand',
      tag: '待读',
    },
  ];
  const sourceRows = (start = 0) =>
    sources
      .slice(start)
      .map(
        (s, i) =>
          `<button class="source-row" data-open-source="${i + start}"><span class="file-icon ${s.color}">${icon(s.kind === 'MD' ? 'note' : 'book')}</span><span class="source-info"><strong>${s.title}</strong><small>${s.kind} <span>·</span> ${s.meta}</small></span><span class="source-topic">${s.topic}</span><span class="source-arrow">${icon('arrow')}</span></button>`,
      )
      .join('');
  const bookCover = `<div class="book-cover" aria-hidden="true"><span>FIELD NOTES<br>ON LEARNING</span><div class="cover-lines"></div><strong>检索<br>增强<br>生成<span>RAG</span></strong><small>从原理到实践</small></div>`;
  const pipeline = `<div class="pipeline" aria-label="问题经过检索，形成证据，再组织回答"><div>${icon('search')}<span>检索</span></div><i></i><div>${icon('book')}<span>证据</span></div><i></i><div>${icon('spark')}<span>回答</span></div><small>TRACE EVERY ANSWER TO ITS SOURCE</small></div>`;
  const plant = `<svg class="plant-art" viewBox="0 0 310 230" fill="none" aria-hidden="true"><ellipse cx="157" cy="209" rx="102" ry="9" fill="#c8d2a8" opacity=".45"/><path d="m48 181 112 12 102-44-110-10Z" fill="#f6bf75" stroke="#32483c" stroke-width="2"/><path d="m48 181 1 13 110 13 103-45v-13l-102 44Z" fill="#ffdfaa" stroke="#32483c" stroke-width="2"/><path d="m72 157 94 11 76-32-95-11Z" fill="#dce6ff" stroke="#32483c" stroke-width="2"/><path d="m72 157 1 15 93 11 76-33v-14l-76 32Z" fill="#aabbe4" stroke="#32483c" stroke-width="2"/><path d="m129 132 9 37c16 10 36 8 46-2l8-37" fill="#f7f1d5" stroke="#32483c" stroke-width="2"/><ellipse cx="160" cy="130" rx="32" ry="10" fill="#c7b9a0" stroke="#32483c" stroke-width="2"/><path d="M160 134V65m0 45 28-32m-28 19-25-25" stroke="#32483c" stroke-width="3"/><path d="M160 82c-34-5-43-30-36-49 30 2 41 21 36 49Z" fill="#7d9d6b" stroke="#32483c" stroke-width="2"/><path d="M163 103c-4-37 19-56 45-51 0 30-17 48-45 51Z" fill="#aec37c" stroke="#32483c" stroke-width="2"/><path d="m135 72 14 8m38-4-13 14" stroke="#32483c" stroke-width="2"/><path d="m68 75 4-12 4 12 12 4-12 4-4 12-4-12-12-4Z" fill="#f7b679"/><circle cx="239" cy="104" r="5" fill="#8ca7d4"/><path d="m231 47 4-7 4 7-4 7Z" fill="#f8e0a0" stroke="#32483c"/></svg>`;
  const timer = `<div class="timer-display" data-time>00:00</div><p class="timer-caption">给眼前的这一页，一点完整的时间。</p><button class="button primary timer-toggle" data-action="timer">${icon('play')}<span>开始计时</span></button><small class="timer-hint">手动学习计时 · 本次演示不保存</small>`;
  const week = `<div class="week-strip" aria-label="2026 年 10 月 12 日至 18 日">${['一', '二', '三', '四', '五', '六', '日'].map((d, i) => `<div class="${i === 5 ? 'today' : ''}"><small>${d}</small><strong>${12 + i}</strong><span class="${[0, 2, 3].includes(i) ? 'marked' : ''}"></span></div>`).join('')}</div>`;

  function home() {
    if (theme === 'paper')
      return `<div class="paper-heading"><div><span class="eyebrow">SATURDAY, OCTOBER 17</span><h1>留一点时间，<br>给真正想懂的事。</h1><p>欢迎回到你的小书房。今天，从上次的好奇继续。</p></div><div class="date-seal"><span>十月</span><strong>拾柒</strong><small>宜 · 温故知新</small></div></div><div class="paper-columns"><div><div class="section-label"><h2>接着上次读</h2><span>CONTINUE READING</span></div><article class="continue-card">${bookCover}<div class="continue-copy"><span class="eyebrow">人工智能 / 01</span><h2>检索增强生成：<br>从原理到实践</h2><p>第三章 · 让回答有据可依</p><div class="reading-track"><span></span></div><small>第 12 页 / 共 36 页</small><button class="button primary" data-view="reader">继续阅读 ${icon('arrow')}</button></div></article><div class="section-label lower"><h2>书桌上的资料</h2><button class="text-button" data-view="library">查看全部 ${icon('arrow')}</button></div><div class="home-sources">${sourceRows()}</div><div class="margin-note"><span>留给自己的问题</span><p>“检索到的片段，真的足够支持这个结论吗？”</p><button class="text-button" data-view="reader">带着问题读 ${icon('arrow')}</button></div></div><aside class="home-aside"><div class="section-label"><h2>这一周</h2><span>10 月</span></div>${week}<button class="checkin" data-action="checkin">${icon('plus')}<span>记录今天的到来</span></button><div class="focus-block"><span class="eyebrow">A LITTLE FOCUS</span><h3>安静地，读一会儿</h3>${timer}</div><div class="little-quote">读过的每一页，<br>都在悄悄拓宽世界。<span>ONE PAGE AT A TIME</span></div></aside></div>`;
    if (theme === 'night')
      return `<div class="night-heading"><div><span class="eyebrow"><span class="status-dot"></span> PERSONAL KNOWLEDGE WORKSPACE</span><h1>让每一个回答，<br>都有迹可循。</h1><p>从阅读出发，把问题追到原文里。</p></div><span class="mono date-label">SAT / 2026.10.17</span></div><div class="night-stats"><div><small>资料库</small><strong>03 <span>份资料</span></strong></div><div><small>正在阅读</small><strong>12 <span>/ 36 页</span></strong></div><div><small>本次学习</small><strong data-time>00:00</strong></div></div><div class="section-label"><h2>继续探索</h2><span class="mono">ACTIVE DOCUMENT / 01</span></div><article class="night-feature"><div><span class="chip">PDF · 人工智能</span><h2>检索增强生成：<br>从原理到实践</h2><p>第三章 / 让回答有据可依</p><button class="button primary" data-view="reader">打开阅读工作台 ${icon('arrow')}</button></div>${pipeline}</article><div class="section-label lower"><h2>最近打开</h2><button class="text-button" data-view="library">全部资料 ${icon('arrow')}</button></div><div class="home-sources">${sourceRows()}</div><div class="night-footer"><span>${icon('clock')} 给一个问题，留一段完整的时间。</span><button class="text-button timer-toggle" data-action="timer">${icon('play')}<span>开始计时</span></button></div>`;
    return `<section class="island-greeting"><div><span class="eyebrow">YOUR OWN LITTLE LEARNING ISLAND</span><h1>今天，也长出<br>一点新想法<span class="heading-spark">✳</span></h1><p>不用一下子读完整个世界。<br>从感兴趣的一页开始，就很好。</p><button class="button primary" data-view="reader">回到我的阅读 ${icon('arrow')}</button></div>${plant}<span class="greeting-sticker">保持好奇<br><span>STAY CURIOUS :)</span></span></section><div class="island-grid"><div><div class="section-label"><h2>还想接着读 ${icon('book')}</h2><button class="text-button" data-view="library">我的资料库 ${icon('arrow')}</button></div><article class="island-reading"><div class="island-book" aria-hidden="true"><small>LEARNING<br>BY ASKING</small><strong>R<br>AG<span>↗</span></strong></div><div><span class="chip">人工智能 · PDF</span><h2>检索增强生成：<br>从原理到实践</h2><p>上次读到：让回答有据可依</p><button class="round-link" data-view="reader" aria-label="继续阅读检索增强生成">${icon('arrow')}</button><small class="page-meta">12 / 36 页</small></div></article><div class="section-label lower"><h2>给好奇心留个位置</h2><span class="mini-label">资料摘选</span></div><div class="island-source-list">${sourceRows(1)}</div></div><aside><div class="island-week"><div class="section-label"><h2>每次出现，都算数</h2><span>10 月</span></div>${week}<button class="checkin" data-action="checkin">${icon('plus')}<span>今天，我来过啦</span></button></div><div class="island-focus"><div class="focus-title"><span class="sun-token">${icon('sun')}</span><h3>只管这一小会儿</h3></div>${timer}</div></aside></div>`;
  }

  const navigation = `<button class="nav-item active" data-view="home" aria-label="今日学习" aria-current="page">${icon('home')}<span>今日学习</span></button><button class="nav-item" data-view="library" aria-label="我的资料">${icon('folder')}<span>我的资料</span><small>03</small></button><button class="nav-item" data-view="reader" aria-label="阅读工作台">${icon('book')}<span>阅读工作台</span></button>`;
  const brand = `<a class="brand" href="../index.html" aria-label="拾知设计总览"><span class="brand-symbol">${icon(theme === 'garden' ? 'sun' : 'leaf')}</span><span>拾知<small>${current.english}</small></span></a>`;
  const sidebar = `<aside class="sidebar">${brand}<button class="quick-search" data-action="search">${icon('search')}<span>找一份资料</span><kbd>/</kbd></button><span class="nav-label">我的空间</span><nav aria-label="主要导航">${navigation}</nav><div class="sidebar-collection"><span class="nav-label">学习主题</span><button data-action="topic-ai"><span class="topic-dot sage"></span>人工智能 <small>2</small></button><button data-action="topic-study"><span class="topic-dot rose"></span>学习方法 <small>1</small></button></div><div class="sidebar-bottom"><div class="local-label"><span class="status-dot"></span>一个人的学习空间</div><button class="profile" data-action="profile"><span class="avatar">知</span><span>学习者<small>本地工作区</small></span>${icon('settings')}</button></div></aside>`;
  const assistant = `<aside class="assistant-panel" aria-label="学习助手示例"><div class="assistant-heading"><span class="assistant-icon">${icon('spark')}</span><strong>一起读懂</strong><span class="example-badge">示例</span><button class="assistant-close" data-action="assistant" aria-label="收起学习助手">×</button></div><div class="assistant-scope">${icon('link')} 仅依据当前资料</div><div class="assistant-content"><span class="eyebrow">从一个好问题开始</span><h3>读到这里，<br>你想弄懂什么？</h3><div class="sample-question">RAG 为什么需要先检索，再生成？</div><div class="sample-answer"><span class="answer-label">${icon('spark')} 拾知 · 示例回答</span><p>先找到相关资料，再让模型组织回答，可以让结论有可核对的依据。</p><p>关键不只是“答出来”，还有“知道答案从哪里来”。<button class="inline-citation" data-action="citation" aria-label="查看引用 1 的原文">[1]</button></p></div><button class="evidence-card" data-action="citation"><span>${icon('book')} 来源 01 ${icon('arrow')}</span><strong>让回答有据可依</strong><small>检索增强生成 · 第 12 页</small></button><div class="suggested-prompts"><button data-prompt="用一个日常例子解释 RAG">用一个日常例子解释 ${icon('plus')}</button><button data-prompt="哪些结论还需要更多证据？">哪些结论还需要更多证据？ ${icon('plus')}</button></div></div><form class="ask-form"><label class="sr-only" for="question">向当前资料提问（仅演示）</label><textarea id="question" rows="2" placeholder="把没想明白的，留在这里…" maxlength="300"></textarea><div><small>静态问答示例</small><button class="send-button" aria-label="预览示例回答" type="submit">${icon('arrow')}</button></div></form></aside>`;
  const library = `<section data-screen="library" hidden><div class="view-heading"><div><span class="eyebrow">YOUR PERSONAL LIBRARY</span><h1>把好奇，收在这里。</h1><p>三份示例资料，等一个新的问题。</p></div><button class="button primary" data-action="import">${icon('plus')} 添加资料</button></div><div class="library-toolbar"><label class="library-search">${icon('search')}<input id="library-search" placeholder="搜索资料名称或主题" aria-label="搜索资料名称或主题"></label><div class="filters" aria-label="资料格式筛选"><button class="active" data-filter="all" aria-pressed="true">全部</button><button data-filter="PDF" aria-pressed="false">PDF</button><button data-filter="MD" aria-pressed="false">Markdown</button></div></div><div class="library-grid">${sources.map((s, i) => `<button class="library-card ${s.color}" data-open-source="${i}" data-title="${s.title} ${s.topic}" data-kind="${s.kind}"><div class="library-cover"><span class="chip">${s.kind}</span><span class="library-cover-number">0${i + 1}</span>${i === 0 ? pipeline : icon(i === 1 ? 'note' : 'spark')}</div><span class="library-card-copy"><small>${s.topic} · ${s.tag}</small><strong>${s.title}</strong><span>${s.meta} ${icon('arrow')}</span></span></button>`).join('')}</div><p id="empty-results" class="empty-results" hidden>这里还没有找到。试试“检索”或“学习方法”。</p><div class="library-footnote">${icon('folder')} PDF / Markdown · 本页为示例资料，未读取本机文件</div></section>`;
  const reader = `<section data-screen="reader" hidden><div class="reader-toolbar"><button class="text-button" data-view="library">${icon('back')} 资料库</button><span id="reader-title">检索增强生成：从原理到实践</span><div class="reader-actions"><button class="text-button" data-action="reading-tone" aria-pressed="false">Aa <span>护眼</span></button><button class="text-button" data-action="assistant" aria-expanded="false">${icon('spark')} 助手</button></div></div><div class="reader-body"><nav class="outline" aria-label="文章目录"><span class="eyebrow">CONTENTS</span><button data-section="article-intro">01　为什么需要 RAG</button><button class="active" data-section="source-quote">02　让回答有据可依</button><button data-section="article-next">03　检索之后呢</button><div class="outline-position">当前示例章节<br><strong>12 <span>/ 36 页</span></strong></div></nav><article class="reading-article" tabindex="-1"><div class="article-meta"><span>第三章 · 阅读示例</span><span>约 5 分钟</span></div><h1>让回答<br>有据可依。</h1><p class="article-lede" id="article-intro">好的回答，不应止于流畅。它还应该让我们知道：这句话，依据什么？</p><div class="article-rule"></div><h2>从“我觉得”到“资料里写着”</h2><p>当我们向模型提问时，一个听起来合理的回答，并不一定来自可靠的资料。检索增强生成（RAG）在问题和回答之间，加上了一次寻找证据的过程。</p><blockquote id="source-quote" tabindex="-1"><span class="quote-number">01 / 原文片段</span>先从资料中检索与问题相关的片段，再将问题与片段一起交给模型。回答中的引用，让读者可以回到原文核对。<small>示例资料 · 第 12 页</small></blockquote><p>我们可以把它想成一次开卷讨论：先翻到相关的几页，再根据这些内容解释，而不是仅凭印象作答。引用不是装饰，而是把结论与证据连接起来的路径。</p><div class="article-pipeline">${pipeline}</div><h2 id="article-next">检索之后，还要追问</h2><p>找到相关内容，只是开始。片段是否完整、结论是否超出证据、哪些部分仍然不确定，都值得继续核对。</p><div class="reading-end"><span>带走一个问题</span><strong>这份证据，真的支持这个结论吗？</strong><button class="text-button" data-action="assistant">和助手一起拆解 ${icon('arrow')}</button></div></article></div></section>`;

  document.getElementById('app').innerHTML =
    `<a class="skip-link" href="#main-content">跳到主要内容</a><header class="design-bar"><a href="../index.html">${icon('back')} 设计总览</a><div class="design-switch" aria-label="切换设计方向">${Object.entries(
      themes,
    )
      .map(
        ([key, s]) =>
          `<a href="../${s.file}/index.html" ${key === theme ? 'aria-current="page"' : ''}>${s.number} ${s.name}</a>`,
      )
      .join(
        '',
      )}</div><span>概念演示 · 全部为示例内容</span></header><div class="desktop-shell">${theme === 'night' ? `<div class="icon-rail"><span class="rail-brand">${icon('leaf')}</span><button data-view="home" aria-label="今日学习">${icon('home')}</button><button data-view="library" aria-label="我的资料">${icon('folder')}</button><button data-view="reader" aria-label="阅读工作台">${icon('book')}</button><span class="rail-bottom">SC</span></div>` : ''}${theme === 'garden' ? `<header class="island-nav">${brand}<nav aria-label="主要导航">${navigation}</nav><div class="island-nav-end"><button class="icon-button" data-action="search" aria-label="搜索资料">${icon('search')}</button><button class="avatar" data-action="profile" aria-label="学习者设置">知</button></div></header>` : sidebar}<div class="workspace"><header class="workspace-bar"><div><span class="breadcrumb">我的空间</span>${icon('chevron')}<strong id="view-label">今日学习</strong></div><span class="workspace-date">2026 年 10 月 17 日 · 星期六</span><button class="icon-button" data-action="search" aria-label="搜索资料">${icon('search')}</button></header><main id="main-content" tabindex="-1"><section data-screen="home">${home()}</section>${library}${reader}</main><footer class="workspace-status"><span><span class="status-dot"></span> 私人空间 · 本地优先</span><span>${current.name} / ${current.english} <span class="status-separator">·</span> 设计概念 0${current.number.slice(-1)}</span></footer></div>${assistant}</div><div class="toast" role="status" aria-live="polite"></div><dialog class="demo-dialog"><form method="dialog"><button class="dialog-close" aria-label="关闭弹窗">×</button><span class="eyebrow">DESIGN PREVIEW</span><h2>这是一次界面预演。</h2><p class="dialog-message"></p><button class="button primary">回到设计 ${icon('arrow')}</button></form></dialog>`;

  let view = 'home';
  let filter = 'all';
  let elapsed = 0;
  let startedAt = null;
  let timerId;
  let toastId;
  const toast = (message) => {
    const node = document.querySelector('.toast');
    node.textContent = message;
    node.classList.add('visible');
    clearTimeout(toastId);
    toastId = setTimeout(() => node.classList.remove('visible'), 3600);
  };
  function setView(next) {
    view = next;
    document.querySelectorAll('[data-screen]').forEach((s) => {
      s.hidden = s.dataset.screen !== next;
    });
    document.querySelectorAll('.nav-item').forEach((n) => {
      n.classList.toggle('active', n.dataset.view === next);
      if (n.dataset.view === next) n.setAttribute('aria-current', 'page');
      else n.removeAttribute('aria-current');
    });
    document.getElementById('view-label').textContent = {
      home: '今日学习',
      library: '我的资料',
      reader: '阅读工作台',
    }[next];
    document.body.dataset.view = next;
    const open =
      next === 'reader'
        ? innerWidth >= 1240
        : theme === 'night' && next === 'home' && innerWidth >= 1240;
    document.body.classList.toggle('assistant-open', open);
    document.querySelector('[data-action="assistant"]').setAttribute('aria-expanded', String(open));
    document.getElementById('main-content').scrollTop = 0;
    document.getElementById('main-content').focus({ preventScroll: true });
  }
  function showDialog(message) {
    document.querySelector('.dialog-message').textContent = message;
    document.querySelector('.demo-dialog').showModal();
  }
  function applyFilter() {
    const query = document.getElementById('library-search').value.trim().toLowerCase();
    let count = 0;
    document.querySelectorAll('.library-card').forEach((card) => {
      card.hidden =
        !(filter === 'all' || card.dataset.kind === filter) ||
        !card.dataset.title.toLowerCase().includes(query);
      if (!card.hidden) count++;
    });
    document.getElementById('empty-results').hidden = count !== 0;
  }
  function updateTime() {
    const total = Math.floor((elapsed + (startedAt === null ? 0 : Date.now() - startedAt)) / 1000);
    const display = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    document.querySelectorAll('[data-time]').forEach((n) => {
      n.textContent = display;
    });
  }
  function toggleAssistant() {
    const open = document.body.classList.toggle('assistant-open');
    document.querySelector('[data-action="assistant"]').setAttribute('aria-expanded', String(open));
  }
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.view) setView(button.dataset.view);
    if (button.dataset.openSource !== undefined) {
      if (button.dataset.openSource === '0') setView('reader');
      else
        showDialog(
          `“${sources[Number(button.dataset.openSource)].title}”用于展示资料卡片。本次仅制作第一份资料的阅读与引用演示。`,
        );
    }
    if (button.dataset.filter) {
      filter = button.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach((n) => {
        n.classList.toggle('active', n === button);
        n.setAttribute('aria-pressed', String(n === button));
      });
      applyFilter();
    }
    if (button.dataset.section) {
      document.getElementById(button.dataset.section).scrollIntoView({ block: 'center' });
      document
        .querySelectorAll('[data-section]')
        .forEach((n) => n.classList.toggle('active', n === button));
    }
    if (button.dataset.prompt) {
      document.getElementById('question').value = button.dataset.prompt;
      document.getElementById('question').focus();
    }
    const action = button.dataset.action;
    if (action === 'search' || action === 'topic-ai' || action === 'topic-study') {
      setView('library');
      const input = document.getElementById('library-search');
      input.value = action === 'topic-ai' ? '人工智能' : action === 'topic-study' ? '学习方法' : '';
      applyFilter();
      input.focus();
    }
    if (action === 'checkin') {
      button.innerHTML = `${icon('check')}<span>今天的到来，已记录</span>`;
      button.disabled = true;
      button.closest('aside, .home-aside').querySelector('.today').classList.add('checked');
      toast('示例签到已更新 · 刷新后重置');
    }
    if (action === 'timer') {
      if (startedAt === null) {
        startedAt = Date.now();
        timerId = setInterval(updateTime, 500);
      } else {
        elapsed += Date.now() - startedAt;
        startedAt = null;
        clearInterval(timerId);
      }
      document.querySelectorAll('.timer-toggle').forEach((n) => {
        n.innerHTML = `${icon(startedAt === null ? 'play' : 'pause')}<span>${startedAt === null ? '继续计时' : '暂停计时'}</span>`;
        n.setAttribute('aria-pressed', String(startedAt !== null));
      });
      updateTime();
    }
    if (action === 'import')
      showDialog(
        '正式软件会在这里打开本机文件选择器，导入 PDF 或 Markdown。此设计 demo 不访问文件，也不保存数据。',
      );
    if (action === 'profile')
      showDialog(
        '这里预留昵称、回应风格和模型设置入口。正式接入时沿用现有设置页与桌面接口；此处只展示视觉方向。',
      );
    if (action === 'assistant') toggleAssistant();
    if (action === 'reading-tone') {
      const enabled = document.body.classList.toggle('reading-soft');
      button.setAttribute('aria-pressed', String(enabled));
      toast(enabled ? '已切换为柔和阅读底色' : '已恢复当前风格的阅读底色');
    }
    if (action === 'citation') {
      setView('reader');
      const quote = document.getElementById('source-quote');
      quote.scrollIntoView({ block: 'center' });
      quote.classList.remove('citation-highlight');
      requestAnimationFrame(() => quote.classList.add('citation-highlight'));
      quote.focus({ preventScroll: true });
      toast('已定位到第 12 页的示例原文');
    }
  });
  document.getElementById('library-search').addEventListener('input', applyFilter);
  document.querySelector('.ask-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!document.getElementById('question').value.trim()) {
      document.getElementById('question').focus();
      return;
    }
    toast('这是静态问答示例；未调用模型。可点击引用 [1] 查看原文定位。');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.classList.contains('assistant-open'))
      toggleAssistant();
    if (
      event.key === '/' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !/INPUT|TEXTAREA/.test(document.activeElement.tagName) &&
      !document.querySelector('dialog[open]')
    ) {
      event.preventDefault();
      setView('library');
      document.getElementById('library-search').focus();
    }
  });
  setView(view);
})();
