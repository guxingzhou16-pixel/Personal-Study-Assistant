import { expect, it, vi } from 'vitest';
import { embeddingModel } from '../embedding-model';
import { loadLocalEncoder } from '../embeddings';

const fake = vi.hoisted(() => {
  const env = { allowRemoteModels: true, allowLocalModels: false, useFSCache: true };
  const tokenizer = vi.fn(() => ({ input_ids: { dims: [1, 20] } }));
  const normalize = vi.fn(() => ({
    data: Float32Array.from({ length: 512 }, (_, i) => Number(i === 0)),
  }));
  const model = vi.fn(async () => ({ last_hidden_state: { slice: () => ({ normalize }) } }));
  const dispose = vi.fn(async () => {});
  const pipeline = vi.fn(async () => ({ tokenizer, model, dispose }));
  return { env, tokenizer, model, dispose, pipeline };
});
vi.mock('../embedding-files', () => ({ verifyEmbeddingFiles: async () => true }));
vi.mock('@huggingface/transformers', () => ({ env: fake.env, pipeline: fake.pipeline }));

it('loads CPU inference from verified local files, applies the BGE query instruction, and prevents token truncation', async () => {
  const encoder = await loadLocalEncoder('local-test-model');
  expect(fake.pipeline).toHaveBeenCalledWith(
    'feature-extraction',
    'local-test-model',
    expect.objectContaining({ local_files_only: true, device: 'cpu', dtype: 'q8' }),
  );
  expect(fake.env.allowRemoteModels).toBe(false);
  const result = await encoder.embed(['查询'], 'query');
  expect(fake.tokenizer).toHaveBeenLastCalledWith([embeddingModel.queryPrefix + '查询'], {
    padding: true,
    truncation: false,
  });
  expect(result[0]).toHaveLength(512);
  await encoder.embed(['原文'], 'passage');
  expect(fake.tokenizer).toHaveBeenLastCalledWith(['原文'], { padding: true, truncation: false });
  fake.tokenizer.mockReturnValueOnce({ input_ids: { dims: [1, 513] } });
  await expect(encoder.embed(['过长输入'], 'query')).rejects.toMatchObject({
    code: 'embeddingInput',
  });
  await encoder.dispose();
  expect(fake.dispose).toHaveBeenCalledOnce();
});

it('reports missing Windows native runtime separately from damaged model files without exposing paths', async () => {
  fake.pipeline.mockRejectedValueOnce(
    Object.assign(
      new Error('The specified module could not be found. C:\\private\\onnxruntime_binding.node'),
      {
        code: 'ERR_DLOPEN_FAILED',
      },
    ),
  );
  const unavailable = loadLocalEncoder('local-test-model');
  await expect(unavailable).rejects.toMatchObject({
    code: 'embeddingRuntime',
    message: expect.stringContaining('Microsoft Visual C++'),
  });
  await expect(unavailable).rejects.toMatchObject({
    message: expect.not.stringContaining('private'),
  });
  fake.pipeline.mockRejectedValueOnce(new Error('private model parsing details'));
  await expect(loadLocalEncoder('local-test-model')).rejects.toMatchObject({
    code: 'embeddingLoad',
    message: '本地嵌入模型无法加载，请检查安装文件或重新下载。',
  });
});
