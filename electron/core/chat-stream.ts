import type { ModelProfile, Provider } from '../../src/lib/types';
import { AppError } from './errors';
import { validateProfile, validateProvider } from './settings';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
export interface StreamRequest {
  provider: Provider;
  profile: ModelProfile;
  key?: string;
  messages: ChatMessage[];
  signal: AbortSignal;
}
const badStream = () =>
  new AppError('streamFormat', '模型返回的流式格式无法识别，请检查接口兼容性。');
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw badStream();
  return value as Record<string, unknown>;
}

export async function streamChat(
  input: StreamRequest,
  onText: (text: string) => void,
): Promise<{ truncated: boolean }> {
  const provider = validateProvider(input.provider);
  const profile = validateProfile(input.profile);
  if (!profile.model) throw new AppError('model', '请先在设置中选择并保存聊天模型。');
  const timeout = new AbortController();
  const signal = AbortSignal.any([input.signal, timeout.signal]);
  let idle = setTimeout(() => timeout.abort(), 120_000);
  const total = setTimeout(() => timeout.abort(), 600_000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let ended = false;
  let truncated = false;
  let receivedCharacters = 0;
  let receivedBytes = 0;
  let pending = '';
  let eventData: string[] = [];
  let eventSize = 0;
  function payload(text: string) {
    if (ended) return;
    if (provider === 'openai' && text === '[DONE]') {
      ended = true;
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw badStream();
    }
    const value = object(parsed);
    if (value.error)
      throw new AppError('modelService', '模型服务报告生成失败。请检查模型或服务状态后重试。');
    let content: unknown;
    let reason: unknown;
    if (provider === 'ollama') {
      content = value.message === undefined ? undefined : object(value.message).content;
      if (typeof value.done !== 'boolean') throw badStream();
      ended = value.done;
      reason = value.done_reason;
    } else {
      if (!Array.isArray(value.choices)) throw badStream();
      if (!value.choices.length) return; // Some services send a separate usage event.
      const choice = object(value.choices[0]);
      const delta = object(choice.delta);
      content = delta.content ?? delta.refusal;
      reason = choice.finish_reason;
      if (reason !== undefined && reason !== null) {
        if (reason !== 'stop' && reason !== 'length') {
          throw new AppError(
            'modelFinish',
            '模型未正常完成文字回答，可能受到内容限制或请求了不支持的工具。',
          );
        }
        ended = true;
      }
    }
    if (content !== undefined && content !== null) {
      if (typeof content !== 'string') throw badStream();
      receivedCharacters += content.length;
      if (receivedCharacters > 64_000)
        throw new AppError('responseSize', '回答超过长度上限，已停止接收。请缩小问题范围。');
      if (content) onText(content);
      signal.throwIfAborted();
    }
    if (ended && reason === 'length') truncated = true;
  }
  function line(text: string) {
    if (provider === 'ollama') {
      if (text.trim()) payload(text);
    } else if (!text) {
      if (eventData.length) payload(eventData.join('\n'));
      eventData = [];
      eventSize = 0;
    } else if (text.startsWith('data:')) {
      const data = text.slice(5).replace(/^ /, '');
      eventSize += data.length;
      if (eventSize > 1_048_576) throw badStream();
      eventData.push(data);
    }
  }
  try {
    const response = await fetch(
      `${profile.baseUrl}/${provider === 'ollama' ? 'api/chat' : 'chat/completions'}`,
      {
        method: 'POST',
        redirect: 'error',
        signal,
        headers: {
          'Content-Type': 'application/json',
          ...(provider === 'openai' && input.key ? { Authorization: `Bearer ${input.key}` } : {}),
        },
        body: JSON.stringify({ model: profile.model, stream: true, messages: input.messages }),
      },
    );
    reader = response.body?.getReader();
    if (!response.ok) {
      if ([401, 403].includes(response.status))
        throw new AppError('authentication', '模型鉴权失败，请检查此地址保存的密钥和访问权限。');
      if (response.status === 429)
        throw new AppError('rateLimit', '模型服务限流或额度不足，请稍后重试并检查账户额度。');
      if (response.status === 404)
        throw new AppError('modelMissing', '聊天接口或模型不存在，请检查服务地址和模型名称。');
      throw new AppError('modelService', '模型服务暂时无法生成回答，请稍后重试。');
    }
    if (!reader) throw badStream();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    while (!ended) {
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      clearTimeout(idle);
      idle = setTimeout(() => timeout.abort(), 120_000);
      if (value) {
        receivedBytes += value.byteLength;
        if (receivedBytes > 8 * 1024 * 1024)
          throw new AppError('responseSize', '模型响应过大，已停止接收。请缩小问题范围。');
      }
      try {
        pending += decoder.decode(value, { stream: !done });
      } catch {
        throw badStream();
      }
      let newline: number;
      while (!ended && (newline = pending.indexOf('\n')) !== -1) {
        const current = pending.slice(0, newline).replace(/\r$/, '');
        pending = pending.slice(newline + 1);
        if (current.length > 1_048_576) throw badStream();
        line(current);
      }
      if (pending.length > 1_048_576) throw badStream();
      if (done) {
        if (provider === 'ollama' && pending.trim()) line(pending);
        break;
      }
    }
    if (!ended)
      throw new AppError(
        'streamIncomplete',
        '回答中途断开，以下内容尚未完成。请检查连接后重新提问。',
      );
    if (!receivedCharacters)
      throw new AppError('emptyAnswer', '模型没有返回可显示的回答，请检查模型是否支持聊天。');
    return { truncated };
  } catch (error) {
    if (input.signal.aborted) throw new AppError('cancelled', '已停止生成。');
    if (timeout.signal.aborted)
      throw new AppError('timeout', '模型响应超时，已停止接收。请检查服务状态或选择较小的模型。');
    if (error instanceof AppError) throw error;
    throw new AppError('unreachable', '无法连接模型或连接已中断，请检查服务地址和网络。');
  } finally {
    clearTimeout(idle);
    clearTimeout(total);
    try {
      await reader?.cancel();
    } catch {
      /* The original request error is reported above. */
    }
    reader?.releaseLock();
  }
}
