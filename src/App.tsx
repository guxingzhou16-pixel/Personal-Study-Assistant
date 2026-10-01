import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  FileText,
  FolderOpen,
  Home,
  Leaf,
  LoaderCircle,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  NotebookPen,
} from 'lucide-react';
import { SettingsPage } from './components/SettingsPage';
import { StudyCalendar } from './components/StudyCalendar';
import { desktop, errorMessage, isDesktop } from './lib/desktop';
import { defaultSettings, type Bootstrap, type Settings } from './lib/types';

type Page = 'home' | 'library' | 'settings';
const pageLabels: Record<Page, string> = { home: '学习首页', library: '资料库', settings: '设置' };

export default function App() {
  const mainRef = useRef<HTMLElement>(null);
  const [page, setPage] = useState<Page>('home');
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [page]);
  useEffect(() => {
    let cancelled = false;
    setFailure(null);
    const loading = isDesktop
      ? desktop.bootstrap()
      : Promise.resolve({
          settings: structuredClone(defaultSettings),
          dataDir: '',
          schemaVersion: 0,
          hasApiKey: false,
        });
    void loading
      .then((data) => {
        if (!cancelled) setBoot(data);
      })
      .catch((error) => {
        if (!cancelled) setFailure(errorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function onSaved(settings: Settings, hasApiKey: boolean) {
    setBoot((previous) => (previous ? { ...previous, settings, hasApiKey } : previous));
  }

  const settings = boot?.settings ?? defaultSettings;
  const date = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());
  const encouragement = {
    gentle: '不用一次学会所有事，今天读懂一小段就很好。',
    game: '每读懂一个概念，都是一次升级。准备好开启第一关了吗？',
    coach: '选一份资料，确定一个问题，再用自己的话写出答案。',
  }[settings.responseStyle];

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <BookOpen size={22} />
          </div>
          <div>
            <strong>拾知</strong>
            <span>私人学习助手</span>
          </div>
        </div>
        <p className="nav-caption">我的学习空间</p>
        <nav aria-label="主导航">
          {[
            { id: 'home' as const, icon: Home },
            { id: 'library' as const, icon: FolderOpen },
          ].map(({ id, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? 'selected' : ''}`}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => setPage(id)}
            >
              <Icon size={18} />
              {pageLabels[id]}
              {page === id && <span className="nav-dot" />}
            </button>
          ))}
          <div className="nav-divider" />
          {[
            { title: '学习笔记', icon: NotebookPen },
            { title: '计划与打卡', icon: Target },
            { title: '专注时光', icon: Timer },
          ].map(({ title, icon: Icon }) => (
            <button key={title} className="nav-item" disabled>
              <Icon size={18} />
              {title}
              <span className="planned-tag">规划中</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-caption">
            <ShieldCheck size={16} />
            <div>
              <strong>{isDesktop ? '本地学习空间' : '界面预览'}</strong>
              <p>{isDesktop ? '你的进步，留在你身边' : '本地保存需启动桌面版'}</p>
            </div>
          </div>
          <button
            className={`nav-item ${page === 'settings' ? 'selected' : ''}`}
            onClick={() => setPage('settings')}
            aria-current={page === 'settings' ? 'page' : undefined}
          >
            <SettingsIcon size={18} />
            设置
          </button>
          <div className="sidebar-version">
            <span>STUDY COMPANION</span>
            <span>v0.1.0</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            我的空间
            <ChevronRight size={14} />
            <span>{pageLabels[page]}</span>
          </div>
          <span className="date">{date}</span>
        </header>
        <main id="main-content" ref={mainRef} tabIndex={-1}>
          {!boot && !failure && (
            <div className="center-state" role="status">
              <LoaderCircle className="spin" size={26} />
              <h2>正在打开你的学习空间…</h2>
            </div>
          )}
          {failure && (
            <div className="center-state" role="alert">
              <CircleHelp size={32} />
              <h2>暂时无法打开学习空间</h2>
              <p>{failure}</p>
              <button className="button primary" onClick={() => setAttempt(attempt + 1)}>
                重试
              </button>
            </div>
          )}
          {boot && !failure && page === 'home' && (
            <div className="page home-page">
              <div className="page-heading">
                <div>
                  <p className="eyebrow">A LITTLE KNOWLEDGE, EVERY DAY</p>
                  <h1>{settings.displayName ? `${settings.displayName}，` : ''}开始今天的小进步</h1>
                  <p className="muted">给自己留一点时间，把好奇变成理解。</p>
                </div>
                <span className="status-pill">
                  <span />
                  刚刚启程
                </span>
              </div>
              <section className="welcome-panel" aria-labelledby="welcome-title">
                <div>
                  <span className="small-label">
                    <Leaf size={15} />
                    从这里开始
                  </span>
                  <h2 id="welcome-title">
                    把一份资料，
                    <br />
                    变成自己的知识。
                  </h2>
                  <p>
                    安静地阅读，带着问题思考。
                    <br />
                    你的学习空间已经准备好了。
                  </p>
                  <button className="button primary" onClick={() => setPage('library')}>
                    打开我的资料库
                    <ArrowRight size={16} />
                  </button>
                </div>
                <div className="book-illustration" aria-hidden="true">
                  <div className="book-back" />
                  <div className="book-front">
                    <BookOpen size={62} strokeWidth={1} />
                    <span>
                      KEEP
                      <br />
                      LEARNING.
                    </span>
                    <div className="book-line" />
                  </div>
                  <span className="book-spark">
                    <Sparkles size={22} strokeWidth={1.5} />
                  </span>
                  <span className="book-leaf">
                    <Leaf size={26} strokeWidth={1.3} />
                  </span>
                </div>
              </section>
              <div className="home-columns">
                <section className="recent-section">
                  <div className="section-heading">
                    <h2>最近阅读</h2>
                    <button className="text-button" onClick={() => setPage('library')}>
                      查看资料库
                      <ArrowRight size={14} />
                    </button>
                  </div>
                  <div className="empty-reading">
                    <FolderOpen size={30} strokeWidth={1.4} />
                    <h3>还没有阅读中的资料</h3>
                    <p>资料导入与阅读器正在下一阶段开发。</p>
                    <span>首版支持 PDF 和 Markdown</span>
                  </div>
                </section>
                <StudyCalendar
                  dailyGoalMinutes={settings.dailyGoalMinutes}
                  encouragement={encouragement}
                />
              </div>
              <div className="journey">
                <span className="small-label">让学习留下痕迹</span>
                <ol>
                  {['读一段资料', '问一个问题', '写下自己的理解', '回看今天的收获'].map(
                    (step, index) => (
                      <li key={step}>
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        {step}
                      </li>
                    ),
                  )}
                </ol>
              </div>
            </div>
          )}
          {boot && !failure && page === 'library' && (
            <div className="page">
              <div className="page-heading">
                <div>
                  <p className="eyebrow">A PLACE FOR YOUR CURIOSITY</p>
                  <h1>我的资料库</h1>
                  <p className="muted">把想读懂的资料放在一起，慢慢建立自己的知识。</p>
                </div>
                <span className="version-label">导入与阅读 · 规划中</span>
              </div>
              <section className="library-empty">
                <div className="library-symbol">
                  <BookOpen size={38} strokeWidth={1.3} />
                </div>
                <h2>第一份资料，值得一个安静的位置</h2>
                <p>资料导入和阅读器将在下一阶段开放。</p>
                <div className="format-tags">
                  <span>
                    <FileText size={15} />
                    PDF 原页阅读
                  </span>
                  <span>
                    <FileText size={15} />
                    Markdown 舒适排版
                  </span>
                </div>
                <button className="button secondary" disabled>
                  导入资料（规划中）
                </button>
                <p className="field-hint">导入后，原文件将复制到本机学习空间。</p>
              </section>
              <div className="library-note">
                <ShieldCheck size={18} />
                <p>阅读和保存资料在本机进行。使用云端 AI 时，会明确提示资料发送给所选服务。</p>
              </div>
            </div>
          )}
          {boot && !failure && page === 'settings' && (
            <SettingsPage boot={boot} onSaved={onSaved} />
          )}
        </main>
        <footer className="app-footer">
          <span>
            <Check size={13} />
            慢慢学，也是在向前走
          </span>
          <span>属于你的学习空间</span>
        </footer>
      </div>
    </div>
  );
}
