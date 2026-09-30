import type { DesktopApi } from './types';

export const isDesktop = typeof window !== 'undefined' && window.studyCompanion !== undefined;

function api(): DesktopApi {
  if (!window.studyCompanion) throw new Error('请在桌面应用中使用此功能。');
  return window.studyCompanion;
}
export const desktop: DesktopApi = {
  bootstrap: () => api().bootstrap(),
  saveSettings: (settings) => api().saveSettings(settings),
  storeApiKey: (baseUrl, key) => api().storeApiKey(baseUrl, key),
  removeApiKey: (baseUrl) => api().removeApiKey(baseUrl),
  hasApiKey: (baseUrl) => api().hasApiKey(baseUrl),
  checkConnection: (provider, profile, key) => api().checkConnection(provider, profile, key),
};

export function errorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) return error;
  return '操作未完成，请重试。';
}

export function sameEndpoint(left: string, right: string): boolean {
  try {
    return (
      new URL(left.trim()).href.replace(/\/$/, '') === new URL(right.trim()).href.replace(/\/$/, '')
    );
  } catch {
    return false;
  }
}
