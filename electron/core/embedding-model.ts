export interface EmbeddingModel {
  name: string;
  repository: string;
  revision: string;
  dimensions: number;
  dtype: 'q8';
  pooling: 'cls';
  queryPrefix: string;
  maxTokens: number;
  files: { path: string; bytes: number; sha256: string }[];
}

// Pin both the repository revision and file digests: updates need a new cache key
// and an evaluation, rather than silently mixing incompatible embeddings.
export const embeddingModel: EmbeddingModel = {
  name: 'BGE-small 中文 v1.5 · Q8',
  repository: 'Xenova/bge-small-zh-v1.5',
  revision: '75c43b069aac4d136ba6bc1122f995fedcfd2781',
  dimensions: 512,
  dtype: 'q8',
  pooling: 'cls',
  queryPrefix: '为这个句子生成表示以用于检索相关文章：',
  maxTokens: 512,
  files: [
    {
      path: 'config.json',
      bytes: 716,
      sha256: 'd4193ead3a810fd694fa8a31d7fc72fbaebc0668b603e398734bf2f6538ff42f',
    },
    {
      path: 'tokenizer.json',
      bytes: 439125,
      sha256: '48cea5d44424912a6fd1ea647bf4fe50b55ab8b1e5879c3275f80e339e8fae26',
    },
    {
      path: 'tokenizer_config.json',
      bytes: 367,
      sha256: 'e6f3b96db926a37d4039995fbf5ad17de158dfb8f6343d607e4dbaad18d75f5a',
    },
    {
      path: 'special_tokens_map.json',
      bytes: 125,
      sha256: 'b6d346be366a7d1d48332dbc9fdf3bf8960b5d879522b7799ddba59e76237ee3',
    },
    {
      path: 'onnx/model_quantized.onnx',
      bytes: 24010842,
      sha256: '15b717c382bcb518ba457b93ea6850ede7f4f1cd8937454aa06972366cd19bcc',
    },
  ],
};

// Retrieval policy, kept outside the runtime adapter and UI. These are explicit
// heuristics, not probabilities or a guarantee that evidence answers a question.
export const vectorPolicy = {
  windowCharacters: 384,
  windowOverlap: 64,
  titleCharacters: 64,
  batchSize: 8,
  candidateLimit: 40,
  minimumSimilarity: 0.6,
  reciprocalRankConstant: 60,
  maximumHits: 4,
};

export const embeddingDownloadTimeoutMs = 15 * 60_000;
