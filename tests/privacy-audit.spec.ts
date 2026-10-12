import { randomUUID } from 'node:crypto';
import { test, expect, _electron as electron } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Storage } from '../electron/core/storage';
import { parseMarkdown } from '../electron/core/document-parser';
import { defaultSettings } from '../src/lib/types';
import { fixtureSourceId, fixtureText } from './fixtures/legacy-databases';

const artifacts = join('artifacts', 'final-acceptance-20261010-' + randomUUID());

test.beforeAll(() => {
  mkdirSync(artifacts, { recursive: true });
});

test('enforces remote memory scope, current preview consent and one request against a fake OpenAI endpoint', async () => {
  const root = mkdtempSync(join(tmpdir(), 'study-remote-privacy-'));
  const requests: { authorization: string | undefined; body: unknown }[] = [];
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const part of request) body += part;
    requests.push({ authorization: request.headers.authorization, body: JSON.parse(body) });
    response.setHeader('content-type', 'text/event-stream');
    response.end(
      'data: ' +
        JSON.stringify({
          choices: [
            {
              delta: {
                content: JSON.stringify({
                  limitations: '资料只有原子性规则，底层机制仍待求证。',
                  steps: ['核对原文', '写下理解与疑问'].map((title) => ({
                    title,
                    action: '对照全部提交或回滚的资料规则，写自己的例子。',
                    minutes: 15,
                    citations: [1],
                    artifact: '用户自己的理解与待求证问题',
                  })),
                }),
              },
            },
          ],
        }) +
        '\n\ndata: [DONE]\n\n',
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const transportEndpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  const endpoint = 'https://privacy.example.invalid/v1';
  mkdirSync(join(root, 'sources'));
  writeFileSync(join(root, 'sources', fixtureSourceId + '.md'), fixtureText);
  const store = new Storage(join(root, 'study-companion.sqlite3'));
  store.saveSettings({
    ...defaultSettings,
    displayName: 'PRIVATE_NICKNAME_SENTINEL',
    provider: 'openai',
    openai: { baseUrl: endpoint, model: 'fake' },
  });
  store.addSource({
    id: fixtureSourceId,
    name: '事务资料',
    kind: 'markdown',
    bytes: Buffer.byteLength(fixtureText),
    ...parseMarkdown(Buffer.from(fixtureText)),
  });
  const local = store.memories.save({
    id: null,
    revision: 0,
    title: '仅本机',
    content: 'LOCAL_PRIVATE_SENTINEL',
    kind: 'preference',
    scope: 'local',
  });
  const remote = store.memories.save({
    id: null,
    revision: 0,
    title: '选中的共享记忆',
    content: 'REMOTE_SELECTED_SENTINEL',
    kind: 'preference',
    scope: 'remote',
  });
  store.memories.save({
    id: null,
    revision: 0,
    title: '未勾选',
    content: 'UNSELECTED_SENTINEL',
    kind: 'preference',
    scope: 'remote',
  });
  store.close();
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  const app = await electron.launch({
    args: ['.'],
    env: { ...env, STUDY_COMPANION_DATA_DIR: root },
  });
  const outcomes: unknown[] = [];
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: /开始今天的小进步/ })).toBeVisible();
    // Only this test process maps the fake HTTPS provider to a loopback protocol server.
    // This verifies application privacy gates and real SSE handling, not TLS or a cloud service.
    await app.evaluate(
      (_electron, { endpoint, transportEndpoint }) => {
        const original = globalThis.fetch;
        globalThis.fetch = async (input, init) => {
          const url = String(input);
          if (!url.startsWith(endpoint + '/')) throw new Error('Unexpected model destination');
          return original(url.replace(endpoint, transportEndpoint), init);
        };
      },
      { endpoint, transportEndpoint },
    );
    const request = {
      goal: '验证事务原子性',
      query: '事务',
      sourceId: fixtureSourceId,
      minutes: 30,
    };
    const blocked = await page.evaluate(
      async ({ request, id }) => {
        try {
          await window.studyCompanion!.prepareLearningDraft(request, [id]);
          return null;
        } catch (error) {
          return (error as { code: string }).code;
        }
      },
      { request, id: local.id },
    );
    expect(blocked).toBeTruthy();
    expect(requests).toEqual([]);
    outcomes.push({ localScopeBlocked: blocked });
    await page.evaluate(
      ({ endpoint }) =>
        window.studyCompanion!.storeApiKey(endpoint, 'privacy-fake-key-not-a-real-secret'),
      { endpoint },
    );
    const preview = await page.evaluate(
      ({ request, id }) => window.studyCompanion!.prepareLearningDraft(request, [id]),
      { request, id: remote.id },
    );
    for (const consentEndpoint of [undefined, endpoint + '/wrong']) {
      const rejected = await page.evaluate(
        async ({ id, endpoint, consentEndpoint }) => {
          try {
            await window.studyCompanion!.sendLearningDraft({
              retrievalId: id,
              expectedProfile: `openai|${endpoint}|fake`,
              ...(consentEndpoint ? { consentEndpoint } : {}),
            });
            return null;
          } catch (error) {
            return (error as { code: string }).code;
          }
        },
        { id: preview.evidence.id, endpoint, consentEndpoint },
      );
      expect(rejected).toBe('remoteConsent');
      expect(requests).toEqual([]);
      outcomes.push({ consentEndpoint: consentEndpoint ?? 'missing', rejected });
    }
    const turn = await page.evaluate(
      ({ id, endpoint }) =>
        window.studyCompanion!.sendLearningDraft({
          retrievalId: id,
          expectedProfile: `openai|${endpoint}|fake`,
          consentEndpoint: endpoint,
        }),
      { id: preview.evidence.id, endpoint },
    );
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.studyCompanion!.listLearningDrafts()))[0].status,
      )
      .toBe('completed');
    expect(requests).toHaveLength(1);
    expect(requests[0].authorization).toBe('Bearer privacy-fake-key-not-a-real-secret');
    const payload = JSON.stringify(requests[0].body);
    expect(payload).toContain('REMOTE_SELECTED_SENTINEL');
    for (const forbidden of [
      'LOCAL_PRIVATE_SENTINEL',
      'UNSELECTED_SENTINEL',
      'PRIVATE_NICKNAME_SENTINEL',
      'originTurnId',
    ])
      expect(payload).not.toContain(forbidden);
    const repeated = await page.evaluate(
      async ({ id, endpoint }) => {
        try {
          await window.studyCompanion!.sendLearningDraft({
            retrievalId: id,
            expectedProfile: `openai|${endpoint}|fake`,
            consentEndpoint: endpoint,
          });
          return null;
        } catch (error) {
          return (error as { code: string }).code;
        }
      },
      { id: preview.evidence.id, endpoint },
    );
    expect(repeated).toBeTruthy();
    expect(requests).toHaveLength(1);
    const stale = await page.evaluate(
      ({ request, id }) => window.studyCompanion!.prepareLearningDraft(request, [id]),
      { request, id: remote.id },
    );
    await page.evaluate(async () => {
      const { settings } = await window.studyCompanion!.bootstrap();
      await window.studyCompanion!.saveSettings({
        ...settings,
        openai: { ...settings.openai, model: 'changed' },
      });
    });
    const changed = await page.evaluate(
      async ({ id, endpoint }) => {
        try {
          await window.studyCompanion!.sendLearningDraft({
            retrievalId: id,
            expectedProfile: `openai|${endpoint}|changed`,
            consentEndpoint: endpoint,
          });
          return null;
        } catch (error) {
          return (error as { code: string }).code;
        }
      },
      { id: stale.evidence.id, endpoint },
    );
    expect(changed).toBe('profileChanged');
    expect(requests).toHaveLength(1);
    writeFileSync(
      join(artifacts, 'privacy-desktop.json'),
      JSON.stringify(
        {
          root,
          endpoint,
          transportEndpoint,
          note: 'Fake HTTPS provider mapped only inside this Electron process to a loopback SSE server. Application privacy gates only; TLS and real cloud UNEXECUTED. Fake key only.',
          outcomes,
          preview,
          turn,
          requests,
          repeated,
          changed,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
    await new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
  }
});
