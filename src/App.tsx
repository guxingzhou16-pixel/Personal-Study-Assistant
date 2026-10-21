import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CircleHelp,
  FolderOpen,
  Home,
  LoaderCircle,
  Settings as SettingsIcon,
  ShieldCheck,
  Sun,
  Target,
  Timer,
  NotebookPen,
  MessageCircle,
} from 'lucide-react';
import { SettingsPage } from './components/SettingsPage';
import { LibraryPage } from './components/LibraryPage';
import { ReadingPage } from './components/ReadingPage';
import { RecentReadings } from './components/RecentReadings';
import { StudyCalendar } from './components/StudyCalendar';
import { ChatPage } from './components/ChatPage';
import { desktop, errorMessage, isDesktop } from './lib/desktop';
import { defaultSettings, type Bootstrap, type Settings, type CitationTarget } from './lib/types';
import sunnyPlant from './assets/sunny-isle-plant.svg';
import { mountMotion } from './lib/motion';

type Page = 'home' | 'library' | 'chat' | 'settings';
const pageLabels: Record<Page, string> = {
  home: '学习首页',
  library: '资料库',
  chat: '学习助手',
  settings: '设置',
};

export default function App() {
  const shellRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [page, setPage] = useState<Page>('home');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [citationTarget, setCitationTarget] = useState<CitationTarget | null>(null);
  const [readerReturn, setReaderReturn] = useState<'library' | 'chat'>('library');
  const [questionSource, setQuestionSource] = useState<{ id: string; sequence: number } | null>(
    null,
  );
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useLayoutEffect(() => {
    const motion = mountMotion(shellRef.current!);
    return motion.dispose;
  }, []);
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
  function navigate(next: Page) {
    const order: Page[] = ['home', 'library', 'chat', 'settings'];
    shellRef.current!.dataset.motionDirection =
      sourceId || order.indexOf(next) < order.indexOf(page) ? 'back' : 'forward';
    setSourceId(null);
    setCitationTarget(null);
    setPage(next);
  }
  function openSource(id: string) {
    shellRef.current!.dataset.motionDirection = 'forward';
    setCitationTarget(null);
    setReaderReturn('library');
    setSourceId(id);
    setPage('library');
  }
  async function openCitation(turnId: string, number: number) {
    const target = await desktop.resolveCitation(turnId, number);
    shellRef.current!.dataset.motionDirection = 'forward';
    setCitationTarget(target);
    setSourceId(target.sourceId);
    setReaderReturn('chat');
    setPage('library');
  }
  function askSource() {
    if (!sourceId) return;
    setQuestionSource((previous) => ({ id: sourceId, sequence: (previous?.sequence ?? 0) + 1 }));
    navigate('chat');
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
    <div className="app-shell" ref={shellRef}>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <header className="app-header">
        <button className="brand" onClick={() => navigate('home')} aria-label="拾知，返回学习首页">
          <span className="brand-mark" aria-hidden="true">
            <Sun size={24} strokeWidth={1.5} />
          </span>
          <span className="brand-name">
            <strong>拾知</strong>
            <small>STUDY COMPANION</small>
          </span>
        </button>
        <nav className="app-nav" aria-label="主导航">
          <span className="nav-indicator" aria-hidden="true" />
          {[
            { id: 'home' as const, icon: Home },
            { id: 'library' as const, icon: FolderOpen },
            { id: 'chat' as const, icon: MessageCircle },
          ].map(({ id, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? 'selected' : ''}`}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={18} />
              {pageLabels[id]}
            </button>
          ))}
        </nav>
        <div className="header-tools">
          <button
            className={`profile-button ${page === 'settings' ? 'selected' : ''}`}
            onClick={() => navigate('settings')}
            aria-current={page === 'settings' ? 'page' : undefined}
            aria-label="设置"
            title="设置"
          >
            <span className="profile-avatar" aria-hidden="true">
              {Array.from(settings.displayName.trim())[0] ?? '知'}
            </span>
            <SettingsIcon size={18} />
          </button>
        </div>
      </header>
      <div className="main-shell">
        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className={sourceId ? 'reader-main' : page === 'chat' ? 'chat-main' : undefined}
        >
          {!boot && !failure && (
            <div className="center-state" role="status" data-motion="fade">
              <LoaderCircle className="spin" size={26} />
              <h2>正在打开你的学习空间…</h2>
            </div>
          )}
          {failure && (
            <div className="center-state" role="alert" data-motion="fade">
              <CircleHelp size={32} />
              <h2>暂时无法打开学习空间</h2>
              <p>{failure}</p>
              <button className="button primary" onClick={() => setAttempt(attempt + 1)}>
                重试
              </button>
            </div>
          )}
          {boot && !failure && page === 'home' && (
            <div className="page home-page" data-motion="page">
              <section
                className="welcome-panel"
                aria-labelledby="welcome-title"
                data-motion="reveal"
              >
                <div className="welcome-copy">
                  <p className="eyebrow">YOUR OWN LITTLE LEARNING ISLAND</p>
                  <h1 id="welcome-title">
                    今天，也长出
                    <br />
                    一点新想法
                    <span className="heading-spark" aria-hidden="true">
                      ✳
                    </span>
                  </h1>
                  <p className="home-greeting">
                    {settings.displayName
                      ? `${settings.displayName}，欢迎回来。`
                      : '欢迎回到你的学习小岛。'}
                  </p>
                  <p>
                    不用一下子读完整个世界。
                    <br />
                    从感兴趣的一页开始，就很好。
                  </p>
                  <button className="button primary" onClick={() => navigate('library')}>
                    打开我的资料库
                    <ArrowRight size={16} />
                  </button>
                </div>
                <img className="plant-illustration" src={sunnyPlant} alt="" aria-hidden="true" />
                <span className="greeting-sticker" aria-hidden="true">
                  保持好奇<small>STAY CURIOUS :)</small>
                </span>
              </section>
              <div className="home-columns">
                <section className="recent-section" data-motion="reveal" data-motion-delay="40">
                  <div className="section-heading">
                    <h2>
                      还想接着读 <BookOpen size={17} aria-hidden="true" />
                    </h2>
                    <button className="text-button" onClick={() => navigate('library')}>
                      查看资料库
                      <ArrowRight size={14} />
                    </button>
                  </div>
                  <RecentReadings onOpen={openSource} />
                  <section className="planned-section" aria-labelledby="planned-heading">
                    <div className="section-heading">
                      <h2 id="planned-heading">留给以后的好点子</h2>
                    </div>
                    <div className="planned-tools">
                      {[
                        { title: '学习笔记', icon: NotebookPen },
                        { title: '学习计划', icon: Target },
                        { title: '番茄专注', icon: Timer },
                      ].map(({ title, icon: Icon }) => (
                        <button key={title} disabled>
                          <Icon size={18} aria-hidden="true" />
                          <span>{title}</span>
                          <span className="planned-tag">规划中</span>
                        </button>
                      ))}
                    </div>
                  </section>
                </section>
                <StudyCalendar
                  dailyGoalMinutes={settings.dailyGoalMinutes}
                  encouragement={encouragement}
                />
              </div>
            </div>
          )}
          {boot && !failure && page === 'library' && !sourceId && (
            <LibraryPage onOpen={openSource} />
          )}
          {boot && !failure && sourceId && (
            <ReadingPage
              key={`${sourceId}:${citationTarget?.anchor ?? ''}`}
              id={sourceId}
              target={citationTarget ?? undefined}
              onBack={() => navigate(readerReturn)}
              backLabel={readerReturn === 'chat' ? '返回问答' : '返回资料库'}
              onAsk={askSource}
            />
          )}
          {boot && !failure && page === 'settings' && (
            <SettingsPage boot={boot} onSaved={onSaved} />
          )}
          {boot && !failure && (
            <div className="chat-container" hidden={page !== 'chat'} data-motion="page">
              <ChatPage
                settings={settings}
                onSettings={() => navigate('settings')}
                visible={page === 'chat'}
                presetSource={questionSource}
                onOpenCitation={openCitation}
              />
            </div>
          )}
        </main>
        <footer className="app-footer">
          <span>
            <ShieldCheck size={14} aria-hidden="true" />
            {isDesktop ? '本地学习空间' : '界面预览 · 本地保存需启动桌面版'}
          </span>
          <span className="footer-date">{date}</span>
        </footer>
      </div>
    </div>
  );
}
