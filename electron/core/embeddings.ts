import { createHash } from 'node:crypto';
import { availableParallelism } from 'node:os';
import { embeddingModel, vectorPolicy } from './embedding-model';
import { verifyEmbeddingFiles } from './embedding-files';
import { AppError } from './errors';

// One narrow boundary for runtime replacement. Retrieval owns batching, source
// locations and persistence; this adapter owns tokenization and model inference.
export interface EmbeddingEncoder {
  readonly id: string;
  readonly dimensions: number;
  embed(texts: string[], kind: 'query' | 'passage'): Promise<Float32Array[]>;
  dispose(): Promise<void>;
}
export async function loadLocalEncoder(path: string): Promise<EmbeddingEncoder> {
  if (!(await verifyEmbeddingFiles(path)))
    throw new AppError('embeddingLoad', '本地检索模型未通过校验，请在设置中重新下载。');
  try {
    const { env, pipeline } = await import('@huggingface/transformers');
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.useFSCache = false;
    const extractor = await pipeline('feature-extraction', path, {
      local_files_only: true,
      dtype: embeddingModel.dtype,
      device: 'cpu',
      session_options: {
        intraOpNumThreads: Math.min(4, availableParallelism()),
        interOpNumThreads: 1,
      },
    });
    const id = createHash('sha256')
      .update(
        JSON.stringify({
          model: embeddingModel.repository,
          revision: embeddingModel.revision,
          dtype: embeddingModel.dtype,
          dimensions: embeddingModel.dimensions,
          pooling: embeddingModel.pooling,
          queryPrefix: embeddingModel.queryPrefix,
          maxTokens: embeddingModel.maxTokens,
          window: vectorPolicy.windowCharacters,
          overlap: vectorPolicy.windowOverlap,
          title: vectorPolicy.titleCharacters,
          runtime: 'transformers.js-4.3.0',
          inputVersion: 1,
        }),
      )
      .digest('hex');
    return {
      id,
      dimensions: embeddingModel.dimensions,
      async embed(texts, kind) {
        const input =
          kind === 'query' ? texts.map((text) => embeddingModel.queryPrefix + text) : texts;
        const tokens = extractor.tokenizer(input, { padding: true, truncation: false });
        if (tokens.input_ids.dims[1] > embeddingModel.maxTokens)
          throw new AppError('embeddingInput', '文本超出嵌入模型窗口，已保留关键词检索。');
        const outputs = await extractor.model(tokens);
        const pooled = outputs.last_hidden_state.slice(null, 0).normalize(2, -1);
        const data = pooled.data as Float32Array;
        return texts.map((_text, index) =>
          Float32Array.from(
            data.subarray(
              index * embeddingModel.dimensions,
              (index + 1) * embeddingModel.dimensions,
            ),
          ),
        );
      },
      async dispose() {
        await extractor.dispose();
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('embeddingLoad', '本地嵌入模型无法加载，请检查安装文件或重新下载。');
  }
}
