import type { MemoryDraft, MemoryKind, MemoryScope } from './types';

export const memoryLimits = { title: 100, content: 1000, count: 500, selection: 5 };
export const memoryKindLabels: Record<MemoryKind, string> = {
  preference: '个人偏好',
  learning: '学习记录',
};
export const memoryScopeLabels: Record<MemoryScope, string> = {
  disabled: '不用于建议',
  local: '仅本机模型的学习路线',
  remote: '本机或远程模型的学习路线',
};
export function emptyMemoryDraft(): MemoryDraft {
  return { title: '', content: '', kind: 'preference', scope: 'local' };
}
export function memoryAllowed(scope: MemoryScope, baseUrl: string): boolean {
  return (
    scope === 'remote' ||
    (scope === 'local' && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseUrl).hostname))
  );
}
