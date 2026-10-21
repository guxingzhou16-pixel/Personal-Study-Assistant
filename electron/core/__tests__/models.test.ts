import { createServer, type Server, type RequestListener } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { checkConnection } from '../models';
import { validateEndpoint } from '../settings';

const servers: Server[] = [];
async function service(handler: RequestListener) {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

describe('model connection checks', () => {
  it('requests Ollama tags and distinguishes missing models', async () => {
    let url = '';
    let authorization: string | undefined;
    const endpoint = await service((request, response) => {
      url = request.url ?? '';
      authorization = request.headers.authorization;
      response.end(JSON.stringify({ models: [{ name: 'qwen3:8b' }, { name: 'qwen3:8b' }] }));
    });
    const result = await checkConnection(
      'ollama',
      { baseUrl: endpoint, model: 'absent' },
      'must-not-be-sent',
    );
    expect(url).toBe('/api/tags');
    expect(authorization).toBeUndefined();
    expect(result.models).toEqual(['qwen3:8b']);
    expect(result.selectedModelAvailable).toBe(false);
    expect(result.message).toContain('找不到');
  });

  it('requests OpenAI models with authorization and preserves a base path', async () => {
    let authorization: string | undefined;
    let url = '';
    const endpoint = await service((request, response) => {
      authorization = request.headers.authorization;
      url = request.url ?? '';
      response.end(JSON.stringify({ data: [{ id: 'local-test-model' }] }));
    });
    const result = await checkConnection(
      'openai',
      { baseUrl: `${endpoint}/v1/`, model: 'local-test-model' },
      'fake-test-key',
    );
    expect(url).toBe('/v1/models');
    expect(authorization).toBe('Bearer fake-test-key');
    expect(result.selectedModelAvailable).toBe(true);
  });

  it.each([
    [401, 'authentication'],
    [403, 'authentication'],
    [404, 'address'],
    [429, 'rateLimit'],
    [503, 'service'],
  ])('reports HTTP %s accurately', async (status, code) => {
    const endpoint = await service((_request, response) => {
      response.statusCode = Number(status);
      response.end();
    });
    await expect(checkConnection('openai', { baseUrl: endpoint, model: '' })).rejects.toMatchObject(
      { code },
    );
  });

  it('does not turn malformed responses or empty model lists into model availability', async () => {
    const badEndpoint = await service((_request, response) => response.end('<html>login</html>'));
    await expect(
      checkConnection('ollama', { baseUrl: badEndpoint, model: '' }),
    ).rejects.toMatchObject({ code: 'responseFormat' });
    const emptyEndpoint = await service((_request, response) => response.end('{"models":[]}'));
    const result = await checkConnection('ollama', { baseUrl: emptyEndpoint, model: 'qwen3:8b' });
    expect(result.selectedModelAvailable).toBe(false);
    expect(result.message).toContain('没有返回模型');
  });

  it('reports timeout and refuses redirects that might forward credentials', async () => {
    const slowEndpoint = await service(() => {});
    await expect(
      checkConnection('ollama', { baseUrl: slowEndpoint, model: '' }, undefined, 30),
    ).rejects.toMatchObject({ code: 'timeout' });
    const redirectEndpoint = await service((_request, response) => {
      response.writeHead(302, { Location: 'https://example.com' });
      response.end();
    });
    await expect(
      checkConnection('openai', { baseUrl: redirectEndpoint, model: '' }, 'fake-key'),
    ).rejects.toMatchObject({ code: 'unreachable' });
  });

  it('rejects secret-bearing addresses and remote plain HTTP', () => {
    for (const url of [
      'file:///etc/passwd',
      'https://user:pass@example.com',
      'https://example.com?key=secret',
      'https://example.com/#secret',
      'http://example.com',
    ])
      expect(() => validateEndpoint(url)).toThrow();
    expect(validateEndpoint(' http://localhost:11434/ ')).toBe('http://localhost:11434');
    expect(validateEndpoint('http://[::1]:11434')).toBe('http://[::1]:11434');
  });
});
