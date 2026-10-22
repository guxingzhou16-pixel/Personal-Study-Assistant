import { useEffect, useState } from 'react';
import {
  Check,
  Cloud,
  HardDrive,
  KeyRound,
  LoaderCircle,
  PlugZap,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { desktop, errorMessage, isDesktop, sameEndpoint } from '../../lib/desktop';
import type { Bootstrap, ConnectionReport, Provider, Settings } from '../../lib/types';
import { themeOptions } from '../../lib/themes';
import { EmbeddingSettings } from './EmbeddingSettings';
import { ModelHealthPanel } from './ModelHealthPanel';
import '../home/FirstUseGuide.css';

interface Props {
  boot: Bootstrap;
  onSaved: (settings: Settings, keyStored: boolean) => void;
}

export function SettingsPage({ boot, onSaved }: Props) {
  const [draft, setDraft] = useState<Settings>(structuredClone(boot.settings));
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(boot.hasApiKey);
  const [keyEndpoint, setKeyEndpoint] = useState(boot.settings.openai.baseUrl);
  const [busy, setBusy] = useState<'save' | 'connect' | 'delete' | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [report, setReport] = useState<ConnectionReport | null>(null);
  const profile = draft[draft.provider];
  const keyStoredHere = hasKey && sameEndpoint(draft.openai.baseUrl, keyEndpoint);

  useEffect(() => {
    if (!isDesktop || draft.provider !== 'openai' || busy !== null) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      try {
        new URL(draft.openai.baseUrl);
      } catch {
        return;
      }
      void desktop
        .hasApiKey(draft.openai.baseUrl)
        .then((stored) => {
          if (!cancelled) {
            setHasKey(stored);
            setKeyEndpoint(draft.openai.baseUrl);
          }
        })
        .catch((error) => {
          if (!cancelled) setNotice({ kind: 'error', text: errorMessage(error) });
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft.openai.baseUrl, draft.provider, busy]);

  function updateProfile(field: 'baseUrl' | 'model', value: string) {
    setDraft((previous) => ({
      ...previous,
      [previous.provider]: { ...previous[previous.provider], [field]: value },
    }));
    setReport(null);
    setNotice(null);
    if (field === 'baseUrl') setApiKey('');
  }

  function selectProvider(provider: Provider) {
    setDraft((previous) => ({ ...previous, provider }));
    setApiKey('');
    setReport(null);
    setNotice(null);
  }

  async function save() {
    setBusy('save');
    setNotice(null);
    let preferencesSaved: Settings | undefined;
    try {
      const saved = await desktop.saveSettings(draft);
      preferencesSaved = saved;
      setDraft(saved);
      let stored = hasKey && sameEndpoint(saved.openai.baseUrl, keyEndpoint);
      if (saved.provider === 'openai' && apiKey.trim()) {
        await desktop.storeApiKey(saved.openai.baseUrl, apiKey);
        setKeyEndpoint(saved.openai.baseUrl);
        setHasKey(true);
        stored = true;
        setApiKey('');
      }
      onSaved(saved, stored);
      setNotice({ kind: 'success', text: '已保存。下次打开应用时会恢复这些设置。' });
    } catch (error) {
      if (preferencesSaved) onSaved(preferencesSaved, keyStoredHere);
      setNotice({
        kind: 'error',
        text: `${preferencesSaved ? '偏好已保存，密钥保存失败：' : ''}${errorMessage(error)}`,
      });
    } finally {
      setBusy(null);
    }
  }

  async function checkConnection() {
    setBusy('connect');
    setNotice(null);
    setReport(null);
    try {
      setReport(await desktop.checkConnection(draft.provider, profile, apiKey));
    } catch (error) {
      setNotice({ kind: 'error', text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function deleteKey() {
    setBusy('delete');
    setNotice(null);
    try {
      await desktop.removeApiKey(draft.openai.baseUrl);
      setHasKey(false);
      setApiKey('');
      onSaved(boot.settings, false);
      setNotice({ kind: 'success', text: '已删除此地址保存的密钥密文。' });
    } catch (error) {
      setNotice({ kind: 'error', text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page settings-page" data-motion="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR OWN PACE</p>
          <h1>让助手更懂你的节奏</h1>
          <p className="muted">从一个合适的目标，和你习惯的学习方式开始。</p>
        </div>
        <span className="version-label">设置</span>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy !== null} className="settings-fields">
          <section className="settings-section" aria-labelledby="preferences-heading">
            <div className="section-heading">
              <h2 id="preferences-heading">学习偏好</h2>
              <span>保存在本机</span>
            </div>
            <div className="form-grid">
              <label>
                怎么称呼你
                <input
                  name="displayName"
                  maxLength={40}
                  placeholder="你的昵称（选填）"
                  value={draft.displayName}
                  onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}
                />
              </label>
              <label>
                每日学习目标 <span className="label-detail">分钟</span>
                <input
                  name="dailyGoalMinutes"
                  type="number"
                  min={10}
                  max={480}
                  required
                  value={draft.dailyGoalMinutes}
                  onChange={(event) =>
                    setDraft({ ...draft, dailyGoalMinutes: Number(event.target.value) })
                  }
                />
              </label>
            </div>
            <label className="full-label">
              助手回应风格
              <select
                name="responseStyle"
                value={draft.responseStyle}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    responseStyle: event.target.value as Settings['responseStyle'],
                  })
                }
              >
                <option value="gentle">温柔陪伴 · 一起慢慢来</option>
                <option value="game">游戏化成长 · 看见每一点进步</option>
                <option value="coach">高效教练 · 目标明确，反馈直接</option>
              </select>
            </label>
            <p className="field-hint">保存后用于学习助手的新回答，实际表达由所选模型决定。</p>
            <fieldset className="theme-options" aria-describedby="theme-hint">
              <legend>界面主题</legend>
              <div className="theme-grid">
                {themeOptions.map((theme) => (
                  <label
                    className={`theme-option ${draft.theme === theme.id ? 'selected' : ''}`}
                    key={theme.id}
                  >
                    <input
                      type="radio"
                      name="theme"
                      value={theme.id}
                      checked={draft.theme === theme.id}
                      onChange={() => {
                        setDraft((previous) => ({ ...previous, theme: theme.id }));
                        setNotice(null);
                      }}
                    />
                    <span className="theme-swatch" data-theme={theme.id} aria-hidden="true" />
                    <span className="theme-option-text">
                      <strong>{theme.name}</strong>
                      <small>{theme.description}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="field-hint" id="theme-hint">
              点击“保存设置”后应用主题。界面主题与助手回应风格分别选择，阅读护眼仍在阅读器中设置。
            </p>
          </section>
          <section
            className="settings-section"
            aria-labelledby="models-heading"
            data-motion="fade"
            data-motion-key={draft.provider}
          >
            <div className="section-heading">
              <h2 id="models-heading">模型连接</h2>
              <span>使用你自己的模型</span>
            </div>
            <div className="provider-switch" role="group" aria-label="选择模型服务">
              <button
                type="button"
                className={draft.provider === 'ollama' ? 'provider active' : 'provider'}
                aria-pressed={draft.provider === 'ollama'}
                onClick={() => selectProvider('ollama')}
              >
                <HardDrive size={19} />
                <span>
                  <strong>本地 Ollama</strong>
                  <small>资料留在本机服务</small>
                </span>
                {draft.provider === 'ollama' && <Check size={17} />}
              </button>
              <button
                type="button"
                className={draft.provider === 'openai' ? 'provider active' : 'provider'}
                aria-pressed={draft.provider === 'openai'}
                onClick={() => selectProvider('openai')}
              >
                <Cloud size={19} />
                <span>
                  <strong>兼容 OpenAI 的接口</strong>
                  <small>按服务商规则处理资料</small>
                </span>
                {draft.provider === 'openai' && <Check size={17} />}
              </button>
            </div>
            <label className="full-label">
              服务基础地址
              <input
                name="baseUrl"
                type="url"
                required
                spellCheck={false}
                autoCapitalize="none"
                value={profile.baseUrl}
                onChange={(event) => updateProfile('baseUrl', event.target.value)}
              />
            </label>
            <p className="field-hint">
              {draft.provider === 'ollama'
                ? '先启动 Ollama。默认地址为 http://127.0.0.1:11434。'
                : '填写服务商的基础地址，通常以 /v1 结尾。远程服务使用 HTTPS。'}
            </p>
            {draft.provider === 'openai' && (
              <>
                <label className="full-label">
                  API 密钥 <span className="label-detail">可选；按服务商要求填写</span>
                  <input
                    name="apiKey"
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder={
                      keyStoredHere
                        ? '此地址已有安全保存的密钥；留空即可继续使用'
                        : '使用 Windows 系统加密保存'
                    }
                  />
                </label>
                <div className="credential-info">
                  <KeyRound size={14} />
                  <span>{keyStoredHere ? '此地址已有保存的密钥' : '此地址未保存密钥'}</span>
                  {keyStoredHere && (
                    <button
                      type="button"
                      className="text-button danger"
                      disabled={!isDesktop}
                      onClick={() => void deleteKey()}
                    >
                      <Trash2 size={13} />
                      删除密钥
                    </button>
                  )}
                </div>
              </>
            )}
            <label className="full-label">
              模型名称
              <input
                name="model"
                list="available-models"
                maxLength={200}
                spellCheck={false}
                value={profile.model}
                placeholder="检测连接后，从返回的列表选择"
                onChange={(event) => updateProfile('model', event.target.value)}
              />
              <datalist id="available-models">
                {report?.models.map((model) => (
                  <option value={model} key={model} />
                ))}
              </datalist>
            </label>
            {report && (
              <div
                className={`notice ${report.selectedModelAvailable ? 'success' : 'info'}`}
                role="status"
                data-motion="fade"
                data-motion-key={report.message}
              >
                <PlugZap size={17} />
                <div>
                  <p>{report.message}</p>
                  {report.models.length > 0 && (
                    <select
                      aria-label="可用模型"
                      value={
                        profile.model && report.models.includes(profile.model) ? profile.model : ''
                      }
                      onChange={(event) =>
                        setDraft((previous) => ({
                          ...previous,
                          [previous.provider]: {
                            ...previous[previous.provider],
                            model: event.target.value,
                          },
                        }))
                      }
                    >
                      <option value="" disabled>
                        选择已发现的模型
                      </option>
                      {report.models.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}
            <div className="connection-footer">
              <button
                type="button"
                className="button secondary"
                disabled={!isDesktop}
                onClick={() => void checkConnection()}
              >
                {busy === 'connect' ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <PlugZap size={16} />
                )}
                {busy === 'connect' ? '正在检测…' : '检测连接'}
              </button>
              <p className="field-hint">只检查服务与模型列表，不发送学习资料、不生成回答。</p>
            </div>
          </section>
          {notice && (
            <div
              className={`notice ${notice.kind}`}
              role={notice.kind === 'error' ? 'alert' : 'status'}
              data-motion="fade"
              data-motion-key={notice.text}
            >
              {notice.text}
            </div>
          )}
          <div className="settings-actions">
            <p>
              <ShieldCheck size={16} />
              密钥不写入学习数据库
            </p>
            <button className="button primary" type="submit" disabled={!isDesktop}>
              {busy === 'save' ? <LoaderCircle size={17} className="spin" /> : <Save size={17} />}
              {busy === 'save' ? '正在保存…' : '保存设置'}
            </button>
          </div>
        </fieldset>
      </form>
      <EmbeddingSettings />
      <ModelHealthPanel settings={boot.settings} />
      <div className="storage-details">
        <h3>
          <HardDrive size={15} />
          本地数据
        </h3>
        <p>
          {isDesktop ? boot.dataDir : '浏览器为界面预览。请在桌面应用中保存设置和检查模型连接。'}
        </p>
        {isDesktop && <small>数据库版本 {boot.schemaVersion} · 资料与学习记录将保存在此目录</small>}
      </div>
    </div>
  );
}
