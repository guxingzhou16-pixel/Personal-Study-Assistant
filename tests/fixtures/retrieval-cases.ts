import { createHash } from 'node:crypto';
import type { SourceSegment } from '../../src/lib/types';

// Fixed, synthetic evidence: the evaluation never reads a user's library or calls a model.
export const retrievalSources: {
  key: string;
  name: string;
  kind: 'pdf' | 'markdown';
  segments: SourceSegment[];
}[] = [
  {
    key: 'sqlite',
    name: '数据库.md',
    kind: 'markdown',
    segments: [
      {
        anchor: 'md-line-1',
        title: '事务隔离',
        depth: 1,
        line: 1,
        text: '事务隔离避免脏读。SQLite 用 BEGIN 开始事务，COMMIT 提交事务，ROLLBACK 回滚事务。',
      },
      {
        anchor: 'md-line-8',
        title: '数据库索引',
        depth: 1,
        line: 8,
        text: '数据库索引加快查找，但需要额外存储空间，并增加写入开销。',
      },
    ],
  },
  {
    key: 'javascript',
    name: 'JavaScript.pdf',
    kind: 'pdf',
    segments: [
      {
        anchor: 'page-1',
        title: '第 1 页',
        depth: 1,
        page: 1,
        text: 'A closure captures variables from its lexical scope. Closures keep access to outer variables.',
      },
      {
        anchor: 'page-2',
        title: '第 2 页',
        depth: 1,
        page: 2,
        text: 'A Promise represents an asynchronous result. Promise.all waits for all promises to fulfill and rejects when one promise rejects.',
      },
      {
        anchor: 'page-3',
        title: '第 3 页',
        depth: 1,
        page: 3,
        text: 'JavaScript event loop schedules callbacks. Microtasks run before the next task.',
      },
    ],
  },
  {
    key: 'http',
    name: 'HTTP.md',
    kind: 'markdown',
    segments: [
      {
        anchor: 'md-line-1',
        title: '缓存有效期',
        depth: 1,
        line: 1,
        text: 'Cache-Control 的 max-age 指定缓存新鲜期，以秒为单位。新鲜期内可以复用缓存响应。',
      },
      {
        anchor: 'md-line-7',
        title: 'ETag 校验',
        depth: 1,
        line: 7,
        text: 'ETag 标识资源版本。If-None-Match 携带已有 ETag，服务器在资源未改变时返回 304，客户端复用缓存内容。',
      },
    ],
  },
  {
    key: 'systems',
    name: '操作系统.pdf',
    kind: 'pdf',
    segments: [
      {
        anchor: 'page-1',
        title: '第 1 页',
        depth: 1,
        page: 1,
        text: '虚拟内存把虚拟地址映射到物理地址。分页将地址空间划分为固定大小的页。',
      },
      {
        anchor: 'page-2',
        title: '第 2 页',
        depth: 1,
        page: 2,
        text: '缺页时需要将相应页调入内存，频繁缺页会降低运行性能。',
      },
    ],
  },
  {
    key: 'study',
    name: '学习方法.md',
    kind: 'markdown',
    segments: [
      {
        anchor: 'md-line-1',
        title: '番茄钟',
        depth: 1,
        line: 1,
        text: '这份练习方案建议番茄钟专注二十五分钟，随后休息五分钟；时长可以按个人情况调整。',
      },
      {
        anchor: 'md-line-6',
        title: '学习复盘',
        depth: 1,
        line: 6,
        text: '学习复盘记录今天理解了什么、仍有什么疑问，以及下一步可以完成的练习。',
      },
    ],
  },
  {
    key: 'scan',
    name: '无文字扫描件.pdf',
    kind: 'pdf',
    segments: [{ anchor: 'page-1', title: '第 1 页', depth: 1, page: 1, text: '' }],
  },
];
export function evaluationSourceId(key: string): string {
  const source = retrievalSources.find((source) => source.key === key)!;
  return createHash('sha256').update(JSON.stringify(source)).digest('hex');
}
export interface RetrievalCase {
  id: string;
  category: 'direct' | 'multi' | 'synonym' | 'unanswerable';
  question: string;
  scope?: string;
  expected: { sourceId: string; anchor: string }[];
}
const expected = (key: string, ...anchors: string[]) =>
  anchors.map((anchor) => ({ sourceId: evaluationSourceId(key), anchor }));
export const retrievalCases: RetrievalCase[] = [
  {
    id: 'zh-transaction',
    category: 'direct',
    question: '什么是事务隔离？',
    expected: expected('sqlite', 'md-line-1'),
  },
  {
    id: 'zh-index',
    category: 'direct',
    question: '数据库索引有什么开销？',
    expected: expected('sqlite', 'md-line-8'),
  },
  {
    id: 'en-closure',
    category: 'direct',
    question: 'Explain a closure',
    expected: expected('javascript', 'page-1'),
  },
  {
    id: 'en-promise',
    category: 'direct',
    question: 'How does Promise.all reject?',
    expected: expected('javascript', 'page-2'),
  },
  {
    id: 'en-event-loop',
    category: 'direct',
    question: 'JavaScript event loop microtasks',
    expected: expected('javascript', 'page-3'),
  },
  {
    id: 'cache-age',
    category: 'direct',
    question: 'max-age 的单位是什么？',
    expected: expected('http', 'md-line-1'),
  },
  {
    id: 'etag',
    category: 'direct',
    question: 'ETag 和 304 有什么关系？',
    expected: expected('http', 'md-line-7'),
  },
  {
    id: 'virtual-memory',
    category: 'direct',
    question: '虚拟内存如何映射地址？',
    expected: expected('systems', 'page-1'),
  },
  {
    id: 'pomodoro',
    category: 'direct',
    question: '番茄钟之后休息多久？',
    expected: expected('study', 'md-line-1'),
  },
  {
    id: 'database-multi',
    category: 'multi',
    question: '事务隔离和数据库索引',
    expected: expected('sqlite', 'md-line-1', 'md-line-8'),
  },
  {
    id: 'cache-multi',
    category: 'multi',
    question: 'max-age 和 ETag',
    expected: expected('http', 'md-line-1', 'md-line-7'),
  },
  {
    id: 'synonym-memory',
    category: 'synonym',
    question: '内存不够为什么还能运行程序？',
    expected: expected('systems', 'page-1', 'page-2'),
  },
  { id: 'unsupported', category: 'unanswerable', question: '黑洞的霍金辐射是什么？', expected: [] },
  {
    id: 'wrong-scope',
    category: 'unanswerable',
    question: 'closure',
    scope: 'sqlite',
    expected: [],
  },
  { id: 'scan-only', category: 'unanswerable', question: '事务隔离', scope: 'scan', expected: [] },
];
