import { markdownFileName, writeMarkdownExport } from './markdown-export';

export function noteFileName(title: string): string {
  return markdownFileName(title, '学习笔记');
}

export async function writeNoteExport(
  destination: string,
  markdown: string,
  dataDirectory: string,
): Promise<void> {
  return writeMarkdownExport(destination, markdown, dataDirectory, '笔记', 'noteExport');
}
