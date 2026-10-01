import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, safeStorage } from 'electron';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Credentials } from './core/credentials';
import { AppError, failure } from './core/errors';
import { checkConnection } from './core/models';
import { Storage } from './core/storage';
import { Documents } from './core/documents';
import { string, validateProfile, validateProvider } from './core/settings';

app.setName('StudyCompanion');
const testDataDir = !app.isPackaged ? process.env.STUDY_COMPANION_DATA_DIR : undefined;
const dataDir = testDataDir ? resolve(testDataDir) : join(app.getPath('appData'), 'StudyCompanion');
let startupError: AppError | undefined;
try {
  mkdirSync(dataDir, { recursive: true });
  app.setPath('userData', dataDir);
} catch {
  startupError = new AppError('startup', '无法创建本地数据目录，请检查目录权限和磁盘空间。');
}
const devUrl =
  !app.isPackaged && process.env.STUDY_COMPANION_DEV_URL === 'http://127.0.0.1:1420'
    ? process.env.STUDY_COMPANION_DEV_URL
    : undefined;
const rendererPath = join(__dirname, '../dist/index.html');
const rendererUrl = devUrl ? new URL(devUrl).href : pathToFileURL(rendererPath).href;
let window: BrowserWindow | null = null;
let storage: Storage | undefined;
let documents: Documents | undefined;

function isRendererUrl(url: string | undefined): boolean {
  return url?.split('#', 1)[0] === rendererUrl;
}

function registerHandlers(database: Storage, credentials: Credentials) {
  const files = new Documents(
    database,
    join(dataDir, 'sources'),
    join(__dirname, 'document-worker.mjs'),
  );
  documents = files;
  function handle(channel: string, work: (...args: unknown[]) => unknown) {
    ipcMain.handle(channel, async (event, ...args: unknown[]) => {
      const frameUrl = event.senderFrame?.url;
      if (
        !window ||
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        !isRendererUrl(frameUrl)
      ) {
        return {
          ok: false,
          error: { code: 'permission', message: '此页面无权访问本地学习数据。' },
        };
      }
      try {
        return { ok: true, value: await work(...args) };
      } catch (error) {
        return { ok: false, error: failure(error) };
      }
    });
  }
  handle('study:bootstrap', () => {
    const settings = database.loadSettings();
    return {
      settings,
      dataDir,
      schemaVersion: database.schemaVersion,
      hasApiKey: credentials.has(settings.openai.baseUrl),
    };
  });
  handle('study:save-settings', (settings) => database.saveSettings(settings));
  handle('study:store-key', (endpoint, key) => credentials.store(endpoint, key));
  handle('study:remove-key', (endpoint) => credentials.remove(endpoint));
  handle('study:has-key', (endpoint) => credentials.has(endpoint));
  handle('study:check-connection', async (providerInput, profileInput, keyInput) => {
    const provider = validateProvider(providerInput);
    const profile = validateProfile(profileInput);
    const typedKey =
      keyInput === undefined || keyInput === null ? '' : string(keyInput, '密钥', 4096);
    const key = provider === 'openai' ? typedKey || credentials.load(profile.baseUrl) : undefined;
    return checkConnection(provider, profile, key);
  });
  handle('study:list-sources', () => database.listSources());
  handle('study:import-sources', async () => {
    if (!window) throw new AppError('window', '请在桌面窗口中导入。');
    const selection = await dialog.showOpenDialog(window, {
      title: '选择学习资料',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF 与 Markdown', extensions: ['pdf', 'md', 'markdown'] }],
    });
    if (selection.canceled) return { added: 0, duplicates: 0, failures: [], cancelled: true };
    return files.import(selection.filePaths, (progress) => {
      if (window && !window.isDestroyed())
        window.webContents.send('study:import-progress', progress);
    });
  });
  handle('study:cancel-import', () => files.cancel());
  handle('study:open-source', (id) => files.open(id));
  handle('study:save-reading-position', (id, position) =>
    database.saveReadingPosition(id, position),
  );
  handle('study:copy-citation', (id, anchor, quote) =>
    clipboard.writeText(files.citation(id, anchor, quote)),
  );
}

function createWindow() {
  window = new BrowserWindow({
    title: '私人学习助手 · 拾知',
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#f8f9f6',
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!isRendererUrl(url)) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.once('ready-to-show', () => window?.show());
  window.on('closed', () => {
    window = null;
  });
  const loading = devUrl ? window.loadURL(devUrl) : window.loadFile(rendererPath);
  void loading.catch(() => {
    dialog.showErrorBox('无法打开学习界面', '界面文件加载失败，请重新构建应用或检查安装文件。');
    app.quit();
  });
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
else {
  app.on('second-instance', () => {
    if (window?.isMinimized()) window.restore();
    window?.focus();
  });
  app
    .whenReady()
    .then(() => {
      if (startupError) throw startupError;
      storage = new Storage(join(dataDir, 'study-companion.sqlite3'));
      mkdirSync(join(dataDir, 'sources'), { recursive: true });
      const credentials = new Credentials(join(dataDir, 'credentials.enc.json'), safeStorage);
      Menu.setApplicationMenu(null);
      registerHandlers(storage, credentials);
      createWindow();
    })
    .catch((error) => {
      dialog.showErrorBox(
        '无法启动私人学习助手',
        failure(
          error instanceof AppError
            ? error
            : new AppError('startup', '无法打开本地数据。请检查数据目录权限、磁盘空间或安装版本。'),
        ).message,
      );
      app.quit();
    });
  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => {
    documents?.cancel();
    storage?.close();
  });
}
