import { expect, it, vi } from 'vitest';
import { embeddingModel } from './embedding-model';
import { loadLocalEncoder } from './embeddings';

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
vi.mock('./embedding-files', () => ({ verifyEmbeddingFiles: async () => true }));
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
