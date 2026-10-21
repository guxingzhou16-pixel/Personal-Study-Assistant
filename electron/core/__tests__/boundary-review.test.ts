import { expect, it } from 'vitest';
import { Storage } from '../storage';
import { fixtureSourceId, fixtureText } from '../../../tests/fixtures/legacy-databases';
it.each([['paper'], ['warm'], null, 1, {}, { toString: () => 'paper' }].map((tone) => ({ tone })))(
  'rejects non-string reading tone $tone without changing saved data',
  ({ tone }) => {
    const store = new Storage(':memory:');
    try {
      store.addSource({
        id: fixtureSourceId,
        name: '事务',
        kind: 'markdown',
        bytes: Buffer.byteLength(fixtureText),
        pageCount: 1,
        textStatus: 'ready',
        outline: [],
        segments: [],
      });
      const before = store.getSource(fixtureSourceId)!.position;
      expect(() => store.saveReadingPosition(fixtureSourceId, { ...before, tone })).toThrowError(
        expect.objectContaining({ code: 'readingPosition' }),
      );
      expect(store.getSource(fixtureSourceId)!.position).toEqual(before);
    } finally {
      store.close();
    }
  },
);
