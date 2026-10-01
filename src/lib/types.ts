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
export type Reply<T> = { ok: true; value: T } | { ok: false; error: AppFailure };
export type SourceKind = 'pdf' | 'markdown';
export interface OutlineEntry {
  anchor: string;
  title: string;
  depth: number;
  page?: number;
  line?: number;
}
export interface ReadingPosition {
  page: number;
  anchor: string;
  offset: number;
  zoom: number;
  tone: 'paper' | 'warm';
}
export interface Source {
  id: string;
  name: string;
  kind: SourceKind;
  bytes: number;
  pageCount: number;
  textStatus: 'ready' | 'partial' | 'none';
  importedAt: string;
  openedAt: string | null;
  outline: OutlineEntry[];
  position: ReadingPosition;
}
export interface SourceSegment extends OutlineEntry {
  text: string;
}
export interface ParsedDocument {
  pageCount: number;
  textStatus: Source['textStatus'];
  outline: OutlineEntry[];
  segments: SourceSegment[];
}
export interface OpenDocument {
  source: Source;
  text?: string;
  data?: Uint8Array;
}
export interface ImportProgress {
  file: string;
  current: number;
  total: number;
  message: string;
}
export interface ImportReport {
  added: number;
  duplicates: number;
  cancelled: boolean;
  failures: { file: string; message: string }[];
}
export interface DesktopApi {
  bootstrap(): Promise<Bootstrap>;
  saveSettings(settings: Settings): Promise<Settings>;
  storeApiKey(baseUrl: string, key: string): Promise<void>;
  removeApiKey(baseUrl: string): Promise<void>;
  hasApiKey(baseUrl: string): Promise<boolean>;
  checkConnection(
    provider: Provider,
    profile: ModelProfile,
    key?: string,
  ): Promise<ConnectionReport>;
  listSources(): Promise<Source[]>;
  importSources(): Promise<ImportReport>;
  cancelImport(): Promise<void>;
  onImportProgress(listener: (progress: ImportProgress) => void): () => void;
  openSource(id: string): Promise<OpenDocument>;
  saveReadingPosition(id: string, position: ReadingPosition): Promise<void>;
  copyCitation(id: string, anchor: string, quote: string): Promise<void>;
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
