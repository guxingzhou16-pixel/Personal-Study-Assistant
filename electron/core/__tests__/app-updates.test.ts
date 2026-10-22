import { afterEach, expect, it, vi } from 'vitest';
import { AppUpdates } from '../app-updates';

const repository = 'https://github.com/guxingzhou16-pixel/Personal-Study-Assistant';
const endpoint =
  'https://api.github.com/repos/guxingzhou16-pixel/Personal-Study-Assistant/releases?per_page=30';
const current = { version: '0.1.1', packaged: true };

function release(version = '0.1.2', tag = `v${version}`) {
  const name = `StudyCompanion-${version}-win-x64-setup.exe`;
  return {
    tag_name: tag,
    name: `拾知 ${tag}`,
    body: '## 更新\n- 阅读与学习功能改进。',
    draft: false,
    prerelease: tag.includes('-'),
    published_at: '2026-10-22T01:00:00Z',
    assets: [
      {
        name,
        state: 'uploaded',
        size: 1000,
        browser_download_url: `${repository}/releases/download/${tag}/${name}`,
      },
    ],
  };
}
function response(value: unknown) {
  return new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
}
function fixture(value: unknown = [release()], version = current) {
  const download = vi.fn(async (_url: string, _options: RequestInit) => response(value));
  const openExternal = vi.fn(async (_url: string) => {});
  const now = vi.fn(() => Date.parse('2026-10-22T02:00:00Z'));
  const service = new AppUpdates(version, download, openExternal, now);
  return { service, download, openExternal, now };
}

afterEach(() => vi.useRealTimers());

it('reports current identity without requesting a server and returns isolated snapshots', () => {
  const { service, download } = fixture();
  const first = service.info();
  first.version = '999.0.0';
  expect(service.info()).toEqual(current);
  expect(download).not.toHaveBeenCalled();
});

it('checks only the fixed anonymous endpoint and identifies a newer installer with notes', async () => {
  const { service, download, openExternal } = fixture();
  const result = await service.check();
  expect(result).toMatchObject({
    current,
    status: 'available',
    checkedAt: '2026-10-22T02:00:00.000Z',
    release: { version: '0.1.2', tag: 'v0.1.2', notes: '## 更新\n- 阅读与学习功能改进。' },
  });
  expect(download).toHaveBeenCalledOnce();
  const [url, options] = download.mock.calls[0];
  expect(url).toBe(endpoint);
  expect(options).toMatchObject({ redirect: 'error', credentials: 'omit' });
  expect(new Headers(options.headers).has('Authorization')).toBe(false);
  expect(options.signal).toBeInstanceOf(AbortSignal);
  expect(openExternal).not.toHaveBeenCalled();
  await service.open('latest');
  expect(openExternal).toHaveBeenCalledExactlyOnceWith(`${repository}/releases/tag/v0.1.2`);
});

it('includes the published legacy preview and distinguishes development from an installed version', async () => {
  const payload = [release('0.1.1', 'v0.1.1-preview.1')];
  expect(await fixture(payload).service.check()).toMatchObject({
    status: 'current',
    release: { version: '0.1.1', prerelease: true },
  });
  expect(
    await fixture(payload, { version: '0.1.1', packaged: false }).service.check(),
  ).toMatchObject({ status: 'development' });
  expect(
    await fixture(payload, { version: '0.1.2', packaged: false }).service.check(),
  ).toMatchObject({ status: 'ahead' });
});

it('orders semantic versions numerically, including prerelease identifiers and stable priority', async () => {
  const payload = [
    release('0.1.9'),
    release('0.1.10-beta.2'),
    release('0.1.10-beta.11'),
    release('0.1.10'),
  ];
  expect((await fixture(payload).service.check()).release?.version).toBe('0.1.10');
  expect((await fixture(payload.slice(0, 3)).service.check()).release?.version).toBe(
    '0.1.10-beta.11',
  );
  expect(
    (
      await fixture([release('1.0.0-alpha')], {
        version: '1.0.0-alpha.1',
        packaged: true,
      }).service.check()
    ).status,
  ).toBe('ahead');
  expect(
    (
      await fixture([release('1.0.0+build.2')], {
        version: '1.0.0+build.1',
        packaged: true,
      }).service.check()
    ).status,
  ).toBe('current');
});

it('skips drafts, unsupported tags and releases without an uploaded matching Windows x64 installer', async () => {
  const draft = { ...release('9.0.0'), draft: true };
  const unsupported = { ...release('8.0.0'), tag_name: 'nightly' };
  const wrongArchitecture = release('7.0.0');
  wrongArchitecture.assets[0].name = 'StudyCompanion-7.0.0-win-arm64-setup.exe';
  const uploading = release('6.0.0');
  uploading.assets[0].state = 'starter';
  const mismatched = release('5.0.0');
  mismatched.assets[0] = release('4.0.0').assets[0];
  const { service } = fixture([draft, unsupported, wrongArchitecture, uploading, mismatched]);
  expect(await service.check()).toMatchObject({ status: 'no-release', release: null });
  await expect(service.open('latest')).rejects.toMatchObject({ code: 'updateNotChecked' });
});

it.each([
  'https://evil.example/setup.exe',
  'https://github.com/another/repository/releases/download/v0.1.2/setup.exe',
  'https://user:password@github.com/guxingzhou16-pixel/Personal-Study-Assistant/releases/download/v0.1.2/StudyCompanion-0.1.2-win-x64-setup.exe',
  'https://github.com:444/guxingzhou16-pixel/Personal-Study-Assistant/releases/download/v0.1.2/StudyCompanion-0.1.2-win-x64-setup.exe',
])('rejects installer provenance outside the exact repository: %s', async (url) => {
  const data = release();
  data.assets[0].browser_download_url = url;
  await expect(fixture([data]).service.check()).rejects.toMatchObject({ code: 'updateData' });
});

