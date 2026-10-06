import type { Theme } from './types';

export const themeOptions = [
  { id: 'modern', name: '清爽现代', description: '浅绿与留白，保持清晰。' },
  { id: 'study', name: '安静书房', description: '暖纸与棕色，适合慢慢读。' },
  { id: 'playful', name: '活泼游戏化', description: '青蓝与橙色，添一点轻快。' },
] as const satisfies readonly { id: Theme; name: string; description: string }[];

export function isTheme(value: unknown): value is Theme {
  return themeOptions.some((theme) => theme.id === value);
}
