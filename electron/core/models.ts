import type { ConnectionReport } from '../../src/lib/types';
import { AppError } from './errors';
import { record, string, validateProfile, validateProvider } from './settings';

function httpError(status: number): AppError {
  if ([401, 403].includes(status))
    return new AppError('authentication', '鉴权失败。请检查密钥和模型访问权限。');
  if (status === 404)
    return new AppError('address', '未找到模型列表接口。请检查基础地址（云端通常包含 /v1）。');
  if (status === 429)
    return new AppError('rateLimit', '请求过多或额度不足。请稍后重试，并检查账户额度。');
  return new AppError('service', `模型服务返回 HTTP ${status}。请检查服务状态后重试。`);
}

export async function checkConnection(
  providerInput: unknown,
  profileInput: unknown,
  key?: string,
  timeoutMs = 15_000,
): Promise<ConnectionReport> {
  const provider = validateProvider(providerInput);
  const profile = validateProfile(profileInput);
  const suffix = provider === 'ollama' ? '/api/tags' : '/models';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (provider === 'openai' && key?.trim()) {
    if (/[\r\n]/.test(key)) throw new AppError('validation', '密钥不能包含换行。');
    headers.Authorization = `Bearer ${key.trim()}`;
  }
  const signal = AbortSignal.timeout(timeoutMs);
  let models: string[];
  try {
    const response = await fetch(`${profile.baseUrl}${suffix}`, {
      headers,
      redirect: 'error',
      signal,
    });
    if (!response.ok) throw httpError(response.status);
    // Bound untrusted service responses before parsing or placing them in the UI.
    const reader = response.body?.getReader();
    if (!reader) throw new AppError('responseFormat', '模型服务返回了空响应。');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new AppError('responseFormat', '模型列表响应过大，请检查服务地址。');
      }
      chunks.push(chunk.value);
    }
    try {
      const data = record(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      const items = provider === 'ollama' ? data.models : data.data;
      if (!Array.isArray(items)) throw new Error('Missing model list');
      models = [
        ...new Set(
          items.map((item) =>
            string(record(item)[provider === 'ollama' ? 'name' : 'id'], '返回的模型名称', 200),
          ),
        ),
      ]
        .filter(Boolean)
        .sort();
    } catch {
      throw new AppError('responseFormat', '服务响应格式不兼容。请检查基础地址和接口类型。');
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (signal.aborted)
      throw new AppError('timeout', '连接超时。请确认服务已启动、地址正确，再重试。');
    throw new AppError(
      'unreachable',
      '无法连接模型服务。请确认服务已启动，并检查地址、网络和证书。',
    );
  }
  const selectedModelAvailable = !!profile.model && models.includes(profile.model);
  let message: string;
  if (!models.length) message = '服务已连接，但没有返回模型。请先安装模型或检查账户权限。';
  else if (!profile.model)
    message = `服务已连接，发现 ${models.length} 个模型。请选择一个模型并保存。`;
  else if (selectedModelAvailable) message = '服务已连接，所选模型存在。聊天生成将在后续阶段接入。';
  else message = '服务已连接，但找不到所选模型。请从列表选择或检查模型名。';
  return { models, selectedModelAvailable, message };
}
