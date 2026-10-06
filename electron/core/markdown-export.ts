import { randomUUID } from 'node:crypto';
import { realpath, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, sep } from 'node:path';
import { AppError } from './errors';

export function markdownFileName(title: string, fallback: string): string {
  let name =
    Array.from(title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_'))
      .slice(0, 80)
      .join('')
      .replace(/[. ]+$/, '') || fallback;
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name)) name = '笔记-' + name;
  return name + '.md';
}

export async function writeMarkdownExport(
  destination: string,
  markdown: string,
  dataDirectory: string,
  subject: string,
  errorCode: string,
  beforeCommit: () => void = () => {},
): Promise<void> {
  if (extname(destination).toLowerCase() !== '.md')
    throw new AppError(errorCode, `请将${subject}保存为 .md 文件。`);
  let temporary: string | undefined;
  try {
    const parent = await realpath(dirname(destination));
    const protectedDirectory = await realpath(dataDirectory);
    const location = relative(protectedDirectory, parent);
    if (
      !location ||
      (location !== '..' && !location.startsWith('..' + sep) && !isAbsolute(location))
    )
      throw new AppError(errorCode, '请选择应用数据目录以外的位置，避免覆盖学习资料。');
    temporary = join(parent, '.' + basename(destination) + '.' + randomUUID() + '.tmp');
    await writeFile(temporary, markdown, { encoding: 'utf8', flag: 'wx' });
    // Verify the saved revision again after asynchronous staging, before replacing the destination.
    beforeCommit();
    await rename(temporary, destination);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(errorCode, `${subject}未能导出，请检查目标目录权限、文件占用和磁盘空间。`);
  } finally {
    if (temporary)
      await rm(temporary, { force: true }).catch(() => {
        // A failed staged export never reports success; cleanup is best effort.
      });
  }
}
