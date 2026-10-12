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
import { HistoryService } from './core/history';
import { historyMarkdown } from './core/history-markdown';
import { markdownFileName, writeMarkdownExport } from './core/markdown-export';
import { NoteFeedbackService } from './core/note-feedback';
import { LearningAgentService } from './core/learning-agent';
import { PracticeService } from './core/practice';
import { MemoryProposalService } from './core/memory-proposals';
import { TaskProposalService } from './core/task-proposals';
import { FocusTracker } from './core/focus';
import type { FocusEndReason } from '../src/lib/types';
import { BackupRunner } from './core/backup-runner';
import { BackupService } from './core/backup';
import {
  activateRestore,
  clearAppliedRestore,
  learningLocation,
  pendingRestore,
  quarantineRestore,
  restoreDirectory,
  type LearningLocation,
} from './core/data-location';

app.setName('StudyCompanion');
if (process.platform === 'win32')
  app.setAppUserModelId('io.github.guxingzhou16pixel.studycompanion');
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
// ESM workers and their external native dependencies are shipped as real files.
const workerDirectory = app.isPackaged
  ? join(process.resourcesPath, 'app.asar.unpacked', 'dist-electron')
  : __dirname;
const rendererUrl = devUrl ? new URL(devUrl).href : pathToFileURL(rendererPath).href;
let window: BrowserWindow | null = null;
let storage: Storage | undefined;
let documents: Documents | undefined;
let study: StudyTracker | undefined;
let focus: FocusTracker | undefined;
let focusBackgroundError: unknown;
let chat: ChatService | undefined;
let search: SearchService | undefined;
let embeddingFiles: EmbeddingFiles | undefined;
let studyHeartbeat: ReturnType<typeof setInterval> | undefined;
let noteDraftDirty = false;
let checkingNoteExit = false;
let backups: BackupService | undefined;
let releasingRestorePreview = false;

function isRendererUrl(url: string | undefined): boolean {
  return url?.split('#', 1)[0] === rendererUrl;
}

function interruptFocus(reason: FocusEndReason): void {
  try {
    focus?.interrupt(reason);
  } catch (error) {
    // The tracker freezes immediately and retains a pending interruption for retry.
    focusBackgroundError = error;
  }
}

