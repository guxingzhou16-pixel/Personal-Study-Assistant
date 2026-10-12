import type { Settings, ModelProbeReport } from '../../src/lib/types';
import { streamChat } from './chat-stream';
import { AppError } from './errors';

export async function probeGeneration(
  settings: Settings,
  credentials: { load(endpoint: unknown): string | undefined },
  expectedProfile: unknown,
  consentEndpoint: unknown,
  transport = streamChat,
): Promise<ModelProbeReport> {
  const profile = settings[settings.provider];
  const signature = `${settings.provider}|${profile.baseUrl}|${profile.model}`;
  if (signature !== expectedProfile)
    throw new AppError('profileChanged', '已保存模型配置变化，请重新核对后测试。');
  if (!profile.model) throw new AppError('model', '先选择模型并保存设置，再测试生成。');
  const remote = !['localhost', '127.0.0.1', '[::1]'].includes(new URL(profile.baseUrl).hostname);
  if (remote && consentEndpoint !== profile.baseUrl)
    throw new AppError(
      'remoteConsent',
      '请明确选择测试当前远程模型；会发送固定示例并可能产生 API 费用。',
    );
  let sample = '';
  const result = await transport(
    {
      provider: settings.provider,
      profile,
      key: settings.provider === 'openai' ? credentials.load(profile.baseUrl) : undefined,
      signal: AbortSignal.timeout(45_000),
      messages: [
        {
          role: 'user',
          content: '这是学习助手的固定连接测试，不含私人资料。请只回复：拾知测试完成。',
        },
      ],
    },
    (text) => {
      sample += text;
      if (sample.length > 4000)
        throw new AppError('probeLength', '测试输出过长，未完成健康检查；请检查模型配置。');
    },
  );
  if (!sample.trim() || result.truncated)
    throw new AppError(
      'probeEmpty',
      '模型没有完整返回可见文字；服务连接与模型列表成功并不代表生成可用。',
    );
  return {
    available: true,
    message: '本次固定文本生成成功；不代表 RAG 回答质量已验收。',
    sample: sample.slice(0, 240),
    checkedAt: new Date().toISOString(),
    profile: signature,
  };
}
