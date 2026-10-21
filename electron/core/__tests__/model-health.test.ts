import { expect, it, vi } from 'vitest';
import { probeGeneration } from '../model-health';
import { defaultSettings } from '../../../src/lib/types';

it('requires explicit remote consent and checks the saved profile before reading a key or sending', async () => {
  const settings = {
    ...defaultSettings,
    provider: 'openai' as const,
    openai: { baseUrl: 'https://model.example/v1', model: 'fixture' },
  };
  const load = vi.fn(() => 'fake-key');
  const transport = vi.fn();
  const signature = 'openai|https://model.example/v1|fixture';
  await expect(probeGeneration(settings, { load }, 'old', undefined, transport)).rejects.toThrow(
    '配置变化',
  );
  await expect(
    probeGeneration(settings, { load }, signature, undefined, transport),
  ).rejects.toThrow('明确选择');
  expect(load).not.toHaveBeenCalled();
  expect(transport).not.toHaveBeenCalled();
});
it('runs only fixed public text, returns the actual sample and rejects empty or truncated generation', async () => {
  const settings = {
    ...defaultSettings,
    ollama: { baseUrl: 'http://127.0.0.1:11434', model: 'fixture' },
  };
  const load = vi.fn();
  const transport = vi.fn(async (_input, onText) => {
    onText('拾知测试完成。');
    return { truncated: false };
  });
  const result = await probeGeneration(
    settings,
    { load },
    'ollama|http://127.0.0.1:11434|fixture',
    undefined,
    transport,
  );
  expect(result.available).toBe(true);
  expect(result.sample).toBe('拾知测试完成。');
  expect(transport.mock.calls[0][0].messages).toHaveLength(1);
  expect(transport.mock.calls[0][0].messages[0].content).toContain('固定连接测试');
  expect(load).not.toHaveBeenCalled();
  await expect(
    probeGeneration(settings, { load }, result.profile, undefined, async () => ({
      truncated: false,
    })),
  ).rejects.toThrow('可见文字');
  await expect(
    probeGeneration(settings, { load }, result.profile, undefined, async (_input, onText) => {
      onText('半句');
      return { truncated: true };
    }),
  ).rejects.toThrow('完整');
});