function registerHandlers(
  database: Storage,
  credentials: Credentials,
  tracker: StudyTracker,
  focusTracker: FocusTracker,
  location: LearningLocation,
  backupRunner: BackupRunner,
) {
  const files = new Documents(
    database,
    join(location.directory, 'sources'),
    join(workerDirectory, 'document-worker.mjs'),
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
    location.directory,
    join(workerDirectory, 'search-worker.mjs'),
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
  const practice = new PracticeService(database, retrieval, chats);
  const memoryProposals = new MemoryProposalService(database);
  const taskProposals = new TaskProposalService(database);
  let runningOperations = 0;
  const backupService = new BackupService(dataDir, location, backupRunner, {
    selectFolder: async (purpose) => {
      if (!window) throw new AppError('window', '请在桌面窗口中选择备份位置。');
      const selection = await dialog.showOpenDialog(window, {
        title:
          purpose === 'export'
            ? '选择保存备份的目录（将新建独立备份文件夹）'
            : '选择包含 manifest.json 的完整拾知备份文件夹',
        properties: [
          'openDirectory',
          ...(purpose === 'export' ? ['createDirectory' as const] : []),
        ],
      });
      return selection.canceled ? null : (selection.filePaths[0] ?? null);
    },
    approveRestore: async (preview) => {
      if (!window) throw new AppError('window', '请在桌面窗口中确认恢复。');
      if (noteDraftDirty)
        throw new AppError('noteDirty', '请先保存笔记或明确放弃笔记草稿，再恢复数据。');
      const answer = await dialog.showMessageBox(window, {
        type: 'warning',
        title: '恢复学习数据并重启',
        message: '确认使用这份备份作为当前学习数据？',
        detail: `备份：${preview.folderName}\n时间：${preview.createdAt}\n\n这是整份替换，不合并记录。当前保存的数据将完整保留在原目录。应用会重启，所有尚未保存的输入会丢失。密钥和本机模型保持原样。`,
        buttons: ['取消', '恢复并重启'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      return answer.response === 1;
    },
    requireIdle: () => {
      if (
        runningOperations > 1 ||
        files.busy ||
        retrieval.busy ||
        chats.current() ||
        embeddings.busy
      )
        throw new AppError(
          'backupBusy',
          '请先完成或取消导入、检索、生成、模型下载和其他文件操作，再处理备份。',
        );
      if (tracker.isRunning || database.focus.active())
        throw new AppError(
          'backupTimer',
          '请先暂停首页累计计时，并结束当前专注（暂停的专注也需要先结束）。',
        );
      if (focusBackgroundError)
        throw new AppError(
          'backupFocus',
          '专注记录曾保存失败，请先在专注页面重新读取并核对状态，再处理备份。',
        );
    },
    notify: (state) => {
      try {
        if (window && !window.isDestroyed() && !window.webContents.isDestroyed())
          window.webContents.send('study:backup-update', state);
      } catch {
        // The actual state remains readable through backupState after a renderer failure.
      }
    },
    restart: () => {
      setTimeout(() => {
        try {
          app.relaunch();
          app.quit();
        } catch {
          dialog.showErrorBox(
            '恢复已准备',
            '自动重启未能完成，请退出并重新打开应用以完成恢复。原学习数据已保留。',
          );
        }
      }, 500);
    },
  });
  backups = backupService;
  const backupControlChannels = new Set(['study:backup-state', 'study:cancel-backup']);
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
      if (backupService.busy && !backupControlChannels.has(channel))
        return {
          ok: false,
          error: { code: 'backupBusy', message: '正在处理备份或恢复，请等待完成或取消后再操作。' },
        };
      runningOperations++;
      try {
        return { ok: true, value: await work(...args) };
      } catch (error) {
        return { ok: false, error: failure(error) };
      } finally {
        runningOperations--;
      }
    });
  }
  handle('study:backup-state', () => backupService.snapshot());
  handle('study:export-backup', () => backupService.export());
  handle('study:inspect-backup', () => backupService.inspect());
  handle('study:confirm-restore', (id) => backupService.confirm(id));
  handle('study:discard-restore', (id) => backupService.discard(id));
  handle('study:cancel-backup', () => backupService.cancel());
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
  function focusWork<T>(work: () => T): T {
    if (focusBackgroundError) {
      const error = focusBackgroundError;
      focusBackgroundError = undefined;
      throw error;
    }
    return work();
  }
  handle('study:focus-overview', () => focusWork(() => focusTracker.overview()));
  handle('study:focus-history', (query) => focusWork(() => database.focus.history(query)));
  handle('study:get-focus-session', (id) => focusWork(() => database.focus.get(id)));
  handle('study:start-focus', (request) => focusWork(() => focusTracker.start(request)));
  handle('study:control-focus', (id, revision, action) =>
    focusWork(() => focusTracker.control(id, revision, action)),
  );
  handle('study:save-focus-review', (id, revision, review) =>
    focusWork(() => focusTracker.saveReview(id, revision, review)),
  );
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
  handle('study:read-selection', async (id, anchor, quote) => {
    await files.verify(id);
    return files.selection(id, anchor, quote);
  });
  handle('study:list-conversations', () => database.chat.list());
  handle('study:create-conversation', () => database.chat.create());
  handle('study:get-conversation', (id) => database.chat.get(id));
  const history = new HistoryService(database.chat, () => chats.current());
  let historyBusy = false;
  let exportingNote = false;
  function assertHistoryIdle() {
    if (historyBusy) throw new AppError('historyBusy', '请完成当前历史记录操作后再试。');
  }
  async function historyDialog<T>(work: () => Promise<T>): Promise<T> {
    assertHistoryIdle();
    if (exportingNote) throw new AppError('historyBusy', '请完成笔记导出后再管理历史记录。');
    historyBusy = true;
    try {
      return await work();
    } finally {
      historyBusy = false;
    }
  }
  handle('study:preview-history', (target) => history.read(target).preview);
  handle('study:rename-conversation', (id, version, title) => {
    assertHistoryIdle();
    return history.rename(id, version, title);
  });
  handle('study:delete-history', (target, version) =>
    historyDialog(async () => {
      if (!window) throw new AppError('window', '请在桌面窗口中管理记录。');
      const saved = history.verify(target, version).preview;
      const route = saved.target.kind === 'learning';
      const choice = await dialog.showMessageBox(window, {
        type: 'warning',
        title: route ? '删除这份学习路线？' : '删除这个会话？',
        message: saved.title,
        detail: `将永久删除 ${saved.turnCount} 份已保存问答及其证据/快照，无回收站。\n${route ? '已生成的任务和记忆会保留来源标识，但不能再打开这份路线；尚未确认的来源提议将失效。' : '资料、阅读位置、笔记、任务和记忆不受影响。'}\n旧备份和已导出文件仍保留记录；删除不能撤回已经发送到远程服务的数据。`,
        buttons: ['保留记录', '确认删除'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (choice.response !== 1) return { cancelled: true };
      history.delete(saved.target, version);
      return { cancelled: false };
    }),
  );
  handle('study:export-history', (target, version) =>
    historyDialog(async () => {
      if (!window) throw new AppError('window', '请在桌面窗口中导出记录。');
      const saved = history.verify(target, version);
      const selection = await dialog.showSaveDialog(window, {
        title: '导出已保存记录（包含原文及所选记忆快照）',
        defaultPath: markdownFileName(saved.preview.title, '学习记录'),
        filters: [{ name: 'Markdown 记录', extensions: ['md'] }],
        properties: ['showOverwriteConfirmation'],
      });
      if (selection.canceled || !selection.filePath) return { cancelled: true };
      const current = history.verify(saved.preview.target, version);
      await writeMarkdownExport(
        selection.filePath,
        historyMarkdown(current.preview, current.turns),
        dataDir,
        '记录',
        'historyExport',
        () => {
          history.verify(saved.preview.target, version);
        },
      );
      return { cancelled: false, fileName: basename(selection.filePath) };
    }),
  );
  handle('study:send-chat', (request) => {
    assertHistoryIdle();
    return chats.send(request);
  });
  handle('study:stop-chat', (id) => chats.stop(id));
  handle('study:active-chat', () => chats.current());
  const retrievalProgress = (progress: import('../src/lib/types').RetrievalProgress) => {
    if (window && !window.isDestroyed() && !window.webContents.isDestroyed())
      window.webContents.send('study:retrieval-progress', progress);
  };
  handle('study:prepare-question', (question, id) =>
    retrieval.prepare(question, id, retrievalProgress),
  );
  handle('study:prepare-reading-question', async (question, id, anchor, quote) => {
    await files.verify(id);
    return retrieval.prepare(question, id, retrievalProgress, files.selection(id, anchor, quote));
  });
  handle('study:prepare-practice', (request) => practice.prepare(request, retrievalProgress));
  handle('study:send-practice', (request) => {
    assertHistoryIdle();
    return practice.send(request);
  });
  handle('study:cancel-retrieval', () => retrieval.cancel());
  handle('study:rebuild-index', () => retrieval.rebuild(retrievalProgress));
  handle('study:resolve-citation', (turnId, number) => retrieval.resolveCitation(turnId, number));
  handle('study:list-note-feedback', (id) => feedback.list(id));
  handle('study:prepare-note-feedback', (id, revision, question) =>
    feedback.prepare(id, revision, question, retrievalProgress),
  );
  handle('study:send-note-feedback', (request) => {
    assertHistoryIdle();
    return feedback.send(request);
  });
  handle('study:list-learning-drafts', () => learning.list());
  handle('study:prepare-learning-draft', (request, memoryIds) =>
    learning.prepare(request, retrievalProgress, memoryIds),
  );
  handle('study:send-learning-draft', (request) => {
    assertHistoryIdle();
    return learning.send(request);
  });
  handle('study:list-memories', () => database.memories.list());
  handle('study:save-memory', (request) => database.memories.save(request));
  handle('study:delete-memory', (id, revision) => database.memories.delete(id, revision));
  handle('study:prepare-memory-proposal', (turnId, edit) => memoryProposals.prepare(turnId, edit));
  handle('study:confirm-memory-proposal', (id) => memoryProposals.confirm(id));
  handle('study:discard-memory-proposal', (id) => memoryProposals.discard(id));
  handle('study:planning-overview', (day) => database.planning.overview(day));
  handle('study:save-project', (request) => database.planning.saveProject(request));
  handle('study:save-task', (request) => database.planning.saveTask(request));
  handle('study:set-task-completed', (id, revision, completed) =>
    database.planning.setCompleted(id, revision, completed),
  );
  handle('study:delete-task', (id, revision) => database.planning.deleteTask(id, revision));
  handle('study:prepare-task-proposal', (turnId, request) =>
    taskProposals.prepare(turnId, request),
  );
  handle('study:confirm-task-proposal', (id) => taskProposals.confirm(id));
  handle('study:discard-task-proposal', (id) => taskProposals.discard(id));
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
  handle('study:export-note', async (id, revisionInput) => {
    assertHistoryIdle();
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
  window.webContents.on('did-start-navigation', (details) => {
    if (details.isMainFrame && !details.isSameDocument) interruptFocus('renderer-reload');
  });
  window.webContents.on('render-process-gone', () => interruptFocus('renderer-reload'));
  window.webContents.on('will-navigate', (event, url) => {
    if (!isRendererUrl(url)) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.once('ready-to-show', () => window?.show());
  window.on('close', (event) => {
    if (backups?.busy && backups.snapshot().operation !== 'restart') {
      event.preventDefault();
      dialog.showErrorBox(
        '备份仍在处理',
        '请先等待备份完成，或在界面取消并等待处理结束，再退出应用。',
      );
      return;
    }
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
    .then(async () => {
      if (startupError) throw startupError;
      const backupRunner = new BackupRunner(
        join(workerDirectory, 'backup-worker.mjs'),
        (path, args) =>
          utilityProcess.fork(path, args, {
            stdio: 'ignore',
            serviceName: 'Study data backup',
            execArgv: ['--max-old-space-size=256'],
          }),
      );
      let location = await learningLocation(dataDir);
      const openData = (directory: string) => {
        let database: Storage | undefined;
        let activity: StudyStorage | undefined;
        try {
          database = new Storage(join(directory, 'study-companion.sqlite3'));
          database.loadSettings();
          mkdirSync(join(directory, 'sources'), { recursive: true });
          activity = new StudyStorage(join(directory, 'study-activity.sqlite3'));
          return {
            database,
            tracker: new StudyTracker(activity),
            focusTracker: new FocusTracker(database.focus, database.planning),
          };
        } catch (error) {
          activity?.close();
          database?.close();
          throw error;
        }
      };
      let opened: ReturnType<typeof openData> | undefined;
      try {
        const pending = await pendingRestore(dataDir);
        if (pending && pending.id === location.id) {
          await clearAppliedRestore(dataDir).catch(() => {
            dialog.showErrorBox(
              '学习数据已恢复',
              '恢复后的数据正在使用，但残留的恢复标记未能清理。请保留应用数据目录并检查文件占用与权限。',
            );
          });
        } else if (pending) {
          if (pending.previousId !== location.id)
            throw new AppError('restoreConflict', '恢复前的数据位置已变化。');
          const directory = await restoreDirectory(dataDir, pending.id);
          await backupRunner.run('verify', directory, '', () => {});
          opened = openData(directory);
          try {
            location = await activateRestore(dataDir, pending);
          } catch (error) {
            opened.tracker.close();
            opened.database.close();
            opened = undefined;
            throw error;
          }
        }
      } catch (error) {
        let isolationNotice = '';
        try {
          await quarantineRestore(dataDir);
        } catch {
          isolationNotice =
            '\n等待恢复记录未能隔离，下次启动可能再次报告。请保留数据目录并检查文件占用与权限。';
        }
        dialog.showErrorBox(
          '恢复未完成，原数据已保留',
          failure(error).message +
            '\n将继续使用恢复前保存的数据。请保留整个应用数据目录并重新选择完整备份。' +
            isolationNotice,
        );
      }
      opened ??= openData(location.directory);
      storage = opened.database;
      const credentials = new Credentials(join(dataDir, 'credentials.enc.json'), safeStorage);
      study = opened.tracker;
      const tracker = study;
      focus = opened.focusTracker;
      const focusTracker = focus;
      studyHeartbeat = setInterval(() => {
        try {
          tracker.checkpoint();
        } catch (error) {
          tracker.interrupt(error);
        }
        try {
          focusTracker.checkpoint();
        } catch (error) {
          focusBackgroundError = error;
        }
      }, 1000);
      powerMonitor.on('suspend', () => {
        interruptFocus('sleep');
        try {
          tracker.pause();
        } catch (error) {
          tracker.interrupt(error);
        }
      });
      Menu.setApplicationMenu(null);
      registerHandlers(storage, credentials, tracker, focusTracker, location, backupRunner);
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
  app.on('before-quit', (event) => {
    const preview = backups?.snapshot().preview;
    if (!preview || !backups || backups.busy || releasingRestorePreview || noteDraftDirty) return;
    event.preventDefault();
    releasingRestorePreview = true;
    void backups
      .releasePreview()
      .catch(() => {
        dialog.showErrorBox(
          '暂存副本未能清理',
          '未确认的恢复副本可能仍占用磁盘空间，当前学习数据未被替换。请保留应用数据目录并检查权限。',
        );
      })
      .finally(() => {
        app.quit();
      });
  });
  app.on('will-quit', () => {
    embeddingFiles?.cancel();
    search?.cancel();
    chat?.close();
    documents?.cancel();
    clearInterval(studyHeartbeat);
    interruptFocus('app-exit');
    if (focusBackgroundError) {
      dialog.showErrorBox(
        '专注记录未能保存',
        '最后的专注状态保存失败，请保留数据目录并检查磁盘空间和权限。重启后不会自动继续计时。',
      );
    }
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
