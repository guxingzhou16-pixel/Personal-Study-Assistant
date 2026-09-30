import {
  defaultSettings,
  type ModelProfile,
  type Provider,
  type Settings,
} from '../../src/lib/types';
import { AppError } from './errors';

export function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppError('validation', '设置格式不正确，请重新填写。');
  }
  return value as Record<string, unknown>;
}

export function string(value: unknown, label: string, maxLength = 512): string {
  if (typeof value !== 'string' || value.trim().length > maxLength) {
    throw new AppError('validation', `${label}格式不正确或过长。`);
  }
  return value.trim();
}

export function validateEndpoint(value: unknown): string {
  let url: URL;
  try {
    url = new URL(string(value, '服务地址'));
  } catch {
    throw new AppError('address', '请填写完整的 HTTP 或 HTTPS 服务基础地址。');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new AppError('address', '基础地址不能包含账号、密钥、查询参数或片段。');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol === 'http:' && !loopback) {
    throw new AppError('address', '远程模型服务请使用 HTTPS；本机服务可使用 HTTP。');
  }
  return url.href.replace(/\/+$/, '');
}

export function validateProvider(value: unknown): Provider {
  if (value !== 'ollama' && value !== 'openai')
    throw new AppError('validation', '请选择受支持的模型服务。');
  return value;
}

export function validateProfile(value: unknown): ModelProfile {
  const data = record(value);
  if (Object.keys(data).some((key) => !['baseUrl', 'model'].includes(key))) {
    throw new AppError('validation', '模型配置包含不支持的字段。');
  }
  return { baseUrl: validateEndpoint(data.baseUrl), model: string(data.model, '模型名称', 200) };
}

export function validateSettings(value: unknown): Settings {
  const data = record(value);
  if (Object.keys(data).some((key) => !Object.hasOwn(defaultSettings, key))) {
    throw new AppError('validation', '设置包含不支持的字段；密钥不能写入学习数据库。');
  }
  const displayName = string(data.displayName, '称呼', 40);
  if (
    typeof data.dailyGoalMinutes !== 'number' ||
    !Number.isInteger(data.dailyGoalMinutes) ||
    data.dailyGoalMinutes < 10 ||
    data.dailyGoalMinutes > 480
  ) {
    throw new AppError('validation', '每日目标应为 10 到 480 之间的整数分钟。');
  }
  const responseStyle = data.responseStyle;
  if (responseStyle !== 'gentle' && responseStyle !== 'game' && responseStyle !== 'coach') {
    throw new AppError('validation', '请选择受支持的回应风格。');
  }
  return {
    displayName,
    dailyGoalMinutes: data.dailyGoalMinutes,
    responseStyle,
    provider: validateProvider(data.provider),
    ollama: validateProfile(data.ollama),
    openai: validateProfile(data.openai),
  };
}
