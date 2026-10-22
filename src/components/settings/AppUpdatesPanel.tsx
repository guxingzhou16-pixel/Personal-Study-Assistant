import { useEffect, useRef, useState } from 'react';
import { ExternalLink, LoaderCircle, RefreshCw } from 'lucide-react';
import { desktop, errorMessage, isDesktop } from '../../lib/desktop';
import type { AppUpdateReport, AppVersionInfo } from '../../lib/types';
import './AppUpdatesPanel.css';

const labels: Record<AppUpdateReport['status'], string> = {
  available: '发现新版本',
  current: '当前已是最新发布版本',
  ahead: '当前版本高于已发布版本',
  development: '版本号与发行版相同',
  'no-release': '暂无可用的 Windows 安装包',
};

export function AppUpdatesPanel() {
  const [current, setCurrent] = useState<AppVersionInfo | null>(null);
  const [report, setReport] = useState<AppUpdateReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(false);
  const sequence = useRef(0);
  const working = useRef(false);

  async function check(force: boolean) {
    if (!isDesktop || working.current) return;
    const request = ++sequence.current;
    working.current = true;
    setBusy(true);
    setError('');
    try {
      const value = await desktop.checkAppUpdate(force);
      if (mounted.current && sequence.current === request) {
        setCurrent(value.current);
        setReport(value);
      }
    } catch (reason) {
      if (mounted.current && sequence.current === request) setError(errorMessage(reason));
    } finally {
      if (mounted.current && sequence.current === request) {
        working.current = false;
        setBusy(false);
      }
    }
  }

  useEffect(() => {
    if (!isDesktop) return;
    mounted.current = true;
    let cancelled = false;
    void desktop.getAppVersion().then(
      (value) => {
        if (!cancelled) setCurrent(value);
      },
      (reason) => {
        if (!cancelled) setError(errorMessage(reason));
      },
    );
    void check(false);
    return () => {
      cancelled = true;
      mounted.current = false;
      sequence.current++;
      working.current = false;
    };
  }, []);

  async function open(target: 'latest' | 'history') {
    if (working.current) return;
    const request = ++sequence.current;
    working.current = true;
    setBusy(true);
    setError('');
    try {
      await desktop.openAppUpdate(target);
    } catch (reason) {
      if (mounted.current && sequence.current === request) setError(errorMessage(reason));
    } finally {
      if (mounted.current && sequence.current === request) {
        working.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <section className="settings-section app-updates" aria-labelledby="app-updates-heading">
      <h2 id="app-updates-heading">软件更新</h2>
      <p>
        当前版本：{current ? `v${current.version}` : '读取中…'}
        {current &&
          (current.packaged ? ' · 已安装应用' : ' · 本地开发运行（源码可能包含未发布修改）')}
      </p>
      <p className="field-hint">
        打开此页时向 GitHub 匿名检查发布信息，成功结果保留 5 分钟。不会发送学习资料或模型密钥。
      </p>
      <p role="status" aria-live="polite">
        {busy
          ? '正在处理…'
          : report
            ? labels[report.status]
            : isDesktop
              ? '尚未取得发布信息'
              : '请在桌面应用中检查更新'}
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {report && (
        <div className="app-update-release">
          {report.release && (
            <>
              <h3>{report.release.name || `拾知 v${report.release.version}`}</h3>
              <p className="field-hint">
                安装包 v{report.release.version}
                {report.release.prerelease ? ' · 预览版' : ''}
                {' · '}
                {new Date(report.release.publishedAt).toLocaleDateString('zh-CN')}
              </p>
              <div className="app-update-notes" tabIndex={0} aria-label="本次更新内容">
                {report.release.notes || '本版本未提供更新说明，请查看官方发布记录。'}
              </div>
            </>
          )}
          <p className="field-hint">
            上次成功检查：{new Date(report.checkedAt).toLocaleString('zh-CN')}
            {error && '（本次操作失败，以上仍为上次取得的信息）'}
          </p>
        </div>
      )}
      <div className="app-update-actions">
        <button
          className="button secondary"
          type="button"
          disabled={!isDesktop || busy}
          onClick={() => void check(true)}
        >
          {busy ? <LoaderCircle size={16} className="spin" /> : <RefreshCw size={16} />}
          检查更新
        </button>
        {report?.status === 'available' && (
          <button
            className="button primary"
            type="button"
            disabled={busy}
            onClick={() => void open('latest')}
          >
            <ExternalLink size={16} />
            升级最新版
          </button>
        )}
        <button
          className="button secondary"
          type="button"
          disabled={!isDesktop || busy}
          onClick={() => void open('history')}
        >
          查看发布记录
        </button>
      </div>
      <p className="field-hint">
        升级将在浏览器打开官方发布页。下载 Windows
        安装包后，保存学习内容并关闭拾知，再运行安装程序。当前发行包未签名，安装时可能出现 Windows
        提示。
      </p>
    </section>
  );
}
