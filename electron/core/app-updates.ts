import type { AppRelease, AppUpdateReport, AppVersionInfo } from '../../src/lib/types';
import { AppError } from './errors';

const repository = 'https://github.com/guxingzhou16-pixel/Personal-Study-Assistant';
const endpoint =
  'https://api.github.com/repos/guxingzhou16-pixel/Personal-Study-Assistant/releases?per_page=30';
const cacheMs = 5 * 60_000;
const timeoutMs = 15_000;
const responseLimit = 512 * 1024;

interface Version {
  core: string[];
  prerelease: string[];
}

function version(value: string): Version | null {
  const match =
    /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?(?:\+[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?$/.exec(
      value,
    );
  if (!match) return null;
  const prerelease = match[4]?.split('.') ?? [];
  if (prerelease.some((part) => /^0\d+$/.test(part))) return null;
  return { core: match.slice(1, 4), prerelease };
}
function numeric(left: string, right: string): number {
  return left.length - right.length || (left < right ? -1 : left > right ? 1 : 0);
}
function compare(left: Version, right: Version): number {
  for (let index = 0; index < 3; index++) {
    const difference = numeric(left.core[index], right.core[index]);
    if (difference) return difference;
  }
  if (!left.prerelease.length || !right.prerelease.length)
    return Number(!left.prerelease.length) - Number(!right.prerelease.length);
  for (let index = 0; index < Math.min(left.prerelease.length, right.prerelease.length); index++) {
    const a = left.prerelease[index],
      b = right.prerelease[index];
    if (a === b) continue;
    const aNumeric = /^\d+$/.test(a),
      bNumeric = /^\d+$/.test(b);
    if (aNumeric && bNumeric) return numeric(a, b);
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
    return a < b ? -1 : 1;
  }
  return left.prerelease.length - right.prerelease.length;
}
function dataError(): AppError {
  return new AppError('updateData', '发布信息不完整或格式不受支持，请稍后重试或查看官方发布页。');
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown, limit: number, fallback: string): string {
  if (value === null) return fallback;
  if (typeof value !== 'string') throw dataError();
  return Array.from(value).slice(0, limit).join('') || fallback;
}
function officialAsset(url: unknown, tag: string, name: string): boolean {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'github.com' &&
      !parsed.port &&
      !parsed.username &&
      !parsed.password &&
      !parsed.search &&
      !parsed.hash &&
      decodeURIComponent(parsed.pathname) ===
        new URL(repository).pathname + `/releases/download/${tag}/${name}`
    );
  } catch {
    return false;
  }
}
function latestRelease(value: unknown): AppRelease | null {
  if (!Array.isArray(value)) throw dataError();
  let latest: AppRelease | null = null;
  for (const item of value) {
    if (!record(item) || typeof item.draft !== 'boolean') throw dataError();
    if (item.draft) continue;
    if (typeof item.tag_name !== 'string') throw dataError();
    const tagVersion = version(item.tag_name);
    if (!tagVersion) continue;
    if (!Array.isArray(item.assets) || typeof item.prerelease !== 'boolean') throw dataError();
    for (const asset of item.assets) {
      if (!record(asset) || typeof asset.name !== 'string') throw dataError();
      const match = /^StudyCompanion-([0-9].*)-win-x64-setup\.exe$/.exec(asset.name);
      const appVersion = match && version(match[1]);
      if (
        !match ||
        !appVersion ||
        asset.state !== 'uploaded' ||
        !Number.isSafeInteger(asset.size) ||
        (asset.size as number) <= 0 ||
        appVersion.core.join('.') !== tagVersion.core.join('.')
      )
        continue;
      // The first preview used a prerelease tag but a plain 0.1.1 application/asset version.
      if (compare(appVersion, tagVersion) !== 0 && appVersion.prerelease.length) continue;
      if (!officialAsset(asset.browser_download_url, item.tag_name, asset.name)) throw dataError();
      if (typeof item.published_at !== 'string' || !Number.isFinite(Date.parse(item.published_at)))
        throw dataError();
      const candidate: AppRelease = {
        version: match[1],
        tag: item.tag_name,
        name: text(item.name, 200, item.tag_name),
        notes: text(item.body, 8000, ''),
        publishedAt: new Date(item.published_at).toISOString(),
        prerelease: item.prerelease,
      };
      const difference = latest ? compare(appVersion, version(latest.version)!) : 1;
      if (difference > 0 || (difference === 0 && candidate.publishedAt > latest!.publishedAt))
        latest = candidate;
    }
  }
  return latest;
}

