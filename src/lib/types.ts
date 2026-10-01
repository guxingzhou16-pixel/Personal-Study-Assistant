export type Provider = 'ollama' | 'openai';
export type ResponseStyle = 'gentle' | 'game' | 'coach';

export interface ModelProfile {
  baseUrl: string;
  model: string;
}

export interface Settings {
  displayName: string;
  dailyGoalMinutes: number;
  responseStyle: ResponseStyle;
  provider: Provider;
  ollama: ModelProfile;
  openai: ModelProfile;
}

export interface Bootstrap {
  settings: Settings;
  dataDir: string;
  schemaVersion: number;
  hasApiKey: boolean;
}

export interface ConnectionReport {
  models: string[];
  selectedModelAvailable: boolean;
  message: string;
}

export interface AppFailure {
  code: string;
  message: string;
}

export interface StudyDay {
  day: string;
  checkedIn: boolean;
  studySeconds: number;
}

export interface StudyOverview {
  today: StudyDay;
  days: StudyDay[];
  running: boolean;
}
export type Reply<T> = { ok: true; value: T } | { ok: false; error: AppFailure };
export interface DesktopApi {
  bootstrap(): Promise<Bootstrap>;
  saveSettings(settings: Settings): Promise<Settings>;
  storeApiKey(baseUrl: string, key: string): Promise<void>;
  removeApiKey(baseUrl: string): Promise<void>;
  hasApiKey(baseUrl: string): Promise<boolean>;
  studyOverview(year: number, month: number): Promise<StudyOverview>;
  checkIn(year: number, month: number): Promise<StudyOverview>;
  setStudyRunning(running: boolean, year: number, month: number): Promise<StudyOverview>;
  checkConnection(
    provider: Provider,
    profile: ModelProfile,
    key?: string,
  ): Promise<ConnectionReport>;
}

declare global {
  interface Window {
    studyCompanion?: DesktopApi;
  }
}

export const defaultSettings: Settings = {
  displayName: '',
  dailyGoalMinutes: 45,
  responseStyle: 'gentle',
  provider: 'ollama',
  ollama: { baseUrl: 'http://127.0.0.1:11434', model: '' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: '' },
};
