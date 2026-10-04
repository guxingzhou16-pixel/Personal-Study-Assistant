import { createHash } from 'node:crypto';
import type { SourceSegment } from '../../src/lib/types';

// A held-out set that did not participate in development or parameter tuning.
// It adds new topics, a distractor source that shares terminology with the
// real answers, and questions that are never read by the production UI.
export const independentRetrievalSources: {
  key: string;
  name: string;
  kind: 'pdf' | 'markdown';
  segments: SourceSegment[];
}[] = [
  {
    key: 'networking',
    name: '网络协议.md',
    kind: 'markdown',
    segments: [
      {
        anchor: 'md-line-1',
        title: 'TCP 可靠传输',
        depth: 1,
        line: 1,
        text: 'TCP 通过确认应答、重传和序号保证可靠传输，按顺序把数据交给接收方。',
      },
      {
        anchor: 'md-line-6',
        title: 'UDP 实时性',
        depth: 1,
        line: 6,
        text: 'UDP 不建立连接、不重传，开销小，适合实时音视频和在线游戏等对延迟敏感的场景。',
      },
    ],
  },
  {
    key: 'data-structures',
    name: '数据结构.md',
    kind: 'markdown',
    segments: [
      {
        anchor: 'md-line-1',
        title: '栈',
        depth: 1,
        line: 1,
        text: '栈是后进先出的结构，只能从栈顶插入和删除，函数调用栈就使用这种顺序。',
      },
      {
        anchor: 'md-line-7',
        title: '队列',
        depth: 1,
        line: 7,
        text: '队列是先进先出的结构，从队尾入队、队头出队，常用于任务调度和消息缓冲。',
      },
    ],
  },
  {
    key: 'crypto',
    name: '密码学.md',
    kind: 'markdown',
    segments: [
      {
        anchor: 'md-line-1',
        title: '对称加密',
        depth: 1,
        line: 1,
        text: '对称加密用同一个密钥加密和解密，速度快，适合大量数据的保密传输。',
      },
      {
        anchor: 'md-line-8',
        title: '哈希函数',
        depth: 1,
        line: 8,
        text: '哈希函数把任意长度输入映射成固定长度摘要，用于校验完整性，不能逆向还原。',
      },
    ],
  },
  {
    key: 'distractor',
    name: '网络性能.md',
    kind: 'markdown',
    segments: [
      {
        anchor: 'md-line-1',
        title: '带宽与延迟',
        depth: 1,
        line: 1,
        text: '带宽决定单位时间能传输多少数据，延迟决定数据到达的时间，两者共同影响传输体验。',
      },
      {
        anchor: 'md-line-6',
        title: '拥塞',
        depth: 1,
        line: 6,
        text: '拥塞发生在网络流量超过链路承载能力时，会造成排队和丢包，与传输是否可靠是不同的问题。',
      },
    ],
  },
];

export function independentSourceId(key: string): string {
  const source = independentRetrievalSources.find((source) => source.key === key)!;
  return createHash('sha256').update(JSON.stringify(source)).digest('hex');
}

export interface IndependentRetrievalCase {
  id: string;
  category: 'direct' | 'multi' | 'synonym' | 'distractor' | 'unanswerable';
  question: string;
  scope?: string;
  expected: { sourceId: string; anchor: string }[];
}

const expected = (key: string, ...anchors: string[]) =>
  anchors.map((anchor) => ({ sourceId: independentSourceId(key), anchor }));

export const independentRetrievalCases: IndependentRetrievalCase[] = [
  {
    id: 'ind-tcp-reliable',
    category: 'direct',
    question: 'TCP 用什么机制保证可靠传输？',
    expected: expected('networking', 'md-line-1'),
  },
  {
    id: 'ind-udp-realtime',
    category: 'synonym',
    question: '为什么网络通话和在线游戏常用 UDP？',
    expected: expected('networking', 'md-line-6'),
  },
  {
    id: 'ind-stack-order',
    category: 'direct',
    question: '栈的插入和删除顺序是什么？',
    expected: expected('data-structures', 'md-line-1'),
  },
  {
    id: 'ind-queue-order',
    category: 'direct',
    question: '队列从哪一端入队和出队？',
    expected: expected('data-structures', 'md-line-7'),
  },
  {
    id: 'ind-stack-queue',
    category: 'multi',
    question: '栈和队列的进出顺序有什么区别？',
    expected: expected('data-structures', 'md-line-1', 'md-line-7'),
  },
  {
    id: 'ind-symmetric-hash',
    category: 'multi',
    question: '对称加密和哈希函数分别有什么特点？',
    expected: expected('crypto', 'md-line-1', 'md-line-8'),
  },
  {
    id: 'ind-hash-irreversible',
    category: 'synonym',
    question: '为什么不能从摘要还原原始数据？',
    expected: expected('crypto', 'md-line-8'),
  },
  {
    id: 'ind-bandwidth-latency',
    category: 'distractor',
    question: '带宽和延迟分别决定什么？',
    expected: expected('distractor', 'md-line-1'),
  },
  { id: 'ind-unanswerable', category: 'unanswerable', question: '傅里叶变换的数学公式是什么？', expected: [] },
  {
    id: 'ind-wrong-scope',
    category: 'unanswerable',
    question: 'TCP 可靠传输',
    scope: 'crypto',
    expected: [],
  },
];
