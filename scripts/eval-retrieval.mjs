import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cpus } from 'node:os';
import { pathToFileURL } from 'node:url';

const hybrid = process.argv.includes('--hybrid');
mkdirSync('artifacts', { recursive: true });
await build({
  entryPoints: [
    'tests/retrieval-evaluation.ts',
    'electron/core/embeddings.ts',
    'electron/core/embedding-files.ts',
    'electron/core/embedding-model.ts',
  ],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  outdir: 'artifacts/evaluation-runtime',
  outbase: '.',
  external: ['@huggingface/transformers'],
});
const runtime = 'artifacts/evaluation-runtime/';
const module = (name) => import(pathToFileURL(resolve(runtime, name)).href);
const { evaluateRetrieval, evaluateIndependentRetrieval } = await module(
  'tests/retrieval-evaluation.js',
);
let encoder;
let loadMs = 0;
const report = {};
try {
  if (hybrid) {
    const { loadLocalEncoder } = await module('electron/core/embeddings.js');
    const { embeddingPath } = await module('electron/core/embedding-files.js');
    const { embeddingModel, vectorPolicy } = await module('electron/core/embedding-model.js');
    const started = performance.now();
    encoder = await loadLocalEncoder(embeddingPath(resolve('artifacts/embedding-model')));
    loadMs = performance.now() - started;
    report.model = embeddingModel;
    report.policy = vectorPolicy;
  }
  report.datasets = [await evaluateRetrieval(encoder), await evaluateIndependentRetrieval(encoder)];
} finally {
  await encoder?.dispose();
}
report.environment = {
  platform: process.platform,
  arch: process.arch,
  node: process.version,
  cpu: cpus()[0]?.model,
  logicalCpus: cpus().length,
  modelLoadMs: loadMs,
};
const prefix = hybrid ? 'hybrid-' : '';
const output = `artifacts/${prefix}retrieval-evaluation.json`;
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
for (const dataset of report.datasets) {
  console.log(
    `数据集：${dataset.dataset}，${dataset.sourceCount} 份合成资料，${dataset.caseCount} 个固定问题`,
  );
  for (const [name, value] of Object.entries(dataset.metrics)) console.log(`  ${name}: ${value}`);
  console.log(`  未完整命中：${dataset.failures.map((entry) => entry.id).join(', ') || '无'}`);
  console.log(
    `  引用位置错误：${dataset.citationFailures.map((entry) => entry.id).join(', ') || '无'}`,
  );
  console.log(
    `  回答依据越界：${dataset.groundingFailures.map((entry) => entry.id).join(', ') || '无'}`,
  );
}
console.log(
  `性能（本机样本）：${JSON.stringify(report.datasets[0].performance)}；模型加载 ${Math.round(loadMs)} ms`,
);
console.log(
  `详细报告：${output}（合成资料；${hybrid ? '真实本地嵌入，无聊天/云 API' : '不调用模型'}；含独立评测集与引用位置校验）`,
);
if (report.datasets.some((dataset) => dataset.fallbackCount)) {
  console.error('有题目发生嵌入降级，不能作为完整混合检索成绩。');
  process.exitCode = 1;
}
