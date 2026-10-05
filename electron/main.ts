import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  net,
  powerMonitor,
  safeStorage,
  utilityProcess,
} from 'electron';
import { mkdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Credentials } from './core/credentials';
import { AppError, failure } from './core/errors';
import { checkConnection } from './core/models';
import { Storage } from './core/storage';
import { Documents } from './core/documents';
import { string, validateProfile, validateProvider } from './core/settings';
import { StudyTracker } from './core/study';
import { StudyStorage } from './core/study-storage';
import { ChatService } from './core/chat';
import { SearchService } from './core/search';
import { EmbeddingFiles } from './core/embedding-files';
import { noteRevision } from './core/note-storage';
import { noteFileName, writeNoteExport } from './core/note-export';
import { noteMarkdown } from '../src/lib/notes';
import { NoteFeedbackService } from './core/note-feedback';
import { LearningAgentService } from './core/learning-agent';
import { MemoryProposalService } from './core/memory-proposals';

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
let study: StudyTracker | undefined;
let chat: ChatService | undefined;
let search: SearchService | undefined;
let embeddingFiles: EmbeddingFiles | undefined;
let studyHeartbeat: ReturnType<typeof setInterval> | undefined;
let noteDraftDirty = false;
let checkingNoteExit = false;

function isRendererUrl(url: string | undefined): boolean {
  return url?.split('#', 1)[0] === rendererUrl;
}

