import { createServer, type Server, type RequestListener } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it } from 'vitest';
import { streamChat } from '../chat-stream';

const servers: Server[] = [];
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
async function serve(handler: RequestListener) {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
const messages = [{ role: 'user' as const, content: '解释闭包' }];

it('decodes split UTF-8 Ollama NDJSON, posts history and never sends a cloud key', async () => {
  let received: unknown;
  let authorization: string | undefined;
  const baseUrl = await serve(async (request, response) => {
    expect(request.url).toBe('/api/chat');
    authorization = request.headers.authorization;
    let body = '';
    for await (const chunk of request) body += chunk;
    received = JSON.parse(body);
    const bytes = Buffer.from(
      '{"message":{"content":"中文🙂"},"done":false}\n{"message":{"content":"回答"},"done":true}\n',
    );
    for (let i = 0; i < bytes.length; i += 2) {
      response.write(bytes.subarray(i, i + 2));
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    response.end();
  });
  let answer = '';
  const result = await streamChat(
    {
      provider: 'ollama',
      profile: { baseUrl, model: 'local' },
      key: 'fake-secret',
      messages,
      signal: new AbortController().signal,
    },
    (text) => {
      answer += text;
    },
  );
  expect(answer).toBe('中文🙂回答');
  expect(result.truncated).toBe(false);
  expect(authorization).toBeUndefined();
  expect(received).toMatchObject({ model: 'local', stream: true, messages });
});

it('reads OpenAI SSE comments, CRLF and deltas, preserves the base path and reports length limits', async () => {
  let authorization: string | undefined;
  const baseUrl = await serve((request, response) => {
    expect(request.url).toBe('/v1/chat/completions');
    authorization = request.headers.authorization;
    response.end(
      ': keepalive\r\n\r\ndata: {"choices":[{"index":0,"delta":{"role":"assistant"}}]}\r\n\r\ndata: {"choices":[{"index":0,"delta":{"content":"你好"},"finish_reason":null}]}\r\n\r\ndata: {"choices":[{"index":0,"delta":{},"finish_reason":"length"}]}\r\n\r\ndata: [DONE]\r\n\r\n',
    );
  });
  let answer = '';
  const result = await streamChat(
    {
      provider: 'openai',
      profile: { baseUrl: `${baseUrl}/v1`, model: 'compatible' },
      key: 'fake-key',
      messages,
      signal: new AbortController().signal,
    },
    (text) => {
      answer += text;
    },
  );
  expect(answer).toBe('你好');
  expect(result.truncated).toBe(true);
  expect(authorization).toBe('Bearer fake-key');
});

it.each(['ollama', 'openai'] as const)(
  'rejects unfinished %s streams while retaining received text',
  async (provider) => {
    const baseUrl = await serve((_request, response) =>
      response.end(
        provider === 'ollama'
          ? '{"message":{"content":"部分回答"},"done":false}\n'
          : 'data: {"choices":[{"delta":{"content":"部分回答"}}]}\n\n',
      ),
    );
    let answer = '';
    await expect(
      streamChat(
        {
          provider,
          profile: { baseUrl, model: 'model' },
          messages,
          signal: new AbortController().signal,
        },
        (text) => {
          answer += text;
        },
      ),
    ).rejects.toMatchObject({ code: 'streamIncomplete' });
    expect(answer).toBe('部分回答');
  },
);

it('stops a hanging response and closes the HTTP stream', async () => {
  let disconnected = false;
  const baseUrl = await serve((_request, response) => {
    response.on('close', () => {
      disconnected = true;
    });
    response.write('{"message":{"content":"开始"},"done":false}\n');
  });
  const controller = new AbortController();
  await expect(
    streamChat(
      {
        provider: 'ollama',
        profile: { baseUrl, model: 'model' },
        messages,
        signal: controller.signal,
      },
      () => controller.abort(),
    ),
  ).rejects.toMatchObject({ code: 'cancelled' });
  await expect.poll(() => disconnected).toBe(true);
});

it.each([401, 429, 500, 302])(
  'reports HTTP %s without exposing response bodies or following redirects',
  async (status) => {
    let requests = 0;
    const baseUrl = await serve((_request, response) => {
      requests++;
      response.writeHead(status, { Location: '/stolen' });
      response.end('private-server-secret');
    });
    await expect(
      streamChat(
        {
          provider: 'openai',
          profile: { baseUrl, model: 'model' },
          messages,
          signal: new AbortController().signal,
        },
        () => {},
      ),
    ).rejects.not.toThrow('private-server-secret');
    expect(requests).toBe(1);
  },
);

it.each(['not-json\n', '{"error":"private-error"}\n', '{"done":true}\n', 'x'.repeat(1_048_577)])(
  'rejects malformed, failed, empty and oversized streams',
  async (body) => {
    const baseUrl = await serve((_request, response) => response.end(body));
    await expect(
      streamChat(
        {
          provider: 'ollama',
          profile: { baseUrl, model: 'model' },
          messages,
          signal: new AbortController().signal,
        },
        () => {},
      ),
    ).rejects.toThrow();
  },
);