it('deduplicates requests, caches success for five minutes and refreshes when explicitly requested', async () => {
  const { service, download, now } = fixture();
  const first = await Promise.all([service.check(), service.check(true)]);
  expect(download).toHaveBeenCalledOnce();
  expect(first[0]).toEqual(first[1]);
  first[0].release!.tag = 'v999.0.0';
  await service.open('latest');
  const cached = await service.check();
  expect(cached.release?.tag).toBe('v0.1.2');
  expect(download).toHaveBeenCalledOnce();
  now.mockReturnValue(Date.parse('2026-10-22T02:04:59Z'));
  await service.check();
  expect(download).toHaveBeenCalledOnce();
  now.mockReturnValue(Date.parse('2026-10-22T02:05:00Z'));
  await service.check();
  expect(download).toHaveBeenCalledTimes(2);
  await service.check(true);
  expect(download).toHaveBeenCalledTimes(3);
});

it('does not cache failures and preserves the last validated browser target after a refresh fails', async () => {
  const { service, download, openExternal } = fixture();
  download.mockRejectedValueOnce(new Error('offline'));
  await expect(service.check()).rejects.toMatchObject({ code: 'updateNetwork' });
  await expect(service.check()).resolves.toMatchObject({ status: 'available' });
  download.mockRejectedValueOnce(new Error('offline again'));
  await expect(service.check(true)).rejects.toMatchObject({ code: 'updateNetwork' });
  await service.open('latest');
  expect(openExternal).toHaveBeenLastCalledWith(`${repository}/releases/tag/v0.1.2`);
});

it.each([403, 429, 404, 500])(
  'reports HTTP %s as an explicit update error without clearing a known version',
  async (status) => {
    const { service, download } = fixture();
    download.mockResolvedValueOnce(new Response('upstream error', { status }));
    await expect(service.check()).rejects.toMatchObject({
      code: [403, 429].includes(status) ? 'updateRateLimit' : 'updateHttp',
    });
  },
);

it('rejects malformed root JSON and malformed release data instead of claiming there is no update', async () => {
  await expect(fixture({ message: 'not a release list' }).service.check()).rejects.toMatchObject({
    code: 'updateData',
  });
  const { service, download } = fixture();
  download.mockResolvedValueOnce(new Response('{invalid json'));
  await expect(service.check()).rejects.toMatchObject({ code: 'updateData' });
  await expect(fixture([null]).service.check()).rejects.toMatchObject({ code: 'updateData' });
  await expect(
    fixture([{ ...release(), published_at: 'not a date' }]).service.check(),
  ).rejects.toMatchObject({ code: 'updateData' });
});

it('bounds response bytes and cancels the stream when metadata is too large', async () => {
  const cancel = vi.fn();
  const data = new Uint8Array(512 * 1024 + 1);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
    },
    cancel,
  });
  const { service, download } = fixture();
  download.mockResolvedValueOnce(new Response(stream));
  await expect(service.check()).rejects.toMatchObject({ code: 'updateData' });
  expect(cancel).toHaveBeenCalledOnce();
});

it('limits notes as inert text and allows nullable GitHub name/body fields', async () => {
  const data = { ...release(), name: null, body: null };
  expect((await fixture([data]).service.check()).release).toMatchObject({
    name: 'v0.1.2',
    notes: '',
  });
  const withNotes = {
    ...release(),
    body:
      '<script>no execution</script>\n![image](https://outside.example/a.png)\n' +
      '中'.repeat(12000),
  };
  const result = (await fixture([withNotes]).service.check()).release!;
  expect(result.notes).toContain('<script>no execution</script>');
  expect([...result.notes].length).toBeLessThanOrEqual(8000);
});

it('aborts a hung request after fifteen seconds and ignores any late result', async () => {
  vi.useFakeTimers();
  const { service, download } = fixture();
  let finish!: (response: Response) => void;
  download.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = service.check();
  const rejected = expect(pending).rejects.toMatchObject({ code: 'updateTimeout' });
  await vi.advanceTimersByTimeAsync(15000);
  await rejected;
  expect(download.mock.calls[0][1].signal?.aborted).toBe(true);
  finish(response([release('9.0.0')]));
  await vi.advanceTimersByTimeAsync(1);
  await expect(service.check()).resolves.toMatchObject({ release: { version: '0.1.2' } });
});

it('also times out while the response body is stalled', async () => {
  vi.useFakeTimers();
  const { service, download } = fixture();
  const cancel = vi.fn();
  const stream = new ReadableStream({ cancel });
  download.mockResolvedValueOnce(new Response(stream));
  const pending = expect(service.check()).rejects.toMatchObject({ code: 'updateTimeout' });
  await vi.advanceTimersByTimeAsync(15000);
  await pending;
  expect(cancel).toHaveBeenCalledOnce();
});

it('validates renderer-facing flags and browser actions without accepting an arbitrary URL', async () => {
  const { service, download, openExternal } = fixture();
  await expect(service.check('yes' as never)).rejects.toMatchObject({ code: 'updateInput' });
  await expect(service.open('https://evil.example' as never)).rejects.toMatchObject({
    code: 'updateInput',
  });
  expect(download).not.toHaveBeenCalled();
  await service.open('history');
  expect(openExternal).toHaveBeenCalledExactlyOnceWith(`${repository}/releases`);
  openExternal.mockRejectedValueOnce(new Error('OS browser unavailable'));
  await expect(service.open('history')).rejects.toMatchObject({ code: 'updateOpen' });
});