function registerHandlers(database: Storage, credentials: Credentials, tracker: StudyTracker) {
  const files = new Documents(
    database,
    join(dataDir, 'sources'),
    join(__dirname, 'document-worker.mjs'),
    (modulePath, args) =>
      utilityProcess.fork(modulePath, args, {
        stdio: 'ignore',
        serviceName: 'Study document parser',
        execArgv: ['--max-old-space-size=256'],
      }),
  );
  documents = files;
  const embeddings = new EmbeddingFiles(join(dataDir, 'embedding-models'), (url, options) =>
    net.fetch(url, options),
  );
  embeddingFiles = embeddings;
  const retrieval = new SearchService(
    database,
    dataDir,
    join(__dirname, 'search-worker.mjs'),
    (modulePath, args) =>
      utilityProcess.fork(modulePath, args, {
        stdio: 'ignore',
        serviceName: 'Study source retrieval',
        execArgv: ['--max-old-space-size=512'],
      }),
    (id) => files.verify(id),
    () => embeddings.candidatePath(),
  );
  search = retrieval;
  const chats = new ChatService(
    database,
    credentials,
    (turn) => {
      if (window && !window.isDestroyed() && !window.webContents.isDestroyed())
        window.webContents.send('study:chat-update', turn);
    },
    undefined,
    retrieval,
  );
  chat = chats;
  const feedback = new NoteFeedbackService(database, retrieval, chats);
  const learning = new LearningAgentService(database, retrieval, chats);
  const memoryProposals = new MemoryProposalService(database);
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
  handle('study:overview', (year, month) => tracker.overview(year, month));
  handle('study:check-in', (year, month) => tracker.checkIn(year, month));
  handle('study:set-running', (running, year, month) => tracker.setRunning(running, year, month));
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
  handle('study:list-conversations', () => database.chat.list());
  handle('study:create-conversation', () => database.chat.create());
  handle('study:get-conversation', (id) => database.chat.get(id));
  handle('study:send-chat', (request) => chats.send(request));
  handle('study:stop-chat', (id) => chats.stop(id));
  handle('study:active-chat', () => chats.current());
  const retrievalProgress = (progress: import('../src/lib/types').RetrievalProgress) => {
    if (window && !window.isDestroyed() && !window.webContents.isDestroyed())
      window.webContents.send('study:retrieval-progress', progress);
  };
  handle('study:prepare-question', (question, id) =>
    retrieval.prepare(question, id, retrievalProgress),
  );
  handle('study:cancel-retrieval', () => retrieval.cancel());
  handle('study:rebuild-index', () => retrieval.rebuild(retrievalProgress));
  handle('study:resolve-citation', (turnId, number) => retrieval.resolveCitation(turnId, number));
  handle('study:list-note-feedback', (id) => feedback.list(id));
  handle('study:prepare-note-feedback', (id, revision, question) =>
    feedback.prepare(id, revision, question, retrievalProgress),
  );
  handle('study:send-note-feedback', (request) => feedback.send(request));
  handle('study:list-learning-drafts', () => learning.list());
  handle('study:prepare-learning-draft', (request, memoryIds) =>
    learning.prepare(request, retrievalProgress, memoryIds),
  );
  handle('study:send-learning-draft', (request) => learning.send(request));
  handle('study:list-memories', () => database.memories.list());
  handle('study:save-memory', (request) => database.memories.save(request));
  handle('study:delete-memory', (id, revision) => database.memories.delete(id, revision));
  handle('study:prepare-memory-proposal', (turnId, edit) => memoryProposals.prepare(turnId, edit));
  handle('study:confirm-memory-proposal', (id) => memoryProposals.confirm(id));
  handle('study:discard-memory-proposal', (id) => memoryProposals.discard(id));
  handle('study:embedding-status', () => embeddings.status());
  handle('study:cancel-embedding-download', () => embeddings.cancel());
  handle('study:download-embedding', () => {
    let lastProgress = 0;
    return embeddings.install((progress) => {
      if (Date.now() - lastProgress < 100 && progress.current !== progress.total) return;
      lastProgress = Date.now();
      if (window && !window.isDestroyed() && !window.webContents.isDestroyed())
        window.webContents.send('study:embedding-progress', progress);
    });
  });
  handle('study:list-notes', () => database.notes.list());
  handle('study:get-note', (id) => database.notes.get(id));
  handle('study:save-note', (request) => database.notes.save(request));
  handle('study:delete-note', (id, revision) => {
    if (chats.current()?.noteSnapshot?.id === id)
      throw new AppError('noteFeedbackBusy', '请先停止这份笔记的反馈，再确认删除。');
    database.notes.delete(id, revision);
  });
  handle('study:set-note-draft-dirty', (dirty) => {
    if (typeof dirty !== 'boolean') throw new AppError('validation', '笔记编辑状态无效。');
    noteDraftDirty = dirty;
  });
  let exportingNote = false;
  handle('study:export-note', async (id, revisionInput) => {
    if (!window) throw new AppError('window', '请在桌面窗口中导出笔记。');
    if (exportingNote) throw new AppError('noteBusy', '请完成当前导出后再试。');
    const revision = noteRevision(revisionInput);
    const note = database.notes.get(id);
    if (note.revision !== revision)
      throw new AppError('noteConflict', '笔记已更新，请重新加载后再导出。');
    exportingNote = true;
    try {
      const selection = await dialog.showSaveDialog(window, {
        title: '导出学习笔记',
        defaultPath: noteFileName(note.title),
        filters: [{ name: 'Markdown 笔记', extensions: ['md'] }],
        properties: ['showOverwriteConfirmation'],
      });
      if (selection.canceled || !selection.filePath) return { cancelled: true };
      const current = database.notes.get(id);
      if (current.revision !== revision)
        throw new AppError('noteConflict', '选择位置期间笔记已更新，请重新加载后再导出。');
      const source = current.sourceId ? database.getSource(current.sourceId) : undefined;
      await writeNoteExport(
        selection.filePath,
        noteMarkdown(current, source?.name ?? null),
        dataDir,
      );
      return { cancelled: false, fileName: basename(selection.filePath) };
    } finally {
      exportingNote = false;
    }
  });
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
  window.on('close', (event) => {
    if (!noteDraftDirty) return;
    event.preventDefault();
    if (checkingNoteExit) return;
    checkingNoteExit = true;
    const closingWindow = window!;
    void dialog
      .showMessageBox(closingWindow, {
        type: 'warning',
        title: '笔记尚未保存',
        message: '有未保存的笔记内容。',
        detail: '继续编辑可以返回笔记保存；放弃并退出会丢失这次尚未保存的修改。',
        buttons: ['继续编辑', '放弃并退出'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      })
      .then(({ response }) => {
        if (closingWindow.isDestroyed()) return;
        if (response === 1) {
          noteDraftDirty = false;
          closingWindow.close();
        } else closingWindow.webContents.send('study:show-notes');
      })
      .catch(() => {
        dialog.showErrorBox('未退出应用', '无法显示退出确认。请先保存笔记后再退出。');
      })
      .finally(() => {
        checkingNoteExit = false;
      });
  });
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
      study = new StudyTracker(new StudyStorage(join(dataDir, 'study-activity.sqlite3')));
      const tracker = study;
      studyHeartbeat = setInterval(() => {
        try {
          tracker.checkpoint();
        } catch (error) {
          tracker.interrupt(error);
        }
      }, 1000);
      powerMonitor.on('suspend', () => {
        try {
          tracker.pause();
        } catch (error) {
          tracker.interrupt(error);
        }
      });
      Menu.setApplicationMenu(null);
      registerHandlers(storage, credentials, tracker);
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
    embeddingFiles?.cancel();
    search?.cancel();
    chat?.close();
    documents?.cancel();
    clearInterval(studyHeartbeat);
    try {
      study?.close();
    } catch {
      dialog.showErrorBox(
        '学习时间未能保存',
        '最后一段学习时间保存失败，请检查磁盘空间和数据目录权限。',
      );
    }
    storage?.close();
  });
}
