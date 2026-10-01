import { PDFDocument, StandardFonts } from 'pdf-lib';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

export async function createReadingFiles(directory: string) {
  const markdown = join(directory, '学习方法.md');
  const text = [
    '# 学习方法',
    '',
    '用自己的语言解释概念，比只读一遍更容易发现知识缺口。',
    '',
    '## 阅读与提问',
    '',
    ...Array.from(
      { length: 35 },
      (_, index) => `第 ${index + 1} 段：阅读之后，写下一个具体的问题，并返回原文寻找依据。\n`,
    ),
    '## 复盘与检验',
    '',
    '验证自己的理解，保留资料出处。',
    '',
    '| 行动 | 目的 |',
    '| --- | --- |',
    '| 主动解释 | 发现知识缺口 |',
    '',
    '```typescript',
    'const evidence = "return to the source";',
    '```',
    '',
    '<script>window.__unsafeExecuted = true</script>',
    '',
    '![远程图片](https://example.com/private-tracker.png)',
    '[外部资料](https://example.com/reference)',
  ].join('\n');
  writeFileSync(markdown, text, 'utf8');
  const pdf = join(directory, 'Learning Notes.pdf');
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const [title, content] of [
    ['Learning Notes - page 1', 'Active recall helps identify gaps in understanding.'],
    ['Learning Notes - page 2', 'Evidence matters. Always return to the original source.'],
  ]) {
    const page = document.addPage([595, 842]);
    page.drawText(title, { x: 54, y: 750, size: 24, font });
    page.drawText(content, { x: 54, y: 685, size: 13, font });
  }
  writeFileSync(pdf, await document.save());
  const scan = join(directory, 'Scan only.pdf');
  const scanDocument = await PDFDocument.create();
  scanDocument.addPage([400, 600]).drawRectangle({ x: 50, y: 50, width: 300, height: 500 });
  writeFileSync(scan, await scanDocument.save());
  const corrupt = join(directory, 'broken.pdf');
  writeFileSync(corrupt, 'not a PDF');
  return { markdown, text, pdf, scan, corrupt };
}
