import { contextBridge, ipcRenderer } from 'electron';
import type {
  Bootstrap,
  ConnectionReport,
  DesktopApi,
  ModelProfile,
  Provider,
  Reply,
  Settings,
  StudyOverview,
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
  studyOverview: (year, month) => call<StudyOverview>('study:overview', year, month),
  checkIn: (year, month) => call<StudyOverview>('study:check-in', year, month),
  setStudyRunning: (running, year, month) =>
    call<StudyOverview>('study:set-running', running, year, month),
  checkConnection: (provider: Provider, profile: ModelProfile, key?: string) =>
    call<ConnectionReport>('study:check-connection', provider, profile, key),
};
contextBridge.exposeInMainWorld('studyCompanion', api);
