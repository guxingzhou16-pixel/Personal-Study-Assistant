import { contextBridge, ipcRenderer } from 'electron';
import type {
  Bootstrap,
  ConnectionReport,
  DesktopApi,
  ModelProfile,
  Provider,
  Reply,
  Settings,
  Source,
  ImportReport,
  ImportProgress,
  OpenDocument,
} from '../src/lib/types';

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const reply = (await ipcRenderer.invoke(channel, ...args)) as Reply<T>;
  if (!reply.ok) throw reply.error;
  return reply.value;
}

const api: DesktopApi = {
  bootstrap: () => call<Bootstrap>('study:bootstrap'),
  saveSettings: (settings: Settings) => call<Settings>('study:save-settings', settings),
  storeApiKey: (baseUrl: string, key: string) => call<void>('study:store-key', baseUrl, key),
  removeApiKey: (baseUrl: string) => call<void>('study:remove-key', baseUrl),
  hasApiKey: (baseUrl: string) => call<boolean>('study:has-key', baseUrl),
  checkConnection: (provider: Provider, profile: ModelProfile, key?: string) =>
    call<ConnectionReport>('study:check-connection', provider, profile, key),
  listSources: () => call<Source[]>('study:list-sources'),
  importSources: () => call<ImportReport>('study:import-sources'),
  cancelImport: () => call<void>('study:cancel-import'),
  onImportProgress: (listener) => {
    const receive = (_event: Electron.IpcRendererEvent, progress: ImportProgress) =>
      listener(progress);
    ipcRenderer.on('study:import-progress', receive);
    return () => {
      ipcRenderer.removeListener('study:import-progress', receive);
    };
  },
  openSource: (id) => call<OpenDocument>('study:open-source', id),
  saveReadingPosition: (id, position) => call<void>('study:save-reading-position', id, position),
  copyCitation: (id, anchor, quote) => call<void>('study:copy-citation', id, anchor, quote),
};
contextBridge.exposeInMainWorld('studyCompanion', api);
