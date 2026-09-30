import type { AppFailure } from '../../src/lib/types';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function failure(error: unknown): AppFailure {
  if (error instanceof AppError) return { code: error.code, message: error.message };
  return { code: 'internal', message: '操作未完成。请检查磁盘空间、数据目录权限或网络后重试。' };
}