async function readMetadata(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.body) throw dataError();
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0,
    body = '';
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      const next = await reader.read();
      if (signal.aborted) throw new AppError('updateTimeout', '检查更新超时，请稍后重试。');
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > responseLimit) {
        await reader.cancel();
        throw dataError();
      }
      try {
        body += decoder.decode(next.value, { stream: true });
      } catch {
        throw dataError();
      }
    }
    try {
      body += decoder.decode();
      return JSON.parse(body);
    } catch {
      throw dataError();
    }
  } finally {
    signal.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}

/** Read-only release metadata and a fixed official browser destination; never installs software. */
export class AppUpdates {
  private readonly current: AppVersionInfo;
  private cached: AppUpdateReport | null = null;
  private cachedAt = 0;
  private inFlight: Promise<AppUpdateReport> | null = null;

  constructor(
    current: AppVersionInfo,
    private readonly download: (url: string, options: RequestInit) => Promise<Response>,
    private readonly openExternal: (url: string) => Promise<void>,
    private readonly now: () => number = Date.now,
  ) {
    this.current = { ...current };
  }

  info(): AppVersionInfo {
    return { ...this.current };
  }

  async check(force = false): Promise<AppUpdateReport> {
    if (typeof force !== 'boolean') throw new AppError('updateInput', '检查更新参数无效。');
    if (this.inFlight) return structuredClone(await this.inFlight);
    if (!force && this.cached && this.now() - this.cachedAt < cacheMs)
      return structuredClone(this.cached);
    this.inFlight = this.fetchReport();
    try {
      const result = await this.inFlight;
      this.cached = result;
      this.cachedAt = this.now();
      return structuredClone(result);
    } finally {
      this.inFlight = null;
    }
  }

  private async fetchReport(): Promise<AppUpdateReport> {
    const currentVersion = version(this.current.version);
    if (!currentVersion)
      throw new AppError('updateVersion', '当前应用版本号无法识别，请查看官方发布页。');
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new AppError('updateTimeout', '检查更新超时，请稍后重试。'));
      }, timeoutMs);
    });
    const request = (async (): Promise<AppUpdateReport> => {
      const response = await this.download(endpoint, {
        redirect: 'error',
        credentials: 'omit',
        signal: controller.signal,
        headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      });
      if (controller.signal.aborted)
        throw new AppError('updateTimeout', '检查更新超时，请稍后重试。');
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        if (response.status === 403 || response.status === 429)
          throw new AppError(
            'updateRateLimit',
            '更新服务暂时限制请求，请稍后重试或查看官方发布页。',
          );
        throw new AppError('updateHttp', '暂时无法取得发布信息，请稍后重试或查看官方发布页。');
      }
      const release = latestRelease(await readMetadata(response, controller.signal));
      const difference = release ? compare(version(release.version)!, currentVersion) : 0;
      const status: AppUpdateReport['status'] = !release
        ? 'no-release'
        : difference > 0
          ? 'available'
          : difference < 0
            ? 'ahead'
            : this.current.packaged
              ? 'current'
              : 'development';
      return {
        current: this.info(),
        release,
        status,
        checkedAt: new Date(this.now()).toISOString(),
      };
    })();
    try {
      return await Promise.race([request, timeout]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('updateNetwork', '检查更新失败，请检查网络后重试；学习资料仍保存在本机。');
    } finally {
      clearTimeout(timer!);
      controller.abort();
    }
  }

  async open(target: 'latest' | 'history'): Promise<void> {
    if (target !== 'latest' && target !== 'history')
      throw new AppError('updateInput', '更新页面参数无效。');
    if (target === 'latest' && !this.cached?.release)
      throw new AppError(
        'updateNotChecked',
        '尚未取得可供升级的发行版，请先检查更新或查看版本历史。',
      );
    const url =
      target === 'history'
        ? `${repository}/releases`
        : `${repository}/releases/tag/${encodeURIComponent(this.cached!.release!.tag)}`;
    try {
      await this.openExternal(url);
    } catch {
      throw new AppError('updateOpen', '无法打开浏览器，请稍后重试或手动访问官方发布页。');
    }
  }
}
