import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';

const built = await build({
  entryPoints: ['tests/retrieval-evaluation.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  write: false,
});
const { evaluateRetrieval } = await import(
  `data:text/javascript;base64,${Buffer.from(built.outputFiles[0].contents).toString('base64')}`
);
const report = evaluateRetrieval();
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/retrieval-evaluation.json', JSON.stringify(report, null, 2) + '\n');
console.log(
  `数据集：${report.dataset}，${report.sourceCount} 份合成资料，${report.caseCount} 个固定问题`,
);
for (const [name, value] of Object.entries(report.metrics)) console.log(`${name}: ${value}`);
console.log(`未完整命中：${report.failures.map((entry) => entry.id).join(', ') || '无'}`);
console.log('详细报告：artifacts/retrieval-evaluation.json（不含真实用户资料；不调用模型）');
